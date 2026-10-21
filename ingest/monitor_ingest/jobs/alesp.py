"""Projetos de autoria dos deputados estaduais de SP, com a situação oficial (dados abertos da ALESP).

Fontes (repositorioDados/processo_legislativo, atualizadas diariamente):
- proposituras.zip: projetos (natureza, número, ano, ementa);
- documento_autor.zip: autores de cada propositura (IdAutor = IdSPL de deputados.xml);
- documento_andamento.zip: toda a tramitação (~2,6 GB descompactado, lido em streaming).

A situação gravada é o texto oficial do andamento que define o desfecho, nesta ordem: lei (ou
resolução, decreto legislativo, emenda constitucional) publicada; veto total; rejeição; retirada
pelo autor; prejudicado; arquivo; senão, o último andamento (em tramitação).
Presença em plenário: API do portal da ALESP (lista de presença por deputado e mês). Os votos
nominais só existem em PDF anexo a cada votação e não são importados.
"""
import os
import re
import tempfile
import time
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import httpx
import psycopg

from ..site import avisar

CASA = "al-sp"
URL_DADOS = "https://www.al.sp.gov.br/repositorioDados/processo_legislativo/{}.zip"
URL_DEPUTADOS = "https://www.al.sp.gov.br/repositorioDados/deputados/deputados.xml"
URL_PROPOSITURA = "https://www.al.sp.gov.br/propositura/?id={}"
# Naturezas (naturezasSpl.xml) que são projetos de fato.
NATUREZAS = {"1": "PL", "2": "PLC", "3": "PR", "4": "PDL", "5": "PEC"}

# Caracteres de controle que tornam o XML da ALESP inválido em alguns registros.
_INVALIDOS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

LEI = re.compile(r"^publicad[ao] (a lei|a resolução|o decreto legislativo|a emenda constitucional|a emenda à constituição)", re.I)
VETO_TOTAL = re.compile(r"opondo veto total", re.I)
REJEICAO = re.compile(r"\brejeitad[oa] (o projeto|a proposta|o pdl|o pl\b)", re.I)
RETIRADA = re.compile(r"deferid[oa]s?\b.*pedidos? de retirada", re.I)
NAO_E_RETIRADA = re.compile(r"assinatura|coautoria|ordem do dia|pauta|urgência|regime", re.I)
PREJUDICADO = re.compile(r"prejudicad[oa] (o|a) (projeto|proposta|pl|plc|pdl|pec|pr)\b", re.I)


def _baixar(http: httpx.Client, url: str) -> str:
    destino = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with http.stream("GET", url) as r, destino:
        r.raise_for_status()
        for bloco in r.iter_bytes(1 << 20):
            destino.write(bloco)
    return destino.name


def _elementos(caminho_zip: str, tag: str) -> Iterator[ET.Element]:
    """Elementos `tag` do XML dentro do zip, um a um, sem carregar o arquivo inteiro."""
    try:
        with zipfile.ZipFile(caminho_zip) as z, z.open(z.namelist()[0]) as f:
            p = ET.XMLPullParser(["end"])
            while bloco := f.read(1 << 20):
                p.feed(_INVALIDOS.sub(" ", bloco.decode("utf-8", errors="ignore")).encode("utf-8"))
                for _, el in p.read_events():
                    if el.tag == tag:
                        yield el
                        el.clear()
    finally:
        os.unlink(caminho_zip)


def _texto(el: ET.Element, campo: str) -> str:
    return (el.findtext(campo) or "").strip()


