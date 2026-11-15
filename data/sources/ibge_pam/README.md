# IBGE PAM (municipal agricultural production)

What: yield, production and harvested area per municipality, crop and year, 2005-2024, for Pernambuco. Shown next to the simulation as context.

- Endpoint: SIDRA table 5457 (`https://apisidra.ibge.gov.br/values/t/5457/n6/in n3 26/v/112,214,216/p/2005-2024/c782/<product>`), one request per product. Variables: 112 yield (kg/ha), 214 production (t), 216 harvested area (ha). Client: `backend/app/integrations/sidra.py`.
- Products (classification 782): `algodao_herb` 40099, `amendoim` 40101, `batata_doce` 40104, `feijao` 40112, `girassol` 40114, `mamona` 40118, `mandioca` 40119, `milho` 40122, `sorgo` 40125.
- Auth: none. Rate limits: SIDRA caps an answer at 100,000 values, which one request per product stays under. Retries with backoff, timeout 120 s.
- Licence: IBGE open data; the terms page is not confirmed, cite IBGE.

## Run

```bash
python -m data extract ibge-pam
```

## Output

`data/raw/ibge_pam/<product>.json` (API body) and `manifest.json`, and `data/processed/pam/pam_pe.csv` with columns `cod_mun` (7-digit code), `ano`, `cultura` (the product label above), `area_colhida_ha`, `producao_t`, `rendimento_kg_ha`. Only municipality-years with a positive yield are kept. SIDRA's `-`, `..`, `...` and `X` become empty cells, never 0. `etl load-reference` loads it into `pam_yields`.

## Known issues

- PAM is a municipal statistic that pools rainfed and irrigated areas; for `feijao` it pools all bean types, so cowpea and common bean share it. It is context, not field-level yield.
- Sunflower, pearl millet have no PAM series in the crop sheet mapping (`pam_crop` empty), and the API returns `pam: null` for them.
