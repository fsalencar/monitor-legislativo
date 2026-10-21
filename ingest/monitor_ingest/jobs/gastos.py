"""Gastos das cotas e verbas parlamentares, somados por parlamentar, mês e categoria.

- Câmara (CEAP): https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip — ideCadastro = id do deputado;
  usa o valor líquido (vlrLiquido). Linhas sem ideCadastro (lideranças) ficam de fora.
- Senado (CEAPS): despesa_ceaps_{ano}.csv — o senador vem pelo nome; valor reembolsado.
- ALESP: despesas_gabinetes.xml — matrícula do deputado; valor.

Guarda só os totais (sem nota a nota e sem fornecedores: há CPF de pessoas físicas). Cada ano é
substituído inteiro a cada carga, porque as casas lançam e corrigem despesas com atraso.
"""
import csv
import io
import re
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from decimal import Decimal

import httpx
import psycopg

from ..site import avisar

URL_CAMARA = "https://www.camara.leg.br/cotas/Ano-{}.csv.zip"
URL_SENADO = "https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{}.csv"
URL_ALESP = "https://www.al.sp.gov.br/repositorioDados/deputados/despesas_gabinetes.xml"

Totais = dict[tuple[int, int, int, str], list]  # (parlamentar, ano, mês, categoria) -> [valor, documentos]


def _cliente() -> httpx.Client:
    return httpx.Client(timeout=600, follow_redirects=True, headers={"User-Agent": "plenario-aberto (ingestao)"})


def _somar(totais: Totais, pid: int, ano: int, mes: int, categoria: str, valor: Decimal) -> None:
    t = totais.setdefault((pid, ano, mes, re.sub(r"\s+", " ", categoria).strip()), [Decimal(0), 0])
    t[0] += valor
    t[1] += 1


def _gravar(conn: psycopg.Connection, casa: str, anos: list[int], totais: Totais) -> int:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""delete from despesa_mensal d using parlamentar p
                       where p.id = d.parlamentar_id and p.casa_id = %s and d.ano = any(%s)""", (casa, anos))
        cur.executemany(
            "insert into despesa_mensal (parlamentar_id, ano, mes, categoria, valor, documentos) values (%s, %s, %s, %s, %s, %s)",
            [(pid, ano, mes, cat, round(v, 2), n) for (pid, ano, mes, cat), (v, n) in totais.items()])
    avisar()
    return len(totais)


def _gravar_anual(conn: psycopg.Connection, casa: str, anos: list[int], totais: Totais) -> int:
    """Anos anteriores ao detalhamento mensal: só o total por parlamentar e ano."""
    por_ano: dict[tuple[int, int], list] = {}
    for (pid, ano, _mes, _cat), (v, n) in totais.items():
        t = por_ano.setdefault((pid, ano), [Decimal(0), 0])
        t[0] += v
        t[1] += n
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""delete from despesa_anual d using parlamentar p
                       where p.id = d.parlamentar_id and p.casa_id = %s and d.ano = any(%s)""", (casa, anos))
        cur.executemany("insert into despesa_anual (parlamentar_id, ano, valor, documentos) values (%s, %s, %s, %s)",
                        [(pid, ano, round(v, 2), n) for (pid, ano), (v, n) in por_ano.items()])
    avisar()
    return len(por_ano)


def camara(conn: psycopg.Connection, anos: list[int], anual: bool = False) -> int:
    ids = dict(conn.execute("select id_fonte, id from parlamentar where casa_id = 'camara'").fetchall())
    conn.commit()
    http, totais = _cliente(), {}
    for ano in anos:
        with tempfile.TemporaryFile() as tmp:
            with http.stream("GET", URL_CAMARA.format(ano)) as r:
                r.raise_for_status()
                for bloco in r.iter_bytes(1 << 20):
                    tmp.write(bloco)
            tmp.seek(0)
            with zipfile.ZipFile(tmp) as z, z.open(z.namelist()[0]) as f:
                for linha in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"), delimiter=";"):
                    pid = ids.get(linha["ideCadastro"])
                    if pid and linha["numMes"] and linha["vlrLiquido"]:
                        _somar(totais, pid, int(linha["numAno"]), int(linha["numMes"]), linha["txtDescricao"],
                               Decimal(linha["vlrLiquido"]))
        print(f"  câmara {ano}: lido", flush=True)
    return (_gravar_anual if anual else _gravar)(conn, "camara", anos, totais)


