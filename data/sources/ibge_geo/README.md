# IBGE municipal mesh and names

What: the 185 municipalities of Pernambuco: polygons, names, and the derived centroid and NASA POWER cell of each. Every other source is keyed by this municipality list.

- Endpoints (public, no key): mesh `https://servicodados.ibge.gov.br/api/v3/malhas/estados/26` with `formato=application/vnd.geo+json`, `qualidade=minima`, `intrarregiao=municipio`; names `https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios`.
- Auth: none. Rate limits: none documented; two requests per run, retried with backoff on 429 and 5xx.
- Licence: IBGE open data. The exact terms page is not confirmed; cite IBGE.

## Run

```bash
python -m data extract ibge-geo      # from the repo root with PYTHONPATH=backend:.
```

## Output

| File | Content |
| --- | --- |
| `data/raw/ibge_geo/mesh.geojson`, `names.json`, `manifest.json` | The API bodies untouched, and provenance. |
| `data/processed/geo/municipalities.json` | List of 185 records sorted by accent-folded name: `code` (7-digit IBGE string), `name`, `search` (lowercase, accent-free), `centroid` `{lat, lon}` (degrees, 5 decimals), `power_cell` `{id, lat, lon}` (cell centre, degrees), `geometry` (GeoJSON, `qualidade=minima` is simplified). |

The centroid is the area-weighted centroid of the outer rings. The POWER cell id is `r<row>c<col>` with row `round((lat + 90) / 0.5)` and column `round((lon + 180) / 0.625)`, the same rule as `web/src/lib/domain/geo.ts` (`app/core/geo.py`). The 185 centroids fall in 38 cells. The extraction fails if the mesh or the names do not have exactly 185 entries.

## Known issues

- The mesh quality is `minima`: good for a map and for point-in-polygon at municipality scale, not for boundary-accurate analysis near borders.
- A point near a border can be assigned to the neighbouring municipality; the API reports `near_centroid` when the point is in another climate cell than the municipality's centroid.
