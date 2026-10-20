"""Senado Federal: histórico de mandatos, votações nominais com votos, autoria e licenças.

Fontes (https://legis.senado.leg.br/dadosabertos):
- /senador/{cod}/mandatos e /senador/{cod}/licencas
- /votacao?dataInicio&dataFim (no máximo 1 ano por consulta; já traz os votos)
- /processo?codigoParlamentarAutor= (autoria; filtra os tipos que são projetos)
"""
from datetime import date

import httpx
import psycopg

CASA = "senado"
BASE = "https://legis.senado.leg.br/dadosabertos"
URL_SENADOR = "https://www25.senado.leg.br/web/senadores/senador/-/perfil/{}"
URL_MATERIA = "https://www25.senado.leg.br/web/atividade/materias/-/materia/{}"
# Tipos que são projetos de fato (os demais são requerimentos, indicações, ofícios...).
TIPOS_PROJETO = {"PL", "PLS", "PLP", "PEC", "PDL", "PDS", "PRS", "MPV", "PLV", "PLN"}


def _cliente() -> httpx.Client:
    return httpx.Client(base_url=BASE, headers={"Accept": "application/json", "User-Agent": "monitor-legislativo (ingestao)"},
                        timeout=120, follow_redirects=True)


def _lista(x) -> list:
    """A API (convertida de XML) devolve objeto único em vez de lista quando há só um item."""
    return x if isinstance(x, list) else [x] if x else []


def _senadores_em_exercicio(conn: psycopg.Connection) -> list[tuple[int, str, str]]:
    """(id interno, código no Senado, nome). Fecha a transação de leitura: cada senador grava na sua."""
    rows = conn.execute(
        "select distinct p.id, p.id_fonte, p.nome from parlamentar p join mandato m on m.parlamentar_id = p.id"
        " where m.casa_id = %s and m.em_exercicio", (CASA,)).fetchall()
    conn.commit()
    return rows


def _url_materia(codigo) -> str | None:
    return URL_MATERIA.format(codigo) if codigo else None


# ---------- Histórico de mandatos ----------

def mandatos(conn: psycopg.Connection) -> int:
    http, n = _cliente(), 0
    for pid, cod, nome in _senadores_em_exercicio(conn):
        dados = http.get(f"/senador/{cod}/mandatos").json()["MandatoParlamentar"]["Parlamentar"]
        legs, linhas = {}, []
        for m in _lista((dados.get("Mandatos") or {}).get("Mandato")):
            for chave in ("PrimeiraLegislaturaDoMandato", "SegundaLegislaturaDoMandato"):
                leg = m.get(chave)
                if not leg:
                    continue
                num = int(leg["NumeroLegislatura"])
                legs[num] = (CASA, num, leg["DataInicio"], leg["DataFim"], f"{BASE}/senador/{cod}/mandatos")
                linhas.append((pid, CASA, num, m.get("UfParlamentar"), m.get("DescricaoParticipacao"),
                               URL_SENADOR.format(cod)))
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(
                """insert into legislatura (casa_id, numero, data_inicio, data_fim, url_fonte)
                   values (%s, %s, %s, %s, %s) on conflict (casa_id, numero) do nothing""", list(legs.values()))
            # Partido de mandatos antigos não vem nesta fonte: fica nulo, sem sobrescrever o atual.
            cur.executemany(
                """insert into mandato (parlamentar_id, casa_id, legislatura, uf, condicao, url_fonte)
                   values (%s, %s, %s, %s, %s, %s)
                   on conflict (parlamentar_id, legislatura) do update set
                     uf = coalesce(excluded.uf, mandato.uf), condicao = coalesce(excluded.condicao, mandato.condicao)""",
                linhas)
        n += len(linhas)
    return n


# ---------- Licenças / afastamentos ----------

def licencas(conn: psycopg.Connection) -> int:
    http, n = _cliente(), 0
    for pid, cod, _ in _senadores_em_exercicio(conn):
        dados = http.get(f"/senador/{cod}/licencas").json()["LicencaParlamentar"]["Parlamentar"]
        linhas = [(pid, l["DataInicio"], l.get("DataFim"), l.get("DescricaoTipoAfastamento"), URL_SENADOR.format(cod))
                  for l in _lista((dados.get("Licencas") or {}).get("Licenca")) if l.get("DataInicio")]
        with conn.transaction(), conn.cursor() as cur:
            cur.execute("delete from afastamento where parlamentar_id = %s", (pid,))
            cur.executemany(
                """insert into afastamento (parlamentar_id, data_inicio, data_fim, motivo, url_fonte)
                   values (%s, %s, %s, %s, %s) on conflict do nothing""", linhas)
        n += len(linhas)
    return n


# ---------- Autoria ----------

