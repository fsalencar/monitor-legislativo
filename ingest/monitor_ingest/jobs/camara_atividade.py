"""Atividade dos deputados: projetos de autoria, presença em sessões deliberativas e afastamentos.

- Autoria: /proposicoes?idDeputadoAutor= (API v2), só os tipos que são projetos de fato.
- Presença: ListarPresencasDia (serviço SitCamaraWS), dia a dia, com justificativa da ausência.
- Afastamentos: /deputados/{id}/historico (API v2): saídas (licença, afastamento) e retornos.
"""
import re
import xml.etree.ElementTree as ET
from datetime import date, timedelta

import httpx
import psycopg

from ..camara import CamaraClient
from .resumos import TIPOS

CASA = "camara"
URL_WS = "https://www.camara.leg.br/SitCamaraWS"
URL_PROPOSICAO = "https://www.camara.leg.br/propostas-legislativas/{}"


def _ids_parlamentares(conn: psycopg.Connection) -> dict[str, int]:
    return dict(conn.execute("select id_fonte, id from parlamentar where casa_id = %s", (CASA,)).fetchall())


def _deputados_da_legislatura(conn: psycopg.Connection) -> list[tuple[int, str]]:
    """(id interno, id na Câmara) de quem exerceu na legislatura atual."""
    return conn.execute(
        """select p.id, p.id_fonte from parlamentar p join mandato m on m.parlamentar_id = p.id
           where m.casa_id = %s and m.legislatura = (select max(numero) from legislatura where casa_id = %s)""",
        (CASA, CASA),
    ).fetchall()


# ---------- Autoria ----------

def autorias(conn: psycopg.Connection, api: CamaraClient) -> int:
    n = 0
    tipos = ",".join(TIPOS)
    for pid, dep in _deputados_da_legislatura(conn):
        props = list(api.paginate("/proposicoes", {"idDeputadoAutor": dep, "siglaTipo": tipos,
                                                   "ordem": "DESC", "ordenarPor": "id"}))
        if not props:
            continue
        nome = conn.execute("select nome from parlamentar where id = %s", (pid,)).fetchone()[0]
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(
                """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, url_fonte)
                   values (%s, %s, %s, %s, %s, %s, %s)
                   on conflict (casa_id, id_fonte) do update set
                     ementa = coalesce(excluded.ementa, proposicao.ementa)""",
                [(CASA, str(p["id"]), p["siglaTipo"], p.get("numero"), p.get("ano"), p.get("ementa"),
                  URL_PROPOSICAO.format(p["id"])) for p in props],
            )
            ids = dict(cur.execute(
                "select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
                (CASA, [str(p["id"]) for p in props])).fetchall())
            cur.executemany(
                """insert into autoria (proposicao_id, parlamentar_id, nome_autor, tipo_autor, url_fonte)
                   values (%s, %s, %s, 'Deputado(a)', %s)
                   on conflict (proposicao_id, nome_autor) do update set parlamentar_id = excluded.parlamentar_id""",
                [(ids[str(p["id"])], pid, nome, URL_PROPOSICAO.format(p["id"])) for p in props],
            )
        n += len(props)
    return n


# ---------- Afastamentos ----------

def _eh_saida(item: dict) -> bool:
    desc = (item.get("descricaoStatus") or "").lower()
    return item.get("situacao") in ("Licença", "SUSPENSO") or desc.startswith("saída - afastamento") and "término da legislatura" not in desc


def afastamentos(conn: psycopg.Connection, api: CamaraClient) -> int:
    deps = _deputados_da_legislatura(conn)
    historicos = api.get_many([f"/deputados/{dep}/historico" for _, dep in deps], ignorar_404=True)
    linhas = []
    for (pid, dep), hist in zip(deps, historicos):
        hist = sorted(hist or [], key=lambda x: x["dataHora"])
        for i, item in enumerate(hist):
            if not _eh_saida(item):
                continue
            # Fim do afastamento: próxima mudança de situação (retorno, fim de mandato etc.).
            fim = hist[i + 1]["dataHora"][:10] if i + 1 < len(hist) else None
            linhas.append((pid, item["dataHora"][:10], fim, item.get("descricaoStatus") or item.get("situacao"),
                           f"https://www.camara.leg.br/deputados/{dep}"))
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from afastamento where parlamentar_id = any(%s)", ([pid for pid, _ in deps],))
        cur.executemany(
            """insert into afastamento (parlamentar_id, data_inicio, data_fim, motivo, url_fonte)
               values (%s, %s, %s, %s, %s) on conflict do nothing""",
            linhas,
        )
    return len(linhas)


# ---------- Presença ----------

