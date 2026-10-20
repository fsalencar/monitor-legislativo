"""Senadores em exercício (Senado Federal).

O mandato de senador abrange duas legislaturas; grava uma linha de mandato por legislatura.
"""
from datetime import date

import httpx
import psycopg

CASA = "senado"
URL_LISTA = "https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json"
# Proteção: não mexe no plenário se a lista vier incompleta.
MIN_EM_EXERCICIO = 70


def coletar() -> list[dict]:
    r = httpx.get(URL_LISTA, headers={"Accept": "application/json"}, timeout=60)
    r.raise_for_status()
    return r.json()["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]


def _https(url: str | None) -> str | None:
    return url.replace("http://", "https://", 1) if url else url


def gravar(conn: psycopg.Connection, senadores: list[dict]) -> int:
    hoje = date.today().isoformat()
    legislaturas, parl_rows, mand = {}, [], []
    for s in senadores:
        ident, m = s["IdentificacaoParlamentar"], s["Mandato"]
        cod = ident["CodigoParlamentar"]
        url = _https(ident.get("UrlPaginaParlamentar")) or f"https://www25.senado.leg.br/web/senadores/senador/-/perfil/{cod}"
        parl_rows.append((CASA, cod, ident["NomeParlamentar"], ident.get("NomeCompletoParlamentar"),
                          {"Masculino": "M", "Feminino": "F"}.get(ident.get("SexoParlamentar")),
                          _https(ident.get("UrlFotoParlamentar")), url))
        for chave in ("PrimeiraLegislaturaDoMandato", "SegundaLegislaturaDoMandato"):
            leg = m.get(chave)
            if not leg:
                continue
            num = int(leg["NumeroLegislatura"])
            legislaturas[num] = (CASA, num, leg["DataInicio"], leg["DataFim"],
                                 "https://legis.senado.leg.br/dadosabertos/plenario/lista/legislaturas")
            mand.append((cod, num, ident.get("SiglaPartidoParlamentar"), m.get("UfParlamentar"),
                         leg["DataInicio"] <= hoje <= leg["DataFim"],
                         m.get("DescricaoParticipacao"), url))

    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into legislatura (casa_id, numero, data_inicio, data_fim, url_fonte)
               values (%s, %s, %s, %s, %s) on conflict (casa_id, numero) do nothing""",
            list(legislaturas.values()),
        )
        cur.executemany(
            """insert into parlamentar (casa_id, id_fonte, nome, nome_civil, sexo, url_foto, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 nome = excluded.nome, nome_civil = excluded.nome_civil, sexo = excluded.sexo,
                 url_foto = excluded.url_foto, url_fonte = excluded.url_fonte, atualizado_em = now()""",
            parl_rows,
        )
        ids = dict(cur.execute("select id_fonte, id from parlamentar where casa_id = %s", (CASA,)).fetchall())
        cur.executemany(
            """insert into mandato (parlamentar_id, casa_id, legislatura, sigla_partido, uf, condicao, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (parlamentar_id, legislatura) do update set
                 sigla_partido = excluded.sigla_partido, uf = excluded.uf,
                 condicao = excluded.condicao, atualizado_em = now()""",
            [(ids[cod], CASA, num, partido, uf, cond, url) for cod, num, partido, uf, _, cond, url in mand],
        )
        atuais = [ids[cod] for cod, _, _, _, vigente, _, _ in mand if vigente]
        if len(atuais) >= MIN_EM_EXERCICIO:
            cur.execute("update mandato set em_exercicio = false where casa_id = %s and em_exercicio", (CASA,))
            cur.execute(
                """update mandato set em_exercicio = true
                   where casa_id = %s and parlamentar_id = any(%s)
                     and legislatura = (select numero from legislatura
                                        where casa_id = %s and current_date between data_inicio and data_fim)""",
                (CASA, atuais, CASA),
            )
        else:
            print(f"AVISO: só {len(atuais)} senadores em exercício; plenário não atualizado")
    return len(parl_rows) + len(mand)
