# Cropshift data tooling

Extraction scripts, ETL and validation for the backend's database. The API never calls these sources at request time: it reads what this tooling loaded. Source overview, licences and limits: [../docs/data-sources.md](../docs/data-sources.md). Credentials: [../docs/api-keys.md](../docs/api-keys.md). Operating it: [../docs/runbook.md](../docs/runbook.md).

## Run

From the repo root, with `PYTHONPATH=backend:.` (the devcontainer sets it; `make doctor` sets it for you):

```bash
make install                                   # backend/.venv with backend + data dependencies
PYTHONPATH=backend:. backend/.venv/bin/python -m data --help
make doctor                                    # check every source, credential and the database (never prints secrets)
```

`python -m data -v ...` turns on debug logging. Dependencies on top of the backend's are in `requirements.txt`. Environment is read from `backend/.env` then `data/.env` (both git-ignored); real environment variables win.

## Commands

| Command | Does | Needs |
| --- | --- | --- |
| `doctor [--strict]` | One check per source, credential and the database, with the fix for each failure. | network, optional |
| `extract ibge-geo` | Municipal mesh and names, centroids, POWER cell per municipality. | network |
| `extract catalog` | Crop catalog from the FAO-56 + EcoCrop sheet. | offline |
| `extract ibge-pam` | PAM yields 2005-2024. | network |
| `extract zarc [--file CSV]` | ZARC windows from a manually downloaded CSV. | the CSV |
| `extract power --cells pilot\|all [--force]` | NASA POWER daily series per cell. | `extract ibge-geo` first |
| `extract appeears [--start --end]` | AppEEARS pilot-point samples (SMAP, MODIS, NASADEM). Needs Earthdata credentials; mock-tested only. | `EARTHDATA_*` in `data/.env` |
| `extract soilgrids [--workers N] [--limit N]` | SoilGrids profiles per municipality centroid. | `extract ibge-geo` first |
| `etl load-reference` | Catalog, cells, municipalities, ZARC, PAM and dataset versions into the database. | the four processed outputs above, a migrated database |
| `etl load-climate` | POWER series into `climate_daily`. | `load-reference` (cells must exist) |
| `etl load-soil` | SoilGrids profiles and each municipality's default soil class. | `load-reference` |
| `etl precompute-windows [--cell ID] [--crop ID]` | Simulate every cell, crop and soil class (rainfed), store the 36-dekad results. | `load-reference`, `load-climate` |
| `validate gate` | Spearman agreement with ZARC per crop; writes the statewide gate on each crop. | `precompute-windows` |
| `validate report` | Write `docs/validation/report.md` from the database and the committed IMERG sample. | `validate gate` |
| `etl build-demo` | Export the derived tables to `data/demo/*.csv.gz` and a manifest (the committed seed). | the full pipeline above, in the database |
| `load-demo` | Load the committed seed into an empty database: no network, no credentials. Truncates the seeded tables first. | a migrated database |

## Run order

```text
extract ibge-geo, catalog, ibge-pam, zarc, power, soilgrids      (any order after ibge-geo; zarc is manual)
etl load-reference -> load-climate -> load-soil -> precompute-windows
validate gate
validate report                                                  (writes docs/validation/report.md)
```

Alternatively, on a fresh migrated database, `load-demo` (`make seed`) loads the committed derived tables and the API can serve without any extraction. Every ETL step is idempotent, so re-running it is safe. Re-run `precompute-windows` and `validate gate` after changing the engines, the crop parameters or the soil assumptions.

## Layout

| Path | What |
| --- | --- |
| `sources/<name>/` | One extractor per source, each with its own README: [fao_ecocrop](sources/fao_ecocrop/README.md), [ibge_geo](sources/ibge_geo/README.md), [ibge_pam](sources/ibge_pam/README.md), [mapa_zarc](sources/mapa_zarc/README.md), [nasa_power](sources/nasa_power/README.md), [soilgrids](sources/soilgrids/README.md). `earthdata_appeears` and `earthdata_harmony` hold parsers and sample CSVs for satellite products; `extract appeears` is wired into the CLI (pilot point, untested against the live service) and there is no IMERG download script: [appeears](sources/earthdata_appeears/README.md), [harmony](sources/earthdata_harmony/README.md). |
| `etl/` | Load and precompute steps: [README](etl/README.md). |
| `validate/` | Quality gate: [README](validate/README.md). |
| `ml/` | Plan for machine learning, not implemented: [README](ml/README.md). |
| `raw/` | Untouched downloads plus a `manifest.json` per source (URL, parameters, retrieval time, licence, sha256). Git-ignored. |
| `processed/` | Derived files (`catalog/`, `geo/`, `pam/`, `zarc/`). Git-ignored. |
| `demo/` | Committed seed: gzipped CSV of the derived tables (catalog, municipalities with geometry, ZARC, PAM, soil, precomputed windows, dataset versions) and `manifest.json` with row counts and sha256. It holds no raw climate series (about 80 MB): re-extract POWER to re-run the simulation. |
| `_common/` | Paths, env loading, the shared HTTP retry (`app.integrations.http`), manifests. |

`raw/` and `processed/` are not committed: a fresh clone must extract them, except the crop sheet, which is committed under `sources/fao_ecocrop/`. The seed in `demo/` is committed.

## Provenance

Each extractor writes `raw/<source>/manifest.json` with `source`, `url`, `params`, `retrieved_at`, `licence`, `notes` and the `sha256` and size of every file. The ETL copies `retrieved_at` into the `dataset_versions` table, which the API reports in every recommendation.
