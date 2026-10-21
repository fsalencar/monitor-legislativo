"""Projetos de autoria dos deputados estaduais de SP, com a situação oficial (dados abertos da ALESP).

Fontes (repositorioDados/processo_legislativo, atualizadas diariamente):
- proposituras.zip: projetos (natureza, número, ano, ementa);
- documento_autor.zip: autores de cada propositura (IdAutor = IdSPL de deputados.xml);
- documento_andamento.zip: toda a tramitação (~2,6 GB descompactado, lido em streaming).

A situação gravada é o texto oficial do andamento que define o desfecho, nesta ordem: lei (ou
resolução, decreto legislativo, emenda constitucional) publicada; veto total; rejeição; retirada
pelo autor; prejudicado; arquivo; senão, o último andamento (em tramitação).
Presença em plenário: API do portal da ALESP (lista de presença por deputado e mês).
Votações nominais: relatório oficial em PDF anexo a cada votação (API do portal), conferido com os
totais impressos no próprio relatório.
"""
import io
import os
import re
import tempfile
import time
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
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
LEGISLATURA_ATUAL = 20
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
    # Proposições votadas em plenário (muitas do Governador): também recebem a situação oficial.
    votadas = {r[0] for r in conn.execute(
        """select distinct pr.id_fonte from proposicao pr join votacao_proposicao vp on vp.proposicao_id = pr.id
           where pr.casa_id = %s""", (CASA,))}
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
        if sigla and (doc in autores or doc in votadas):
            props[doc] = (sigla, _texto(el, "NroLegislativo") or None, _texto(el, "AnoLegislativo") or None,
                          _texto(el, "Ementa") or None, _texto(el, "DtPublicacao")[:10] or None)
    print(f"  {len(props)} projetos (de deputados em exercício ou votados); lendo a tramitação…", flush=True)

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
                 for doc in lote for pid, nome in autores.get(doc, [])])
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
LICENCA = re.compile(r"^(licen|afastamento)", re.I)
URL_PRESENCA = "https://www.al.sp.gov.br/deputado/?matricula={}"


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
        r"""select p.id, substring(p.url_fonte from 'matricula=(\d+)') from parlamentar p
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
    # Linha do tempo de cada deputado: (data, tipo de licença ou None quando a sessão contou).
    linha_do_tempo: dict[int, list[tuple[date, str | None]]] = {}
    with ThreadPoolExecutor(6) as pool:
        for pid, itens in pool.map(buscar, tarefas):
            for s in itens:
                bruta = (s.get("situacao") or "").strip()
                d, m_, a = s["data"].split("/")
                dia = date(int(a), int(m_), int(d))
                if dia < desde:
                    continue
                if LICENCA.match(bruta):
                    linha_do_tempo.setdefault(pid, []).append((dia, bruta))
                situacao = _situacao_presenca(bruta)
                if situacao is None:
                    if not NAO_CONTA.match(bruta):
                        desconhecidas.add(bruta)
                    continue
                linha_do_tempo.setdefault(pid, []).append((dia, None))
                ids = str(s["idSessaoPlenaria"])
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
        # Afastamentos: a partir de `desde`, refeitos com os períodos de licença das listas de presença.
        cur.execute("delete from afastamento where parlamentar_id = any(%s) and coalesce(data_fim, data_inicio) >= %s",
                    ([pid for pid, _ in deputados], desde))
        cur.executemany(
            "insert into afastamento (parlamentar_id, data_inicio, data_fim, motivo, url_fonte) values (%s, %s, %s, %s, %s)",
            [(pid, ini, fim, motivo, URL_PRESENCA.format(mat))
             for pid, mat in deputados for ini, fim, motivo in _periodos(linha_do_tempo.get(pid, []))])
    return len(registros)


def _periodos(eventos: list[tuple[date, str | None]]) -> list[tuple[date, date, str]]:
    """Sessões seguidas com o mesmo tipo de licença viram um período (da 1ª à última dessas sessões)."""
    periodos = []
    for dia, licenca in sorted(eventos, key=lambda e: e[0]):
        if licenca and periodos and periodos[-1][2] == licenca and periodos[-1][3]:
            periodos[-1][1] = dia
        elif licenca:
            periodos.append([dia, dia, licenca, True])
        elif periodos:
            periodos[-1][3] = False  # sessão que contou interrompe a licença
    return [(ini, fim, motivo) for ini, fim, motivo, _ in periodos]


# ---------- Votações nominais do plenário (PDF anexo a cada votação) ----------

# Valores de voto no relatório oficial; "---" é quem não registrou voto (inclui quem preside: marca P).
LINHA_VOTO = re.compile(r"^(?P<nome>.+?) (?P<voto>Sim|Não|Obstrução|Abstenção|Licenciado|Em Branco|---)"
                        r"(?P<marca>[A-Z])? (?P<partido>\S.*)$")
TOTAIS = re.compile(r"(Votos Sim|Votos Não|Abstenção|Em Branco|Presidente|Total)\s+(\d+)")
RESULTADO = re.compile(r"\b(Aprovad[oa]|Rejeitad[oa])\b")
DATA_SESSAO = re.compile(r"de (\d{2})/(\d{2})/(\d{4}) às (\d{2}:\d{2}:\d{2})")
SIGLAS_PORTAL = {1: "PL", 2: "PLC", 3: "PR", 4: "PDL", 5: "PEC", 7: "REQ"}
_PARADA = {"DA", "DE", "DO", "DOS", "DAS", "E"}
# Nome parlamentar alterado durante a legislatura: o relatório usa o nome da época. Fabiana Barroso
# passou a usar "Fabiana Bolsonaro" em out/2023 (mesma pessoa; nome civil Fabiana de Lima Barroso Souza).
APELIDOS = {"FABIANA BARROSO": 300669}


def _tokens(nome: str) -> list[str]:
    s = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode().upper()
    return [t for t in re.split(r"[\s.]+", s) if t and t not in _PARADA]


def _casa_nome(do_relatorio: str, oficial: str) -> int:
    """3: igual; 2: cada palavra do relatório (abreviada ou não) aparece, em ordem, no nome oficial;
    iniciais de uma letra que não aparecem são toleradas (ex.: "CARLA S. MORANDO"); 0: não casa."""
    a, b = _tokens(do_relatorio), _tokens(oficial)
    if a == b:
        return 3
    j = 0
    for t in a:
        k = j
        while k < len(b) and not (b[k] == t or (len(t) <= 4 and b[k].startswith(t))):
            k += 1
        if k == len(b):
            if len(t) == 1:
                continue
            return 0
        j = k + 1
    return 2


def _ler_relatorio(conteudo: bytes) -> tuple[list[dict], dict, str | None, str | None]:
    import pypdf  # só este job precisa do leitor de PDF

    leitor = pypdf.PdfReader(io.BytesIO(conteudo))
    texto = "\n".join(p.extract_text() for p in leitor.pages)
    layout = "\n".join(p.extract_text(extraction_mode="layout") for p in leitor.pages)
    linhas, na_lista = [], False
    for linha in texto.splitlines():
        if linha.startswith("Parlamentar Partido Voto"):
            na_lista = True
        elif linha.startswith("Votos Sim"):
            na_lista = False
        elif na_lista and (m := LINHA_VOTO.match(linha.strip())):
            linhas.append(m.groupdict())
    totais = {k: int(n) for k, n in TOTAIS.findall(layout)}
    resultado = RESULTADO.search(layout)
    data = DATA_SESSAO.search(texto)
    quando = f"{data[3]}-{data[2]}-{data[1]} {data[4]}" if data else None
    return linhas, totais, resultado[1] if resultado else None, quando


def votacoes(conn: psycopg.Connection, desde_ano: int = 2023) -> int:
    """Votações nominais do plenário desde `desde_ano` ainda não gravadas.

    Só grava a votação se a contagem lida do PDF bater com os totais impressos no próprio
    relatório e se todos os nomes forem identificados; senão, avisa e pula.
    """
    http = httpx.Client(timeout=120, follow_redirects=True, headers={"User-Agent": "monitor-legislativo (ingestao)"})
    lista = [v for a in range(desde_ano, date.today().year + 1)
             for v in http.get(f"{URL_PORTAL}/votacao/{a}").raise_for_status().json()]
    feitas = {r[0] for r in conn.execute("select id_fonte from votacao where casa_id = %s", (CASA,))}
    pendentes = [v for v in lista if v.get("urlArquivoPrincipal")
                 and v["urlArquivoPrincipal"].rsplit("/", 1)[-1] not in feitas]
    # Parlamentares da legislatura atual (inclusive os que já saíram), para casar os nomes do relatório.
    todos = [p for p in http.get(f"{URL_PORTAL}/lista-presenca-parlamentar/parlamentares").raise_for_status().json()
             if LEGISLATURA_ATUAL in (p.get("listaLegislaturas") or [])]
    por_matricula = {p["nuMatricula"]: p for p in todos}
    ids = {int(m): pid for pid, m in conn.execute(
        r"""select id, substring(url_fonte from 'matricula=(\d+)') from parlamentar
            where casa_id = %s and url_fonte like '%%matricula=%%'""", (CASA,))}
    conn.commit()

    def identificar(nome: str) -> int | None:
        if nome in APELIDOS:
            return APELIDOS[nome]
        notas = [(_casa_nome(nome, p["txNomeParlamentar"]), p["nuMatricula"]) for p in todos]
        melhor = max((n for n, _ in notas), default=0)
        achados = [m for n, m in notas if n == melhor and n > 0]
        return achados[0] if len(achados) == 1 else None

    n = 0
    for v in pendentes:
        url = v["urlArquivoPrincipal"]
        linhas, totais, resultado, quando = _ler_relatorio(http.get(url).raise_for_status().content)
        cont = Counter(x["voto"] for x in linhas)
        if not linhas or not totais or any(cont[voto] != totais.get(rotulo, 0) for voto, rotulo in
                                           (("Sim", "Votos Sim"), ("Não", "Votos Não"), ("Abstenção", "Abstenção"),
                                            ("Em Branco", "Em Branco"))):
            print(f"  pulada (contagem não confere com os totais do relatório): {v['dataSessao']} {v['descricao']}")
            continue
        matriculas = {x["nome"]: identificar(x["nome"]) for x in linhas}
        if None in matriculas.values():
            print(f"  pulada (nomes não identificados {[k for k, m in matriculas.items() if m is None]}): {url}")
            continue
        for m in set(matriculas.values()) - set(ids):
            ids[m] = _parlamentar_que_saiu(conn, http, por_matricula[m])

        with conn.transaction(), conn.cursor() as cur:
            sigla = SIGLAS_PORTAL.get(v.get("idTipoProposicao"))
            prop_id = None
            if sigla and v.get("idProposicao") and v.get("numeroProposicao"):
                prop_id = cur.execute(
                    """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, url_fonte)
                       values (%s, %s, %s, %s, %s, %s, %s)
                       on conflict (casa_id, id_fonte) do update set ementa = coalesce(proposicao.ementa, excluded.ementa)
                       returning id""",
                    (CASA, str(v["idProposicao"]), sigla, v["numeroProposicao"], v.get("anoProposicao"),
                     v.get("ementaProposicao"), URL_PROPOSITURA.format(v["idProposicao"]))).fetchone()[0]
            votacao_id = cur.execute(
                """insert into votacao (casa_id, id_fonte, data_hora, data, descricao, tipo, aprovacao, sigla_orgao,
                                        url_fonte)
                   values (%s, %s, %s, %s, %s, 'nominal', %s, 'PLEN', %s)
                   on conflict (casa_id, id_fonte) do update set descricao = excluded.descricao
                   returning id""",
                (CASA, url.rsplit("/", 1)[-1], quando, v["dataSessao"],
                 f"{v.get('tituloSessao') or ''}: {v['descricao']}".strip(": "),
                 None if resultado is None else resultado.startswith("Aprovad"), url)).fetchone()[0]
            if prop_id:
                cur.execute("insert into votacao_proposicao values (%s, %s) on conflict do nothing",
                            (votacao_id, prop_id))
            cur.executemany(
                """insert into voto (votacao_id, parlamentar_id, voto, sigla_partido, uf) values (%s, %s, %s, %s, 'SP')
                   on conflict (votacao_id, parlamentar_id) do update set voto = excluded.voto""",
                [(votacao_id, ids[matriculas[x["nome"]]],
                  "Presidente" if x["voto"] == "---" and x["marca"] == "P"
                  else "Sem voto registrado" if x["voto"] == "---" else x["voto"],
                  x["partido"].strip()) for x in linhas])
        n += 1
        avisar()
    return n


def _parlamentar_que_saiu(conn: psycopg.Connection, http: httpx.Client, p: dict) -> int:
    """Grava quem votou na legislatura atual e não está mais em exercício (fica fora do plenário)."""
    matricula = p["nuMatricula"]
    detalhe = http.get(f"{URL_PORTAL}/parlamentar-portal/detalhes/{matricula}")
    d = detalhe.json() if detalhe.status_code == 200 else {}
    foto = ((d.get("biografia") or {}).get("txFotoGrande") or "").lstrip("/")
    url = f"https://www.al.sp.gov.br/deputado/?matricula={matricula}"
    with conn.transaction():
        pid = conn.execute(
            """insert into parlamentar (casa_id, id_fonte, nome, url_foto, url_fonte) values (%s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set url_fonte = excluded.url_fonte returning id""",
            (CASA, str(p["idParlamentar"]), d.get("txNomeParlamentar") or p["txNomeParlamentar"],
             f"https://www3.al.sp.gov.br/legis/{foto}" if foto else None, url)).fetchone()[0]
        conn.execute(
            """insert into mandato (parlamentar_id, casa_id, legislatura, sigla_partido, uf, em_exercicio, url_fonte)
               values (%s, %s, %s, %s, 'SP', false, %s) on conflict (parlamentar_id, legislatura) do nothing""",
            (pid, CASA, LEGISLATURA_ATUAL, d.get("txPartido"), url))
    return pid
