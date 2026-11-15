# Cropshift backend

FastAPI service that implements the [API contract](../contract/README.md) v0.1 for Pernambuco. Requests are answered from the database: nothing is simulated or fetched from external services per request, except the optional Gemini explanation. For the why behind the design see [../docs/backend-architecture.md](../docs/backend-architecture.md); for loading data see [../data/README.md](../data/README.md).

## Layers

`app/` is layered, and each layer only calls the one below it:

| Layer | Path | Role |
| --- | --- | --- |
| API | `app/api/` | Routers, dependency wiring (`deps.py`), locale and rate-limit dependencies. No logic. |
| Services | `app/services/` | Use cases: catalog, location resolve, recommendation, explanation, and the localized text of the payload. |
| Repositories | `app/repositories/` | All SQLAlchemy queries (crops, municipalities, climate, soil, ZARC and PAM, precomputed windows). |
| Integrations | `app/integrations/` | Clients of external services: NASA POWER, SoilGrids, IBGE SIDRA, Gemini, and the shared HTTP retry policy. Used by the `data/` extractors and ETL, and by the explanation layer. |
| Engines | `app/engines/` | Pure numpy functions, no I/O and no database: dekad calendar, FAO-56 Penman-Monteith ET0, crop cycle vectors, root-zone water balance, season simulation, window statistics, confidence. |
| Core | `app/core/` | Settings, database session, error envelope, i18n and message catalog, logging, rate limiter, geometry helpers. |
| Models, schemas | `app/models/`, `app/schemas/` | SQLAlchemy tables, and Pydantic models that mirror the contract schemas. |

## Run

From the repo root (see [../README.md](../README.md) for the three run modes):

```bash
make install && make db && make migrate
make run        # http://127.0.0.1:8000, interactive docs at /docs
```

The image is built from `backend/Dockerfile` with the repo root as context: target `runtime` is the API (non-root, `uvicorn` with `--no-access-log`, a `/health` healthcheck), target `tools` adds `data/` and `contract/` and runs `python -m data` (used by the compose `seed` service).

## Configuration

Read from the environment and `backend/.env` (copy `backend/.env.example`; git-ignored). Every field has a development default, so tests, CI and Alembic need no `.env`. Names are the upper-case field names; list values are comma separated. Defined in `app/core/config.py`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `APP_NAME` | `Cropshift API` | Title in the OpenAPI docs and `GET /api/v1/`. |
| `APP_ENV` | `development` | Environment label. |
| `DEBUG` | `false` | FastAPI debug mode. |
| `LOG_LEVEL` | `INFO` | Python logging level. |
| `API_V1_PREFIX` | `/api/v1` | Prefix of the business routes. |
| `CORS_ORIGINS` | empty | Allowed browser origins. Empty is correct behind the web app's same-origin proxy. |
| `CONTRACT_VERSION` | `0.1` | Reported by `/health` and in every payload. |
| `METHOD_VERSION` | `mvp-1` | Method version: stored with precomputed results and embedded in `analysis_id`. Changing it makes older ids and stored results unusable until the windows are recomputed. |
| `DATA_VERSION` | `2026-11-15` | Reported by `/health`; bump it when data is re-extracted and the seed rebuilt. |
| `DATABASE_URL` | empty | Full SQLAlchemy URL. When set it wins over the `POSTGRES_*` parts. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `rurotation`, `change_me`, `rurotation` | Database credentials (development defaults; change them anywhere shared). |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `localhost`, `5433` | Host port 5433 maps to 5432 in the `db` container. Inside compose the host is `db` and the port 5432. |
| `RATE_LIMIT_PER_MIN` | `60` | Token bucket per client IP on the POST routes. `0` disables it. |
| `TRUSTED_PROXIES` | empty | Peer IPs whose `X-Forwarded-For` is believed. Without it the direct peer IP is the client. |
| `GEMINI_API_KEY` | empty | Enables AI-written explanations (the model chain below is tried in order). Secret: never commit it. See [../docs/api-keys.md](../docs/api-keys.md). |
| `GEMINI_MODEL` | empty | First-choice Gemini model. |
| `GEMINI_FALLBACK_MODELS` | empty | Comma-separated models tried in order when the previous one fails (retired, 5xx, timeout, quota, bad JSON). Built-in defaults (`gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`) are appended; duplicates are dropped. |
| `GEMINI_TIMEOUT_S` | `12.0` | Timeout of one model call in seconds. |
| `GEMINI_TOTAL_TIMEOUT_S` | `30.0` | Budget for the whole chain; `/explain` never waits longer, then answers with the template. A model that just failed is skipped for 60 s. |

