"""Human-readable text of a recommendation, in en and pt-BR (ported from the contract-defining mock messages).

Every number in these sentences comes from the payload; nothing here computes agronomy. Engines return codes and
values, this module turns them into sentences.
"""

from app.core.i18n import Locale
from app.engines.confidence import ConfidenceReason

MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "pt-BR": ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
}
_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # labels use a non-leap year, like the web


def _dekad_days(dekad: int) -> tuple[int, int, int]:
    month, part = divmod(dekad - 1, 3)
    start = part * 10 + 1
    end = _MONTH_DAYS[month] if part == 2 else start + 9
    return month, start, end


def dekad_label(dekad: int, locale: Locale) -> str:
    month, start, end = _dekad_days(dekad)
    return f"{MONTHS[locale][month]} {start}–{end}"


def window_label(start: int, end: int, locale: Locale) -> str:
    if start == end:
        return dekad_label(start, locale)
    m1, d1, _ = _dekad_days(start)
    m2, _, d2 = _dekad_days(end)
    return f"{MONTHS[locale][m1]} {d1} – {MONTHS[locale][m2]} {d2}"


def percent(p: float) -> str:
    return f"{int(p * 100 + 0.5)}%"


def kg_per_ha(value: float, locale: Locale) -> str:
    rounded = f"{int(value + 0.5):,}"
    return f"{rounded if locale == 'en' else rounded.replace(',', '.')} kg/ha"


def _decimal(value: float, locale: Locale, places: int = 2) -> str:
    text = f"{value:.{places}f}".rstrip("0").rstrip(".")
    return text if locale == "en" else text.replace(".", ",")


def _plural(locale: Locale, n: int, en: tuple[str, str], pt: tuple[str, str]) -> str:
    one, many = en if locale == "en" else pt
    return one if n == 1 else many


def strength_window(window: str, p: str, locale: Locale) -> str:
    if locale == "en":
        return f"{window} succeeded in {p} of 40 simulated seasons on average."
    return f"{window} deu certo em {p} das 40 safras simuladas, em média."


STRENGTH_INSIDE_ZARC = {
    "en": "The best simulated window sits inside the official ZARC window.",
    "pt-BR": "A melhor janela simulada fica dentro da janela oficial do ZARC.",
}
STRENGTH_LEGUME = {
    "en": "Legume: it can fix nitrogen, which helps the next crop.",
    "pt-BR": "Leguminosa: pode fixar nitrogênio, o que ajuda a cultura seguinte.",
}


def risk_narrow(n: int, locale: Locale) -> str:
    if locale == "en":
        return f"Narrow window: only {n} {_plural(locale, n, ('dekad reaches', 'dekads reach'), ('', ''))} 70% success."
    return f"Janela estreita: só {n} {_plural(locale, n, ('', ''), ('decêndio chega', 'decêndios chegam'))} a 70% de sucesso."


RISK_NONE = {
    "en": "No dekad reaches 70% success in the simulation.",
    "pt-BR": "Nenhum decêndio chega a 70% de sucesso na simulação.",
}


def risk_late(dekad: str, locale: Locale) -> str:
    if locale == "en":
        return f"Success drops below 50% from {dekad}: planting late is risky."
    return f"O sucesso cai abaixo de 50% a partir de {dekad}: plantar tarde é arriscado."


def risk_outside_zarc(n: int, locale: Locale) -> str:
    if locale == "en":
        looks = "dekad looks" if n == 1 else "dekads look"
        return f"{n} {looks} good in the simulation but {'is' if n == 1 else 'are'} outside the ZARC window."
    looks = "decêndio parece bom" if n == 1 else "decêndios parecem bons"
    return f"{n} {looks} na simulação, mas {'fica' if n == 1 else 'ficam'} fora da janela do ZARC."


def risk_low_yield(local: str, state: str, locale: Locale) -> str:
    if locale == "en":
        return f"Recorded yields here (median {local}) are below the state median ({state})."
    return f"O rendimento registrado aqui (mediana {local}) está abaixo da mediana do estado ({state})."


RISK_SANDY = {
    "en": "Sandy soil stores less water; dry spells hurt more.",
    "pt-BR": "Solo arenoso guarda menos água; os veranicos pesam mais.",
}

