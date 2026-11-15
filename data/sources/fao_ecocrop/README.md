# FAO-56 and EcoCrop crop sheet

What: the team's crop parameter sheet, committed in this directory, and the code that turns it into the crop catalog the engines read (stage lengths, Kc, root depth, depletion fraction, temperature and rainfall requirements).

- Inputs: `ficha_exigencias_culturas_FAO56_EcoCrop.csv` (one row per crop, FAO-56 columns plus EcoCrop columns; decimals with a dot, ranges as `min-max`) and `crops_meta.csv` (`crop_id`, sheet row, English and Portuguese names, family, `pam_crop`, `zarc_name`). 11 crops: cowpea, peanut, sorghum, maize, common bean, sunflower, castor, cotton, pearl millet, cassava, sweet potato.
- Origin: FAO-56 (Allen et al. 1998, tables 11, 12, 22 and 23, <https://www.fao.org/4/x0490e/x0490e00.htm>) and the FAO EcoCrop database through the OpenCLIM copy (<https://github.com/OpenCLIM/ecocrop>). No network access is needed to build the catalog.
- Licence: FAO-56 values are transcribed from the bulletin; the EcoCrop data licence is not confirmed. Check it before redistributing the sheet.

## Run

```bash
python -m data extract catalog       # writes data/processed/catalog/crops.json and manifest.json
python -m data etl load-reference    # loads it into the database
```

## Output

`data/processed/catalog/crops.json`: one object per crop with `requirements` (`fao56` and `ecocrop` as published: ranges are `{min, max}`, stage days keep the sheet's raw `total`), `stages` (the four stages with Kc and root depth at each end) and `sources` (provenance per parameter, `published` or `assumption`).

Derivation rules in `parse.py` (assumptions, recorded in `crop_parameter_sources`):

- Kc is flat at Kc ini, linear to Kc mid across development, flat, then linear to Kc end; a range uses its midpoint. A blank Kc ini defaults to 0.35.
- Root depth is 0.15 m at planting, linear to the lower published maximum by the end of development, constant afterwards.
- Cycle length used by the simulation is the sum of the stage days. The sheet's total can differ (cowpea: stages sum to 100, total says 110) and is kept raw in `requirements`.

`backend/tests/data/test_catalog_parity.py` checks that this parser matches the web mock's fixture builder.

## Known issues

- FAO-56 values are reference values for specific regions and dates, not calibrated to Northeast Brazil.
- Pearl millet, cassava and sweet potato have no ZARC mapping (`zarc_name` empty), so they cannot be gated and are excluded as `engine_not_run`.
