"""What Gemini receives: compact, coordinate-free, and every quoted number still checkable against the payload."""

import json

from app.core.config import REPO_ROOT
from app.schemas.recommendations import Recommendation
from app.services.explain_service import compact_for_ai

EXAMPLE = REPO_ROOT / "contract/examples/recommendation.sao-bento-do-una.soil2.rainfed.json"


def test_compact_payload_drops_curves_and_sources_but_keeps_decisions():
    rec = Recommendation.model_validate_json(EXAMPLE.read_text(encoding="utf-8"))
    payload = compact_for_ai(rec)
    text = json.dumps(payload)
    assert len(text) < len(EXAMPLE.read_text(encoding="utf-8")) / 3
    assert "p_success" not in text and "sources" not in text and "centroid" not in text
    assert [c["name"] for c in payload["ranked_crops"]] == [c.name for c in rec.crops]
    assert payload["ranked_crops"][0]["best_windows"] == [w.model_dump() for w in rec.crops[0].best_windows]
    assert {e["name"] for e in payload["not_ranked"]} == {e.name for e in rec.excluded}
