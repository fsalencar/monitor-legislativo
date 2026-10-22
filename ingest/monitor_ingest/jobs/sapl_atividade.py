"""Atividade dos deputados estaduais nas Assembleias que usam o SAPL (Interlegis): AM, PB, RO, AC, RR, TO.

Desde o início da legislatura atual (fev/2023), só o que o site mostra:
- votações nominais do plenário (registrovotacao + votoparlamentar), com o partido na data do voto;
- presença nas sessões ordinárias e extraordinárias: o SAPL registra os presentes e as ausências
  justificadas; quem estava com mandato vigente na data e não aparece em nenhum dos dois conta como
  ausência sem justificativa registrada. Sessões sem nenhuma presença registrada são ignoradas;
- projetos (lei, lei complementar, decreto legislativo, resolução, emenda constitucional) de autoria
  dos deputados em exercício, com a situação: "virou lei" pela tabela de normas do próprio SAPL
  (a norma aponta a matéria de origem); senão, o texto da última tramitação oficial.
"""
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import httpx
import psycopg

from ..site import avisar
from .estaduais import SAPL, _cliente, _https, _json, _sapl_todos

INICIO = date(2023, 2, 1)
SESSOES_DELIBERATIVAS = {"ordinaria", "extraordinaria", "sessao ordinaria", "sessao extraordinaria"}
TIPOS_PROJETO = ("projeto de lei", "projeto de decreto legislativo", "projeto de resolu", "proposta de emenda",
                 "projeto de codigo")
REJEICAO = re.compile(r"rejeitad|reprovad|mantido o veto|\bveto\b.*\bmantido|vetad[oa] (total|integral)", re.I)
# Fora de tramitação no SAPL, mas ainda à espera de um ato (sanção, promulgação, publicação).
AGUARDANDO = re.compile(r"aguardando|à sanção|a sanção", re.I)
ARQUIVAMENTO = re.compile(r"arquivad|arquivament|ao arquivo|prejudicad|retirad|inconstitucionalidade", re.I)
# Aprovado pela Assembleia, sem a lei registrada no SAPL (ex.: AC registra só o autógrafo enviado ao Executivo).
APROVADO = re.compile(r"aut[óo]grafo|^aprovad[oa]\s*(—|$)|proposi[çc][ãa]o aprovada", re.I)


def _desde(conn: psycopg.Connection, sql: str, casa: str, margem: int) -> date:
    """Carga incremental: a partir do último dado gravado (menos uma margem para correções da fonte)."""
    ultimo = conn.execute(sql, (casa,)).fetchone()[0]
    conn.commit()
    return max(INICIO, ultimo - timedelta(days=margem)) if ultimo else INICIO


def _sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower().strip()


