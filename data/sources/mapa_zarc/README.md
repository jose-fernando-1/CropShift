# MAPA ZARC (agricultural climate risk zoning)

What: the official "Tabua de Risco" of the Ministry of Agriculture: for each municipality, crop, soil class and cycle, a risk value per dekad. It is the reference the simulated windows are compared with.

- Source: `https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico`, the safra CSV for Pernambuco. The file used is `zarc_tabua_risco_safra2025_2026_PE.csv` (semicolon separated, UTF-8 with BOM).
- Auth: none. Licence: CC BY (MAPA open data).
- Access: the portal resets connections from non-browser clients such as `curl`, so the download is manual.

## Run

1. In a browser, open the dataset page above and download the safra CSV for PE into `data/raw/mapa_zarc/`.
2. Ingest it:

```bash
python -m data extract zarc                          # picks the last *.csv in data/raw/mapa_zarc/
python -m data extract zarc --file ~/Downloads/zarc_tabua_risco_safra2025_2026_PE.csv   # copies it there first
python -m data etl load-reference
```

Without a CSV the command exits asking for the download.

## Output

`data/processed/zarc/zarc_windows.csv`, one row per municipality, crop and texture soil class: `municipality_code`, `crop_id`, `soil_code` (1-3), `cycle_code`, `ordinance`, `season`, `climate`, `values`. `values` is a 36-character digit string, one character per dekad: `0`, `2`, `3`, `4` stand for risk values 0, 20, 30, 40 (the loader converts back to integers). Provenance goes in `data/raw/mapa_zarc/manifest.json`.

Selection rules (the same as `web/scripts/build-mock-fixtures.ts`): rainfed rows only (`Nome_Outros_Manejos` is `Sequeiro`); texture classes 1-3 only (the AD classes 11-16 have no mapping from 1-3); among several rows for the same municipality, crop and soil, cycle `21` first, then the lowest cycle, then the general climate (`Nao se aplica`) over a regional variant. Crops are mapped by `zarc_name` in `sources/fao_ecocrop/crops_meta.csv`; the file must hold exactly one season.

## Known issues

- The meaning of 0, 20, 30 and 40 as risk percent is not confirmed in the ZARC dictionary; they are kept as published and the API treats `> 0` as "recommended".
- Dekad 1 = Jan 1-10 is an assumption, not confirmed in the ordinances.
- Common bean has only AD soil classes in rainfed ZARC, so it has no ZARC window here, and the irrigated regime is not mapped.
- ZARC is itself derived from a water balance, so agreement with it is not independent validation.
