"""Deputados estaduais em exercício nas Assembleias que publicam dados abertos.

- ALESP: repositorioDados/deputados/deputados.xml (todos os listados estão em exercício).
- ALMG: ws/deputados/em_exercicio e ws/deputados/{id} (com o histórico de legislaturas).
- SAPL (Interlegis: AM, PB, RO, AC, RR, TO): legislaturas, mandatos, filiações e parlamentares.
- ALES e ALEPE: só a lista atual (nome e partido), sem identificador; o nome faz as vezes de id.
"""
import re
import time
import unicodedata
from datetime import date
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

import httpx
import psycopg

# Legislatura atual de cada Assembleia (as fontes não têm um endpoint de legislaturas).
LEGISLATURA_SP = (20, "2023-03-15", "2027-03-14")
URL_ALESP = "https://www.al.sp.gov.br/repositorioDados/deputados/deputados.xml"
URL_ALMG = "https://dadosabertos.almg.gov.br/ws/deputados"
# API do portal da ALESP (a mesma que a página oficial do deputado usa para mostrar a foto).
URL_ALESP_DETALHES = "https://legis-api-portal-prd.al.sp.gov.br/parlamentar-portal/detalhes/{}"
FOTO_ALESP = "https://www3.al.sp.gov.br/legis/{}"
FOTO_ALMG = "https://www.almg.gov.br/export/sites/portal/a-assembleia/deputados/fotos/{}.jpg"
URL_ALES = "https://www.al.es.gov.br/DadosAbertos/ParlamentaresData"
URL_ALEPE = "https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares/"
# Legislaturas de ES e PE (as fontes só dão a lista atual).
LEGISLATURA_ES = (20, "2023-02-01", "2027-01-31")
LEGISLATURA_PE = (20, "2023-02-01", "2027-01-31")
SAPL = {
    "al-am": "https://sapl.al.am.leg.br",
    "al-pb": "https://sapl.al.pb.leg.br",
    "al-ro": "https://sapl.al.ro.leg.br",
    "al-ac": "https://sapl.al.ac.leg.br",
    "al-rr": "https://sapl.al.rr.leg.br",
    "al-to": "https://sapl.al.to.leg.br",
}
# Cada fonte grafa as siglas do seu jeito; padroniza para a forma usada no Congresso.
SIGLAS = {"REP": "REPUBLICANOS", "UNIAO": "UNIÃO", "UNIÃO BRASIL": "UNIÃO", "PODEMOS": "PODE",
          "PC DO B": "PCdoB", "PCDOB": "PCdoB"}


def _sigla(s: str | None) -> str | None:
    s = re.sub(r"\s+", " ", (s or "").strip())
    if not s:
        return None
    return SIGLAS.get(s.upper(), s if s == "PCdoB" else s.upper())


CADEIRAS = {"al-sp": 94, "al-mg": 77, "al-am": 24, "al-pb": 36, "al-ro": 24, "al-ac": 24, "al-rr": 24,
            "al-to": 24, "al-es": 30, "al-pe": 49}


def _cliente() -> httpx.Client:
    return httpx.Client(timeout=90, follow_redirects=True,
                        headers={"User-Agent": "monitor-legislativo (ingestao)", "Accept": "application/json"})


def _json(http: httpx.Client, url: str, tentativas: int = 5) -> dict:
    """GET com novas tentativas: a ALMG às vezes devolve uma página de erro (não JSON) sob carga."""
    for t in range(tentativas):
        # Mescla com a query string da URL (params= sozinho a substituiria, perdendo a paginação).
        r = http.get(httpx.URL(url).copy_merge_params({"formato": "json"}))
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
            return r.json()
        time.sleep(2 * (t + 1))
    r.raise_for_status()
    raise RuntimeError(f"resposta não-JSON de {url}: {r.text[:120]!r}")