MISSING = {
    "no_zarc": {
        "en": "No ZARC window for this crop, soil and municipality.",
        "pt-BR": "Não há janela do ZARC para esta cultura, solo e município.",
    },
    "common_bean": {
        "en": "Rainfed ZARC for common bean uses AD soil classes (11–16); there is no mapping from your soil class yet.",
        "pt-BR": "O ZARC de sequeiro do feijão comum usa classes de solo AD (11–16); "
        "ainda não há correspondência com a sua classe de solo.",
    },
    "no_pam": {
        "en": "No PAM yield series for this crop in this municipality.",
        "pt-BR": "Não há série de rendimento da PAM para esta cultura neste município.",
    },
    "not_surveyed": {"en": "PAM does not survey this crop.", "pt-BR": "A PAM não pesquisa esta cultura."},
}


def soil_assumed(theta_aw: float, locale: Locale) -> str:
    value = _decimal(theta_aw, locale)
    if locale == "en":
        return f"Soil water capacity is assumed ({value} m³/m³ for your soil class), not measured."
    return f"A capacidade de água do solo é uma premissa ({value} m³/m³ para a sua classe de solo), não uma medida."


SOIL_DEFAULT_NOTE = {
    "derived": {
        "en": "Soil class was not given: it was derived from SoilGrids clay content at the municipality centroid.",
        "pt-BR": "A classe de solo não foi informada: foi derivada do teor de argila do SoilGrids no centroide do município.",
    },
    "fallback": {
        "en": "Soil class was not given and SoilGrids has no value here: the medium class (2) is assumed.",
        "pt-BR": "A classe de solo não foi informada e o SoilGrids não tem valor aqui: assume-se a classe média (2).",
    },
}


def excluded_gate_failed(rho: float | None, locale: Locale) -> str:
    if locale == "en":
        shown = "n/a" if rho is None else f"{rho:.2f}"
        return (
            "Own estimate not reliable here: the engine does not reproduce ZARC for this crop, soil and "
            f"municipality (rank correlation {shown}, threshold 0.70)."
        )
    shown = "—" if rho is None else f"{rho:.2f}".replace(".", ",")
    return (
        "Estimativa própria não confiável aqui: o motor não reproduz o ZARC para esta cultura, solo e município "
        f"(correlação de postos {shown}, limite 0,70)."
    )


EXCLUDED_NOT_RUN = {
    "en": "Not ranked: there is no official ZARC window for this crop, soil and municipality to check the engine against.",
    "pt-BR": "Fora do ranking: não há janela oficial do ZARC para esta cultura, solo e município para validar o motor.",
}
EXCLUDED_NO_REGIME_DATA = {
    "en": "Not ranked: the engine's success rule needs rainfed water stress, and the irrigated regime has no "
    "ZARC mapping (irrigated ZARC uses AD classes 11–16).",
    "pt-BR": "Fora do ranking: a regra de sucesso do motor depende do estresse hídrico em sequeiro, e o regime "
    "irrigado não tem correspondência no ZARC (o ZARC irrigado usa as classes AD 11–16).",
}


def confidence_reason(reason: ConfidenceReason, locale: Locale) -> str:
    dekad = dekad_label(reason.dekad, locale) if reason.dekad else ""
    en = {
        "gate_failed": "The crop did not pass the quality gate against ZARC.",
        "no_zarc": "No official ZARC window to compare the engine with.",
        "best_class": f"The engine's best dekad ({dekad}) is in ZARC's best class (value {reason.value}).",
        "inside": f"The engine's best dekad ({dekad}) is inside the ZARC window, but not in its best class.",
        "outside": f"The engine's best dekad ({dekad}) is outside the ZARC window.",
        "other_cell": "Your point is in a different climate cell than the municipality centroid.",
    }
    pt = {
        "gate_failed": "A cultura não passou na porta de qualidade contra o ZARC.",
        "no_zarc": "Não há janela oficial do ZARC para comparar com o motor.",
        "best_class": f"O melhor decêndio do motor ({dekad}) está na melhor classe do ZARC (valor {reason.value}).",
        "inside": f"O melhor decêndio do motor ({dekad}) está dentro da janela do ZARC, mas não na melhor classe.",
        "outside": f"O melhor decêndio do motor ({dekad}) está fora da janela do ZARC.",
        "other_cell": "O seu ponto está numa célula climática diferente da do centroide do município.",
    }
    return (en if locale == "en" else pt)[reason.code]


