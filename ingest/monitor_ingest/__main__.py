import argparse
import sys
import time
from contextlib import nullcontext
from datetime import date, timedelta

from . import db
from .camara import CamaraClient
from .jobs import camara_deputados, camara_votacoes, senado_senadores


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p =argparse.ArgumentParser(prog="python -m monitor_ingest")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate", help="aplica db/migrations no DATABASE_URL")
    dep = sub.add_parser("camara-deputados", help="legislaturas, deputados e mandatos")
    dep.add_argument("--historico", action="store_true", help="todas as legislaturas")
    dep.add_argument("--dry-run", action="store_true", help="só coleta, não grava")
    vot = sub.add_parser("camara-votacoes", help="votações, votos e proposições afetadas")
    vot.add_argument("--desde", type=date.fromisoformat, default=date.today() - timedelta(days=30),
                     help="AAAA-MM-DD (padrão: últimos 30 dias)")
    vot.add_argument("--ate", type=date.fromisoformat, default=date.today())
    vot.add_argument("--dry-run", action="store_true", help="só coleta, não grava")
    sub.add_parser("senado-senadores", help="senadores em exercício e seus mandatos")
    args = p.parse_args()

    if args.cmd == "senado-senadores":
        senadores = senado_senadores.coletar()
        print(f"{len(senadores)} senadores em exercício")
        with db.connect() as conn, db.execucao(conn, "senado-senadores") as stats:
            stats["registros"] = senado_senadores.gravar(conn, senadores)
        print(f"gravados {stats['registros']} registros")
        return

    if args.cmd == "migrate":
        aplicadas = db.migrate()
        print("aplicadas:", ", ".join(aplicadas) if aplicadas else "nenhuma (já atualizado)")
        return

    if args.cmd == "camara-deputados":
        t0 = time.monotonic()
        coleta = camara_deputados.coletar(CamaraClient(), historico=args.historico)
        print(camara_deputados.resumo(coleta), f"({time.monotonic() - t0:.0f}s)")
        if args.dry_run:
            return
        with db.connect() as conn, db.execucao(conn, "camara-deputados") as stats:
            stats["registros"] = camara_deputados.gravar(conn, coleta)
        print(f"gravados {stats['registros']} registros")

    if args.cmd == "camara-votacoes":
        api = CamaraClient()
        with (nullcontext() if args.dry_run else db.connect()) as conn, \
             (nullcontext({"registros": 0}) if conn is None else db.execucao(conn, "camara-votacoes")) as stats:
            for ini, fim in camara_votacoes.meses(args.desde, args.ate):
                t0 = time.monotonic()
                m = camara_votacoes.coletar_mes(api, ini, fim)
                nominais = sum(1 for v in m.votos.values() if v)
                msg = (f"{ini:%Y-%m}: {len(m.votacoes)} votações ({nominais} nominais), "
                       f"{sum(map(len, m.votos.values()))} votos, {len(m.proposicoes)} proposições")
                if conn is not None:
                    stats["registros"] += camara_votacoes.gravar_mes(conn, m)
                print(msg, f"({time.monotonic() - t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
