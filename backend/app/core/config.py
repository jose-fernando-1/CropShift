from pydantic import field_validator
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    app_name: str = "Rurotation API"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    api_v1_prefix: str = "/api/v1"

    cors_origins: list[str] = []

    database_url: str

    @field_validator(
        "cors_origins",
        mode="before",
    )
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )


settings = Settings()
