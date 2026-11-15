from pathlib import Path

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent


# Used after the configured models. Names change as Google retires and adds models, so `python -m data doctor`
# checks the configured chain with real calls; override with GEMINI_MODEL / GEMINI_FALLBACK_MODELS.
DEFAULT_GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]


class Settings(BaseSettings):
    """Runtime configuration, read from the environment and `backend/.env`.

    Every field has a development default, so importing the app (tests, CI,
    `alembic`) never needs a `.env`. Secrets have no default and stay empty.
    """

    app_name: str = "Cropshift API"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    api_v1_prefix: str = "/api/v1"

    # The web app calls the API through its same-origin Next proxy, so browsers
    # never hit this service directly and no CORS origin is needed by default.
    # List origins here only to call the API straight from a browser (dev tools).
    cors_origins: list[str] = []

    # Versions reported by /health and stored with every analysis.
    contract_version: str = "0.1"
    method_version: str = "mvp-1"
    # Bump when the data is re-extracted and the seed rebuilt (see docs/runbook.md); reported by /health.
    data_version: str = "2026-11-15"

    # Database: either a full DATABASE_URL or the POSTGRES_* parts (host port
    # 5433 maps to 5432 in the container, see docker-compose.yml).
    database_url: str = ""
    postgres_user: str = "rurotation"
    postgres_password: str = "change_me"
    postgres_db: str = "rurotation"
    postgres_host: str = "localhost"
    postgres_port: int = 5433

    # Abuse protection for the POST routes. The client IP is read from
    # X-Forwarded-For only when the direct peer is in `trusted_proxies`.
    rate_limit_per_min: int = 60
    trusted_proxies: list[str] = []

    # Optional Gemini explanation layer; without a key the template is used.
    gemini_api_key: SecretStr | None = None
    gemini_model: str = ""  # first choice
    gemini_fallback_models: list[str] = []  # tried in order when the first choice fails (retired, overloaded, quota)
    gemini_timeout_s: float = 12.0  # per model call
    gemini_total_timeout_s: float = 30.0  # budget for the whole chain, so /explain never waits longer than this

    @field_validator("cors_origins", "trusted_proxies", "gemini_fallback_models", mode="before")
    @classmethod
    def split_comma_list(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def empty_key_is_none(cls, value):
        return value or None

    @property
    def gemini_models(self) -> list[str]:
        """Ordered, de-duplicated model chain: the chosen model, its fallbacks, then the built-in defaults."""
        chain = [m for m in [self.gemini_model, *self.gemini_fallback_models, *DEFAULT_GEMINI_MODELS] if m]
        return list(dict.fromkeys(chain))

    @model_validator(mode="after")
    def compose_database_url(self):
        if not self.database_url:
            self.database_url = URL.create(
                "postgresql+psycopg",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            ).render_as_string(hide_password=False)
        return self

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )


settings = Settings()
