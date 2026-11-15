# Machine learning (plan, not implemented)

Nothing here is trained or applied. `flags.ml_applied` is `false` in API responses because only the identity calibrator exists. What exists is the seam in `backend/app/engines/calibration/`: the `Calibrator` protocol, `IdentityCalibrator` (returns the simulation unchanged with `applied=False`) and `features.FEATURES`, the documented inputs of a future model (names, units, sources). The recommendation service already passes each curve through a `Calibrator` (the identity one), so a trained model plugs in there. This file records the intended design so that it is built with the known risks in mind.

## Targets

- ZARC window or risk class per municipality, crop, soil class and dekad (values 0, 20, 30, 40; their meaning as risk percent is unconfirmed).
- IBGE PAM yield (kg/ha) per municipality, crop and year, as a municipal context signal.

## Features

- Simulation indicators from `planting_window_results` and the engines: success frequency, ETa/ETc percentiles, mid-season deficit, heat and cold days.
- Climate and soil descriptors: POWER aggregates per cell, SoilGrids properties per municipality.
- Satellite data (rainfall such as IMERG, soil moisture such as GLDAS, vegetation indices) via NASA Earthdata, which needs credentials (see [../../docs/api-keys.md](../../docs/api-keys.md)). No satellite extractor exists yet; only parsers for sample files ([appeears](../sources/earthdata_appeears/README.md), [harmony](../sources/earthdata_harmony/README.md)).

## Leakage and evaluation

- ZARC is derived from a water balance. A model that sees water-balance features and predicts ZARC mostly learns the method, not the crop. Do not treat that agreement as validation.
- Hold out whole municipalities (and ideally whole climate cells) when evaluating. Neighbouring municipalities share a POWER cell, so random row splits leak.
- PAM pools rainfed and irrigated areas and, for beans, all bean types: it is context, not field-level yield. Use years as a time-based split for yield targets.
- Report against the engine alone, and against a baseline of the statewide ZARC mean, before claiming any gain.
