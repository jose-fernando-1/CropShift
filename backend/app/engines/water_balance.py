"""FAO-56 daily root-zone water balance, vectorized over seasons. Pure numpy, no I/O.

Rows are seasons (years), columns are days of the crop cycle. Depletion Dr is in mm, 0 = field capacity.

  TAW = 1000 * theta_aw * Zr           total available water in the root zone
  RAW = p * TAW                        readily available water
  Ks  = 1                              if Dr <= RAW
      = (TAW - Dr) / ((1 - p) * TAW)   otherwise (clipped to 0..1)
  ETc = Kc * ET0,  ETa = Ks * ETc
  Dr  = Dr_prev - P_eff + ETa          floored at 0 (excess leaves as deep percolation), capped at TAW

Assumptions kept explicit (see `BalanceAssumptions`, versioned in the method): the soil starts at `initial_fraction`
of available water, newly explored soil as roots deepen enters at that same fraction, effective rain is
`effective_rain_fraction` of rain (1.0 = no runoff), and irrigation is absent (rainfed).
"""

from dataclasses import dataclass

import numpy as np

from app.engines.crop_cycle import STAGE_MID_SEASON, CycleVectors


@dataclass(frozen=True)
class BalanceAssumptions:
    theta_aw: float = 0.11  # m³/m³ available water; class 2 = the proposal's premise (see SOIL_THETA_AW)
    initial_fraction: float = 0.60  # share of available water at planting (proposal premise)
    effective_rain_fraction: float = 1.0  # proposal premise: effective rain equals rain


# ZARC texture class -> available water, m³/m³. Class 2 is the proposal's premise (0.11). Classes 1 and 3 are
# assumptions of this project (sandy and clayey), flagged for the sensitivity scenarios; FAO-56 Table 19 ranges
# overlap widely between texture classes, so these are not measured values.
SOIL_THETA_AW = {1: 0.08, 2: 0.11, 3: 0.14}


@dataclass(frozen=True)
class SeasonOutcome:
    eta_etc: np.ndarray  # ΣETa / ΣETc per season (1.0 = no stress)
    deficit_total_mm: np.ndarray  # Σ(ETc - ETa)
    deficit_mid_mm: np.ndarray  # same, mid-season (flowering) stage only
    etc_total_mm: np.ndarray
    rain_total_mm: np.ndarray


def simulate_seasons(
    rain_mm: np.ndarray,
    et0_mm: np.ndarray,
    cycle: CycleVectors,
    assumptions: BalanceAssumptions = BalanceAssumptions(),
    irrigated: bool = False,
) -> SeasonOutcome:
    """Run the balance for every season at once. `rain_mm` and `et0_mm` have shape (seasons, cycle days)."""
    seasons, days = rain_mm.shape
    if days != cycle.length or et0_mm.shape != rain_mm.shape:
        raise ValueError("rain, ET0 and the crop cycle must cover the same number of days")

    etc = cycle.kc[None, :] * et0_mm
    peff = assumptions.effective_rain_fraction * rain_mm
    taw_day = 1000.0 * assumptions.theta_aw * cycle.root_depth_m  # (days,)

    dr = np.zeros(seasons)
    taw_prev = taw_day[0]
    dr += taw_prev * (1.0 - assumptions.initial_fraction)
    eta = np.empty_like(etc)
    for day in range(days):
        taw = taw_day[day]
        dr = dr + (taw - taw_prev) * (1.0 - assumptions.initial_fraction)  # new soil enters at the initial fraction
        taw_prev = taw
        p = cycle.depletion_fraction[day]
        if irrigated:
            ks = np.ones(seasons)
        else:
            raw = p * taw
            ks = np.where(dr <= raw, 1.0, np.clip((taw - dr) / ((1.0 - p) * taw), 0.0, 1.0))
        eta[:, day] = ks * etc[:, day]
        dr = np.clip(dr - peff[:, day] + eta[:, day], 0.0, taw)

    mid = cycle.stage == STAGE_MID_SEASON
    etc_total = etc.sum(axis=1)
    eta_total = eta.sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        ratio = np.where(etc_total > 0, eta_total / etc_total, np.nan)
    return SeasonOutcome(
        eta_etc=ratio,
        deficit_total_mm=etc_total - eta_total,
        deficit_mid_mm=(etc - eta)[:, mid].sum(axis=1),
        etc_total_mm=etc_total,
        rain_total_mm=rain_mm.sum(axis=1),
    )
