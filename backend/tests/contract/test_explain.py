"""POST /api/v1/recommendations/{id}/explain: template by default, AI only when grounded, always the contract shape."""

import pytest

from app.integrations.gemini import AiExplanation
from app.schemas.explanation import ExplanationSection
from app.schemas.recommendations import Recommendation
from app.services import explain_service

pytestmark = pytest.mark.db

PILOT_ID = "csa_mvp-1_2613008.2.d.r.d.p.1"


@pytest.fixture(autouse=True)
def _db(database):
    from sqlalchemy import text

    with database.connect() as connection:
        if connection.execute(text("SELECT count(*) FROM planting_window_results")).scalar_one() == 0:
            pytest.skip("no precomputed windows")
    return database


def explain(client, analysis_id=PILOT_ID, **headers):
    return client.post(f"/api/v1/recommendations/{analysis_id}/explain", headers=headers)


def test_template_explanation_is_valid_in_both_languages(client, assert_contract):
    for language, title in (("en", "Summary"), ("pt-BR", "Resumo")):
        response = explain(client, **{"Accept-Language": language})
        assert response.status_code == 200
        assert_contract("explanation", response.json())
        assert response.json()["source"] == "template" and response.json()["mock"] is False
        assert response.json()["sections"][0]["title"] == title


def test_unknown_id_is_not_found(client, assert_contract):
    response = explain(client, "csa_mvp-1_0000000.2.d.r.d.p.1")
    assert response.status_code == 404
    assert_contract("api-error", response.json())


class FakeGemini:
    def __init__(self, answer):
        self.answer, self.calls, self.payload = answer, 0, None

    def explain(self, recommendation, locale):
        self.calls += 1
        self.payload = recommendation
        return self.answer


def ai_answer(text):
    return AiExplanation(
        sections=[ExplanationSection(id="summary", title="Summary", paragraphs=[text])], field_checks=["Check soil."]
    )


def use_gemini(monkeypatch, fake):
    explain_service._CACHE.clear()
    monkeypatch.setattr("app.api.deps._gemini", lambda: fake)


def pilot_recommendation(client) -> Recommendation:
    return Recommendation.model_validate(
        client.post("/api/v1/recommendations", json={"municipality_code": "2613008"}).json()
    )


def test_grounded_ai_text_is_used_and_marked(client, assert_contract, monkeypatch):
    rec = pilot_recommendation(client)
    grounded = round(rec.crops[0].best_windows[0].mean_p * 100)
    fake = FakeGemini(ai_answer(f"Plant {rec.crops[0].name}: it worked in {grounded}% of seasons."))
    use_gemini(monkeypatch, fake)
    body = explain(client).json()
    assert_contract("explanation", body)
    assert body["source"] == "ai" and body["sections"][0]["paragraphs"][0].startswith("Plant ")
    # the sent payload is the coordinate-free Recommendation: the user's point is not part of an analysis id
    client.post("/api/v1/recommendations", json={"lat": -8.612345, "lon": -36.487654})
    assert "612345" not in str(fake.payload) and "487654" not in str(fake.payload)
    explain(client)
    assert fake.calls == 1  # second answer comes from the cache


def test_ungrounded_percentage_falls_back_to_the_template(client, monkeypatch):
    allowed = explain_service.allowed_percentages(pilot_recommendation(client))
    invented = next(n for n in range(1, 100) if n not in allowed)
    use_gemini(monkeypatch, FakeGemini(ai_answer(f"It works in {invented}% of seasons.")))
    assert explain(client).json()["source"] == "template"


def test_gemini_failure_falls_back_to_the_template(client, monkeypatch):
    use_gemini(monkeypatch, FakeGemini(None))
    assert explain(client).json()["source"] == "template"


def test_percentage_guard_uses_only_payload_numbers(client):
    rec = pilot_recommendation(client)
    allowed = explain_service.allowed_percentages(rec)
    grounded = round(rec.crops[0].best_windows[0].mean_p * 100)
    invented = next(n for n in range(1, 100) if n not in allowed)
    assert explain_service.percentages_are_grounded([f"{grounded}% of seasons"], rec)
    assert not explain_service.percentages_are_grounded([f"{invented}% of seasons"], rec)
    assert explain_service.percentages_are_grounded(["no numbers here"], rec)
