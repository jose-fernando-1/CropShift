import pytest

from app.core.i18n import resolve_locale


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        (None, "en"),
        ("", "en"),
        ("pt-BR", "pt-BR"),
        ("pt", "pt-BR"),
        ("en-US,en;q=0.9", "en"),
        ("fr-FR,pt-BR;q=0.8", "pt-BR"),
        ("pt-BR;q=0.2,en;q=0.9", "en"),
        ("de", "en"),
        ("pt-BR;q=bad", "en"),
    ],
)
def test_resolve_locale(header, expected):
    assert resolve_locale(header) == expected
