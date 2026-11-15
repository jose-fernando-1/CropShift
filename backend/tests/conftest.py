"""Shared fixtures. Contract schemas are read from the repo-root `contract/` folder."""

import json
import os

os.environ.setdefault("RATE_LIMIT_PER_MIN", "0")  # tests make hundreds of calls; the limiter has its own test
os.environ["GEMINI_API_KEY"] = ""  # tests never call Gemini, whatever backend/.env holds

from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.core.config import REPO_ROOT
from app.main import app

CONTRACT_DIR = REPO_ROOT / "contract"


@pytest.fixture(scope="session")
def client() -> TestClient:
    # raise_server_exceptions=False: unhandled errors must come back as the 500 envelope.
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="session")
def contract_dir() -> Path:
    return CONTRACT_DIR


@pytest.fixture(scope="session")
def assert_contract() -> Callable[[str, object], None]:
    """`assert_contract("health", body)` validates `body` against contract/health.schema.json."""
    validators: dict[str, Draft202012Validator] = {}

    def check(name: str, instance: object) -> None:
        if name not in validators:
            schema = json.loads((CONTRACT_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))
            Draft202012Validator.check_schema(schema)
            validators[name] = Draft202012Validator(schema)
        errors = sorted(validators[name].iter_errors(instance), key=lambda e: list(e.path))
        assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors[:5])

    return check


@pytest.fixture(scope="session")
def database():
    """A migrated PostGIS database with the reference data loaded; skips the test when it is unreachable."""
    from sqlalchemy import text

    from app.core.database import engine

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        pytest.skip("PostGIS database not reachable (make db migrate)")
    with engine.connect() as connection:
        seeded = connection.execute(text("SELECT count(*) FROM crops")).scalar_one() > 0
    if not seeded:  # a fresh database (CI, new clone): the committed demo seed, no network
        from data.etl.demo_seed import load

        load()
    return engine
