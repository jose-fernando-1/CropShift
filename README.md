# Rurotation

Cropshift (NASA Space Apps 2026, team Rural): for a point or municipality in Pernambuco, Brazil, it shows for each crop the probability of planting success per dekad (36 ten-day windows) from 40 seasons of NASA POWER climate, next to the official ZARC planting window and IBGE PAM yields. The "probability" is the historical frequency of successful simulated seasons, not a calibrated probability.

Current state: the web app ([`web/`](web/README.md)) runs against either its in-process mock API or the FastAPI backend ([`backend/`](backend/README.md)), which implements the shared [contract](contract/README.md) v0.1 over a PostGIS database. The data extraction and ETL tooling lives in [`data/`](data/README.md). Machine learning is scaffolded only: no model is trained or applied (`ml_applied` is always `false`).

## Layout

| Path        | What                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `web/`      | Next.js app with a mock API (`API_MODE=mock`) or a proxy to the backend (`API_MODE=live`, `API_ORIGIN`). |
| `backend/`  | FastAPI API, pure simulation engines, Alembic migrations, tests.                                         |
| `data/`     | Source extraction, ETL, validation (`python -m data ...`).                                               |
| `contract/` | API contract v0.1: JSON Schemas and golden examples, generated from the web zod schemas.                 |
| `docs/`     | Cross-cutting docs: architecture, data sources, API keys, runbook, validation.                           |

## Run it

Three ways, all driven by the root `Makefile` (`make help` lists the targets) and `docker-compose.yml`.

### 1. Devcontainer

Open the repo root in VS Code and choose "Reopen in Container" (`.devcontainer/`, compose-based: services `dev` and `db`, Python 3.13 and Node 22). `post-create.sh` installs the web and backend dependencies and applies the migrations. Then `make run` for the API and `cd web && npm run dev` for the web. Run `make db` and `make stack` on the host, not inside the container.

### 2. Containers

```bash
make stack                     # db + migrations + api + web in live mode: http://localhost:3000, API docs http://localhost:8000/docs
docker compose up --build web  # web alone with the mock API, no database
make stack-down                # stop, keep the database volume
```

Never run `docker compose down -v`: it deletes the PostgreSQL volume. The database listens on host port 5433. Overrides (ports, passwords, Gemini) go in a root `.env` copied from `.env.example`. `make seed` (or `docker compose --profile live run --rm seed`) loads the committed demo dataset from `data/demo` into the database with no network; it truncates the seeded tables first. To rebuild the data from the sources see [docs/runbook.md](docs/runbook.md).

### 3. Plain local

Needs Python 3.13, Node 22 and Docker (for the database).

```bash
make install   # backend/.venv with backend and data dependencies
make db        # PostGIS on 127.0.0.1:5433
make migrate
make run       # API on http://127.0.0.1:8000
cd web && npm ci && API_MODE=live API_ORIGIN=http://127.0.0.1:8000 npm run dev
```

Without `API_MODE=live`, `npm run dev` uses the mock API and needs no backend. `make check` runs what the backend CI runs (lint and offline tests).

## Docs

- [web/README.md](web/README.md): web run modes, env vars, scripts, mock scenarios, tests, layout.
- [web/docs/data-flow.md](web/docs/data-flow.md): request flow, fixtures (real vs synthetic), mapping rules, privacy.
- [backend/README.md](backend/README.md): backend layers, configuration, endpoints, errors, tests.
- [docs/backend-architecture.md](docs/backend-architecture.md): request and data flow, key decisions and why.
- [data/README.md](data/README.md): extraction, ETL, validation commands and data layout; one README per source under `data/sources/`.
- [docs/data-sources.md](docs/data-sources.md): every data source, licence, access and limits.
- [docs/api-keys.md](docs/api-keys.md): which credentials exist, which are needed, where they go.
- [docs/runbook.md](docs/runbook.md): reseed, re-extract, backup and restore, troubleshooting.
- [docs/validation/README.md](docs/validation/README.md): how the evidence for the method is produced.
- [contract/README.md](contract/README.md): API contract v0.1 draft, schemas, examples and backend notes.