The rate limiter is in-process, so it assumes one uvicorn worker (the compose default); behind several workers limit at the proxy.

## Endpoints

Business routes live under `/api/v1`. Contract schemas are in [../contract/](../contract/README.md).

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Liveness and versions (`contract_version`, `method_version`, `data_version`, `mock: false`). Never touches the database. |
| `GET /health/db` | Readiness: 200 only when the database answers, else 503 `upstream_unavailable`. Not in the contract. |
| `GET /api/v1/` | Service info. |
| `GET /api/v1/crops` | Crop catalog with raw FAO-56 and EcoCrop requirements and each crop's statewide quality gate. |
| `GET /api/v1/crops/{id}` | One crop. Not in the contract table. |
| `POST /api/v1/environment` | Backend-only: stored POWER climate summary, SoilGrids layers and elevation behind an analysis (body `{lat, lon}` or `{municipality_code}`; not query string, so coordinates stay out of URLs). |
| `POST /api/v1/locations/resolve` | `{lat, lon}` to municipality and POWER cell, or `out_of_state`. |
| `POST /api/v1/recommendations` | Ranked crops, windows and excluded crops for `{lat, lon}` or `{municipality_code}` plus optional `soil_class` (1-3) and `regime`. |
| `GET /api/v1/recommendations/{id}` | Recomputes an earlier analysis from its id. Not in the contract table. |
| `POST /api/v1/recommendations/{id}/explain` | Plain-language explanation: template, or Gemini when configured. |

POST routes are rate limited. Responses carry `Content-Language` and `Vary: Accept-Language`, and `X-Request-ID` (an incoming safe value is kept, else generated).

Behavior worth knowing:

- Soil class defaults to the municipality's class derived from SoilGrids clay content, else 2. Regime defaults to `rainfed`. The response reports each source as `user` or `default`.
- Irrigated regime: every crop is excluded with `no_data_for_regime`. Only the rainfed balance is simulated.
- The quality gate runs per location: the Spearman correlation between a crop's 36 simulated frequencies and the ZARC window at that municipality and soil must be at least 0.7, else `gate_failed`; no ZARC row gives `engine_not_run`. The `gate` in the crops response is the statewide median written by `python -m data validate gate`.
- Crops are ranked by the highest mean frequency over any 3 consecutive dekads (wrapping), ties by `crop_id`.
- `analysis_id` is `csa_<method>_<code>.<soil>.<u|d>.<r|i>.<u|d>.<p|m>.<0|1>`: municipality code, soil class and source, regime and source, input mode, near-centroid flag. It holds no coordinates and nothing is stored per analysis.
- Explanations: the template is deterministic. With `GEMINI_API_KEY` set, Gemini (through the model chain above) rewrites the already computed payload; the answer is discarded for the template if it fails validation, states a percentage that is not derivable from the payload, or the call fails. Accepted answers are cached in memory per (id, language). Gemini receives no coordinates or personal data.
- ML is scaffolded only: every ranked crop has `flags.ml_applied = false`. `app/engines/calibration/` holds the `Calibrator` interface, an identity implementation and the documented feature list; the recommendation service passes every curve through a `Calibrator`, which is the identity one today. Plan: [../data/ml/README.md](../data/ml/README.md).

## Errors

