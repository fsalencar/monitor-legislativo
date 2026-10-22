"""Votações nominais de vetos nas sessões conjuntas do Congresso Nacional (Senado, dados abertos).

- /materia/vetos/{ano}: vetos do ano;
- /plenario/resultado/veto/materia/{codigo}: dispositivos de cada veto, com a situação (Mantido,
  Rejeitado) e se tiveram votação nominal (cédula eletrônica);
- /plenario/resultado/veto/dispositivo/{codigo}: voto de cada deputado e senador no dispositivo.

Na cédula, "Sim" é pela manutenção do veto e "Não", pela derrubada (conferido com os resultados:
nos dispositivos derrubados predomina o "Não"). Se a Câmara mantém o veto, o Senado não vota.
Cada dispositivo vira uma votação (casa 'congresso', órgão 'CN'), ligada ao veto já gravado pelo
job da Presidência (mesma sigla, número e ano).
"""
import difflib
import re
import time
import unicodedata
from datetime import date

import httpx
import psycopg

from ..site import avisar

BASE = "https://legis.senado.leg.br/dadosabertos"
INICIO = 2023
LEGISLATURA_ATUAL = 57  # Câmara e Senado (2023-2027)
SESSAO = re.compile(r"(\d{2})/(\d{2})/(\d{4})")


def _lista(o):
    return o if isinstance(o, list) else ([o] if o else [])


def _achar(o, chave):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == chave:
                yield v
            yield from _achar(v, chave)
    elif isinstance(o, list):
        for x in o:
            yield from _achar(x, chave)


def _nome(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z ]", "", re.sub(r"\s+", " ", s)).strip()


def _cliente() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=120, follow_redirects=True,
                        headers={"Accept": "application/json", "User-Agent": "plenario-aberto (ingestao)"})


def _get(http: httpx.Client, caminho: str, tentativas: int = 4) -> dict | None:
    for t in range(tentativas):
        try:
            r = http.get(caminho)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except (httpx.TransportError, ValueError):
            pass
        time.sleep(3 * (t + 1))
    return None


