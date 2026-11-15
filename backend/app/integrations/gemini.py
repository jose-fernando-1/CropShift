"""Gemini (Google AI Studio) client for the explanation layer only.

Gemini receives a Recommendation that is ALREADY computed and rewrites it in plain language. It never computes,
ranks or invents agronomic data, and never receives the user's coordinates or personal data (the payload carries only public municipality centroids).
Any failure returns None so the caller falls back to the deterministic template.
"""

import json
import logging
import time
from typing import Any

from pydantic import BaseModel, SecretStr

from app.core.i18n import Locale
from app.schemas.common import ContractModel
from app.schemas.explanation import ExplanationSection

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = {
    "en": (
        "You rewrite an already computed crop recommendation for a farmer in plain, short English. "
        "Use ONLY the facts and numbers in the JSON you receive. Do not calculate, rank, choose or recommend crops or "
        "windows yourself, and do not add agronomic data, prices or forecasts. Keep every percentage exactly as given. "
        "Mention uncertainty and what the farmer should check in the field. This is decision support, not a guarantee."
    ),
    "pt-BR": (
        "Você reescreve, em português simples e curto, uma recomendação de culturas já calculada, para um agricultor. "
        "Use SOMENTE os fatos e números do JSON recebido. Não calcule, não ranqueie, não escolha nem recomende culturas ou "
        "janelas por conta própria e não acrescente dados agronômicos, preços ou previsões. Mantenha cada percentual "
        "exatamente como informado. Mencione a incerteza e o que o agricultor deve verificar no campo. "
        "É apoio à decisão, não garantia."
    ),
}


class _GeminiSection(BaseModel):
    """Plain models on purpose: Gemini's schema format rejects `additionalProperties: false`, which our strict
    contract models emit. The answer is converted to the strict contract models right after."""

    id: str
    title: str
    paragraphs: list[str]


class _GeminiAnswer(BaseModel):
    sections: list[_GeminiSection]
    field_checks: list[str]


class AiExplanation(ContractModel):
    """What the service uses: contract-shaped (strict) sections and field checks."""

    sections: list[ExplanationSection]
    field_checks: list[str]


class GeminiExplainer:
    """Tries an ordered chain of models: a retired, overloaded or rate-limited model falls through to the next."""

    FAILURE_COOLDOWN_S = 60.0  # a model that just failed is skipped for this long, so users do not each pay its timeout

    def __init__(
        self, api_key: SecretStr, models: list[str], timeout_s: float, total_timeout_s: float, clock=time.monotonic
    ):
        self._api_key = api_key
        self.models = models
        self.timeout_s = timeout_s
        self.total_timeout_s = total_timeout_s
        self._clock = clock
        self._skip_until: dict[str, float] = {}
        self.last_model: str | None = None  # model that produced the latest answer

    def explain(self, recommendation: dict[str, Any], locale: Locale) -> AiExplanation | None:
        """Ask Gemini for the explanation of `recommendation` (a JSON-able dict). None when every model fails."""
        deadline = self._clock() + self.total_timeout_s
        for model in self.models:
            remaining = deadline - self._clock()
            if remaining < 2:
                break
            if self._skip_until.get(model, 0.0) > self._clock():
                continue
            try:
                answer = self._call(model, recommendation, locale, min(self.timeout_s, remaining))
            except Exception as exc:  # network, quota, 404/503, safety block, bad JSON: try the next model
                self._skip_until[model] = self._clock() + self.FAILURE_COOLDOWN_S
                status = getattr(exc, "code", None)  # HTTP status of an API error (no secret in it)
                logger.warning(
                    "Gemini model %s failed (%s %s); trying the next one", model, type(exc).__name__, status or ""
                )
                continue
            self.last_model = model
            return answer
        logger.warning("Gemini explanation failed on every model; using the template")
        return None

    def _call(self, model: str, recommendation: dict[str, Any], locale: Locale, timeout_s: float) -> AiExplanation:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=self._api_key.get_secret_value(),
            http_options=types.HttpOptions(api_version="v1beta", timeout=int(timeout_s * 1000)),
        )
        response = client.models.generate_content(
            model=model,
            contents=json.dumps(recommendation, ensure_ascii=False),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION[locale],
                response_mime_type="application/json",
                response_schema=_GeminiAnswer,
                temperature=0.2,
            ),
        )
        answer = _GeminiAnswer.model_validate_json(response.text or "")
        if not answer.sections:
            raise ValueError("empty answer")
        return AiExplanation.model_validate(answer.model_dump())
