# Runbook

Operating the database and the data pipeline. Run modes are in [../README.md](../README.md); commands for the data tooling are in [../data/README.md](../data/README.md). Run `make` and `python -m data` from the repo root.

## Rules

- Never run `docker compose down -v`: it deletes the PostgreSQL volume `postgres_data`. `make stack-down` (plain `down`) keeps it.
- Back up before anything destructive (see below). `make seed` truncates the seeded tables.

## Reseed a database

For a fresh or disposable database, load the committed derived tables with no network:

```bash
make db migrate     # host; inside the devcontainer the db is already running
make seed           # or: docker compose --profile live run --rm seed
```

The seed has the catalog, municipalities, ZARC, PAM, soil, precomputed windows and dataset versions, but not the raw daily climate (`climate_daily`). It replaces the content of those tables, including the quality gate values.

## Rebuild from the sources

Full order (each ETL step is idempotent), details in [../data/README.md](../data/README.md#run-order):

```bash
python -m data extract ibge-geo
python -m data extract catalog
python -m data extract ibge-pam
python -m data extract zarc          # after the manual download, see below
python -m data extract power --cells all
python -m data extract soilgrids     # slow; resumable
python -m data etl load-reference
python -m data etl load-climate
python -m data etl load-soil
python -m data etl precompute-windows
python -m data validate gate
python -m data validate report      # optional: regenerate docs/validation/report.md
python -m data etl build-demo        # optional: refresh the committed seed
```

Use `PYTHONPATH=backend:.` (set in the devcontainer and by the `make` targets) and the `backend/.venv` python.

## Re-extract one source

Run its extract command, then the ETL step that loads it, then whatever depends on it:

| Source changed | Commands |
| --- | --- |
| POWER | `extract power --cells all --force`, `etl load-climate`, `etl precompute-windows`, `validate gate`, `validate report` |
| SoilGrids | `extract soilgrids`, `etl load-soil` (the default soil class changes; no recompute is needed because windows are stored for all three classes) |
| ZARC | `extract zarc`, `etl load-reference`, `validate gate` |
| PAM | `extract ibge-pam`, `etl load-reference` |
| Crop sheet or engine assumptions | `extract catalog`, `etl load-reference`, `etl precompute-windows`, `validate gate` |
| Municipal mesh | `extract ibge-geo`, `etl load-reference`, then the soil, climate and window steps for any new cell |

A new `METHOD_VERSION` stores new window rows next to the old ones and makes old analysis ids invalid: run `precompute-windows` and `validate gate` after changing it.

## Backup and restore

```bash
# backup (from the repo root, db running)
docker compose --profile live exec -T db pg_dump -U rurotation -d rurotation -Fc > cropshift.dump

# restore into the same stack
docker compose --profile live exec -T db pg_restore -U rurotation -d rurotation --clean --if-exists < cropshift.dump
```

Replace the user and database if you changed `POSTGRES_USER` or `POSTGRES_DB`. Check afterwards with `curl http://127.0.0.1:8000/health/db`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Port 3000 is busy | Another web instance or `next dev` runs. Stop it, or use `WEB_PORT=8080 make stack` (compose), or `npm run dev -- -p 3001` (the devcontainer forwards 3001). The API port is `API_PORT` (default 8000), the database `DB_PORT` (default 5433). |
| `make db` fails inside the devcontainer | The `db` service already runs there. Run `make db` and `make stack` on the host. |
| API answers 503 on `/health/db` | The database is down or the host/port is wrong: outside containers `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433`; inside compose `db` and `5432`. `make migrate` if the tables are missing. |
| `no_data` (404) for a place | No precomputed windows for its cell: run `etl precompute-windows` or `make seed`. |
| `extract soilgrids` is slow or fails | The public API takes 1-80 s per call and is sometimes down. Lower `--workers`, and re-run the same command: finished municipalities are skipped. |
| `extract zarc` says no CSV | The portal resets non-browser clients. Download the PE safra CSV in a browser into `data/raw/mapa_zarc/` (see [the source README](../data/sources/mapa_zarc/README.md)) and re-run. |
| `extract power` stops on one cell | Re-run the same command: cells already downloaded are skipped. |
| `doctor` reports `MISSING` for Earthdata or Gemini | Optional; see [api-keys.md](api-keys.md). |
| `make test` skips the contract tests | The database is not reachable: `make db migrate`. |
