"""Daily crop vectors (stage, Kc, root depth, p) from the stored growth stages. Pure, no I/O.

Within a stage Kc and root depth move linearly from the stage's start value to its end value; each day takes
the value at its midpoint, so a stage of N days is sampled at (t + 0.5) / N.
"""

from dataclasses import dataclass

import numpy as np

STAGE_MID_SEASON = 3  # position of the mid-season stage: the "flowering / yield-forming" window of the criterion


@dataclass(frozen=True)
class Stage:
    position: int
    duration_days: int
    kc_start: float
    kc_end: float
    root_depth_start_m: float
    root_depth_end_m: float
    depletion_fraction: float


@dataclass(frozen=True)
class CycleVectors:
    stage: np.ndarray  # int, stage position per day
    kc: np.ndarray
    root_depth_m: np.ndarray
    depletion_fraction: np.ndarray

    @property
    def length(self) -> int:
        return int(self.stage.shape[0])


def build_cycle(stages: list[Stage]) -> CycleVectors:
    """Concatenate the stages into per-day arrays. The cycle length is the sum of the stage durations."""
    ordered = sorted(stages, key=lambda s: s.position)
    parts: dict[str, list[np.ndarray]] = {"stage": [], "kc": [], "root": [], "p": []}
    for stage in ordered:
        n = stage.duration_days
        fraction = (np.arange(n) + 0.5) / n if n else np.empty(0)
        parts["stage"].append(np.full(n, stage.position, dtype=int))
        parts["kc"].append(stage.kc_start + (stage.kc_end - stage.kc_start) * fraction)
        parts["root"].append(stage.root_depth_start_m + (stage.root_depth_end_m - stage.root_depth_start_m) * fraction)
        parts["p"].append(np.full(n, stage.depletion_fraction))
    return CycleVectors(
        stage=np.concatenate(parts["stage"]),
        kc=np.concatenate(parts["kc"]),
        root_depth_m=np.concatenate(parts["root"]),
        depletion_fraction=np.concatenate(parts["p"]),
    )