def autorias(conn: psycopg.Connection) -> int:
    http, n = _cliente(), 0
    for pid, cod, nome in _senadores_em_exercicio(conn):
        procs = http.get("/processo", params={"codigoParlamentarAutor": cod}).json()
        projetos = []
        for p in procs:
            sigla, _, resto = (p.get("identificacao") or "").partition(" ")
            numero, _, ano = resto.partition("/")
            if sigla in TIPOS_PROJETO and numero.isdigit() and ano.isdigit():
                projetos.append((p, sigla, int(numero), int(ano)))
        if not projetos:
            continue
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(
                """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, data_apresentacao,
                                           situacao, url_inteiro_teor, url_fonte)
                   values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   on conflict (casa_id, id_fonte) do update set
                     ementa = excluded.ementa, situacao = excluded.situacao,
                     url_inteiro_teor = excluded.url_inteiro_teor, atualizado_em = now()""",
                [(CASA, str(p["id"]), sigla, numero, ano, p.get("ementa"), p.get("dataApresentacao"),
                  (p.get("situacaoAtual") or "").replace("_", " ").capitalize() or None, p.get("urlDocumento"),
                  _url_materia(p.get("codigoMateria")) or f"{BASE}/processo/{p['id']}")
                 for p, sigla, numero, ano in projetos],
            )
            ids = dict(cur.execute("select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
                                   (CASA, [str(p["id"]) for p, *_ in projetos])).fetchall())
            cur.executemany(
                """insert into autoria (proposicao_id, parlamentar_id, nome_autor, tipo_autor, url_fonte)
                   values (%s, %s, %s, 'Senador(a)', %s)
                   on conflict (proposicao_id, nome_autor) do update set parlamentar_id = excluded.parlamentar_id""",
                [(ids[str(p["id"])], pid, nome, _url_materia(p.get("codigoMateria")) or f"{BASE}/processo/{p['id']}")
                 for p, *_ in projetos],
            )
        n += len(projetos)
    return n


# ---------- Votações nominais ----------

def votacoes(conn: psycopg.Connection, desde: date, ate: date) -> int:
    http, n = _cliente(), 0
    ano = desde.year
    while ano <= ate.year:
        ini, fim = max(desde, date(ano, 1, 1)), min(ate, date(ano, 12, 31))
        lista = http.get("/votacao", params={"dataInicio": ini.isoformat(), "dataFim": fim.isoformat()}).json()
        n += _gravar_votacoes(conn, lista)
        print(f"senado {ano}: {len(lista)} votações", flush=True)
        ano += 1
    return n


def _gravar_votacoes(conn: psycopg.Connection, lista: list[dict]) -> int:
    if not lista:
        return 0
    with conn.transaction(), conn.cursor() as cur:
        # Quem votou mas não está no banco (ex-senadores, suplentes): registro mínimo.
        cur.executemany(
            """insert into parlamentar (casa_id, id_fonte, nome, sexo, url_fonte)
               values (%s, %s, %s, %s, %s) on conflict (casa_id, id_fonte) do nothing""",
            list({str(v["codigoParlamentar"]): (CASA, str(v["codigoParlamentar"]), v["nomeParlamentar"],
                                               v.get("sexoParlamentar"), URL_SENADOR.format(v["codigoParlamentar"]))
                  for x in lista for v in (x.get("votos") or [])}.values()),
        )
        parl = dict(cur.execute("select id_fonte, id from parlamentar where casa_id = %s", (CASA,)).fetchall())

        props = {str(x["idProcesso"]): x for x in lista if x.get("idProcesso")}
        cur.executemany(
            """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, data_apresentacao, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set ementa = coalesce(excluded.ementa, proposicao.ementa)""",
            [(CASA, pid, x.get("sigla") or "?", x.get("numero"), x.get("ano"), x.get("ementa"),
              x.get("dataApresentacao"), _url_materia(x.get("codigoMateria")) or f"{BASE}/processo/{pid}")
             for pid, x in props.items()],
        )
        prop = dict(cur.execute("select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
                                (CASA, list(props))).fetchall())

        def tipo(x):
            if x.get("votacaoSecreta") == "S":
                return "secreta"
            return "nominal" if x.get("votos") else "simbolica"

        cur.executemany(
            """insert into votacao (casa_id, id_fonte, data, data_hora, descricao, sigla_orgao, tipo, aprovacao, url_fonte)
               values (%s, %s, %s, %s, %s, 'PLEN', %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 descricao = excluded.descricao, tipo = excluded.tipo, aprovacao = excluded.aprovacao, atualizado_em = now()""",
            [(CASA, str(x["codigoSessaoVotacao"]), x["dataSessao"], x["dataSessao"], x.get("descricaoVotacao"), tipo(x),
              {"A": True, "R": False}.get(x.get("resultadoVotacao")),
              _url_materia(x.get("codigoMateria")) or f"{BASE}/votacao?codigoSessaoVotacao={x['codigoSessaoVotacao']}")
             for x in lista],
        )
        vot = dict(cur.execute("select id_fonte, id from votacao where casa_id = %s and id_fonte = any(%s)",
                               (CASA, [str(x["codigoSessaoVotacao"]) for x in lista])).fetchall())
        cur.execute("delete from votacao_proposicao where votacao_id = any(%s)", (list(vot.values()),))
        cur.executemany("insert into votacao_proposicao values (%s, %s) on conflict do nothing",
                        [(vot[str(x["codigoSessaoVotacao"])], prop[str(x["idProcesso"])])
                         for x in lista if str(x.get("idProcesso")) in prop])
        cur.execute("delete from voto where votacao_id = any(%s)", (list(vot.values()),))
        linhas = {(vot[str(x["codigoSessaoVotacao"])], parl[str(v["codigoParlamentar"])]):
                  (vot[str(x["codigoSessaoVotacao"])], parl[str(v["codigoParlamentar"])], v["siglaVotoParlamentar"],
                   v.get("siglaPartidoParlamentar"), v.get("siglaUFParlamentar"))
                  for x in lista for v in (x.get("votos") or []) if v.get("siglaVotoParlamentar")}
        with cur.copy("copy voto (votacao_id, parlamentar_id, voto, sigla_partido, uf) from stdin") as cp:
            for row in linhas.values():
                cp.write_row(row)
    return len(lista) + len(linhas)
