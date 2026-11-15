# NASA Earthdata AppEEARS (satellite point samples)

Status: parsers and sample files only. `python -m data extract appeears` (pilot point, needs `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`) exists but has only been tested against a mocked transport, never against the live service; nothing is loaded into the database, and the API does not use satellite data. It is groundwork for the [ML plan](../../ml/README.md).

What `parse.py` reads: AppEEARS point-sample CSVs, one row per date with columns named `<PRODUCT>_<layer>`. `LAYERS` declares, per layer, the product, the column suffix, the unit and the fill values (which become `None`, never 0): SMAP L4 root-zone and surface soil moisture (m3/m3), SMAP L3 morning soil moisture, MODIS NDVI (MOD13Q1), evapotranspiration (MOD16A2GF), LAI and FPAR (MOD15A2H), GPP (MOD17A2HGF), and NASADEM and SRTM elevation (m). Several rows can share a date (SMAP L4 is 3-hourly). `sample/` holds example downloads.

- Access to the real service: AppEEARS API, which needs NASA Earthdata credentials (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD` in `data/.env`); see [../../../docs/api-keys.md](../../../docs/api-keys.md). `python -m data doctor` checks the login.
- Licence: NASA Earthdata data are open; cite each product.
