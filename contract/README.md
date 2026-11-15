# Cropshift API contract

Version 0.1, DRAFT. The FastAPI backend in [`../backend`](../backend/README.md) implements it and is tested against these schemas and examples. The web mock API stays the reference implementation until the three tracks (Entrega 0) ratify the contract.

The source of truth is the zod schemas in `web/src/contract/schemas.ts`. The files here are generated from them and are never hand-edited:

```bash
cd web
npm run gen:contract             # regenerate
npm run gen:contract -- --check  # fail if the files here are stale
```

`--check` runs in `npm run check`. The unit tests also validate every example against its schema with Ajv (`web/tests/unit/contract-files.test.ts`).

## Files

| File | Describes |
| --- | --- |
| `api-error.schema.json` | Error envelope. |
| `crops.schema.json` | `GET /api/v1/crops` response. |
| `resolve-request.schema.json`, `resolve-response.schema.json` | `POST /api/v1/locations/resolve`. |
| `recommendation-request.schema.json` | Body of `POST /api/v1/recommendations`. |
| `recommendation.schema.json` | Response of `POST /api/v1/recommendations`. |
| `explanation.schema.json` | Response of `POST /api/v1/recommendations/{id}/explain`. |
| `health.schema.json` | `GET /health`. |
| `examples/*.json` | Golden payloads from the mock, named `<schema>.<case>.json` (requests, responses, an error). |

Schemas are JSON Schema draft 2020-12. Examples are generated with a fixed timestamp, so they are stable.

## Conventions

- `municipality_code`: 7-digit IBGE code, as a string.
- Dekads are 1-based, 1 to 36. Dekad 1 = Jan 1-10 (assumption, to confirm).
- Probabilities are fractions in [0, 1]. `p_success` has 36 entries `{p, lo, hi}`; `lo`/`hi` is the 95% band.
- A window with `end_dekad < start_dekad` wraps past the end of the year.
- `analysis_id` is opaque to clients, but limited to URL-path-safe characters (`[A-Za-z0-9_.~-]+`, enforced by the schema) because it is a path segment in `/explain`; the web proxy rejects anything else. UUIDs, ULIDs and base64url fit.
- `crops[]` holds only crops that passed the quality gate, ranked 1..n in display order. `excluded[]` holds the rest. A crop is never in both.
- ZARC values are 0, 20, 30 or 40 and are shown as-is; their meaning as risk percent is unconfirmed. `zarc` is `null` when there is no mapping (irrigated regime, common bean rainfed). `pam` is `null` when PAM has no series (for example sunflower).
- Language: clients send `Accept-Language: en` or `pt-BR`. Servers localize human-readable fields (crop names, confidence reasons, `strengths`/`risks`/`missing_data`, excluded reasons, disclaimer texts, gate notes, explanation sections and `field_checks`, error messages) and fall back to English for any other value. Ids, codes and numbers are never localized (`crop_id`, `reason_code`, disclaimer `id`, `crop_label`, ZARC and PAM codes, `analysis_id`). `analysis_id` is language-neutral, so cache explanations by (id, language). Responses carry `Content-Language`; add `Vary: Accept-Language` if HTTP caching is ever introduced. Examples: `examples/recommendation.sao-bento-do-una.soil2.rainfed.pt-BR.json` and `examples/explanation.sao-bento-do-una.soil2.rainfed.pt-BR.json`. The schemas are unchanged.
- The schemas avoid `.refine`, `.transform` and defaults, so zod and the JSON Schema accept the same instances.

