"""Model chain: a failing model falls through to the next, failures are remembered, the total budget holds."""

import pytest
from pydantic import SecretStr

from app.core.config import DEFAULT_GEMINI_MODELS, Settings
from app.integrations import gemini
from app.integrations.gemini import AiExplanation, GeminiExplainer
from app.schemas.explanation import ExplanationSection

OK = AiExplanation(sections=[ExplanationSection(id="s", title="t", paragraphs=["p"])], field_checks=["c"])


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def explainer(models, behaviour, clock=None, total=30.0):
    clock = clock or Clock()
    ex = GeminiExplainer(SecretStr("k"), models, timeout_s=12, total_timeout_s=total, clock=clock)
    calls = []

    def fake_call(model, rec, locale, timeout_s):
        calls.append((model, timeout_s))
        outcome = behaviour[model]
        if isinstance(outcome, Exception):
            clock.now += 5
            raise outcome
        return outcome

    ex._call = fake_call
    return ex, calls, clock


def test_first_model_wins_when_it_works():
    ex, calls, _ = explainer(["a", "b"], {"a": OK, "b": OK})
    assert ex.explain({}, "en") is OK and [m for m, _ in calls] == ["a"] and ex.last_model == "a"


def test_failure_falls_through_to_the_next_model():
    ex, calls, _ = explainer(["a", "b", "c"], {"a": RuntimeError("404"), "b": RuntimeError("503"), "c": OK})
    assert ex.explain({}, "pt-BR") is OK and [m for m, _ in calls] == ["a", "b", "c"] and ex.last_model == "c"


def test_all_failing_returns_none_and_failed_models_are_skipped_for_a_while():
    ex, calls, clock = explainer(["a", "b"], {"a": RuntimeError("x"), "b": RuntimeError("y")})
    assert ex.explain({}, "en") is None and len(calls) == 2
    assert ex.explain({}, "en") is None and len(calls) == 2  # both cooling down: no new calls
    clock.now += GeminiExplainer.FAILURE_COOLDOWN_S + 1
    ex.explain({}, "en")
    assert len(calls) == 4


def test_total_budget_stops_the_chain_and_caps_each_call():
    ex, calls, _ = explainer(["a", "b", "c", "d"], dict.fromkeys("abcd", RuntimeError("slow")), total=11)
    assert ex.explain({}, "en") is None
    assert [m for m, _ in calls] == ["a", "b"]  # 5 s each: 1 s left after b, below the 2 s minimum
    assert calls[0][1] == 11 - 0 and calls[0][1] <= 12


def test_empty_answer_counts_as_failure(monkeypatch):
    class Resp:
        text = '{"sections": [], "field_checks": []}'

    class Models:
        def generate_content(self, **kwargs):
            return Resp()

    class Client:
        def __init__(self, **kwargs):
            self.models = Models()

    monkeypatch.setattr("google.genai.Client", Client)
    ex = GeminiExplainer(SecretStr("k"), ["a"], 12, 30)
    assert ex.explain({}, "en") is None


def test_settings_chain_order_dedupe_and_defaults(monkeypatch):
    for name in ("GEMINI_MODEL", "GEMINI_FALLBACK_MODELS"):
        monkeypatch.delenv(name, raising=False)
    assert Settings(_env_file=None).gemini_models == DEFAULT_GEMINI_MODELS
    chosen = Settings(_env_file=None, gemini_model="x", gemini_fallback_models="y, x ,z")
    assert chosen.gemini_models == ["x", "y", "z", *DEFAULT_GEMINI_MODELS]


def test_module_is_importable_without_google_sdk_calls():
    assert hasattr(gemini, "GeminiExplainer")


@pytest.mark.parametrize("bad", ["", None])
def test_no_key_means_no_explainer(monkeypatch, bad):
    from app.api import deps

    monkeypatch.setattr(deps, "_gemini_instance", None)
    monkeypatch.setattr(deps.settings, "gemini_api_key", bad)
    assert deps._gemini() is None