def _mapa_carteira(conn: psycopg.Connection, http: httpx.Client) -> dict[str, int]:
    """carteira/matrícula parlamentar -> id interno, via ObterDeputados (ideCadastro = id da API v2)."""
    r = http.get(f"{URL_WS}/Deputados.asmx/ObterDeputados")
    r.raise_for_status()
    ids = _ids_parlamentares(conn)
    mapa = {}
    for d in ET.fromstring(r.content).iter("deputado"):
        cad, mat = (d.findtext("ideCadastro") or "").strip(), (d.findtext("matricula") or "").strip()
        if cad in ids and mat:
            mapa[mat] = ids[cad]
    return mapa


def _mapa_nome_uf(conn: psycopg.Connection) -> dict[tuple[str, str], int]:
    """(nome normalizado, UF) -> id interno, para quem não está mais em exercício."""
    rows = conn.execute(
        """select lower(p.nome), m.uf, p.id from parlamentar p join mandato m on m.parlamentar_id = p.id
           where m.casa_id = %s and m.legislatura = (select max(numero) from legislatura where casa_id = %s)""",
        (CASA, CASA),
    ).fetchall()
    return {(nome, uf): pid for nome, uf, pid in rows}


def presencas(conn: psycopg.Connection, desde: date, ate: date) -> int:
    http = httpx.Client(timeout=60, headers={"User-Agent": "monitor-legislativo (ingestao)"})
    por_carteira, por_nome = _mapa_carteira(conn, http), _mapa_nome_uf(conn)
    n, sem_vinculo = 0, set()
    dia = desde
    while dia <= ate:
        r = http.get(f"{URL_WS}/sessoesreunioes.asmx/ListarPresencasDia",
                     params={"data": dia.strftime("%d/%m/%Y"), "numMatriculaParlamentar": "",
                             "siglaPartido": "", "siglaUF": ""})
        dia_atual, dia = dia, dia + timedelta(days=1)
        if r.status_code != 200 or b"<parlamentar>" not in r.content:
            continue  # dia sem sessão deliberativa
        sessoes, registros = {}, []
        for p in ET.fromstring(r.content).iter("parlamentar"):
            carteira = (p.findtext("carteiraParlamentar") or "").strip()
            nome_uf = re.match(r"(.+)-[^-/]+/(\w\w)$", (p.findtext("nomeParlamentar") or "").strip())
            pid = por_carteira.get(carteira) or (
                por_nome.get((nome_uf.group(1).strip().lower(), nome_uf.group(2))) if nome_uf else None)
            if pid is None:
                sem_vinculo.add((p.findtext("nomeParlamentar") or "").strip())
                continue
            freq_dia = (p.findtext("descricaoFrequenciaDia") or "").strip()
            justificativa = (p.findtext("justificativa") or "").strip() or None
            for s in p.iter("sessaoDia"):
                desc = (s.findtext("descricao") or "").strip()
                sessoes[desc] = (s.findtext("inicio") or "").strip()
                situacao = (s.findtext("frequencia") or "").strip()
                if situacao == "Ausência" and freq_dia == "Ausência justificada":
                    situacao = "Ausência justificada"
                registros.append((desc, pid, situacao, justificativa if situacao != "Presença" else None))
        with conn.transaction(), conn.cursor() as cur:
            for desc, inicio in sessoes.items():
                d, h = (inicio.split(" ") + ["00:00:00"])[:2]
                cur.execute(
                    """insert into sessao (casa_id, id_fonte, data_inicio, tipo, deliberativa, url_fonte)
                       values (%s, %s, to_timestamp(%s, 'DD/MM/YYYY HH24:MI:SS'), %s, true, %s)
                       on conflict (casa_id, id_fonte) do update set data_inicio = excluded.data_inicio""",
                    (CASA, desc, f"{d} {h}", desc.split(" Nº")[0].title(),
                     f"{URL_WS}/sessoesreunioes.asmx/ListarPresencasDia?data={dia_atual:%d/%m/%Y}"),
                )
            ids_sessao = dict(cur.execute(
                "select id_fonte, id from sessao where casa_id = %s and id_fonte = any(%s)",
                (CASA, list(sessoes))).fetchall())
            cur.execute("delete from presenca where sessao_id = any(%s)", (list(ids_sessao.values()),))
            cur.executemany(
                "insert into presenca (sessao_id, parlamentar_id, situacao, justificativa) values (%s, %s, %s, %s)"
                " on conflict do nothing",
                [(ids_sessao[desc], pid, sit, just) for desc, pid, sit, just in registros],
            )
        n += len(registros)
    if sem_vinculo:
        print(f"AVISO: {len(sem_vinculo)} nomes sem vínculo com parlamentar (ex.: {sorted(sem_vinculo)[:3]})")
    return n
