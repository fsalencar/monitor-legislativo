# monitor-legislativo

Site apartidário de transparência legislativa: quem ocupa cada cadeira na Câmara, no Senado e nas Câmaras Municipais, com dados brutos das fontes oficiais. Veja [CLAUDE.md](CLAUDE.md) para objetivos e princípios.

## Estrutura
- `db/migrations/` — schema Postgres (Supabase), aplicado em ordem.
- `ingest/` — jobs de ingestão em Python (rodam diariamente via GitHub Actions).

## Ingestão local
```sh
cp .env.example .env          # preencha DATABASE_URL
cd ingest
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Linux/mac: .venv/bin/pip
.venv/Scripts/python -m monitor_ingest migrate
.venv/Scripts/python -m monitor_ingest camara-deputados --historico     # primeira carga
.venv/Scripts/python -m monitor_ingest camara-deputados --dry-run       # só coleta, não grava
```