## Routes

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/v1/crops` | none | `crops` |
| `POST /api/v1/locations/resolve` | `{lat, lon}` | `resolve-response`: `coverage` is `covered` (with municipality and POWER cell) or `out_of_state` |
| `POST /api/v1/recommendations` | `{lat, lon}` or `{municipality_code}`, plus optional `soil_class` (1-3) and `regime` (`rainfed`, `irrigated`) | `recommendation` |
| `POST /api/v1/recommendations/{id}/explain` | none | `explanation` (`source`: `template` or `ai`) |
| `GET /health` | none | `health` |

The web app calls `/api/health`; the Next proxy maps it to the backend's `/health`. Every other path is served by the backend under the same `/api/...` path. The request takes either a point or a municipality, never both. When `soil_class` or `regime` is omitted the server applies a default and reports it in `location.soil_source` / `regime_source` (`user` or `default`).

## Errors

Every error uses the envelope:

```json
{ "error": { "code": "out_of_coverage", "message": "This point is outside Pernambuco. Cropshift covers Pernambuco only." } }
```

Codes: `invalid_request`, `invalid_coordinates`, `out_of_coverage`, `not_found`, `no_data`, `upstream_unavailable`, `rate_limited`, `internal`. See `examples/api-error.out-of-coverage.json`.

FastAPI must override its default `422 {"detail": [...]}` (the `RequestValidationError` handler) and its `HTTPException` handler so they return this envelope. The Next proxy wraps non-contract error bodies as a safety net, but the original code and message are lost when it does.

## Backend notes

Behavior of the implemented backend that the schemas do not express. See [../backend/README.md](../backend/README.md) for the full list.

- Routes beyond the table above: `GET /api/v1/crops/{id}` (one crop, `404 not_found` when unknown) and `GET /api/v1/recommendations/{id}` (re-derives an analysis from its id). `GET /health/db` is a readiness check, outside the contract.
- `analysis_id` is decodable and coordinate-free (`csa_<method>_<code>.<soil>.<u|d>.<r|i>.<u|d>.<p|m>.<0|1>`). Nothing is stored per analysis: the same id recomputes the same analysis.
- Irrigated regime: every crop is excluded with `reason_code: no_data_for_regime` and `zarc` is `null`. Only the rainfed water balance is simulated.
- The quality gate is applied per location: a crop is ranked only when the Spearman correlation between its 36 simulated frequencies and the ZARC window of that municipality and soil is at least 0.7, otherwise it is excluded as `gate_failed`; with no ZARC row it is `engine_not_run`. The crop-level `gate` object is the statewide median.
- Error messages are localized per `Accept-Language` and never echo request values. Status codes: `invalid_request` and `invalid_coordinates` 422 (framework errors such as 405 keep their status), `out_of_coverage` 422, `not_found` 404, `no_data` 404, `rate_limited` 429, `upstream_unavailable` 503, `internal` 500.

## Using it from FastAPI

- Validate: run `jsonschema` (draft 2020-12) against `examples/*.json` in the backend tests, and against your own responses.
- Generate models: `datamodel-code-generator --input contract/recommendation.schema.json --input-file-type jsonschema --output-model-type pydantic_v2.BaseModel`. Review the output: some constraints (for example the request union with `additionalProperties: false`) may need manual care. Not tried yet.
- Rate limiting: behind the Next proxy the client IP arrives in `X-Forwarded-For` (the proxy forwards the incoming value, else `X-Real-IP`). The backend must trust that header, from the proxy only, when limiting by client.
- Coordinates arrive only in request bodies and must not be logged or echoed in `Recommendation`.

## Fields added beyond the plan PDF

These need team ratification:

- `location`: `near_centroid`, `input_mode` (`point` or `municipality`), `soil_source`, `regime_source`; resolve response `near_centroid`.
- `zarc`: `cycle_code`, `soil_code`, `ordinance`, `season`.
- `pam`: `crop_label`, `state_median`.
- `excluded[]`: `reason_code` (`gate_failed`, `engine_not_run`, `no_data_for_regime`), `eligible`; ranked crops also carry `eligible: true` and `legume` (boolean, drives the legume badge).
- Crop `gate` object: `status` (`passed`, `failed`, `not_run`), `metric`, `value`, `threshold`, `note`; `has_zarc`, `has_pam`.
- `crops` response: `requirements` per crop (nullable), the raw FAO-56 and EcoCrop crop sheet from the team's `ficha_exigencias_culturas_FAO56_EcoCrop.csv`: `fao56` (`stage_days`, `kc`, `max_height_m`, `max_root_depth_m`, `depletion_fraction`, `salinity_threshold_ece_ds_m`) and `ecocrop` (`species`, optimal and absolute temperature and rainfall, `ph_optimal`, `cycle_days`, `tolerances`). Ranges are `{min, max}` (`min` equals `max` for single values). Values are as published: `stage_days.total` can differ from the stage sum (cowpea 100 vs 110, sorghum 125 vs 130) and is kept raw. Example: `examples/crops.json`.
- `location.municipality_centroid` `{lat, lon}`: the municipality's centroid (IBGE mesh). The user's point is not echoed back: the client already has it, and keeping it out of responses keeps it out of logs (it is also not in `analysis_id` or the page URL).
- `explanation`: `field_checks`, `source` (`template` or `ai`).
- `confidence` (`level` plus `reasons`), `flags`, `disclaimers`, `dataset_versions`, `mock`.
- `Accept-Language` / `Content-Language` handling (see Conventions).
- The `crops[]` / `excluded[]` split itself, and the error code list.
