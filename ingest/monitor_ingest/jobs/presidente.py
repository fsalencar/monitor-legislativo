"""O que a Presidência da República enviou ao Congresso: projetos, medidas provisórias e vetos.

- Câmara (/proposicoes?autor=Poder Executivo, por ano e tipo): PL, PLP e PEC, que começam na Câmara.
- Senado (/processo?autor=Presidência da República, por ano): MPV, VET e PLN, que tramitam no
  Congresso Nacional (casa 'congresso').

O presidente não vota no Congresso; o site mostra estes itens e o desfecho de cada um.
"""
from datetime import date

import httpx
import psycopg

from ..camara import CamaraClient

AUTOR_CAMARA = "Poder Executivo"
AUTOR_SENADO = "Presidência da República"
TIPOS_CAMARA = ("PL", "PLP", "PEC")
TIPOS_CONGRESSO = {"MPV", "VET", "PLN"}
URL_CAMARA = "https://www.camara.leg.br/propostas-legislativas/{}"
URL_MATERIA = "https://www25.senado.leg.br/web/atividade/materias/-/materia/{}"


def _gravar(conn: psycopg.Connection, casa: str, autor: str, linhas: list[tuple]) -> int:
    """linhas: (id_fonte, sigla, numero, ano, ementa, data_apresentacao, situacao, url_texto, url_fonte, temas)."""
    if not linhas:
        return 0
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, data_apresentacao,
                                       situacao, url_inteiro_teor, url_fonte, palavras_chave)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 ementa = excluded.ementa, data_apresentacao = excluded.data_apresentacao,
                 situacao = excluded.situacao, url_inteiro_teor = coalesce(excluded.url_inteiro_teor, proposicao.url_inteiro_teor),
                 palavras_chave = coalesce(excluded.palavras_chave, proposicao.palavras_chave), atualizado_em = now()""",
            [(casa, *l) for l in linhas],
        )
        ids = dict(cur.execute("select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
                               (casa, [l[0] for l in linhas])).fetchall())
        cur.executemany(
            """insert into autoria (proposicao_id, nome_autor, tipo_autor, url_fonte)
               values (%s, %s, 'Poder Executivo', %s) on conflict (proposicao_id, nome_autor) do nothing""",
            [(ids[l[0]], autor, l[8]) for l in linhas],
        )
    return len(linhas)


def camara(conn: psycopg.Connection, api: CamaraClient, desde: int, ate: int) -> int:
    n = 0
    for ano in range(desde, ate + 1):
        for sigla in TIPOS_CAMARA:
            lista = list(api.paginate("/proposicoes", {"siglaTipo": sigla, "ano": ano, "autor": AUTOR_CAMARA}))
            detalhes = api.get_many([f"/proposicoes/{p['id']}" for p in lista], ignorar_404=True)
            linhas = [(str(d["id"]), d["siglaTipo"], d.get("numero"), d.get("ano"), d.get("ementa"),
                       (d.get("dataApresentacao") or "")[:10] or None,
                       (d.get("statusProposicao") or {}).get("descricaoSituacao"), d.get("urlInteiroTeor"),
                       URL_CAMARA.format(d["id"]), d.get("keywords") or None)
                      for d in detalhes if d]
            n += _gravar(conn, "camara", AUTOR_CAMARA, linhas)
            print(f"  câmara {sigla} {ano}: {len(linhas)}", flush=True)
    return n


def congresso(conn: psycopg.Connection, desde: int, ate: int) -> int:
    http = httpx.Client(base_url="https://legis.senado.leg.br/dadosabertos", timeout=180, follow_redirects=True,
                        headers={"Accept": "application/json", "User-Agent": "plenario-aberto (ingestao)"})
    n = 0
    for ano in range(desde, ate + 1):
        procs = http.get("/processo", params={"autor": AUTOR_SENADO, "ano": ano}).json()
        linhas = []
        for p in procs:
            sigla, _, resto = (p.get("identificacao") or "").partition(" ")
            numero, _, a = resto.partition("/")
            if sigla not in TIPOS_CONGRESSO or not (numero.isdigit() and a.isdigit()):
                continue
            url = URL_MATERIA.format(p["codigoMateria"]) if p.get("codigoMateria") else \
                f"https://legis.senado.leg.br/dadosabertos/processo/{p['id']}"
            linhas.append((str(p["id"]), sigla, int(numero), int(a), p.get("ementa"), p.get("dataApresentacao"),
                           (p.get("situacaoAtual") or "").capitalize() or None, p.get("urlDocumento"), url, None))
        n += _gravar(conn, "congresso", AUTOR_SENADO, linhas)
        print(f"  congresso {ano}: {len(linhas)}", flush=True)
    return n


def atualizar(conn: psycopg.Connection, desde: int = 2023) -> int:
    ate = date.today().year
    return camara(conn, CamaraClient(), desde, ate) + congresso(conn, desde, ate)
