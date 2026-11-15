# SoilGrids soil properties

What: ISRIC SoilGrids 2.0 soil properties at the centroid of each of the 185 municipalities, used for the default soil class (clay) and soil descriptors.

- Endpoint: `https://rest.isric.org/soilgrids/v2.0/properties/query`, one call per municipality with `value=mean`, properties `clay`, `sand`, `silt`, `phh2o`, `soc`, `bdod` and depths `0-5cm`, `5-15cm`, `15-30cm`. Client: `backend/app/integrations/soilgrids.py`.
- Auth: none. Rate limits: the public API is rate limited and slow: 1 to 80 s per call, sometimes down. The client retries timeouts, 429 and 5xx (10 s, 20 s, 40 s backoff), timeout 180 s.
- Licence: CC BY 4.0 (ISRIC - World Soil Information); cite SoilGrids 2.0.

## Run

Run it offline, never per request:

```bash
python -m data extract soilgrids                    # 4 parallel workers
python -m data extract soilgrids --workers 2 --limit 10
python -m data etl load-soil                        # after etl load-reference
```

The run is resumable: municipalities that already have a file are skipped, failures are logged and left for the next run, and the manifest notes the failures of the last run. Re-run the same command until none are left.

## Output

`data/raw/soilgrids/<municipality_code>.json` is the API body untouched, plus `manifest.json`. The ETL unscales the integers into `soil_profiles`, one row per municipality and depth:

| Column                                | Unit        | Source scale             |
| ------------------------------------- | ----------- | ------------------------ |
| `clay_g_kg`, `sand_g_kg`, `silt_g_kg` | g/kg        | as mapped                |
| `ph`                                  | pH in water | mapped value times 0.1   |
| `soc_g_kg`                            | g/kg        | mapped dg/kg times 0.1   |
| `bulk_density_g_cm3`                  | g/cm3       | mapped cg/cm3 times 0.01 |

A masked cell (urban, water) comes back with `null` means and stays `NULL`, never 0. The default soil class of the municipality is derived from the thickness-weighted clay content of 0 to 30 cm (weights 5, 10, 15 cm): below 15% is class 1, 15 to 35% is class 2, above 35% is class 3. It is `NULL` when clay is missing at any depth, and the API then falls back to class 2 and says so.

## Known issues

- Slow and intermittent public REST API (see above). `python -m data doctor` mentions an offline raster fallback; none is implemented. Retry later or lower `--workers`.
- Centroid values describe one 250 m pixel, not the whole municipality, and are modeled estimates with uncertainty. The class is a default that the user can override.
