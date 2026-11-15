# Data sources

What Cropshift is built from, how each source is accessed and what limits it has. Per-source details, output schemas and re-run steps are in the READMEs under [../data/sources/](../data/README.md). Credentials: [api-keys.md](api-keys.md).

| Source | What | Resolution and coverage | Licence | Access | Limits | Used for |
| --- | --- | --- | --- | --- | --- | --- |
| [NASA POWER](../data/sources/nasa_power/README.md) | Daily temperature, humidity, wind, pressure, solar radiation, rain | MERRA-2 grid 0.5 by 0.625 degrees, 38 cells over Pernambuco, 1984-2024 | Public domain, cite POWER | REST, no key | About 50 km gridded rain, not gauges; radiation only from 1984 | ET0, water balance, success frequency |
| [SoilGrids 2.0](../data/sources/soilgrids/README.md) | Clay, sand, silt, pH, organic carbon, bulk density, 0-30 cm | 250 m, sampled at each municipality centroid | CC BY 4.0 | REST, no key, run offline | Slow (1-80 s per call), intermittent | Default soil class (clay), descriptors |
| [IBGE malhas v3 and localidades](../data/sources/ibge_geo/README.md) | Municipal polygons and names | 185 municipalities, `qualidade=minima` | IBGE open data (terms page not confirmed) | REST, no key | Simplified polygons | Point to municipality, centroids, POWER cells |
| [IBGE PAM, SIDRA table 5457](../data/sources/ibge_pam/README.md) | Yield, production, area | Municipality and year, 2005-2024, nine products | IBGE open data (terms page not confirmed) | REST, no key | Pools rainfed and irrigated; beans pooled | Yield context next to the simulation |
| [MAPA ZARC](../data/sources/mapa_zarc/README.md) | Official climate risk table | Municipality, crop, soil class, cycle, 36 dekads, safra 2025/2026 | CC BY | Manual browser download | Portal resets non-browser clients; value meaning and dekad 1 unconfirmed | Reference window and the quality gate |
| [FAO-56 and EcoCrop crop sheet](../data/sources/fao_ecocrop/README.md) | Stage lengths, Kc, root depth, depletion fraction, climate requirements | 11 crops | FAO-56 transcribed; EcoCrop licence unconfirmed | Committed CSV | Reference values, not calibrated to the Northeast | Crop parameters of the engines |
| NASA Earthdata (AppEEARS, GES DISC) | Satellite soil moisture, NDVI, ET, rain | No extractor yet; [AppEEARS](../data/sources/earthdata_appeears/README.md) and [IMERG](../data/sources/earthdata_harmony/README.md) parsers and committed samples | Open, cite each product | Free account | Needs credentials for real downloads | The IMERG sample feeds the rain comparison in the [validation report](validation/report.md); planned ML features ([plan](../data/ml/README.md)) |

Provenance of each download (URL, parameters, retrieval time, licence, sha256) is in `data/raw/<source>/manifest.json`, and the retrieval times reach the API as `dataset_versions` in every recommendation.

## Unconfirmed assumptions

- Dekad 1 = Jan 1-10, and the planting date of a dekad is its first day.
- ZARC values 0, 20, 30 and 40 are read as published; `> 0` means recommended.
- Available water of 0.08, 0.11 and 0.14 m3/m3 for soil classes 1, 2 and 3: 0.11 is the proposal's premise, the other two are project assumptions.
- The EcoCrop licence and the IBGE terms page have not been checked.