def autorias(conn: psycopg.Connection) -> int:
    http = httpx.Client(timeout=300, follow_redirects=True, headers={"User-Agent": "monitor-legislativo (ingestao)"})

    # IdSPL (autor) -> id interno, para os deputados que estão no banco.
    ids = dict(conn.execute("select id_fonte, id from parlamentar where casa_id = %s", (CASA,)).fetchall())
    conn.commit()
    por_spl = {}
    for d in ET.fromstring(http.get(URL_DEPUTADOS).content).iter("Deputado"):
        if _texto(d, "IdDeputado") in ids and _texto(d, "IdSPL"):
            por_spl[_texto(d, "IdSPL")] = ids[_texto(d, "IdDeputado")]

    autores: dict[str, list[tuple[int, str]]] = {}
    for el in _elementos(_baixar(http, URL_DADOS.format("documento_autor")), "DocumentoAutor"):
        pid = por_spl.get(_texto(el, "IdAutor"))
        if pid:
            autores.setdefault(_texto(el, "IdDocumento"), []).append((pid, _texto(el, "NomeAutor")))

    props = {}
    for el in _elementos(_baixar(http, URL_DADOS.format("proposituras")), "propositura"):
        doc, sigla = _texto(el, "IdDocumento"), NATUREZAS.get(_texto(el, "IdNatureza"))
        if sigla and doc in autores:
            props[doc] = (sigla, _texto(el, "NroLegislativo") or None, _texto(el, "AnoLegislativo") or None,
                          _texto(el, "Ementa") or None, _texto(el, "DtPublicacao")[:10] or None)
    print(f"  {len(props)} projetos de deputados em exercício; lendo a tramitação…", flush=True)

    marcos: dict[str, dict[str, str]] = {}
    ultimo: dict[str, tuple] = {}
    for el in _elementos(_baixar(http, URL_DADOS.format("documento_andamento")), "DocumentoAndamento"):
        doc = _texto(el, "IdDocumento")
        if doc not in props:
            continue
        desc = re.sub(r"\s+", " ", _texto(el, "Descricao"))
        chave = (_texto(el, "Data"), int(_texto(el, "NrOrdem") or 0))
        if doc not in ultimo or chave >= ultimo[doc][0]:
            ultimo[doc] = (chave, desc, _texto(el, "NmEtapa"))
        m = marcos.setdefault(doc, {})
        for nome, padrao in (("lei", LEI), ("veto", VETO_TOTAL), ("rejeicao", REJEICAO),
                             ("prejudicado", PREJUDICADO)):
            if nome not in m and padrao.search(desc):
                m[nome] = desc
        if "retirada" not in m and RETIRADA.search(desc) and not NAO_E_RETIRADA.search(desc):
            m["retirada"] = desc

    def situacao(doc: str) -> str | None:
        m = marcos.get(doc, {})
        for nome in ("lei", "veto", "rejeicao", "retirada", "prejudicado"):
            if nome in m:
                return m[nome]
        if doc in ultimo:
            _, desc, etapa = ultimo[doc]
            return f"Arquivo - {desc}" if etapa == "Arquivo" and not desc.lower().startswith("arquivo") else desc
        return None

    docs = list(props)
    n = 0
    for i in range(0, len(docs), 1000):
        lote = docs[i:i + 1000]
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(
                """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, data_apresentacao,
                                           url_fonte, situacao)
                   values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   on conflict (casa_id, id_fonte) do update set
                     sigla_tipo = excluded.sigla_tipo, numero = excluded.numero, ano = excluded.ano,
                     ementa = excluded.ementa, data_apresentacao = excluded.data_apresentacao,
                     situacao = excluded.situacao, atualizado_em = now()""",
                [(CASA, doc, *props[doc][:4], props[doc][4], URL_PROPOSITURA.format(doc), situacao(doc))
                 for doc in lote])
            ids_prop = dict(cur.execute("select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
                                        (CASA, lote)).fetchall())
            cur.executemany(
                """insert into autoria (proposicao_id, parlamentar_id, nome_autor, tipo_autor, url_fonte)
                   values (%s, %s, %s, 'Deputado(a)', %s)
                   on conflict (proposicao_id, nome_autor) do update set parlamentar_id = excluded.parlamentar_id""",
                [(ids_prop[doc], pid, nome, URL_PROPOSITURA.format(doc))
                 for doc in lote for pid, nome in autores[doc]])
        n += len(lote)
        avisar()
    return n


# ---------- Presença em plenário (API do portal da ALESP) ----------

URL_PORTAL = "https://legis-api-portal-prd.al.sp.gov.br"
URL_SESSAO = URL_PORTAL + "/sessoes-plenarias/{}"
# Situações da lista de presença -> (situação no site, justificativa). Missão oficial conta como
# ausência justificada, com o motivo oficial. Licenças e afastamentos não contam (o deputado estava
# licenciado, como na Câmara); sessões não deliberativas também não.
SITUACOES = {"Presente": ("Presença", None), "Justificada": ("Ausência justificada", None),
             "Não Justificada": ("Ausência", None)}
