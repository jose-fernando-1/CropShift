# Rurotation

Cropshift (NASA Space Apps 2026, team Rural): for a point or municipality in Pernambuco, Brazil, it shows for each crop the probability of planting success per dekad (36 ten-day windows) from 40 seasons of NASA POWER climate, next to the official ZARC planting window and IBGE PAM yields.

Current state: the web app (`web/`) runs against a mock API that follows the shared contract. The FastAPI backend does not exist yet.

## Quickstart

```bash
cd web && npm ci
npm run dev        # http://localhost:3000 (mock API)
# or, from the repo root: docker compose up --build web
```

## Docs

- [web/README.md](web/README.md): run, env vars, scripts, mock scenarios, tests, layout.
- [web/docs/data-flow.md](web/docs/data-flow.md): request flow, fixtures (real vs synthetic), mapping rules, privacy.
- [contract/README.md](contract/README.md): API contract v0.1 draft, schemas and examples.