def _nome(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().upper()).strip()


def senado(conn: psycopg.Connection, anos: list[int], anual: bool = False) -> int:
    por_nome, civis = defaultdict(set), []
    for pid, nome, civil in conn.execute("select id, nome, nome_civil from parlamentar where casa_id = 'senado'"):
        por_nome[_nome(nome)].add(pid)
        if civil:
            civis.append((pid, set(_nome(civil).split())))
    conn.commit()

    def identificar(senador: str) -> set[int]:
        """Pelo nome parlamentar; senão, pelo nome civil que contém todas as palavras da planilha
        (ex.: "WEVERTON ROCHA" -> Weverton Rocha Marques de Sousa, nome parlamentar "Weverton")."""
        if pids := por_nome.get(_nome(senador)):
            return pids
        palavras = set(_nome(senador).split())
        return {pid for pid, civil in civis if palavras <= civil}
    http, totais, sem_vinculo = _cliente(), {}, set()
    for ano in anos:
        r = http.get(URL_SENADO.format(ano))
        r.raise_for_status()
        linhas = r.content.decode("latin-1").splitlines()
        # 1ª linha: "ULTIMA ATUALIZACAO"; a 2ª é o cabeçalho.
        for linha in csv.DictReader(linhas[1:], delimiter=";"):
            pids = identificar(linha["SENADOR"])
            if len(pids) != 1:
                sem_vinculo.add(linha["SENADOR"])
                continue
            valor = Decimal(linha["VALOR_REEMBOLSADO"].replace(".", "").replace(",", "."))
            _somar(totais, next(iter(pids)), int(linha["ANO"]), int(linha["MES"]), linha["TIPO_DESPESA"], valor)
        print(f"  senado {ano}: lido", flush=True)
    if sem_vinculo:
        print(f"AVISO: {len(sem_vinculo)} senadores da planilha sem vínculo (ex-senadores ou nome diferente): "
              f"{sorted(sem_vinculo)[:8]}")
    return (_gravar_anual if anual else _gravar)(conn, "senado", anos, totais)


def alesp(conn: psycopg.Connection, anos: list[int], anual: bool = False) -> int:
    ids = {int(m): pid for pid, m in conn.execute(
        r"""select id, substring(url_fonte from 'matricula=(\d+)') from parlamentar
            where casa_id = 'al-sp' and url_fonte like '%%matricula=%%'""")}
    conn.commit()
    totais = {}
    with tempfile.TemporaryFile() as tmp:
        with _cliente().stream("GET", URL_ALESP) as r:
            r.raise_for_status()
            for bloco in r.iter_bytes(1 << 20):
                tmp.write(bloco)
        tmp.seek(0)
        for _, el in ET.iterparse(tmp):
            if el.tag != "despesa":
                continue
            ano, pid = int(el.findtext("Ano") or 0), ids.get(int(el.findtext("Matricula") or 0))
            if pid and ano in anos and el.findtext("Valor"):
                # "A - COMBUSTÍVEIS E LUBRIFICANTES": a letra é só o código do item.
                tipo = re.sub(r"^[A-Z]{1,2} - ", "", (el.findtext("Tipo") or "Não informado").strip())
                _somar(totais, pid, ano, int(el.findtext("Mes")), tipo, Decimal(el.findtext("Valor")))
            el.clear()
    return (_gravar_anual if anual else _gravar)(conn, "al-sp", anos, totais)
