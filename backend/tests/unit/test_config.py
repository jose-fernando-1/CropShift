from app.core.config import Settings


def test_defaults_work_without_env_file(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.database_url.startswith("postgresql+psycopg://rurotation:")
    assert settings.cors_origins == []


def test_database_url_is_composed_with_percent_encoding(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None, postgres_password="p@ss/w:rd", postgres_host="db", postgres_port=5432)
    assert settings.database_url == "postgresql+psycopg://rurotation:p%40ss%2Fw%3Ard@db:5432/rurotation"


def test_explicit_database_url_wins():
    settings = Settings(_env_file=None, database_url="postgresql+psycopg://u:p@h:1/d")
    assert settings.database_url == "postgresql+psycopg://u:p@h:1/d"


def test_comma_lists_and_empty_secret(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test,")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://a.test", "http://b.test"]
    assert settings.gemini_api_key is None
