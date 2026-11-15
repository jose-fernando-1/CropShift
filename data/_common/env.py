"""Loads credentials from git-ignored env files without ever printing them.

Order (later wins, real environment variables win over both):
  backend/.env   shared settings (database, Gemini)
  data/.env      credentials used only by data/ scripts (Earthdata)
"""

import os

from dotenv import dotenv_values

from data._common.paths import BACKEND_DIR, DATA_DIR


def load_env() -> None:
    merged: dict[str, str] = {}
    for env_file in (BACKEND_DIR / ".env", DATA_DIR / ".env"):
        if env_file.exists():
            merged.update({k: v for k, v in dotenv_values(env_file).items() if v})
    for key, value in merged.items():
        os.environ.setdefault(key, value)


def secret(name: str) -> str | None:
    """A non-empty environment value, or None. Callers must never log the result."""
    return os.environ.get(name) or None