class _Sapl:
    """Acesso a um SAPL e aos parlamentares dele já gravados no banco."""

    def __init__(self, conn: psycopg.Connection, casa: str):
        self.conn, self.casa, self.base, self.http = conn, casa, SAPL[casa], _cliente()
        self.ids = {int(f): pid for f, pid in conn.execute(
            "select id_fonte, id from parlamentar where casa_id = %s", (casa,))}
        self.em_exercicio = {int(f) for (f,) in conn.execute(
            """select p.id_fonte from parlamentar p join mandato m on m.parlamentar_id = p.id
               where m.casa_id = %s and m.em_exercicio""", (casa,))}
        conn.commit()
        self._filiacoes = None

    def todos(self, caminho: str) -> list[dict]:
        return _sapl_todos(self.http, self.base, caminho)

    def um(self, caminho: str) -> dict:
        return _json(self.http, f"{self.base}{caminho}")

    def partido_em(self, sapl_id: int, dia: str) -> str | None:
        """Sigla do partido do parlamentar na data (histórico de filiações do SAPL)."""
        if self._filiacoes is None:
            siglas = {p["id"]: p["sigla"] for p in self.todos("/api/parlamentares/partido/")}
            self._filiacoes = {}
            for f in self.todos("/api/parlamentares/filiacao/"):
                self._filiacoes.setdefault(f["parlamentar"], []).append(
                    (f["data"] or "", f["data_desfiliacao"] or "9999", siglas.get(f["partido"])))
        for ini, fim, sigla in self._filiacoes.get(sapl_id, []):
            if ini <= dia[:10] <= fim:
                return sigla
        return None

    def parlamentar(self, sapl_id: int) -> int:
        """Id interno; grava quem já saiu da Assembleia (fica fora do plenário)."""
        if sapl_id in self.ids:
            return self.ids[sapl_id]
        p = self.um(f"/api/parlamentares/parlamentar/{sapl_id}/")
        url = f"{self.base}/parlamentar/{sapl_id}"
        leg = self.conn.execute("select max(numero) from legislatura where casa_id = %s", (self.casa,)).fetchone()[0]
        with self.conn.transaction():
            pid = self.conn.execute(
                """insert into parlamentar (casa_id, id_fonte, nome, nome_civil, url_foto, url_fonte)
                   values (%s, %s, %s, %s, %s, %s)
                   on conflict (casa_id, id_fonte) do update set url_fonte = excluded.url_fonte returning id""",
                (self.casa, str(sapl_id), p["nome_parlamentar"].strip(), p.get("nome_completo"),
                 _https(p.get("fotografia")), url)).fetchone()[0]
            self.conn.execute(
                """insert into mandato (parlamentar_id, casa_id, legislatura, sigla_partido, uf, em_exercicio, url_fonte)
                   values (%s, %s, %s, %s, %s, false, %s) on conflict (parlamentar_id, legislatura) do nothing""",
                (pid, self.casa, leg, self.partido_em(sapl_id, date.today().isoformat()), self.casa[-2:].upper(), url))
        self.ids[sapl_id] = pid
        return pid

    def siglas_materia(self) -> dict[int, tuple[str, str]]:
        return {t["id"]: (t["sigla"].strip(), t["descricao"]) for t in self.todos("/api/materia/tipomaterialegislativa/")}

    def gravar_proposicoes(self, cur, materias: list[dict], situacoes: dict[int, str] | None = None) -> dict[int, int]:
        tipos = self.siglas_materia() if not hasattr(self, "_tipos") else self._tipos
        self._tipos = tipos
        situacoes = situacoes or {}
        cur.executemany(
            """insert into proposicao (casa_id, id_fonte, sigla_tipo, numero, ano, ementa, data_apresentacao,
                                       url_fonte, url_inteiro_teor, situacao)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (casa_id, id_fonte) do update set
                 ementa = excluded.ementa, situacao = coalesce(excluded.situacao, proposicao.situacao),
                 url_inteiro_teor = coalesce(excluded.url_inteiro_teor, proposicao.url_inteiro_teor), atualizado_em = now()""",
            [(self.casa, str(m["id"]), tipos.get(m["tipo"], ("MAT", ""))[0], m.get("numero"), m.get("ano"),
              (m.get("ementa") or "").strip() or None, m.get("data_apresentacao"), f"{self.base}/materia/{m['id']}",
              _https(m.get("texto_original")), situacoes.get(m["id"])) for m in materias])
        return {int(f): i for f, i in cur.execute(
            "select id_fonte, id from proposicao where casa_id = %s and id_fonte = any(%s)",
            (self.casa, [str(m["id"]) for m in materias])).fetchall()}


# ---------- Votações nominais ----------

def votacoes(conn: psycopg.Connection, casa: str) -> int:
    desde = _desde(conn, "select max(data) from votacao where casa_id = %s", casa, 7)
    s = _Sapl(conn, casa)
    regs = s.todos(f"/api/sessao/registrovotacao/?data_hora__gte={desde}")
    votos = s.todos(f"/api/sessao/votoparlamentar/?data_hora__gte={desde}")
    por_registro: dict[int, list[dict]] = {}
    for v in votos:
        por_registro.setdefault(v["votacao"], []).append(v)
    regs = [r for r in regs if r["id"] in por_registro]  # só as nominais (com voto de cada parlamentar)
    if not regs:
        return 0
    resultados = {t["id"]: t for t in s.todos("/api/sessao/tiporesultadovotacao/")}
    ids_materia = sorted({r["materia"] for r in regs if r.get("materia")})
    with ThreadPoolExecutor(4) as pool:
        materias = [m for m in pool.map(lambda i: s.um(f"/api/materia/materialegislativa/{i}/"), ids_materia) if m]
    for sapl_id in {v["parlamentar"] for v in votos}:
        s.parlamentar(sapl_id)

    with conn.transaction(), conn.cursor() as cur:
        props = s.gravar_proposicoes(cur, materias)
        siglas = {m["id"]: f"{s._tipos.get(m['tipo'], ('MAT', ''))[0]} {m.get('numero')}/{m.get('ano')}" for m in materias}
        for r in regs:
            res = resultados.get(r.get("tipo_resultado_votacao")) or {}
            natureza = (res.get("natureza") or "").upper()
            descricao = " — ".join(x for x in (siglas.get(r.get("materia")), res.get("nome"), (r.get("observacao") or "").strip()) if x)
            votacao_id = cur.execute(
                """insert into votacao (casa_id, id_fonte, data_hora, data, descricao, tipo, aprovacao, sigla_orgao, url_fonte)
                   values (%s, %s, %s, %s, %s, 'nominal', %s, 'PLEN', %s)
                   on conflict (casa_id, id_fonte) do update set descricao = excluded.descricao, aprovacao = excluded.aprovacao
                   returning id""",
                (casa, str(r["id"]), r["data_hora"], r["data_hora"][:10], descricao or None,
                 True if natureza == "A" else False if natureza == "R" else None,
                 f"{s.base}/materia/{r['materia']}" if r.get("materia") else s.base)).fetchone()[0]
            if r.get("materia") in props:
                cur.execute("insert into votacao_proposicao values (%s, %s) on conflict do nothing",
                            (votacao_id, props[r["materia"]]))
            cur.executemany(
                """insert into voto (votacao_id, parlamentar_id, voto, sigla_partido, uf) values (%s, %s, %s, %s, %s)
                   on conflict (votacao_id, parlamentar_id) do update set voto = excluded.voto""",
                [(votacao_id, s.ids[v["parlamentar"]], (v["voto"] or "").strip(), s.partido_em(v["parlamentar"], r["data_hora"]),
                  casa[-2:].upper()) for v in por_registro[r["id"]]])
    avisar()
    return len(regs)


