"""Confidence of a crop's result: the contract rule, as codes (the service localizes them). Pure, no I/O.

- low:    the crop did not pass the quality gate or there is no ZARC window to compare with;
- high:   the engine's best dekad is in ZARC's best class (and the point is in the municipality's climate cell);
- medium: the best dekad is inside the ZARC window but not in its best class, or the point is in another climate cell;
- low:    the best dekad is outside the ZARC window.
Every level carries its reasons.
"""

from dataclasses import dataclass, field
from typing import Literal

from app.engines.windows import best_dekad

Level = Literal["high", "medium", "low"]


@dataclass(frozen=True)
class ConfidenceReason:
    code: str  # gate_failed | no_zarc | best_class | inside | outside | other_cell
    dekad: int | None = None
    value: int | None = None


@dataclass(frozen=True)
class ConfidenceResult:
    level: Level
    reasons: list[ConfidenceReason] = field(default_factory=list)


def assess_confidence(
    gate_passed: bool, p: list[float], zarc_values: list[int] | None, near_centroid: bool
) -> ConfidenceResult:
    if not gate_passed:
        return ConfidenceResult("low", [ConfidenceReason("gate_failed")])
    if not zarc_values:
        return ConfidenceResult("low", [ConfidenceReason("no_zarc")])

    best = best_dekad(p)
    value = zarc_values[best - 1]
    recommended = [v for v in zarc_values if v > 0]
    best_class = min(recommended) if recommended else 0
    if value > 0 and value == best_class:
        level: Level = "high"
        reasons = [ConfidenceReason("best_class", best, value)]
    elif value > 0:
        level = "medium"
        reasons = [ConfidenceReason("inside", best)]
    else:
        level = "low"
        reasons = [ConfidenceReason("outside", best)]

    if not near_centroid:
        if level == "high":
            level = "medium"
        reasons.append(ConfidenceReason("other_cell"))
    return ConfidenceResult(level, reasons)