def _gravar(conn: psycopg.Connection, casa: str, legislaturas: list[tuple], deputados: list[dict]) -> int:
    """deputados: dicts com id_fonte, nome, nome_civil, sexo, foto, url, partido, mandatos [(leg, em_exercicio)]."""
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into legislatura (casa_id, numero, data_inicio, data_fim, url_fonte)
               values (%s, %s, %s, %s, %s) on conflict (casa_id, numero) do nothing""",
            [(casa, *l) for l in legislaturas])
        cur.executemany(
            """insert into parlamentar (casa_id, id_fonte, nome, nome_civil, sexo, url_foto, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 nome = excluded.nome, nome_civil = coalesce(excluded.nome_civil, parlamentar.nome_civil),
                 sexo = coalesce(excluded.sexo, parlamentar.sexo), url_foto = coalesce(excluded.url_foto, parlamentar.url_foto),
                 url_fonte = excluded.url_fonte, atualizado_em = now()""",
            [(casa, d["id_fonte"], d["nome"], d.get("nome_civil"), d.get("sexo"), d.get("foto"), d["url"])
             for d in deputados])
        ids = dict(cur.execute("select id_fonte, id from parlamentar where casa_id = %s", (casa,)).fetchall())
        cur.executemany(
            """insert into mandato (parlamentar_id, casa_id, legislatura, sigla_partido, uf, url_fonte)
               values (%s, %s, %s, %s, %s, %s)
               on conflict (parlamentar_id, legislatura) do update set
                 sigla_partido = coalesce(excluded.sigla_partido, mandato.sigla_partido), atualizado_em = now()""",
            [(ids[d["id_fonte"]], casa, leg, _sigla(partido), casa[-2:].upper(), d["url"])
             for d in deputados for leg, partido in d["mandatos"]])
        atuais = [ids[d["id_fonte"]] for d in deputados]
        # Proteção: não mexe no plenário se a lista vier muito incompleta.
        if len(atuais) >= CADEIRAS[casa] * 0.85:
            leg_atual = max(l[0] for l in legislaturas)
            cur.execute("update mandato set em_exercicio = false where casa_id = %s and em_exercicio", (casa,))
            cur.execute("""update mandato set em_exercicio = true
                           where casa_id = %s and legislatura = %s and parlamentar_id = any(%s)""",
                        (casa, leg_atual, atuais))
        else:
            print(f"AVISO: só {len(atuais)} deputados em exercício em {casa}; plenário não atualizado")
    return len(deputados)


def alesp(conn: psycopg.Connection) -> int:
    raiz = ET.fromstring(_cliente().get(URL_ALESP).content)
    deputados = []
    for d in raiz.iter("Deputado"):
        if (d.findtext("Situacao") or "").strip() != "EXE":
            continue
        matricula = (d.findtext("Matricula") or "").strip()
        deputados.append({
            "id_fonte": (d.findtext("IdDeputado") or "").strip(),
            "nome": (d.findtext("NomeParlamentar") or "").strip(),
            "url": f"https://www.al.sp.gov.br/deputado/?matricula={matricula}",
            "mandatos": [(LEGISLATURA_SP[0], (d.findtext("Partido") or "").strip() or None)],
        })
    with ThreadPoolExecutor(4) as pool:
        fotos = list(pool.map(_foto_alesp, [d["url"].rsplit("=", 1)[1] for d in deputados]))
    for d, foto in zip(deputados, fotos):
        d["foto"] = foto
    return _gravar(conn, "al-sp", [(*LEGISLATURA_SP, URL_ALESP)], deputados)


def _foto_alesp(matricula: str) -> str | None:
    """URL da foto oficial; sem foto (ou com a API fora do ar) fica a que já estava gravada."""
    try:
        r = _cliente().get(URL_ALESP_DETALHES.format(matricula))
        caminho = ((r.json() or {}).get("biografia") or {}).get("txFotoGrande") if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        return None
    return FOTO_ALESP.format(caminho.lstrip("/")) if caminho else None


def almg(conn: psycopg.Connection) -> int:
    http = _cliente()
    lista = _json(http, f"{URL_ALMG}/em_exercicio")["list"]
    with ThreadPoolExecutor(3) as pool:
        detalhes = list(pool.map(lambda d: _json(http, f"{URL_ALMG}/{d['id']}")["deputado"], lista))
    legislaturas, deputados = {}, []
    for d in detalhes:
        mandatos = []
        for l in d.get("legislaturas") or []:
            num = int(l["numeroLegislatura"])
            ini = (l.get("inicioLegislatura") or {}).get("$")
            fim = (l.get("terminoLegislatura") or {}).get("$")
            if ini:
                legislaturas[num] = (num, ini[:10], fim[:10] if fim else None, f"{URL_ALMG}/{d['id']}")
            mandatos.append((num, None))
        atual = max((n for n, _ in mandatos), default=None)
        # O partido atual vale para a legislatura atual; de legislaturas antigas a fonte não dá a sigla.
        mandatos = [(n, d.get("partido") if n == atual else None) for n, _ in mandatos]
        deputados.append({
            "id_fonte": str(d["id"]), "nome": d["nome"], "nome_civil": d.get("nomeServidor"),
            "sexo": {"M": "M", "F": "F"}.get(d.get("sexo")), "foto": FOTO_ALMG.format(d["id"]),
            "url": f"https://www.almg.gov.br/deputados/conheca_deputados/deputados-info.html?idDep={d['id']}",
            "mandatos": mandatos,
        })
    return _gravar(conn, "al-mg", sorted(legislaturas.values()), deputados)


# ---------- SAPL ----------

def _sapl_todos(http: httpx.Client, base: str, caminho: str) -> list[dict]:
    """Todas as páginas de um endpoint de listagem do SAPL."""
    itens, pagina = [], 1
    sep = "&" if "?" in caminho else "?"
    while True:
        r = _json(http, f"{base}{caminho}{sep}page_size=100&page={pagina}")
        itens += r["results"]
        if not r["pagination"].get("next_page"):
            return itens
        pagina += 1


def _https(url: str | None) -> str | None:
    return re.sub(r"^http://", "https://", url) if url else None


def sapl(conn: psycopg.Connection, casa: str) -> int:
    """Deputados em exercício: mandato da legislatura atual vigente hoje, sem afastamento, de parlamentar ativo.

    Alguns SAPL não encerram o mandato do suplente quando o titular volta; se sobrar gente além das
    cadeiras, ficam os titulares.
    """
    base, http, hoje = SAPL[casa], _cliente(), date.today().isoformat()
    legs = _sapl_todos(http, base, "/api/parlamentares/legislatura/?o=-numero")
    atual = next(l for l in legs if l["data_inicio"] <= hoje <= (l["data_fim"] or "9999"))
    mandatos = _sapl_todos(http, base, f"/api/parlamentares/mandato/?legislatura={atual['id']}")
    ativos = {p["id"]: p for p in _sapl_todos(http, base, "/api/parlamentares/parlamentar/?ativo=True")}
    vigentes = {m["parlamentar"]: m for m in mandatos
                if (m["data_inicio_mandato"] or "") <= hoje <= (m["data_fim_mandato"] or "9999")
                and not m.get("tipo_afastamento") and m["parlamentar"] in ativos}
    if len(vigentes) > CADEIRAS[casa]:
        vigentes = {k: m for k, m in vigentes.items() if m["titular"]}
    partidos = {p["id"]: p["sigla"] for p in _sapl_todos(http, base, "/api/parlamentares/partido/")}
    filiacoes = {}
    for f in _sapl_todos(http, base, "/api/parlamentares/filiacao/?data_desfiliacao__isnull=True"):
        if f["data_desfiliacao"] is None and f["parlamentar"] in vigentes:
            filiacoes[f["parlamentar"]] = partidos.get(f["partido"])
    deputados = []
    for pid in vigentes:
        p = ativos[pid]
        deputados.append({
            "id_fonte": str(pid), "nome": p["nome_parlamentar"].strip(), "nome_civil": p.get("nome_completo"),
            "sexo": {"M": "M", "F": "F"}.get(p.get("sexo")), "foto": _https(p.get("fotografia")),
            "url": f"{base}/parlamentar/{pid}", "mandatos": [(atual["numero"], filiacoes.get(pid))],
        })
    leg = (atual["numero"], atual["data_inicio"], atual["data_fim"], f"{base}/api/parlamentares/legislatura/{atual['id']}/")
    return _gravar(conn, casa, [leg], deputados)


# ---------- Listas sem identificador (ALES, ALEPE) ----------

def _slug(nome: str) -> str:
    sem_acento = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def _lista_simples(conn: psycopg.Connection, casa: str, legislatura: tuple, url: str,
                   itens: list[tuple[str, str | None]]) -> int:
    deputados = [{"id_fonte": _slug(nome), "nome": nome.strip(), "url": url,
                  "mandatos": [(legislatura[0], (partido or "").strip() or None)]}
                 for nome, partido in itens if nome and nome.strip()]
    return _gravar(conn, casa, [(*legislatura, url)], deputados)


def ales(conn: psycopg.Connection) -> int:
    lista = _cliente().get(URL_ALES).raise_for_status().json()
    return _lista_simples(conn, "al-es", LEGISLATURA_ES, "https://www.al.es.gov.br/Deputado/Lista",
                          [(d.get("nmPolitico"), d.get("tx_partido_sigla")) for d in lista])


def alepe(conn: psycopg.Connection) -> int:
    lista = _cliente().get(URL_ALEPE).raise_for_status().json()
    return _lista_simples(conn, "al-pe", LEGISLATURA_PE, URL_ALEPE,
                          [(d.get("nomeParlamentar"), d.get("partido")) for d in lista])


def todas(conn: psycopg.Connection) -> int:
    """Atualiza cada Assembleia; a falha de uma fonte não impede as outras."""
    n, falhas = 0, []
    jobs = [("al-sp", alesp), ("al-mg", almg), ("al-es", ales), ("al-pe", alepe)]
    jobs += [(casa, lambda c, casa=casa: sapl(c, casa)) for casa in SAPL]
    for casa, job in jobs:
        try:
            k = job(conn)
            print(f"  {casa}: {k} deputados", flush=True)
            n += k
        except Exception as e:  # noqa: BLE001 - registra e segue para a próxima fonte
            conn.rollback()
            falhas.append(casa)
            print(f"  {casa}: falhou ({e!r})"[:300], flush=True)
    if falhas and len(falhas) == len(jobs):
        raise RuntimeError("todas as fontes estaduais falharam")
    return n