def vetos(conn: psycopg.Connection) -> int:
    http = _cliente()
    # Todos os parlamentares de cada casa (inclusive licenciados e ex-senadores, que podem não ter
    # mandato gravado), com a UF e a legislatura mais recente de cada um.
    cadastro: dict[str, list[tuple[int, str, str | None, int]]] = {"camara": [], "senado": []}
    for casa, pid, nome, uf, leg in conn.execute(
            """select p.casa_id, p.id, p.nome, max(m.uf), coalesce(max(m.legislatura), 0)
               from parlamentar p left join mandato m on m.parlamentar_id = p.id
               where p.casa_id in ('camara', 'senado') group by 1, 2, 3"""):
        cadastro[casa].append((pid, _nome(nome), uf, leg))
    feitas = {r[0] for r in conn.execute("select id_fonte from votacao where casa_id = 'congresso'")}
    vets = {(n, a): i for i, n, a in conn.execute(
        "select id, numero, ano from proposicao where casa_id = 'congresso' and sigla_tipo = 'VET'")}
    conn.commit()
    memo: dict[tuple, int | None] = {}

    def identificar(casa: str, voto: dict) -> int | None:
        """A fonte só traz o nome: tenta, nesta ordem, nome igual (mesma UF ou sem UF no cadastro);
        abreviações ("Prof.", "Astr."); grafia parecida na mesma UF ("Foletto"/"Folletto"); e o
        primeiro nome, se único na UF entre os da legislatura atual ("Dayany Bittencourt", que
        passou a usar "Dayany do Capitão"). Com mais de um candidato, fica o de legislatura mais
        recente; empate ou nenhum, o voto não é gravado (e vai para o aviso)."""
        chave = (casa, voto.get("NomeParlamentar"), voto.get("UfParlamentar"))
        if chave in memo:
            return memo[chave]
        nome, uf = _nome(chave[1]), chave[2]
        regiao = [c for c in cadastro[casa] if c[2] in (uf, None)]
        a = nome.split()

        def abrev(b: list[str]) -> bool:
            j = 0
            for t in a:
                while j < len(b) and not (b[j] == t or (len(t) <= 5 and b[j].startswith(t))):
                    j += 1
                if j == len(b):
                    return False
                j += 1
            return True

        for criterio in (lambda c: c[1] == nome,
                         lambda c: abrev(c[1].split()),
                         lambda c: difflib.SequenceMatcher(None, c[1], nome).ratio() >= 0.9,
                         lambda c: c[3] >= LEGISLATURA_ATUAL and c[1].split()[:1] == a[:1]):
            achados = [c for c in regiao if criterio(c)]
            if achados:
                maior = max(c[3] for c in achados)
                topo = [c for c in achados if c[3] == maior]
                memo[chave] = topo[0][0] if len(topo) == 1 else None
                return memo[chave]
        memo[chave] = None
        return None

    codigos = set()
    for ano in range(INICIO, date.today().year + 1):
        dados = _get(http, f"/materia/vetos/{ano}") or {}
        for ms in _achar(dados, "Materia"):
            for m in _lista(ms):
                if isinstance(m, dict) and m.get("Sigla") == "VET" and m.get("Codigo"):
                    codigos.add(m["Codigo"])

    n, sem_vinculo = 0, set()
    for cod in sorted(codigos):
        dados = _get(http, f"/plenario/resultado/veto/materia/{cod}")
        if not dados:
            continue
        veto = dados["ResultadoVetoMateriaCN"]["Veto"]
        mat = veto.get("Materia") or {}
        prop_id = vets.get((int(mat.get("Numero") or 0), int(mat.get("Ano") or 0)))
        pdf = next((p.get("URL") for p in _lista((veto.get("PdfsResultadoVotacao") or {}).get("PdfResultadoVotacao"))), None)
        url = pdf or f"https://www25.senado.leg.br/web/atividade/materias/-/materia/{cod}"
        for d in _lista((veto.get("Dispositivos") or {}).get("Dispositivo")):
            if d.get("PossuiVotos") != "Sim" or not d.get("Codigo") or str(d["Codigo"]) in feitas:
                continue
            resultado = _get(http, f"/plenario/resultado/veto/dispositivo/{d['Codigo']}")
            if not resultado:
                continue
            v = resultado["ResultadoVetoDispositivoCN"]["Votacao"]
            m = SESSAO.search(v.get("Sessao") or "")
            dia = f"{m[3]}-{m[2]}-{m[1]}" if m else None
            situacao = {"Mantido": "veto mantido", "Rejeitado": "veto derrubado"}.get(d.get("Situacao"), d.get("Situacao"))
            descricao = (f"VET {mat.get('Numero')}/{mat.get('Ano')}, item {d.get('Identificador')}: "
                         f"{(d.get('Descricao') or '').strip()} — {situacao}")
            votos = []
            for casa, chave in (("camara", "Camara"), ("senado", "Senado")):
                bloco = v.get(chave)
                for voto in _lista(bloco.get("Voto") if isinstance(bloco, dict) else None):
                    pid = identificar(casa, voto)
                    if pid is None:
                        sem_vinculo.add(f"{voto.get('NomeParlamentar')} ({voto.get('UfParlamentar')}, {casa})")
                        continue
                    votos.append((pid, voto.get("TipoVoto") or "", voto.get("PartidoParlamentar"), voto.get("UfParlamentar")))
            with conn.transaction(), conn.cursor() as cur:
                votacao_id = cur.execute(
                    """insert into votacao (casa_id, id_fonte, data, descricao, tipo, aprovacao, sigla_orgao, url_fonte)
                       values ('congresso', %s, %s, %s, 'nominal', null, 'CN', %s)
                       on conflict (casa_id, id_fonte) do update set descricao = excluded.descricao
                       returning id""", (str(d["Codigo"]), dia, descricao[:2000], url)).fetchone()[0]
                if prop_id:
                    cur.execute("insert into votacao_proposicao values (%s, %s) on conflict do nothing", (votacao_id, prop_id))
                cur.executemany(
                    """insert into voto (votacao_id, parlamentar_id, voto, sigla_partido, uf) values (%s, %s, %s, %s, %s)
                       on conflict (votacao_id, parlamentar_id) do update set voto = excluded.voto""",
                    [(votacao_id, *x) for x in votos])
            n += 1
            avisar()
    if sem_vinculo:
        print(f"AVISO: {len(sem_vinculo)} nomes sem vínculo (votos não gravados): {sorted(sem_vinculo)[:12]}")
    return n