# ---------- Presença em sessões deliberativas ----------

def presencas(conn: psycopg.Connection, casa: str) -> int:
    desde = _desde(conn, "select max(data_inicio)::date from sessao where casa_id = %s", casa, 30)
    s = _Sapl(conn, casa)
    tipos = {t["id"]: t["nome"] for t in s.todos("/api/sessao/tiposessaoplenaria/")}
    deliberativas = {i for i, nome in tipos.items() if _sem_acento(nome) in SESSOES_DELIBERATIVAS}
    sessoes = [x for x in s.todos(f"/api/sessao/sessaoplenaria/?data_inicio__gte={desde}") if x["tipo"] in deliberativas]
    justificativas = {t["id"]: t["descricao"] for t in s.todos("/api/sessao/tipojustificativa/")}
    # Período do mandato de cada deputado em exercício, na legislatura atual.
    legs = s.todos("/api/parlamentares/legislatura/?o=-numero")
    hoje = date.today().isoformat()
    atual = next(l for l in legs if l["data_inicio"] <= hoje <= (l["data_fim"] or "9999"))
    periodos: dict[int, list[tuple[str, str]]] = {}
    for m in s.todos(f"/api/parlamentares/mandato/?legislatura={atual['id']}"):
        if m["parlamentar"] in s.em_exercicio:
            periodos.setdefault(m["parlamentar"], []).append((m["data_inicio_mandato"] or "", m["data_fim_mandato"] or "9999"))

    def da_sessao(sessao):
        pres = s.todos(f"/api/sessao/sessaoplenariapresenca/?sessao_plenaria={sessao['id']}")
        just = s.todos(f"/api/sessao/justificativaausencia/?sessao_plenaria={sessao['id']}")
        return sessao, {p["parlamentar"] for p in pres if p["sessao_plenaria"] == sessao["id"]}, \
            {j["parlamentar"]: j for j in just if j["sessao_plenaria"] == sessao["id"]}

    with ThreadPoolExecutor(4) as pool:
        lidas = list(pool.map(da_sessao, sessoes))
    registros, gravadas = [], {}
    for sessao, presentes, justificadas in lidas:
        if not presentes:
            continue  # sessão sem lista de presença no SAPL: não dá para saber quem esteve
        dia = sessao["data_inicio"]
        gravadas[sessao["id"]] = (dia, tipos[sessao["tipo"]], f"{s.base}/sessao/{sessao['id']}")
        for sapl_id, faixas in periodos.items():
            if not any(ini <= dia <= fim for ini, fim in faixas):
                continue
            if sapl_id in presentes:
                registros.append((sessao["id"], sapl_id, "Presença", None))
            elif sapl_id in justificadas:
                j = justificadas[sapl_id]
                motivo = " — ".join(x for x in (justificativas.get(j.get("tipo_ausencia")), (j.get("observacao") or "").strip()) if x)
                registros.append((sessao["id"], sapl_id, "Ausência justificada", motivo or None))
            else:
                registros.append((sessao["id"], sapl_id, "Ausência", None))

    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """insert into sessao (casa_id, id_fonte, data_inicio, tipo, deliberativa, url_fonte) values (%s, %s, %s, %s, true, %s)
               on conflict (casa_id, id_fonte) do update set data_inicio = excluded.data_inicio, tipo = excluded.tipo""",
            [(casa, str(i), dia, tipo, url) for i, (dia, tipo, url) in gravadas.items()])
        ids_sessao = {int(f): i for f, i in cur.execute(
            "select id_fonte, id from sessao where casa_id = %s and id_fonte = any(%s)",
            (casa, [str(i) for i in gravadas])).fetchall()}
        cur.execute("delete from presenca where sessao_id = any(%s)", (list(ids_sessao.values()),))
        cur.executemany(
            "insert into presenca (sessao_id, parlamentar_id, situacao, justificativa) values (%s, %s, %s, %s) on conflict do nothing",
            [(ids_sessao[sid], s.ids[pid], sit, just) for sid, pid, sit, just in registros if pid in s.ids])
    avisar()
    return len(registros)


