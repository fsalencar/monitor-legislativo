"""Resumo em linguagem simples das proposições principais, gerado por IA a partir da ementa oficial.

O resumo é material derivado: o site sempre o rotula como gerado por IA e mostra a ementa
oficial ao lado. Só usa a ementa e os temas oficiais; refaz quando a ementa muda.

Usa o plano gratuito da API Gemini (GEMINI_API_KEY). A cota gratuita é pequena e muda com o
tempo: o job anda devagar (RESUMOS_INTERVALO segundos entre pedidos), espera quando bate o
limite por minuto e para sem erro quando acaba a cota do dia; a próxima execução continua de
onde parou, pelos projetos votados mais recentemente.
"""
import os
import re
import time

import psycopg
from google import genai
from google.genai import errors, types

from ..camara import CamaraClient

MODELO = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
INTERVALO = float(os.environ.get("RESUMOS_INTERVALO", "7"))  # ~8 pedidos por minuto
TIPOS = {
    "PL": "Projeto de Lei",
    "PLP": "Projeto de Lei Complementar",
    "PEC": "Proposta de Emenda à Constituição",
    "MPV": "Medida Provisória",
    "PLV": "Projeto de Lei de Conversão (texto de Medida Provisória alterado pelo Congresso)",
    "PDL": "Projeto de Decreto Legislativo",
    "PDC": "Projeto de Decreto Legislativo",
    "PRC": "Projeto de Resolução da Câmara",
    "PLN": "Projeto de Lei do Congresso Nacional",
}

SISTEMA = """Você escreve resumos em linguagem simples de proposições legislativas brasileiras para um site apartidário de transparência. O público é o cidadão comum, sem conhecimento jurídico.

Regras:
- Use apenas o que está na ementa e nos temas oficiais fornecidos. Não invente efeitos, valores, prazos, beneficiários ou justificativas que não estejam ali.
- Neutralidade total: não avalie, não elogie nem critique, não diga se é bom ou ruim, não atribua intenções a autores ou partidos.
- Diga o que a proposição muda, cria ou determina, em 1 ou 2 frases curtas, com no máximo 45 palavras.
- Troque jargão por palavras comuns. Em vez de citar número de lei, diga do que a lei trata quando a ementa ou os temas permitirem.
- Se a ementa for vaga demais para explicar, reescreva-a em palavras simples sem acrescentar nada.
- Responda só com o resumo, sem título, aspas ou prefixos."""


class CotaDiariaEsgotada(Exception):
    pass


def pendentes(conn: psycopg.Connection, limite: int) -> list[tuple]:
    """Proposições principais sem resumo (ou com ementa alterada), as votadas mais recentemente primeiro."""
    return conn.execute(
        """select p.id, p.id_fonte, p.sigla_tipo, p.numero, p.ano, p.ementa, p.palavras_chave
           from proposicao p
           left join lateral (
             select max(v.data_hora) as ultima, bool_or(v.tipo = 'nominal') as nominal
             from votacao_proposicao vp join votacao v on v.id = vp.votacao_id
             where vp.proposicao_id = p.id) u on true
           where p.casa_id = 'camara' and p.sigla_tipo = any(%s) and p.ementa is not null
             and (p.resumo_simples is null or p.resumo_simples_base is distinct from p.ementa)
           order by u.nominal desc nulls last, u.ultima desc nulls last
           limit %s""",
        (list(TIPOS), limite),
    ).fetchall()


def completar_temas(conn: psycopg.Connection, api: CamaraClient, itens: list[tuple], gravar: bool) -> list[tuple]:
    """Busca na API as palavras-chave das proposições carregadas antes de elas serem gravadas."""
    faltando = [i for i in itens if not i[6]]
    if not faltando:
        return itens
    detalhes = api.get_many([f"/proposicoes/{i[1]}" for i in faltando], ignorar_404=True)
    temas = {i[0]: (d or {}).get("keywords") or None for i, d in zip(faltando, detalhes)}
    if gravar:
        with conn.transaction():
            conn.cursor().executemany(
                "update proposicao set palavras_chave = %s where id = %s",
                [(t, pid) for pid, t in temas.items() if t],
            )
    return [i if i[6] else (*i[:6], temas.get(i[0])) for i in itens]


def resumir(client: genai.Client, item: tuple, tentativas: int = 4) -> str | None:
    """Resumo do item, ou None se o modelo não devolver texto utilizável."""
    _, _, sigla, numero, ano, ementa, temas = item
    pedido = (
        f"Tipo: {TIPOS.get(sigla, sigla)} ({sigla} {numero}/{ano})\n"
        f"Ementa oficial: {ementa}\n"
        f"Temas oficiais: {temas or 'não informados'}"
    )
    for tentativa in range(tentativas):
        try:
            resposta = client.models.generate_content(
                model=MODELO,
                contents=pedido,
                config=types.GenerateContentConfig(
                    system_instruction=SISTEMA, temperature=0.2, max_output_tokens=2048
                ),
            )
            texto = (resposta.text or "").strip()
            return texto or None
        except errors.APIError as e:
            if e.code != 429:
                if e.code >= 500 and tentativa < tentativas - 1:
                    time.sleep(10 * (tentativa + 1))
                    continue
                print(f"  {sigla} {numero}/{ano}: erro {e.code} ({e.message})")
                return None
            if "PerDay" in str(e.details or e.message):
                raise CotaDiariaEsgotada from e
            # Limite por minuto: espera o tempo sugerido pela API (ou 60 s) e tenta de novo.
            espera = re.search(r"retryDelay['\"]?:\s*['\"]?(\d+)", str(e.details))
            time.sleep(int(espera.group(1)) + 1 if espera else 60)
    return None


def gerar(conn: psycopg.Connection, limite: int, gravar: bool = True) -> list[tuple]:
    itens = completar_temas(conn, CamaraClient(), pendentes(conn, limite), gravar)
    client = genai.Client()  # lê GEMINI_API_KEY do ambiente
    feitos = []
    for n, item in enumerate(itens):
        if n:
            time.sleep(INTERVALO)
        try:
            resumo = resumir(client, item)
        except CotaDiariaEsgotada:
            print(f"cota diária gratuita esgotada após {len(feitos)} resumos; continua na próxima execução")
            break
        if not resumo:
            continue
        feitos.append((item, resumo))
        if gravar:
            conn.execute(
                """update proposicao set resumo_simples = %s, resumo_simples_modelo = %s,
                     resumo_simples_em = now(), resumo_simples_base = %s where id = %s""",
                (resumo, MODELO, item[5], item[0]),
            )
            conn.commit()
    return feitos
