#!/usr/bin/env bash
# Installs web + backend dependencies, applies migrations and the Playwright browser. Safe to re-run.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

# Named volumes are created root-owned by Docker.
for dir in "$root/web/node_modules" "$root/backend/.venv" "$HOME/.cache/ms-playwright"; do
  mkdir -p "$dir"
  [ -w "$dir" ] || sudo chown -R "$(id -u):$(id -g)" "$dir"
done

echo "== web"
(cd "$root/web" && npm ci && npx playwright install --with-deps chromium)

echo "== backend"
[ -x "$root/backend/.venv/bin/python" ] || python -m venv "$root/backend/.venv"
"$root/backend/.venv/bin/pip" install -q -r "$root/backend/requirements-dev.txt" -r "$root/data/requirements.txt"
(cd "$root/backend" && .venv/bin/python -m alembic upgrade head)

cat <<'MSG'
Ready.
  web:      cd web && npm run dev                       -> http://localhost:3000 (mock API)
  api:      make run                                    -> http://localhost:8000/docs
  web live: cd web && API_MODE=live npm run dev         (API_ORIGIN already points at the api above)
  data:     python -m data --help (PYTHONPATH is set), make doctor, make check
  note:     run `make db`/`make stack` on the HOST, not here: the db service is already running as `db`.
MSG
