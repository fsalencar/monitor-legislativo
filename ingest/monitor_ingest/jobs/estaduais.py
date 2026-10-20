"""Deputados estaduais em exercício: ALESP (São Paulo) e ALMG (Minas Gerais).

- ALESP: repositorioDados/deputados/deputados.xml (todos os listados estão em exercício).
- ALMG: ws/deputados/em_exercicio e ws/deputados/{id} (com o histórico de legislaturas).
"""
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

import httpx
import psycopg

# Legislatura atual de cada Assembleia (as fontes não têm um endpoint de legislaturas).
LEGISLATURA_SP = (20, "2023-03-15", "2027-03-14")
URL_ALESP = "https://www.al.sp.gov.br/repositorioDados/deputados/deputados.xml"
URL_ALMG = "https://dadosabertos.almg.gov.br/ws/deputados"
FOTO_ALMG = "https://www.almg.gov.br/export/sites/portal/a-assembleia/deputados/fotos/{}.jpg"
# Proteção: não mexe no plenário se a lista vier muito incompleta.
MIN_EM_EXERCICIO = {"al-sp": 80, "al-mg": 65}


def _cliente() -> httpx.Client:
    return httpx.Client(timeout=90, follow_redirects=True,
                        headers={"User-Agent": "monitor-legislativo (ingestao)", "Accept": "application/json"})


def _json(http: httpx.Client, url: str, tentativas: int = 5) -> dict:
    """GET com novas tentativas: a ALMG às vezes devolve uma página de erro (não JSON) sob carga."""
    for t in range(tentativas):
        r = http.get(url, params={"formato": "json"})
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
            [(ids[d["id_fonte"]], casa, leg, partido, casa[-2:].upper(), d["url"])
             for d in deputados for leg, partido in d["mandatos"]])
        atuais = [ids[d["id_fonte"]] for d in deputados]
        if len(atuais) >= MIN_EM_EXERCICIO[casa]:
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
    return _gravar(conn, "al-sp", [(*LEGISLATURA_SP, URL_ALESP)], deputados)


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
