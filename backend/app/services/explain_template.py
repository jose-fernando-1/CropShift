"""Deterministic explanation built only from a Recommendation (port of `web/src/lib/explain/template.ts`).

It never introduces a number that is not in the payload, and it is the fallback of the AI explanation, so the app
always has an explanation without any AI service.
"""

from datetime import UTC, datetime

from app.core.i18n import Locale
from app.schemas.explanation import Explanation, ExplanationSection
from app.schemas.recommendations import Recommendation
from app.services.recommendation_text import percent, window_label

SOIL_LABEL = {
    "en": {1: "Sandy", 2: "Medium", 3: "Clayey"},
    "pt-BR": {1: "Arenoso", 2: "Médio", 3: "Argiloso"},
}
CONFIDENCE_LABEL = {
    "en": {"high": "High", "medium": "Medium", "low": "Low"},
    "pt-BR": {"high": "Alta", "medium": "Média", "low": "Baixa"},
}

T = {
    "en": {
        "summary": "Summary",
        "top": "Top crops",
        "not_ranked": "Not ranked",
        "how_sure": "How sure is this",
        "regime": {"rainfed": "rainfed farming", "irrigated": "irrigated farming"},
        "no_ranking": "no crop passed the quality checks, so there is no ranking.",
        "default_soil": "soil class",
        "default_regime": "regime",
        "no_window": "There is no clear planting window.",
        "zarc": "The official ZARC window is shown on the chart for comparison.",
        "no_zarc": "There is no official ZARC window to compare with.",
        "none_ranked": "No crop is ranked.",
        "limits": [
            "These are probabilities from past seasons of NASA climate data, not a forecast. "
            "They describe a climate cell, not your field.",
            "This is decision support: it does not replace your own judgement.",
        ],
        "field_checks": [
            "Get a soil analysis: texture, depth and fertility change how much water the crop can use.",
            "Check local market prices and buyers before choosing a crop.",
            "Ask about pests and diseases this season with your local extension office.",
            "Compare with the local planting calendar and your own experience of the rains.",
        ],
    },
    "pt-BR": {
        "summary": "Resumo",
        "top": "Melhores culturas",
        "not_ranked": "Fora do ranking",
        "how_sure": "Qual a segurança disto",
        "regime": {"rainfed": "cultivo de sequeiro", "irrigated": "cultivo irrigado"},
        "no_ranking": "nenhuma cultura passou nas verificações de qualidade, então não há ranking.",
        "default_soil": "a classe de solo",
        "default_regime": "o regime",
        "no_window": "Não há uma janela de plantio clara.",
        "zarc": "A janela oficial do ZARC aparece no gráfico para comparação.",
        "no_zarc": "Não há janela oficial do ZARC para comparar.",
        "none_ranked": "Nenhuma cultura está no ranking.",
        "limits": [
            "São probabilidades de safras passadas com dados climáticos da NASA, não uma previsão. "
            "Descrevem uma célula climática, não a sua área.",
            "Isto é apoio à decisão: não substitui o seu julgamento.",
        ],
        "field_checks": [
            "Faça uma análise de solo: textura, profundidade e fertilidade mudam quanta água a planta consegue usar.",
            "Verifique preços e compradores na sua região antes de escolher a cultura.",
            "Pergunte sobre pragas e doenças desta safra na assistência técnica local.",
            "Compare com o calendário de plantio local e com a sua experiência com as chuvas.",
        ],
    },
}


def field_checks(locale: Locale) -> list[str]:
    return list(T[locale]["field_checks"])


def _intro(locale: Locale, municipality: str, soil: str, regime: str) -> str:
    if locale == "en":
        return f"For {municipality}, with {soil.lower()} soil and {regime}, "
    return f"Para {municipality}, com solo {soil.lower()} e {regime}, "


def _top_list(locale: Locale, names: str) -> str:
    if locale == "en":
        return f"the crops with the best simulated planting windows are: {names}."
    return f"as culturas com as melhores janelas de plantio simuladas são: {names}."


def _defaults(locale: Locale, what: list[str]) -> str:
    if locale == "en":
        return f"You did not choose a {' or '.join(what)}, so the default was used. Change it above to see how the result moves."
    return f"Você não escolheu {' nem '.join(what)}, então usamos o padrão. Mude acima para ver como o resultado se altera."


def _window(locale: Locale, window: str, p: str) -> str:
    if locale == "en":
        return f"The best window is {window}, where planting succeeded in {p} of simulated seasons on average."
    return f"A melhor janela é {window}, em que o plantio deu certo em {p} das safras simuladas, em média."


def _confidence(locale: Locale, level: str, reasons: str) -> str:
    if locale == "en":
        return f"Confidence is {level.lower()}: {reasons}"
    return f"A confiança é {level.lower()}: {reasons}"


def template_explanation(rec: Recommendation, locale: Locale, now: datetime | None = None) -> Explanation:
    t = T[locale]
    loc = rec.location
    top = rec.crops[:3]
    defaults = [
        t["default_soil"] if loc.soil_source == "default" else None,
        t["default_regime"] if loc.regime_source == "default" else None,
    ]
    defaults = [d for d in defaults if d]

    intro = _intro(locale, loc.municipality_name, SOIL_LABEL[locale][loc.soil_class], t["regime"][loc.regime])
    summary = [intro + (_top_list(locale, ", ".join(c.name for c in top)) if top else t["no_ranking"])]
    if defaults:
        summary.append(_defaults(locale, defaults))

    crop_paragraphs = []
    for crop in top:
        best = crop.best_windows[0] if crop.best_windows else None
        window = (
            _window(locale, window_label(best.start_dekad, best.end_dekad, locale), percent(best.mean_p))
            if best
            else t["no_window"]
        )
        zarc = t["zarc"] if crop.zarc else t["no_zarc"]
        confidence = _confidence(
            locale, CONFIDENCE_LABEL[locale][crop.confidence.level], " ".join(crop.confidence.reasons)
        )
        crop_paragraphs.append(f"{crop.rank}. {crop.name}: {window} {zarc} {confidence}")

    sections = [
        ExplanationSection(id="summary", title=t["summary"], paragraphs=summary),
        ExplanationSection(id="top", title=t["top"], paragraphs=crop_paragraphs or [t["none_ranked"]]),
    ]
    if rec.excluded:
        sections.append(
            ExplanationSection(
                id="excluded", title=t["not_ranked"], paragraphs=[f"{e.name}: {e.reason}" for e in rec.excluded]
            )
        )
    sections.append(ExplanationSection(id="limits", title=t["how_sure"], paragraphs=list(t["limits"])))

    now = now or datetime.now(UTC)
    return Explanation(
        analysis_id=rec.analysis_id,
        source="template",
        mock=rec.mock,
        generated_at=now.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        sections=sections,
        field_checks=field_checks(locale),
    )
