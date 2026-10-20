import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from dotenv import load_dotenv

from .site import avisar

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations"

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def connect() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL não definida (veja .env.example)")
    # prepare_threshold=None: o pooler do Supabase não suporta prepared statements.
    conn = psycopg.connect(url, prepare_threshold=None)
    # As APIs dão data/hora local sem fuso; o fuso da sessão resolve inclusive o antigo horário de verão.
    conn.execute("set timezone to 'America/Sao_Paulo'")
    conn.commit()
    return conn


def migrate() -> list[str]:
    """Aplica, em ordem, os arquivos de db/migrations ainda não aplicados."""
    applied_now = []
    with connect() as conn:
        conn.execute(
            "create table if not exists schema_migrations ("
            " nome text primary key, aplicado_em timestamptz not null default now())"
        )
        done = {r[0] for r in conn.execute("select nome from schema_migrations")}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in done:
                continue
            with conn.transaction():
                conn.execute(path.read_text(encoding="utf-8"))
                conn.execute("insert into schema_migrations (nome) values (%s)", (path.name,))
            applied_now.append(path.name)
    return applied_now


@contextmanager
def execucao(conn: psycopg.Connection, job: str):
    """Registra início/fim de um job em ingestao_execucao. O corpo atribui stats['registros']."""
    run_id = conn.execute(
        "insert into ingestao_execucao (job) values (%s) returning id", (job,)
    ).fetchone()[0]
    conn.commit()
    stats = {"registros": 0}
    try:
        yield stats
    except Exception as e:
        conn.rollback()
        conn.execute(
            "update ingestao_execucao set finalizado_em = now(), ok = false, erro = %s where id = %s",
            (repr(e)[:2000], run_id),
        )
        conn.commit()
        raise
    conn.execute(
        "update ingestao_execucao set finalizado_em = now(), ok = true, registros = %s where id = %s",
        (stats["registros"], run_id),
    )
    conn.commit()
    avisar(forcar=True)