# ---------- Projetos de autoria ----------

def autorias(conn: psycopg.Connection, casa: str) -> int:
    s = _Sapl(conn, casa)
    s._tipos = s.siglas_materia()
    tipos_projeto = [i for i, (_, desc) in s._tipos.items() if _sem_acento(desc).startswith(TIPOS_PROJETO)]
    # Autor -> parlamentar em exercício (o autor do SAPL aponta o parlamentar em object_id).
    autores = {}
    for a in s.todos("/api/base/autor/"):
        if a.get("object_id") in s.em_exercicio and "deput" in _sem_acento(a.get("cargo") or "deputado"):
            autores[a["id"]] = (a["object_id"], a["nome"].strip())
    # Incremental: matérias atualizadas desde a última carga bem-sucedida (3 dias de margem).
    ultima = conn.execute("""select max(iniciado_em)::date from ingestao_execucao where job = %s and ok""",
                          (f"sapl-autorias-{casa}",)).fetchone()[0]
    conn.commit()
    filtro = f"&data_ultima_atualizacao__gte={ultima - timedelta(days=3)}" if ultima else ""
    materias = []
    for t in tipos_projeto:
        materias += [m for m in s.todos(f"/api/materia/materialegislativa/?ano__gte={INICIO.year}&tipo={t}{filtro}")
                     if any(a in autores for a in m.get("autores") or [])]
    tipos_norma = {t["id"]: t["sigla"] for t in s.todos("/api/norma/tiponormajuridica/")}
    normas = {}
    for n in s.todos(f"/api/norma/normajuridica/?ano__gte={INICIO.year}"):
        if n.get("materia"):
            normas[n["materia"]] = f"{tipos_norma.get(n['tipo'], 'Norma')} nº {n['numero']}/{n['ano']}"
    if ultima:
        # Projetos já gravados que viraram lei desde então (a norma nem sempre atualiza a matéria).
        ja = {m["id"] for m in materias}
        sem_lei = {int(f) for (f,) in conn.execute(
            """select pr.id_fonte from proposicao pr where pr.casa_id = %s and exists (select 1 from autoria a
               where a.proposicao_id = pr.id) and coalesce(pr.situacao, '') not like 'Transformada em norma%%'""", (casa,))}
        conn.commit()
        for mid in (set(normas) & sem_lei) - ja:
            materias.append(s.um(f"/api/materia/materialegislativa/{mid}/"))
    if not materias:
        return 0
    status = {x["id"]: x["descricao"].strip() for x in s.todos("/api/materia/statustramitacao/")}

    def situacao(m: dict) -> str:
        if m["id"] in normas:
            return f"Transformada em norma jurídica: {normas[m['id']]}"
        ult = _json(s.http, f"{s.base}/api/materia/tramitacao/?materia={m['id']}&o=-data_tramitacao&page_size=1")["results"]
        texto = " — ".join(x for x in (status.get(ult[0]["status"]) if ult else None,
                                       re.sub(r"\s+", " ", (ult[0].get("texto") or "")).strip() if ult else None) if x)
        if REJEICAO.search(texto):
            return f"Rejeitada: {texto}"
        if ARQUIVAMENTO.search(texto):
            return f"Arquivada: {texto}"
        if APROVADO.search(texto):
            return f"Aprovada pela Assembleia: {texto}"
        if m.get("em_tramitacao") or AGUARDANDO.search(texto):
            return f"Em tramitação: {texto}" if texto else "Em tramitação"
        return f"Tramitação encerrada: {texto}" if texto else "Tramitação encerrada"

    with ThreadPoolExecutor(4) as pool:
        situacoes = dict(zip((m["id"] for m in materias), pool.map(situacao, materias)))
    with conn.transaction(), conn.cursor() as cur:
        props = s.gravar_proposicoes(cur, materias, situacoes)
        cur.executemany(
            """insert into autoria (proposicao_id, parlamentar_id, nome_autor, tipo_autor, url_fonte)
               values (%s, %s, %s, 'Deputado(a)', %s)
               on conflict (proposicao_id, nome_autor) do update set parlamentar_id = excluded.parlamentar_id""",
            [(props[m["id"]], s.ids[autores[a][0]], autores[a][1], f"{s.base}/materia/{m['id']}")
             for m in materias for a in (m.get("autores") or []) if a in autores and autores[a][0] in s.ids])
    avisar()
    return len(materias)
