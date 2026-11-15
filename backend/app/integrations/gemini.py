"""Gemini (Google AI Studio) client for the explanation layer only.

Gemini receives a Recommendation that is ALREADY computed and rewrites it in plain language. It never computes,
ranks or invents agronomic data, and never receives the user's coordinates or personal data (the payload carries only public municipality centroids).
Any failure returns None so the caller falls back to the deterministic template.
"""

import json
import logging
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
    def __init__(self, api_key: SecretStr, model: str, timeout_s: float):
        self._api_key = api_key
        self.model = model
        self.timeout_s = timeout_s

    def explain(self, recommendation: dict[str, Any], locale: Locale) -> AiExplanation | None:
        """Ask Gemini for the explanation of `recommendation` (a JSON-able dict). None on any failure."""
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=self._api_key.get_secret_value(),
                http_options=types.HttpOptions(api_version="v1beta", timeout=int(self.timeout_s * 1000)),
            )
            response = client.models.generate_content(
                model=self.model,
                contents=json.dumps(recommendation, ensure_ascii=False),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION[locale],
                    response_mime_type="application/json",
                    response_schema=_GeminiAnswer,
                    temperature=0.2,
                ),
            )
            answer = _GeminiAnswer.model_validate_json(response.text or "")
            return AiExplanation.model_validate(answer.model_dump())
        except Exception as exc:  # network, quota, safety block, bad JSON: all mean "use the template"
            logger.warning("Gemini explanation failed (%s); using the template", type(exc).__name__)
            return None
