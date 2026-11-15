# Cropshift web

Front end for Cropshift (NASA Space Apps 2026, team Rural). Given a point or municipality in Pernambuco, it shows for each crop the probability of planting success per dekad (36 ten-day windows, from 40 seasons of NASA POWER climate), next to the official ZARC window and IBGE PAM yields.

It is a Next.js 16 + React 19 + TypeScript app. The app ships with a complete in-process mock API that follows the shared [API contract](../contract/README.md), and can run against the FastAPI backend in [`../backend`](../backend/README.md) (`API_MODE=live`). The UI is in English by default, with Brazilian Portuguese (pt-BR) available from the header; the docs are in English.

See also: [data flow and fixtures](docs/data-flow.md), [API contract](../contract/README.md).

## Run it

### 1. Devcontainer (recommended)

Open the repo root in VS Code and choose "Reopen in Container" (`.devcontainer/devcontainer.json`, Node 22).

- `web/node_modules` is a named Docker volume (`cropshift-web-node-modules-<devcontainerId>`, one per workspace).
- `.devcontainer/post-create.sh` runs `npm ci` and `npx playwright install --with-deps chromium`. It is safe to re-run.
- Ports 3000 (`next dev`) and 3001 (a second instance, for testing live mode) are forwarded.
- `API_MODE=mock` is set in the container environment. For live mode run the backend with `make run` and start the web with `API_MODE=live npm run dev` (`API_ORIGIN` already points at `http://127.0.0.1:8000`).

Then: `cd web && npm run dev` and open <http://localhost:3000>.

### 2. Container

From the repo root:

```bash
docker compose up --build web      # http://localhost:3000, mock API
WEB_PORT=8080 docker compose up --build web
```

The image is a multi-stage build of the Next.js standalone server (`web/Dockerfile`). `API_MODE`, `API_ORIGIN`, `API_TIMEOUT_MS` and `SHOW_DATA_FLOW` are read at runtime, so the same image serves the mock and the live proxy:

```bash
make stack    # db + migrations + api + web in live mode: web http://localhost:3000, API http://localhost:8000/docs
```

`make stack` runs `API_MODE=live API_ORIGIN=http://api:8000 docker compose --profile live up --build`. The root `docker-compose.yml` defines `db`, `migrate`, `api` and `seed` behind the `live` profile, so `docker compose up --build web` alone stays mock-only. See [../README.md](../README.md) for the run modes and [../docs/runbook.md](../docs/runbook.md) for operations.

### 3. Plain local

Requires Node 22 (`.nvmrc`).

```bash
cd web
npm ci
npm run dev                  # http://localhost:3000
npm run build && npm start   # standalone server, same as the image
```

## Environment variables

Copy `.env.example` to `.env.local` if you need to change any. All are read at request time, so no rebuild is needed.

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_MODE` | `mock` | `mock`: in-process mock API. `live`: proxy to `API_ORIGIN`. |
| `API_ORIGIN` | empty | FastAPI origin for live mode, no trailing slash (for example `http://api:8000`). Live mode without it answers `503 upstream_unavailable`. |
| `API_TIMEOUT_MS` | `15000` | Upstream timeout in live mode. |
| `SHOW_DATA_FLOW` | `true` | Unset, empty, `true`, `1`, `on` or `yes` (case-insensitive) keep the header's "Data flow" button and the inspector. Any other value, such as `false` or a typo, hides them entirely, even with `?debug=1`. Useful on a public demo. |
| `MOCK_LATENCY_MS` | random 300-900 | Mock only. Fixed latency in ms; `0` disables it. |
| `WEB_PORT` | `3000` | Compose only: host port. |
| `PORT` | `3000` | Port of the standalone server (`npm start`). |
| `WEB_HOST` | `0.0.0.0` | Interface `npm start` binds to. Set explicitly because Docker and the devcontainer set `HOSTNAME` to the container id, which the standalone server would otherwise bind to. |
| `E2E_PORT` | `3100` | Port Playwright starts the app on. |
| `E2E_BASE_URL` | unset | Run the E2E tests against an already running server. |

