"""The template port must reproduce the contract's golden explanations (en and pt-BR)."""

import json
from datetime import UTC, datetime

import pytest

from app.core.config import REPO_ROOT
from app.schemas.recommendations import Recommendation
from app.services.explain_template import template_explanation

EXAMPLES = REPO_ROOT / "contract/examples"


@pytest.mark.parametrize(
    ("recommendation", "explanation", "locale"),
    [
        ("recommendation.sao-bento-do-una.soil2.rainfed.json", "explanation.sao-bento-do-una.soil2.rainfed.json", "en"),
        (
            "recommendation.sao-bento-do-una.soil2.rainfed.pt-BR.json",
            "explanation.sao-bento-do-una.soil2.rainfed.pt-BR.json",
            "pt-BR",
        ),
    ],
)
def test_matches_golden_explanation(recommendation, explanation, locale):
    rec = Recommendation.model_validate(json.loads((EXAMPLES / recommendation).read_text(encoding="utf-8")))
    golden = json.loads((EXAMPLES / explanation).read_text(encoding="utf-8"))
    got = template_explanation(rec, locale, now=datetime(2026, 1, 1, tzinfo=UTC)).model_dump()
    for key in ("analysis_id", "source", "mock", "sections", "field_checks"):
        assert got[key] == golden[key], key