DISCLAIMERS = {
    "scale": {
        "en": "Climate comes from NASA POWER cells of 0.5° × 0.625° (about 55 × 69 km). It does not describe your field.",
        "pt-BR": "O clima vem de células do NASA POWER de 0,5° × 0,625° (cerca de 55 × 69 km). Não descreve a sua área.",
    },
    "soil": {
        "en": "Soil water is an assumption by soil class (0.08, 0.11 and 0.14 m³/m³ of available water for classes 1, 2 "
        "and 3), not a measurement.",
        "pt-BR": "A água do solo é uma premissa por classe de solo (0,08, 0,11 e 0,14 m³/m³ de água disponível para as "
        "classes 1, 2 e 3), não uma medida.",
    },
    "rain": {
        "en": "Rainfall is POWER's; in 2024 IMERG measured about 37% less at the test point. Results depend on the rain source.",
        "pt-BR": "A chuva é a do POWER; em 2024 o IMERG mediu cerca de 37% menos no ponto de teste. "
        "Os resultados dependem da fonte de chuva.",
    },
    "frequency": {
        "en": "The success chance is the share of the 40 simulated seasons that met the criterion (ETa/ETc ≥ 0.80 and "
        "flowering deficit < 25 mm). It is a historical frequency, not a calibrated probability.",
        "pt-BR": "A chance de sucesso é a fração das 40 safras simuladas que atendeu ao critério (ETa/ETc ≥ 0,80 e déficit na "
        "floração < 25 mm). É uma frequência histórica, não uma probabilidade calibrada.",
    },
    "validation": {
        "en": "Independent validation against PAM yields is weak to moderate (rank correlation +0.33 to +0.48, one point).",
        "pt-BR": "A validação independente contra a PAM é fraca a moderada (correlação de postos de +0,33 a +0,48, um ponto).",
    },
    "zarc": {
        "en": "ZARC is also built from a water balance, so agreeing with it shows consistency with the official method, "
        "not field success.",
        "pt-BR": "O ZARC também vem de balanço hídrico; concordar com ele mostra coerência com o método oficial, "
        "não sucesso no campo.",
    },
    "dekad": {
        "en": "Dekad 1 is assumed to be Jan 1–10, and ZARC values 20/30/40 are shown as-is; their meaning as risk % is "
        "not confirmed.",
        "pt-BR": "Assume-se que o decêndio 1 é 1–10 de janeiro, e os valores 20/30/40 do ZARC aparecem como estão; "
        "o significado como risco em % não foi confirmado.",
    },
}
DISCLAIMER_ORDER = ["scale", "soil", "rain", "frequency", "validation", "zarc", "dekad"]


def risk_suitability(factor: str, value: float, locale: Locale) -> str:
    if locale == "en":
        what = {
            "temperature": f"mean annual temperature ({_decimal(value, locale, 1)} °C)",
            "rainfall": f"mean annual rainfall ({int(value + 0.5)} mm)",
            "ph": f"topsoil pH ({_decimal(value, locale, 1)})",
        }[factor]
        return f"The place's {what} is outside this crop's tolerated range (FAO EcoCrop)."
    what = {
        "temperature": f"temperatura média anual ({_decimal(value, locale, 1)} °C)",
        "rainfall": f"chuva média anual ({int(value + 0.5)} mm)",
        "ph": f"pH do solo superficial ({_decimal(value, locale, 1)})",
    }[factor]
    return f"A {what} do local está fora da faixa tolerada por esta cultura (FAO EcoCrop)."


MISSING_SOIL_PH = {
    "en": "No SoilGrids pH at this location, so soil acidity was not checked against the crop's range.",
    "pt-BR": "Não há pH do SoilGrids neste local, então a acidez do solo não foi comparada com a faixa da cultura.",
}
