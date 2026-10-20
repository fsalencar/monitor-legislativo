"""Votações da Câmara (todos os órgãos), votos individuais e proposições afetadas com autores.

Processa mês a mês (a API limita o período da consulta); cada mês é uma transação.
Requer camara-deputados já executado (mandatos/parlamentares).
"""
import re
from dataclasses import dataclass, field
from datetime import date, timedelta

import psycopg

from ..camara import BASE_URL, CamaraClient

CASA = "camara"
URL_PROPOSICAO = "https://www.camara.leg.br/propostas-legislativas/{}"
RE_DEPUTADO = re.compile(r"/deputados/(\d+)$")


@dataclass
class Mes:
    inicio: date
    fim: date
    votacoes: list[dict] = field(default_factory=list)       # detalhe
    votos: dict[str, list[dict]] = field(default_factory=dict)
    proposicoes: dict[int, dict] = field(default_factory=dict)
    autores: dict[int, list[dict]] = field(default_factory=dict)


def meses(desde: date, ate: date):
    ini = desde
    while ini <= ate:
        prox = (ini.replace(day=1) + timedelta(days=32)).replace(day=1)
        yield ini, min(prox - timedelta(days=1), ate)
        ini = prox


def coletar_mes(api: CamaraClient, inicio: date, fim: date) -> Mes:
    m = Mes(inicio, fim)
    ids = [v["id"] for v in api.paginate(
        "/votacoes", {"dataInicio": inicio.isoformat(), "dataFim": fim.isoformat()})]
    ids = list(dict.fromkeys(ids))
    detalhes = api.get_many([f"/votacoes/{i}" for i in ids], ignorar_404=True)
    votos = api.get_many([f"/votacoes/{i}/votos" for i in ids], ignorar_404=True)
    for i, det, vs in zip(ids, detalhes, votos):
        if det is None:
            continue
        m.votacoes.append(det)
        m.votos[i] = vs or []

    prop_ids = sorted({p["id"] for v in m.votacoes for p in v.get("proposicoesAfetadas") or []})
    props = api.get_many([f"/proposicoes/{p}" for p in prop_ids], ignorar_404=True)
    autores = api.get_many([f"/proposicoes/{p}/autores" for p in prop_ids], ignorar_404=True)
    for pid, prop, aut in zip(prop_ids, props, autores):
        if prop is not None:
            m.proposicoes[pid] = prop
            m.autores[pid] = aut or []
    return m


def _id_deputado(uri: str | None) -> str | None:
    mt = RE_DEPUTADO.search(uri or "")
    return mt.group(1) if mt else None


def gravar_mes(conn: psycopg.Connection, m: Mes) -> int:
    n = 0
    with conn.transaction(), conn.cursor() as cur:
        # Parlamentares que aparecem em votos mas ainda não existem (raro): cria o mínimo.
        novos = {}
        for vs in m.votos.values():
            for v in vs:
                d = v["deputado_"]
                novos[str(d["id"])] = (CASA, str(d["id"]), d["nome"], d.get("urlFoto"),
                                       f"https://www.camara.leg.br/deputados/{d['id']}")
        cur.executemany(
            """insert into parlamentar (casa_id, id_fonte, nome, url_foto, url_fonte)
               values (%s, %s, %s, %s, %s) on conflict (casa_id, id_fonte) do nothing""",
            list(novos.values()),
        )
        parl = dict(cur.execute(
            "select id_fonte, id from parlamentar where casa_id = %s", (CASA,)).fetchall())

        # Proposições
        cur.executemany(
            """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa,
                                       data_apresentacao, situacao, url_inteiro_teor, palavras_chave,
                                       url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 sigla_tipo = excluded.sigla_tipo, numero = excluded.numero, ano = excluded.ano,
                 ementa = excluded.ementa, data_apresentacao = excluded.data_apresentacao,
                 situacao = excluded.situacao, url_inteiro_teor = excluded.url_inteiro_teor,
                 palavras_chave = excluded.palavras_chave,
                 atualizado_em = now()""",
            [(CASA, str(pid), p["siglaTipo"], p.get("numero"), p.get("ano"), p.get("ementa"),
              (p.get("dataApresentacao") or "")[:10] or None,
              (p.get("statusProposicao") or {}).get("descricaoSituacao"),
              p.get("urlInteiroTeor"), p.get("keywords") or None, URL_PROPOSICAO.format(pid))
             for pid, p in m.proposicoes.items()],
        )
        n += len(m.proposicoes)
        prop = dict(cur.execute(
            "select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
            (CASA, [str(p) for p in m.proposicoes])).fetchall())

        # Autorias: substitui as das proposições coletadas.
        cur.execute("delete from autoria where proposicao_id = any(%s)", (list(prop.values()),))
        aut_rows = {}
        for pid, autores in m.autores.items():
            for a in autores:
                if not a.get("nome"):
                    continue
                dep =_id_deputado(a.get("uri"))
                aut_rows[(pid, a["nome"])] = (
                    prop[str(pid)], parl.get(dep) if dep else None, a["nome"], a.get("tipo"),
                    bool(a["proponente"]) if a.get("proponente") is not None else None,
                    a.get("ordemAssinatura"), a.get("uri") or URL_PROPOSICAO.format(pid))
        cur.executemany(
            """insert into autoria (proposicao_id, parlamentar_id, nome_autor, tipo_autor,
                                    proponente, ordem, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s)""",
            list(aut_rows.values()),
        )
        n += len(aut_rows)

        # Votações
        cur.executemany(
            """insert into votacao (casa_id, id_fonte, data, data_hora, descricao, sigla_orgao,
                                    tipo, aprovacao, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 data = excluded.data, data_hora = excluded.data_hora, descricao = excluded.descricao,
                 sigla_orgao = excluded.sigla_orgao, tipo = excluded.tipo,
                 aprovacao = excluded.aprovacao, atualizado_em = now()""",
            [(CASA, v["id"], v.get("data"), v.get("dataHoraRegistro"), v.get("descricao"),
              v.get("siglaOrgao"), "nominal" if m.votos[v["id"]] else "simbolica",
              None if v.get("aprovacao") is None else bool(v["aprovacao"]),
              f"{BASE_URL}/votacoes/{v['id']}")
             for v in m.votacoes],
        )
        n += len(m.votacoes)
        vot = dict(cur.execute(
            "select id_fonte, id from votacao where casa_id = %s and id_fonte = any(%s)",
            (CASA, [v["id"] for v in m.votacoes])).fetchall())

        cur.execute("delete from votacao_proposicao where votacao_id = any(%s)", (list(vot.values()),))
        vp = {(vot[v["id"]], prop[str(p["id"])])
              for v in m.votacoes for p in v.get("proposicoesAfetadas") or [] if str(p["id"]) in prop}
        cur.executemany("insert into votacao_proposicao values (%s, %s)", list(vp))

        # Votos: substitui os das votações coletadas (COPY, pois são muitos).
        cur.execute("delete from voto where votacao_id = any(%s)", (list(vot.values()),))
        linhas = {}
        for vid, vs in m.votos.items():
            for v in vs:
                if not v.get("tipoVoto"):
                    continue  # a fonte às vezes manda o registro sem o valor do voto
                d = v["deputado_"]
                linhas[(vot[vid], parl[str(d["id"])])] = (
                    vot[vid], parl[str(d["id"])], v["tipoVoto"], d.get("siglaPartido"), d.get("siglaUf"))
        with cur.copy("copy voto (votacao_id, parlamentar_id, voto, sigla_partido, uf) from stdin") as cp:
            for row in linhas.values():
                cp.write_row(row)
        n += len(linhas)
    return n
