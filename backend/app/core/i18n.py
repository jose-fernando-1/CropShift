"""Language negotiation. The contract supports `en` and `pt-BR`; anything else falls back to English."""

from typing import Literal

Locale = Literal["en", "pt-BR"]
DEFAULT_LOCALE: Locale = "en"


def resolve_locale(accept_language: str | None) -> Locale:
    """Pick the first supported language in an `Accept-Language` header (ordered by q-value)."""
    if not accept_language:
        return DEFAULT_LOCALE
    weighted: list[tuple[float, int, str]] = []
    for position, part in enumerate(accept_language.split(",")):
        tag, _, params = part.strip().partition(";")
        quality = 1.0
        if params.strip().startswith("q="):
            try:
                quality = float(params.strip()[2:])
            except ValueError:
                quality = 0.0
        weighted.append((-quality, position, tag.strip().lower()))
    for negative_quality, _, tag in sorted(weighted):
        if negative_quality >= 0:  # q=0 means "not acceptable"
            continue
        if tag == "pt-br" or tag == "pt":
            return "pt-BR"
        if tag == "en" or tag.startswith("en-"):
            return "en"
    return DEFAULT_LOCALE
