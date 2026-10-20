import argparse
import sys
import time
from contextlib import nullcontext
from datetime import date, timedelta

from . import db
from .site import avisar
from .camara import CamaraClient
from .jobs import (camara_atividade, camara_deputados, camara_votacoes, estaduais, presidente, resumos,
                   senado_atividade, senado_senadores)


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
    sub.add_parser("camara-autorias", help="projetos de autoria dos deputados da legislatura atual")
    sub.add_parser("camara-afastamentos", help="licenças e afastamentos (histórico de situação)")
    sit = sub.add_parser("camara-situacoes", help="situação atual dos projetos (sem situação ou desatualizados)")
    sit.add_argument("--limite", type=int, default=3000)
    pres = sub.add_parser("camara-presencas", help="presença em sessões deliberativas do plenário")
    pres.add_argument("--desde", type=date.fromisoformat, default=date.today() - timedelta(days=30))
    pres.add_argument("--ate", type=date.fromisoformat, default=date.today())
    sub.add_parser("estaduais", help="deputados estaduais em exercício (ALESP e ALMG)")
    pr = sub.add_parser("presidente", help="projetos, medidas provisórias e vetos da Presidência")
    pr.add_argument("--desde", type=int, default=date.today().year, help="ano inicial (padrão: ano atual)")
    sub.add_parser("senado-mandatos", help="histórico de mandatos dos senadores em exercício")
    sub.add_parser("senado-licencas", help="licenças e afastamentos dos senadores")
    sub.add_parser("senado-autorias", help="projetos de autoria dos senadores")
    sv = sub.add_parser("senado-votacoes", help="votações nominais do Senado com os votos")
    sv.add_argument("--desde", type=date.fromisoformat, default=date.today() - timedelta(days=30))
    sv.add_argument("--ate", type=date.fromisoformat, default=date.today())
    res = sub.add_parser("resumos", help="resumo em linguagem simples (IA) das proposições principais")
    res.add_argument("--limite", type=int, default=200, help="máximo de proposições nesta execução")
    res.add_argument("--dry-run", action="store_true", help="só mostra os resumos, não grava")
    res.add_argument("--minutos", type=float, help="tempo máximo; para sem erro ao esgotar")
    args = p.parse_args()

    if args.cmd == "estaduais":
        with db.connect() as conn, db.execucao(conn, args.cmd) as stats:
            stats["registros"] = estaduais.alesp(conn) + estaduais.almg(conn)
        print(f"estaduais: {stats['registros']} deputados")
        return

    if args.cmd == "presidente":
        with db.connect() as conn, db.execucao(conn, args.cmd) as stats:
            stats["registros"] = presidente.atualizar(conn, args.desde)
        print(f"presidente: {stats['registros']} registros")
        return

    if args.cmd == "camara-situacoes":
        with db.connect() as conn, db.execucao(conn, args.cmd) as stats:
            stats["registros"] = camara_atividade.situacoes(conn, CamaraClient(), args.limite)
        print(f"{args.cmd}: {stats['registros']} registros")
        return

    if args.cmd in ("camara-autorias", "camara-afastamentos", "camara-presencas"):
        t0 = time.monotonic()
        with db.connect() as conn, db.execucao(conn, args.cmd) as stats:
            if args.cmd == "camara-autorias":
                stats["registros"] = camara_atividade.autorias(conn, CamaraClient())
            elif args.cmd == "camara-afastamentos":
                stats["registros"] = camara_atividade.afastamentos(conn, CamaraClient())
            else:
                stats["registros"] = camara_atividade.presencas(conn, args.desde, args.ate)
        print(f"{args.cmd}: {stats['registros']} registros ({time.monotonic() - t0:.0f}s)")
        return

    if args.cmd.startswith("senado-") and args.cmd != "senado-senadores":
        t0 = time.monotonic()
        # Carga desde o início da legislatura atual é registrada à parte: marca a cobertura completa.
        job = args.cmd + ("-historico" if args.cmd == "senado-votacoes" and args.desde <= date(2023, 2, 1) else "")
        with db.connect() as conn, db.execucao(conn, job) as stats:
            if args.cmd == "senado-votacoes":
                stats["registros"] = senado_atividade.votacoes(conn, args.desde, args.ate)
            else:
                stats["registros"] = {"senado-mandatos": senado_atividade.mandatos,
                                      "senado-licencas": senado_atividade.licencas,
                                      "senado-autorias": senado_atividade.autorias}[args.cmd](conn)
        print(f"{job}: {stats['registros']} registros ({time.monotonic() - t0:.0f}s)")
        return

    if args.cmd == "resumos":
        with db.connect() as conn:
            if args.dry_run:
                for item, resumo in resumos.gerar(conn, args.limite, gravar=False):
                    print(f"\n{item[2]} {item[3]}/{item[4]}\n  ementa: {item[5]}\n  resumo: {resumo}")
                return
            with db.execucao(conn, "resumos") as stats:
                stats["registros"] = len(resumos.gerar(conn, args.limite, minutos=args.minutos))
        print(f"gerados {stats['registros']} resumos")
        return

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
                    avisar()
                print(msg, f"({time.monotonic() - t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
