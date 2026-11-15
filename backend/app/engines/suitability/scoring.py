from app.engines.suitability.models import FactorResult, Status, SuitabilityResult

SUITABILITY_VERSION = "suit-1"
WEIGHTS = {"temperature": 1.0, "rainfall": 1.0, "ph": 1.0}  # versioned with SUITABILITY_VERSION
PH_TOLERANCE = 1.0  # EcoCrop lists only an optimal pH range; the tolerated band is optimal +/- 1 pH unit (heuristic)


def trapezoid(value: float | None, tolerated: tuple[float, float], optimal: tuple[float, float]) -> float | None:
    """1 in the optimal range, linear to 0 at the tolerated limits (heuristic), 0 outside, None without a value."""
    if value is None:
        return None
    t_min, t_max = tolerated
    o_min, o_max = optimal
    if value < t_min or value > t_max:
        return 0.0
    if o_min <= value <= o_max:
        return 1.0
    if value < o_min:
        return (value - t_min) / (o_min - t_min) if o_min > t_min else 1.0
    return (t_max - value) / (t_max - o_max) if t_max > o_max else 1.0


def _status(score: float | None) -> Status:
    if score is None:
        return "not_evaluated"
    return "optimal" if score >= 1.0 else "tolerable" if score > 0 else "outside"


def _factor(name: str, value: float | None, tolerated, optimal) -> FactorResult:
    score = trapezoid(value, tolerated, optimal)
    return FactorResult(name, _status(score), score, value, optimal, tolerated)


def assess_suitability(
    *,
    mean_annual_temp_c: float | None,
    annual_rain_mm: float | None,
    ph: float | None,
    temp_optimal: tuple[float, float],
    temp_absolute: tuple[float, float],
    rain_optimal: tuple[float, float],
    rain_absolute: tuple[float, float],
    ph_optimal: tuple[float, float],
) -> SuitabilityResult:
    """Score the climate and soil of a place against one crop's EcoCrop ranges.

    EcoCrop temperature is a growing-season range; the annual mean is a coarse proxy, so a mismatch is a hint to read
    next to the simulation, not a verdict.
    """
    ph_tolerated = (ph_optimal[0] - PH_TOLERANCE, ph_optimal[1] + PH_TOLERANCE)
    factors = [
        _factor("temperature", mean_annual_temp_c, temp_absolute, temp_optimal),
        _factor("rainfall", annual_rain_mm, rain_absolute, rain_optimal),
        _factor("ph", ph, ph_tolerated, ph_optimal),
    ]
    evaluated = [f for f in factors if f.score is not None]
    total_weight = sum(WEIGHTS.values())
    used_weight = sum(WEIGHTS[f.name] for f in evaluated)
    score = (
        100 * sum(WEIGHTS[f.name] * f.score for f in evaluated if f.score is not None) / used_weight  # type: ignore[operator]
        if evaluated
        else None
    )
    return SuitabilityResult(SUITABILITY_VERSION, score, used_weight / total_weight, factors)
