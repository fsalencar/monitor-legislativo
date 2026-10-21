# Plenário Aberto

Você no plenário. Site apartidário com os dados oficiais do Congresso e das Assembleias Legislativas.

Site apartidário de transparência legislativa: quem ocupa cada cadeira na Câmara, no Senado e nas Câmaras Municipais, com dados brutos das fontes oficiais. Veja [CLAUDE.md](CLAUDE.md) para objetivos e princípios.

## Estrutura
- `db/migrations/` — schema Postgres (Supabase), aplicado em ordem.
- `ingest/` — jobs de ingestão em Python (rodam diariamente via GitHub Actions).

## Ingestão local
```sh
# crie .env na raiz com DATABASE_URL=<connection string do Session pooler do Supabase>
cd ingest
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Linux/mac: .venv/bin/pip
.venv/Scripts/python -m monitor_ingest migrate
.venv/Scripts/python -m monitor_ingest camara-deputados --historico     # primeira carga
.venv/Scripts/python -m monitor_ingest camara-deputados --dry-run       # só coleta, não grava
.venv/Scripts/python -m monitor_ingest camara-votacoes --desde 2023-02-01  # votações (padrão: últimos 30 dias)
```
