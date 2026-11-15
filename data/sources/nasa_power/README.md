# NASA POWER daily climate

What: daily meteorology 1984-01-01 to 2024-12-31 for the centre of each POWER grid cell that holds a Pernambuco municipality centroid (38 cells). The input of the ET0 and water-balance engines.

- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point` (public, community `AG`, format JSON), queried at the cell centre, never at a user coordinate. Client: `backend/app/integrations/nasa_power.py`.
- Parameters: `T2M`, `T2M_MAX`, `T2M_MIN` (degC), `RH2M` (%), `WS2M` (m/s at 2 m), `PS` (kPa), `ALLSKY_SFC_SW_DWN` (MJ/m2/day), `PRECTOTCORR` (mm/day, bias-corrected).
- Auth: none. Rate limits: not documented to us; the shared client retries timeouts, 429 and 5xx with backoff (5 s, 10 s, 20 s), honoring `Retry-After`. Timeout 120 s per call; one cell is a single request of about 2 MB.
- Licence: NASA POWER data are public domain; cite POWER (power.larc.nasa.gov).
- Grid: MERRA-2, 0.5 degrees latitude by 0.625 degrees longitude. Radiation exists only from 1984, which is why the series starts there.

## Run

```bash
python -m data extract ibge-geo                 # once: the cells come from its output
python -m data extract power --cells pilot      # cell r163c230 only (Sao Bento do Una)
python -m data extract power --cells all        # the 38 cells
python -m data extract power --cells all --force   # refetch everything
```

Re-running skips cells whose file matches the manifest checksum, and checkpoints the manifest after each cell, so an interrupted run resumes.

## Output

`data/raw/nasa_power/<cell_id>.json` is the API body untouched (GeoJSON feature: `geometry.coordinates` is `[lon, lat, elevation_m]`, `properties.parameter.<NAME>.<YYYYMMDD>`), plus `manifest.json`. Fill value `-999` means missing: the parser turns it into `None`, and the ETL stores `NULL` in `climate_daily` (never 0). `etl load-climate` loads it; elevation comes from the third coordinate.

Result obtained: 38 cells times 14,976 days = 569,088 rows, no gaps. The pilot cell `r163c230` (centre -8.5, -36.25) has elevation 618 m, annual rainfall 957 mm (1984-2023) and 2024 rainfall 652 mm.

## Known issues

- Rainfall is a gridded, bias-corrected product at about 50 km: it smooths local convective events, so it is not a rain-gauge series.
- A failed cell aborts the run with an error; re-run the same command to continue.
