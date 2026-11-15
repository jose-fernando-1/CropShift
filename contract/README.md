# Field Shift API contract

Version 0.1, DRAFT. To be ratified by the three tracks (Entrega 0) before the FastAPI backend implements it. Until then the web mock API is the reference implementation.

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
{ "error": { "code": "out_of_coverage", "message": "This point is outside Pernambuco. Field Shift covers Pernambuco only." } }
```

Codes: `invalid_request`, `invalid_coordinates`, `out_of_coverage`, `not_found`, `no_data`, `upstream_unavailable`, `rate_limited`, `internal`. See `examples/api-error.out-of-coverage.json`.

FastAPI must override its default `422 {"detail": [...]}` (the `RequestValidationError` handler) and its `HTTPException` handler so they return this envelope. The Next proxy wraps non-contract error bodies as a safety net, but the original code and message are lost when it does.

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
- `explanation`: `field_checks`, `source` (`template` or `ai`).
- `confidence` (`level` plus `reasons`), `flags`, `disclaimers`, `dataset_versions`, `mock`.
- The `crops[]` / `excluded[]` split itself, and the error code list.
