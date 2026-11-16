# Landing

One-page landing site for Cropshift: Next.js 16, React 19, TypeScript, Tailwind 4. It explains the idea and links to the app ("Open the demo" buttons).

## Run it

- Dev: `cd landing && npm ci && NEXT_PUBLIC_DEMO_URL=http://localhost:3000 npm run dev` on http://localhost:3002. Without the variable the buttons go to `/demo`, which 404s on this port under `next dev`.
- Container: `make landing` (root `docker-compose.yml`, host port `LANDING_PORT`, default 3002; links to the web app on `WEB_PORT`).
- Deploy: the `landing` service in [../deployment/README.md](../deployment/README.md), served at `/` with the app at `/demo`.

## Environment

| Variable               | Default | Meaning                                                                                    |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_DEMO_URL` | `/demo` | Build time. Target of the "Open the demo" buttons. The Dockerfile takes it as a build arg. |
| `LANDING_PORT`         | `3002`  | Compose only: host port.                                                                   |

## Scripts

`npm run dev`, `build`, `start` (standalone server), `lint`, `typecheck`, `check` (lint, typecheck and build).

## Content

The page is `src/app/page.tsx`; the dekad strip is `src/components/dekad-strip.tsx`. Keep its claims in sync with the app ([../web/README.md](../web/README.md)) and with [../docs/validation/report.md](../docs/validation/report.md).
