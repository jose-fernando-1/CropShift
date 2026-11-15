from dataclasses import dataclass
from typing import Literal

Status = Literal["optimal", "tolerable", "outside", "not_evaluated"]


@dataclass(frozen=True)
class FactorResult:
    name: str  # temperature | rainfall | ph
    status: Status
    score: float | None  # 0..1; None when not evaluated
    value: float | None
    optimal: tuple[float, float]
    tolerated: tuple[float, float]


@dataclass(frozen=True)
class SuitabilityResult:
    version: str
    score: float | None  # 0..100 over the evaluated factors; None when nothing could be evaluated
    coverage: float  # evaluated weight / total weight, 0..1
    factors: list[FactorResult]
