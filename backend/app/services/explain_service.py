"""Explanation use case: AI text when configured and trustworthy, otherwise the deterministic template."""

import logging
import re
import time
from collections import OrderedDict
from datetime import UTC, datetime

from app.core.i18n import Locale
from app.integrations.gemini import GeminiExplainer
from app.schemas.explanation import Explanation
from app.schemas.recommendations import Recommendation
from app.services.explain_template import field_checks, template_explanation
from app.services.recommendation_service import RecommendationService

logger = logging.getLogger(__name__)

_PERCENT = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")
_CACHE_SIZE = 256
_FAILURE_COOLDOWN_S = 60.0
_FAILED_UNTIL: dict[tuple[str, str, str], float] = {}  # negative cache: key -> retry not before (monotonic)
# Shared by all requests of this process: AI answers cost money and time, the template is free and recomputed.
_CACHE: OrderedDict[tuple[str, str, str], Explanation] = OrderedDict()


def allowed_percentages(rec: Recommendation) -> set[int]:
    """Every whole percentage that may appear in an explanation: those derivable from the payload itself."""
    allowed = {70, 50, 40, 80, 25}  # fixed thresholds of the method, stated in the payload's texts
    for crop in rec.crops:
        values = [w.mean_p for w in crop.best_windows]
        values += [x for d in crop.p_success for x in (d.p, d.lo, d.hi)]
        for v in values:  # accept both neighbours: the payload text rounds half up, Python's round() to even
            allowed.update({int(v * 100), int(v * 100 + 0.5), int(v * 100 + 0.999999)})
    return allowed


def percentages_are_grounded(texts: list[str], rec: Recommendation) -> bool:
    """False when the text states a percentage that is not in the payload (a hallucinated number)."""
    allowed = allowed_percentages(rec)
    for text in texts:
        for match in _PERCENT.finditer(text):
            if int(float(match.group(1).replace(",", ".")) + 0.5) not in allowed:
                return False
    return True


def compact_for_ai(rec: Recommendation) -> dict:
    """What Gemini sees: the decisions and their reasons, not the 36-point curves or source lists (smaller, faster,
    cheaper; every number it may quote is still in the payload the guard checks against)."""
    return {
        "place": {
            "municipality": rec.location.municipality_name,
            "soil_class": rec.location.soil_class,
            "soil_was_default": rec.location.soil_source == "default",
            "regime": rec.location.regime,
        },
        "ranked_crops": [
            {
                "rank": c.rank,
                "name": c.name,
                "best_windows": [w.model_dump() for w in c.best_windows],
                "has_official_zarc_window": c.zarc is not None,
                "confidence": c.confidence.model_dump(),
                "strengths": c.strengths,
                "risks": c.risks,
                "missing_data": c.missing_data,
            }
            for c in rec.crops
        ],
        "not_ranked": [{"name": e.name, "reason": e.reason} for e in rec.excluded],
        "disclaimers": [d.text for d in rec.disclaimers],
    }


def _data_key(rec: Recommendation) -> str:
    """Changes whenever the data behind an analysis changes, so a cached AI text never outlives its numbers."""
    parts = [rec.method_version, *(f"{d.name}:{d.version}:{d.retrieved_at}" for d in rec.dataset_versions)]
    parts += [f"{c.crop_id}:{c.best_windows[0].mean_p if c.best_windows else 0}" for c in rec.crops]
    return "|".join(parts)


class ExplainService:
    def __init__(self, recommendations: RecommendationService, gemini: GeminiExplainer | None):
        self.recommendations = recommendations
        self.gemini = gemini
        self._cache = _CACHE

    def explain(self, analysis_id: str, locale: Locale) -> Explanation:
        rec = self.recommendations.recommend_for_id(analysis_id, locale)
        template = template_explanation(rec, locale)
        if self.gemini is None:
            return template

        key = (analysis_id, locale, _data_key(rec))
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        if _FAILED_UNTIL.get(key, 0.0) > time.monotonic():
            return template  # recently failed: do not make every request wait for another timeout
        ai = self.gemini.explain(compact_for_ai(rec), locale)
        if ai is None or not ai.sections:
            _FAILED_UNTIL[key] = time.monotonic() + _FAILURE_COOLDOWN_S
            return template
        texts = [p for s in ai.sections for p in s.paragraphs] + ai.field_checks
        if not percentages_are_grounded(texts, rec):
            logger.warning("AI explanation rejected: it states a percentage that is not in the payload")
            _FAILED_UNTIL[key] = time.monotonic() + _FAILURE_COOLDOWN_S
            return template
        explanation = Explanation(
            analysis_id=rec.analysis_id,
            source="ai",
            mock=rec.mock,
            generated_at=datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            sections=ai.sections,
            field_checks=ai.field_checks or field_checks(locale),
        )
        self._cache[key] = explanation
        if len(self._cache) > _CACHE_SIZE:
            self._cache.popitem(last=False)
        return explanation
