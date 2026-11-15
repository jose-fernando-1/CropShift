from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CalibrationInput:
    """What a calibrator may use for one municipality, crop and soil class (see features.FEATURES)."""

    crop_id: str
    municipality_code: str
    soil_class: int
    p: list[float]  # simulated success frequency per dekad (36)
    lo: list[float]
    hi: list[float]
    features: dict[str, float | None]  # keys from features.FEATURES; None = unavailable


@dataclass(frozen=True)
class CalibratedCurve:
    p: list[float]
    lo: list[float]
    hi: list[float]
    applied: bool  # True only when a trained model changed the curve


class Calibrator(Protocol):
    """Pure with respect to the request: no I/O. A trained implementation loads its artifact at construction."""

    def calibrate(self, data: CalibrationInput) -> CalibratedCurve: ...