MISSAO = ("A Serviço do Poder Legislativo", "Em Audiência Pública", "Em Comissão Parlamentar de Inquérito",
          "Em Comissão de Representação")
NAO_CONTA = re.compile(r"^(sessão não deliberativa|licen|afastamento|indefinida)", re.I)


def _situacao_presenca(bruta: str) -> tuple[str, str | None] | None:
    """None quando a sessão não conta para o deputado ou a situação é desconhecida."""
    if bruta in SITUACOES:
        return SITUACOES[bruta]
    if bruta in MISSAO:
        return "Ausência justificada", bruta
    if bruta.lower().startswith(("ausência", "ausente")):
        return "Ausência", None
    return None


def presencas(conn: psycopg.Connection, desde: date) -> int:
    """Presença de cada deputado em exercício nas sessões deliberativas do plenário, mês a mês."""
    http = httpx.Client(timeout=60, follow_redirects=True, headers={"User-Agent": "monitor-legislativo (ingestao)"})
    deputados = conn.execute(
        """select p.id, substring(p.url_fonte from 'matricula=(\d+)') from parlamentar p
           join mandato m on m.parlamentar_id = p.id where m.casa_id = %s and m.em_exercicio""", (CASA,)).fetchall()
    conn.commit()
    hoje = date.today()
    meses = [(a, m) for a in range(desde.year, hoje.year + 1) for m in range(1, 13)
             if (a, m) >= (desde.year, desde.month) and (a, m) <= (hoje.year, hoje.month)]

    def buscar(tarefa):
        pid, matricula, (ano, mes) = tarefa
        for tentativa in range(4):
            try:
                r = http.get(f"{URL_PORTAL}/lista-presenca-parlamentar/{matricula}/{mes}/{ano}")
                if r.status_code == 200:
                    return pid, r.json() or []
            except (httpx.HTTPError, ValueError):
                pass
            time.sleep(2 * (tentativa + 1))
        raise RuntimeError(f"lista de presença indisponível: matrícula {matricula}, {mes}/{ano}")

    tarefas = [(pid, mat, am) for pid, mat in deputados if mat for am in meses]
    sessoes, registros, desconhecidas = {}, [], set()
    with ThreadPoolExecutor(6) as pool:
        for pid, itens in pool.map(buscar, tarefas):
            for s in itens:
                bruta = (s.get("situacao") or "").strip()
                situacao = _situacao_presenca(bruta)
                if situacao is None:
                    if not NAO_CONTA.match(bruta):
                        desconhecidas.add(bruta)
                    continue
                ids = str(s["idSessaoPlenaria"])
                d, m_, a = s["data"].split("/")
                if date(int(a), int(m_), int(d)) < desde:
                    continue
                sessoes[ids] = (f"{a}-{m_}-{d}", (s.get("tituloSessaoPlenaria") or "").split("ª ", 1)[-1] or None)
                registros.append((ids, pid, *situacao))
    if desconhecidas:
        print(f"AVISO: situações de presença não reconhecidas (não gravadas): {sorted(desconhecidas)}", flush=True)

    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into sessao (casa_id, id_fonte, data_inicio, tipo, deliberativa, url_fonte)
               values (%s, %s, %s, %s, true, %s)
               on conflict (casa_id, id_fonte) do update set data_inicio = excluded.data_inicio, tipo = excluded.tipo""",
            [(CASA, ids, data, tipo, URL_SESSAO.format(ids)) for ids, (data, tipo) in sessoes.items()])
        ids_sessao = dict(cur.execute("select id_fonte, id from sessao where casa_id = %s and id_fonte = any(%s)",
                                      (CASA, list(sessoes))).fetchall())
        cur.execute("delete from presenca where sessao_id = any(%s) and parlamentar_id = any(%s)",
                    (list(ids_sessao.values()), [pid for pid, _ in deputados]))
        cur.executemany(
            """insert into presenca (sessao_id, parlamentar_id, situacao, justificativa)
               values (%s, %s, %s, %s) on conflict do nothing""",
            [(ids_sessao[ids], pid, sit, just) for ids, pid, sit, just in registros])
    return len(registros)
