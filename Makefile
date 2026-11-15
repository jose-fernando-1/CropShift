# Cropshift developer commands. Works on the host, inside the devcontainer and in CI.
# Run `make help`. Python commands use backend/.venv when it exists, else the python on PATH.

PY := $(shell [ -x backend/.venv/bin/python ] && echo $(CURDIR)/backend/.venv/bin/python || echo python3)
DATA_ENV := PYTHONPATH=backend:.

.PHONY: help install db migrate seed run test lint format check doctor stack stack-down mock-web

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install: ## Create backend/.venv and install backend + data dependencies
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements-dev.txt -r data/requirements.txt

db: ## Start PostgreSQL+PostGIS on 127.0.0.1:5433 (docker)
	docker compose --profile live up -d --wait db

migrate: ## Apply Alembic migrations to the database
	cd backend && $(PY) -m alembic upgrade head

seed: ## Load the committed demo dataset into the database (no network)
	$(DATA_ENV) $(PY) -m data load-demo

run: ## API with auto-reload on http://127.0.0.1:8000 (docs at /docs)
	cd backend && $(PY) -m uvicorn app.main:app --reload --port 8000

test: ## Backend tests (offline; database tests need `make db migrate`)
	cd backend && PYTHONPATH=$(CURDIR)/backend:$(CURDIR) $(PY) -m pytest -m "not live"

lint: ## Ruff lint + format check (backend and data)
	$(PY) -m ruff check backend data
	$(PY) -m ruff format --check backend data

format: ## Ruff format (backend and data)
	$(PY) -m ruff check --fix backend data
	$(PY) -m ruff format backend data

check: lint test ## Everything CI runs for the backend

doctor: ## Check every data source, credential and the database
	$(DATA_ENV) $(PY) -m data doctor

stack: ## db + migrations + api + web (live mode) in containers
	API_MODE=live API_ORIGIN=http://api:8000 docker compose --profile live up --build

stack-down: ## Stop the stack, keep the database volume
	docker compose --profile live down

mock-web: ## Web alone with the in-process mock API in a container
	docker compose up --build web
