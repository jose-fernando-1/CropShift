# ETL

Loads extracted files into the database through the backend repositories, and runs the engines to precompute results. Run through `python -m data etl <step>` (see [../README.md](../README.md) for the order). All steps are idempotent.

| Step | Reads | Writes |
| --- | --- | --- |
| `load-reference` | `processed/catalog/crops.json`, `processed/geo/municipalities.json`, `processed/zarc/zarc_windows.csv`, `processed/pam/pam_pe.csv` | `crops` and its requirement, stage and source tables, `climate_cells`, `municipalities` (with polygon), `zarc_windows`, `pam_yields`, `dataset_versions` (ZARC, PAM, IBGE mesh, crop sheet). |
| `load-climate` | `raw/nasa_power/r*.json` | `climate_daily` (replaced per cell), the cell's `elevation_m`, a `dataset_versions` row. A POWER `-999` becomes `NULL`. |
| `load-soil` | `raw/soilgrids/<code>.json` | `soil_profiles` and `municipalities.default_soil_class` (ZARC texture class from thickness-weighted 0-30 cm clay: below 15% is 1, 15 to 35% is 2, above 35% is 3; `NULL` for a masked cell). |
| `precompute-windows` | database: climate, crop stages and requirements | `planting_window_results`: per cell, crop, soil class (1-3) and dekad, `n_valid`, `n_success`, `p`, Wilson 95% `lo` and `hi`, percentiles of ETa/ETc, mid-season deficit, heat and cold days. Rainfed only. |

`precompute-windows` uses the pure functions in `backend/app/engines/` and the assumptions in `backend/app/engines/water_balance.py` (available water 0.08, 0.11 and 0.14 m3/m3 for soil classes 1, 2 and 3; initial moisture 60%; effective rain equals rain; no irrigation). It simulates 40 planting seasons (1984-2023). A re-run replaces the rows of the current `METHOD_VERSION`. Options: `--cell r163c230`, `--crop cowpea`.

## Demo seed

`etl build-demo` exports these tables to `data/demo/<table>.csv.gz` (reproducible bytes) and writes `data/demo/manifest.json` with row counts and sha256: `crops`, `crop_requirements`, `crop_growth_stages`, `crop_parameter_sources`, `climate_cells`, `municipalities`, `zarc_windows`, `pam_yields`, `soil_profiles`, `planting_window_results`, `dataset_versions`. It excludes `climate_daily`.

`load-demo` (`python -m data load-demo`, `make seed`, or the compose `seed` service) verifies the checksums, truncates those tables (with `CASCADE`, and resets their ids) and loads the files. Use it on a fresh database; it replaces whatever those tables held. To re-run the simulation afterwards, extract and `load-climate` the POWER series again.