## Mock vs live

The browser only calls same-origin `/api/*`. A single catch-all route (`src/app/api/[...path]/route.ts`) hands each request to `src/lib/server/handle-api.ts`, which picks the mode per request from `API_MODE`:

- `mock`: `src/mocks` answers from the fixtures in `mock-data/`. Every response has `mock: true`.
- `live`: `src/lib/server/live-proxy.ts` forwards to `API_ORIGIN`. `/api/health` maps to the backend's `/health`; other paths keep their `/api/...` path.

Responses carry `x-cropshift-mode: mock|live` and `cache-control: no-store`. In live mode, failures (backend down, timeout, non-contract error bodies such as FastAPI's default 422) are normalized to the contract error envelope `{ "error": { "code", "message" } }`, so the UI shows "API unavailable" instead of a schema error. `/health` (outside `/api`) serves the same handler, so a second web instance can stand in for the backend in a live-mode test.

Details: [docs/data-flow.md](docs/data-flow.md).

## Scripts

Run from `web/`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server. |
| `npm run build` | Production build (standalone output). |
| `npm start` | Runs the standalone build as the image does (`scripts/start-standalone.mjs`). Run `build` first. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `next typegen && tsc --noEmit`. |
| `npm test` | Vitest, once. `npm run test:watch` for watch mode. |
| `npm run e2e` | Playwright E2E. |
| `npm run format` | Prettier, writes the whole repo (runs from the repo root). |
| `npm run format:check` | Prettier, fails if any file is not formatted. |
| `npm run check` | `format:check`, lint, typecheck, test and `gen:contract -- --check`. |
| `npm run gen:geo` | Downloads the Pernambuco municipal mesh and names from public IBGE APIs; writes `public/geo/pe-municipalities.json` and `mock-data/municipalities.json`. |
| `npm run gen:fixtures -- [--zarc <csv>] [--pam <csv>] [--ficha <csv>]` | Compacts the real ZARC, PAM and crop-sheet CSVs into `mock-data/zarc.json`, `mock-data/pam.json` and `mock-data/requirements.json`. Every arg is optional; only the outputs for the inputs given are written. |
| `npm run gen:contract` | Regenerates `../contract/` (JSON Schemas and examples) from the zod schemas. |
| `npm run gen:contract -- --check` | Fails if the files in `../contract/` are stale. |

`gen:fixtures` inputs are the challenge data CSVs, not stored in the repo (the maintainers keep them in `~/Downloads`): the ZARC risk table for Pernambuco, season 2025/26 (`zarc_tabua_risco_safra2025_2026_PE.csv`, `;`-separated), the PAM yield table 2005-2024 (`ibge_pam_PE_2005_2024_culturas_chave.csv`) and the crop requirements sheet (`ficha_exigencias_culturas_FAO56_EcoCrop.csv`, FAO-56 and FAO EcoCrop). The generated JSON files are committed; you only need the CSVs to rebuild them.

## Languages

English is always the default (the challenge requires an English UI). pt-BR is opt-in through the EN | PT switcher in the header (`src/components/layout/language-switcher.tsx`) and is remembered on that device in `localStorage` under `cropshift-lang`. The locale is not in the URL and the root layout stays static: `<html lang>` and the tab title follow the choice on the client. Numbers and ids never change across languages, only human-readable text.

The language reaches the API as `Accept-Language` on every call and is part of every query key, so switching refetches. The mock answers in the requested language; error copy is chosen on the client per error code. See [docs/data-flow.md](docs/data-flow.md#language) and the [contract convention](../contract/README.md#conventions).

Messages live in `src/i18n/messages/`: `en.ts` defines the shape and `pt-BR.ts` must match it, so a missing key fails `npm run typecheck`. To add or edit a string, change `en.ts` first, then `pt-BR.ts`. Components use `useMessages()` / `useLocale()` (`src/i18n/use-i18n.ts`); code outside React (template, mock, formatters) uses `getMessages(locale)` from `src/i18n`. Text produced by the mock API lives in `src/mocks/messages.ts`.

Tests: `tests/unit/i18n.test.ts` and `tests/e2e/i18n.spec.ts`.

## Mock scenarios

Failure scenarios for testing error states, mock mode only:

| Scenario       | Effect                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------ |
| `power_down`   | `POST /api/v1/recommendations` fails with 503 `upstream_unavailable`.                      |
| `explain_down` | The explain route fails with 500 `internal`; the UI falls back to the in-browser template. |
| `no_data`      | Recommendations return 404 `no_data` (after request validation).                           |

Select one in the data-flow inspector, with the `x-mock-scenario` request header, or with `?scenario=` on an API call:

```bash
curl -X POST localhost:3000/api/v1/recommendations \
  -H 'content-type: application/json' -H 'x-mock-scenario: power_down' \
  -d '{"municipality_code":"2613008"}'
curl -X POST 'localhost:3000/api/v1/recommendations?scenario=no_data' \
  -H 'content-type: application/json' -d '{"municipality_code":"2613008"}'
```

## Data-flow inspector

A sheet that lists the last 50 API calls (method, path, status, duration, mode, request and response bodies, zod validation result), the layers between UI and data with the mocked ones marked, and the scenario selector. It is available in mock mode, or in any mode with `?debug=1` in the page URL, unless `SHOW_DATA_FLOW` is off (see [environment variables](#environment-variables)), in which case it is not rendered.

## Testing

- `npm test` (Vitest, `tests/unit`): the mock handlers and engine, dekad helpers, the explanation template, and the published contract: every file in `../contract/examples/` is validated with Ajv against its JSON Schema, as the backend contract tests do.
- `npm run e2e` (Playwright, `tests/e2e`): builds the app, serves it in mock mode on port 3100 and runs the user journey in two projects, desktop (1440x900) and mobile (Pixel 7), with axe accessibility checks. Map tiles are blocked so runs are hermetic. The first run needs Chromium (`npx playwright install --with-deps chromium`; the devcontainer does this).
- `npm run check` runs the format check, lint, typecheck, unit tests and the contract staleness check.

## Code style

Formatting is [Prettier](https://prettier.io) with the config in the repo root (`.prettierrc.json`); `.editorconfig` and `.gitattributes` (LF line endings) back it up. The workspace settings in `.vscode/settings.json` format on save with that config and override personal VS Code settings. Generated files (`contract/*.schema.json`, `contract/examples/`, `web/mock-data/`, `web/public/geo/`) are listed in `.prettierignore`, because their generators own the layout. Run `npm run format` to fix everything, `npm run format:check` to verify.

After pulling this change in the devcontainer, run `npm install` in `web/` so the pinned Prettier is installed.

## Project layout

```text
web/
  src/
    app/            Next.js app router; api/[...path] (catch-all API), health
    components/     charts, form, map, results, explain, inspector, layout, ui
    contract/       zod schemas (source of the contract) and types
    lib/
      api/          client (zod parse, request log), TanStack Query hooks
      server/       handle-api (mock/live switch), live-proxy
      domain/       dekads, formatting, geo helpers
      explain/      template explanation (client fallback and mock)
      state/        analysis state (URL params)
    mocks/          mock API: handlers, engine, synthetic curves, scenarios, localized text
    i18n/           locales, message catalogs (en, pt-BR), locale store and hooks
  mock-data/        fixtures: catalog, municipalities, zarc, pam, requirements, prototype
  public/geo/       municipal mesh for the map
  scripts/          generators (geo, fixtures, contract), standalone starter
  tests/            unit (Vitest) and e2e (Playwright)
  docs/data-flow.md
```
