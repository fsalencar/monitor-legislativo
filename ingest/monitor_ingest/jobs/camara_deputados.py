"""Legislaturas, deputados e mandatos da Câmara.

- Sem --historico: só a legislatura atual (rápido; para o cron diário).
- Com --historico: todas as legislaturas (base para "quantos mandatos já cumpriu").
"""
from dataclasses import dataclass, field

import psycopg

from ..camara import CamaraClient

CASA = "camara"
URL_DEPUTADO = "https://www.camara.leg.br/deputados/{}"
# Proteção: se a listagem de "em exercício" vier muito menor que 513, não mexe no plenário.
MIN_EM_EXERCICIO = 450


@dataclass
class Coleta:
    legislaturas: list[dict] = field(default_factory=list)
    # (id_deputado, legislatura) -> item da listagem
    mandatos: dict[tuple[int, int], dict] = field(default_factory=dict)
    em_exercicio: set[int] = field(default_factory=set)
    detalhes: dict[int, dict] = field(default_factory=dict)


def coletar(api: CamaraClient, historico: bool) -> Coleta:
    c = Coleta()
    c.legislaturas = list(api.paginate("/legislaturas", {"ordem": "ASC", "ordenarPor": "id"}))
    atual = max(l["id"] for l in c.legislaturas)
    alvo = [l["id"] for l in c.legislaturas] if historico else [atual]

    for leg in alvo:
        for d in api.paginate("/deputados", {"idLegislatura": leg}):
            c.mandatos[(d["id"], leg)] = d  # a API pode repetir o deputado; fica o último

    c.em_exercicio = {d["id"] for d in api.paginate("/deputados")}

    # Detalhe: deputados da legislatura atual + quem não tem nome em nenhuma listagem.
    com_nome = {dep for (dep, _), item in c.mandatos.items() if item.get("nome")}
    sem_nome = {dep for dep, _ in c.mandatos} - com_nome
    ids_detalhe = sorted({dep for dep, leg in c.mandatos if leg == atual} | c.em_exercicio | sem_nome)
    for d in api.get_many([f"/deputados/{i}" for i in ids_detalhe]):
        d.pop("cpf", None)  # não armazenamos CPF
        c.detalhes[d["id"]] = d
    return c


def gravar(conn: psycopg.Connection, c: Coleta) -> int:
    atual = max(l["id"] for l in c.legislaturas)
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into legislatura (casa_id, numero, data_inicio, data_fim, url_fonte)
               values (%s, %s, %s, %s, %s)
               on conflict (casa_id, numero) do update
                 set data_inicio = excluded.data_inicio, data_fim = excluded.data_fim""",
            [(CASA, l["id"], l["dataInicio"], l["dataFim"], l["uri"]) for l in c.legislaturas],
        )

        # Parlamentar: dados da listagem mais recente em que aparece + detalhe, se houver.
        # Algumas listagens antigas vêm sem nome; usa o mais recente não nulo, depois o detalhe.
        ultimo: dict[int, dict] = {}
        nome: dict[int, str] = {}
        for (dep, leg), item in sorted(c.mandatos.items(), key=lambda kv: kv[0][1]):
            ultimo[dep] = item
            if item.get("nome"):
                nome[dep] = item["nome"]
        rows = []
        for dep, item in ultimo.items():
            det = c.detalhes.get(dep, {})
            status = det.get("ultimoStatus") or {}
            rows.append((
                CASA, str(dep),
                nome.get(dep) or status.get("nome") or status.get("nomeEleitoral") or det.get("nomeCivil"),
                det.get("nomeCivil"), det.get("sexo"),
                det.get("dataNascimento"), det.get("ufNascimento"), det.get("municipioNascimento"),
                item.get("urlFoto"), URL_DEPUTADO.format(dep),
            ))
        cur.executemany(
            """insert into parlamentar (casa_id, id_fonte, nome, nome_civil, sexo, data_nascimento,
                                        uf_nascimento, municipio_nascimento, url_foto, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 nome = excluded.nome,
                 nome_civil = coalesce(excluded.nome_civil, parlamentar.nome_civil),
                 sexo = coalesce(excluded.sexo, parlamentar.sexo),
                 data_nascimento = coalesce(excluded.data_nascimento, parlamentar.data_nascimento),
                 uf_nascimento = coalesce(excluded.uf_nascimento, parlamentar.uf_nascimento),
                 municipio_nascimento = coalesce(excluded.municipio_nascimento, parlamentar.municipio_nascimento),
                 url_foto = coalesce(excluded.url_foto, parlamentar.url_foto),
                 url_fonte = excluded.url_fonte,
                 atualizado_em = now()""",
            rows,
        )

        ids = dict(cur.execute(
            "select id_fonte, id from parlamentar where casa_id = %s", (CASA,)
        ).fetchall())

        mandato_rows = []
        for (dep, leg), item in c.mandatos.items():
            status = c.detalhes.get(dep, {}).get("ultimoStatus") or {}
            mesmo_leg = status.get("idLegislatura") == leg
            mandato_rows.append((
                ids[str(dep)], CASA, leg, item.get("siglaPartido"), item.get("siglaUf"),
                status.get("situacao") if mesmo_leg else None,
                status.get("condicaoEleitoral") if mesmo_leg else None,
                f"https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura={leg}",
            ))
        cur.executemany(
            """insert into mandato (parlamentar_id, casa_id, legislatura, sigla_partido, uf,
                                    situacao, condicao, url_fonte)
               values (%s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (parlamentar_id, legislatura) do update set
                 sigla_partido = excluded.sigla_partido,
                 uf = excluded.uf,
                 situacao = coalesce(excluded.situacao, mandato.situacao),
                 condicao = coalesce(excluded.condicao, mandato.condicao),
                 atualizado_em = now()""",
            mandato_rows,
        )

        if len(c.em_exercicio) >= MIN_EM_EXERCICIO:
            cur.execute(
                "update mandato set em_exercicio = false where casa_id = %s and em_exercicio", (CASA,)
            )
            cur.execute(
                """update mandato set em_exercicio = true
                   where casa_id = %s and legislatura = %s and parlamentar_id = any(%s)""",
                (CASA, atual, [ids[str(d)] for d in c.em_exercicio if str(d) in ids]),
            )
        else:
            print(f"AVISO: só {len(c.em_exercicio)} em exercício na API; plenário não atualizado")

    return len(rows) + len(mandato_rows)


def resumo(c: Coleta) -> str:
    legs = {leg for _, leg in c.mandatos}
    deps = {dep for dep, _ in c.mandatos}
    return (f"{len(c.legislaturas)} legislaturas na API; {len(legs)} coletadas; "
            f"{len(deps)} deputados; {len(c.mandatos)} mandatos; "
            f"{len(c.em_exercicio)} em exercício; {len(c.detalhes)} detalhes")
