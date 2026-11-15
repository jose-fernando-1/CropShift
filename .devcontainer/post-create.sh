#!/usr/bin/env bash
# Installs web dependencies and the Playwright browser. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/../web"

# node_modules is a named volume (see devcontainer.json); Docker creates it as root.
if [ ! -w node_modules ]; then
  sudo chown -R "$(id -u):$(id -g)" node_modules
fi

npm ci
npx playwright install --with-deps chromium

echo "Ready: cd web && npm run dev  ->  http://localhost:3000"
