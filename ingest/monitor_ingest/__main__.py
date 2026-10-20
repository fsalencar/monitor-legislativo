import argparse
import sys
import time

from . import db
from .camara import CamaraClient
from .jobs import camara_deputados


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p =argparse.ArgumentParser(prog="python -m monitor_ingest")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate", help="aplica db/migrations no DATABASE_URL")
    dep = sub.add_parser("camara-deputados", help="legislaturas, deputados e mandatos")
    dep.add_argument("--historico", action="store_true", help="todas as legislaturas")
    dep.add_argument("--dry-run", action="store_true", help="só coleta, não grava")
    args = p.parse_args()

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


if __name__ == "__main__":
    main()