Every error uses the contract envelope `{"error": {"code", "message"}}`, localized to `en` or `pt-BR` from `Accept-Language` (English otherwise). Messages never repeat request values, and coordinates are never logged (only method, path, status and duration are).

| Code                   | Status | When                                                                                     |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `invalid_request`      | 422    | Body fails validation; framework errors such as 405 keep their own status.               |
| `invalid_coordinates`  | 422    | `lat` or `lon` out of range.                                                             |
| `out_of_coverage`      | 422    | Point or municipality outside Pernambuco (`resolve` answers 200 `out_of_state` instead). |
| `not_found`            | 404    | Unknown crop id, unknown or undecodable analysis id, unknown path.                       |
| `no_data`              | 404    | Rainfed analysis for a cell with no precomputed windows.                                 |
| `rate_limited`         | 429    | Token bucket empty.                                                                      |
| `upstream_unavailable` | 503    | Database unreachable on `/health/db`.                                                    |
| `internal`             | 500    | Unhandled exception (logged with the request id).                                        |

## Database and migrations

PostgreSQL 16 with PostGIS (`postgis/postgis:16-3.5`). Migrations are in `alembic/versions/`: `0002_enable_postgis`, `0003_catalog` (crops, requirements, growth stages, parameter sources), `0004_geo_climate` (climate cells, municipalities with geometry, daily climate, soil profiles, dataset versions) and `0005_reference_results` (ZARC windows, PAM yields, precomputed `planting_window_results`, and `recommendation_runs`, an audit table the API does not write yet).

```bash
cd backend
python -m alembic upgrade head
python -m alembic revision --autogenerate -m "describe the change"   # then review the file
python -m alembic downgrade -1
```

`make migrate` runs the upgrade. In the compose stack the `migrate` service runs it before the API starts. CI applies, checks (`alembic check`), downgrades to base and re-applies.

## Tests and lint

```bash
make test    # cd backend && pytest -m "not live"
make lint    # ruff check and format --check on backend and data (config: ../ruff.toml)
make format  # ruff fix and format
make check   # lint + test
```

- `tests/unit`: pure engines, geometry, i18n, rate limiter, config, explanation template. No database.
- `tests/contract`: every route validated against `contract/*.schema.json` with `jsonschema`. These are marked `db` and skip themselves when the database is unreachable, so run `make db migrate` first for the full set. The golden examples in `contract/examples/` are also fed through the window selection (`tests/unit/test_windows.py`).
- `tests/data`: parity of the Python crop catalog with the web mock's.
- Markers (`pyproject.toml`): `db` needs the PostGIS database; `live` calls real external APIs and is excluded by `make test`; run them with `cd backend && python -m pytest -m live`. No test is currently marked `live`.
- The test setup disables the rate limit and blanks `GEMINI_API_KEY`, so tests never call Gemini.
- CI: `.github/workflows/backend-ci.yml` runs lint, the migration round trip and `pytest -m "not live"` against a PostGIS service, and builds the `runtime` and `tools` images.

## Not implemented (deliberately deferred)

- The PDF plan's static suitability score is built (`app/engines/suitability`: trapezoid scores for temperature, rainfall and topsoil pH against the EcoCrop ranges, weighted aggregate with coverage, "not evaluated" for missing data) but only feeds the risk and missing-data notes of a result: it is not used for ranking (water would be counted twice) and the score is not in the payload (that needs a contract v0.2). It needs `climate_daily`, which is not part of the demo seed, so a database filled only from the seed omits those notes.
- ML calibration: only the seam exists (`app/engines/calibration`, identity calibrator, `ml_applied: false`).
- Irrigated analyses: every crop is excluded with `no_data_for_regime` (the success rule is meaningless without water stress).
- Satellite data in the runtime (SMAP, MODIS, IMERG): not used by the API; extraction clients exist only in `data/`.
- Inline computation on a cache miss and a job queue (all 38 cells are precomputed, a miss returns `no_data`), the `explanations` table (the explain cache is in memory), `recommendation_runs` writes, `tests/live` smoke tests and `docs/validation/evidence/`.
