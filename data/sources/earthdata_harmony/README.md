# NASA GES DISC time series (IMERG)

Status: parser and a committed sample file only. There is no extractor and no CLI command to download it, nothing is loaded into the database, and the API does not use it. `python -m data validate report` reads the sample to compare IMERG with POWER rain (see [../../../docs/validation/report.md](../../../docs/validation/report.md)). It is also groundwork for the [ML plan](../../ml/README.md).

What `parse.py` reads: GES DISC point time-series CSVs (Giovanni or Harmony, for example GPM IMERG Final daily rainfall). The file has `key,value` header lines, a blank line, then `Timestamp (UTC),Data`. `read_giovanni_series` returns the metadata and a value per day; the undefined marker declared in the header (for example -9999.9) becomes `None`, never 0. `sample/` holds one example series.

- Access to the real service: NASA Earthdata credentials, and for IMERG the "NASA GESDISC DATA ARCHIVE" application must be approved in the Earthdata profile; see [../../../docs/api-keys.md](../../../docs/api-keys.md).
- Licence: NASA GES DISC data are open; cite the product.
