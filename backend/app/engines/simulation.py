"""Historical planting-window simulation for one crop at one climate cell. Pure numpy, no I/O.

For every dekad of the year and every historical season: take the daily weather of the crop cycle that starts on the
dekad's first day, run ET0 -> ETc -> the root-zone water balance, and classify the season. A season counts only when
the whole cycle has complete data; the number of valid seasons is reported with every result.

Success (the proposal's experimental criterion, fixed before looking at ZARC): ΣETa/ΣETc >= 0.80 AND the water
deficit in the mid-season (flowering) stage < 25 mm. The frequency of successful seasons is NOT a calibrated
probability. Heat and frost indicators are recorded for diagnosis but do not enter the success rule.
"""

from dataclasses import dataclass
from datetime import date

import numpy as np

from app.engines.crop_cycle import CycleVectors
from app.engines.dekads import DEKADS_PER_YEAR, planting_date
from app.engines.et0 import actual_vapour_pressure_from_rh_mean, et0_penman_monteith
from app.engines.water_balance import BalanceAssumptions, simulate_seasons
from app.engines.windows import wilson_interval

ETA_ETC_MIN = 0.80
MID_DEFICIT_MAX_MM = 25.0


@dataclass(frozen=True)
class ClimateSeries:
    """Contiguous daily weather of one cell (no gaps in dates; gaps in values are NaN)."""

    first_day: date
    lat: float
    elevation_m: float
    t2m: np.ndarray
    t2m_max: np.ndarray
    t2m_min: np.ndarray
    rh2m: np.ndarray
    ws2m: np.ndarray
    ps: np.ndarray
    allsky: np.ndarray
    rain: np.ndarray

    @property
    def length(self) -> int:
        return int(self.t2m.shape[0])

    @property
    def last_day(self) -> date:
        return date.fromordinal(self.first_day.toordinal() + self.length - 1)


@dataclass(frozen=True)
class DekadResult:
    dekad: int
    n_valid: int
    n_success: int
    p: float
    lo: float
    hi: float
    eta_etc_p10: float | None
    eta_etc_p50: float | None
    eta_etc_p90: float | None
    deficit_mid_p50_mm: float | None
    heat_days_p50: float | None  # days with Tmax above the crop's absolute maximum
    cold_days_p50: float | None  # days with Tmin below the crop's absolute minimum


def daily_et0(climate: ClimateSeries) -> np.ndarray:
    """ET0 (mm/day) for every day of the series; NaN where any input is missing."""
    days = np.arange(climate.length) + climate.first_day.toordinal()
    doy = np.array([date.fromordinal(int(d)).timetuple().tm_yday for d in days])
    ea = actual_vapour_pressure_from_rh_mean(climate.t2m_max, climate.t2m_min, climate.rh2m)
    return et0_penman_monteith(
        climate.t2m,
        climate.t2m_max,
        climate.t2m_min,
        ea,
        climate.ws2m,
        climate.allsky,
        climate.ps,
        np.radians(climate.lat),
        doy,
        climate.elevation_m,
    )


def _percentile(values: np.ndarray, q: float) -> float | None:
    return None if values.size == 0 else float(np.percentile(values, q))


def simulate_windows(
    climate: ClimateSeries,
    cycle: CycleVectors,
    first_season: int,
    last_season: int,
    assumptions: BalanceAssumptions = BalanceAssumptions(),
    irrigated: bool = False,
    temp_abs_min_c: float | None = None,
    temp_abs_max_c: float | None = None,
    et0: np.ndarray | None = None,
    rain: np.ndarray | None = None,
) -> list[DekadResult]:
    """Results for the 36 dekads, seasons `first_season..last_season` (planting years). `et0`/`rain` can be passed
    to reuse a precomputed ET0 across crops or to swap the rainfall source (sensitivity runs)."""
    et0 = daily_et0(climate) if et0 is None else et0
    rain = climate.rain if rain is None else rain
    length = cycle.length
    base = climate.first_day.toordinal()
    years = list(range(first_season, last_season + 1))
    n_years = len(years)
    offsets = np.arange(length)

    # One batch for the whole year: row = dekad * n_years + season.
    starts = np.array([planting_date(y, d).toordinal() - base for d in range(1, DEKADS_PER_YEAR + 1) for y in years])
    inside = (starts >= 0) & (starts + length <= climate.length)
    index = np.minimum(np.clip(starts[:, None], 0, None) + offsets[None, :], climate.length - 1)
    rain_w, et0_w = rain[index], et0[index]
    complete = inside & ~np.isnan(rain_w).any(axis=1) & ~np.isnan(et0_w).any(axis=1)

    eta_etc = np.full(starts.shape[0], np.nan)
    deficit_mid = np.full(starts.shape[0], np.nan)
    if complete.any():
        outcome = simulate_seasons(rain_w[complete], et0_w[complete], cycle, assumptions, irrigated)
        eta_etc[complete] = outcome.eta_etc
        deficit_mid[complete] = outcome.deficit_mid_mm
    heat_days = (climate.t2m_max[index] > temp_abs_max_c).sum(axis=1) if temp_abs_max_c is not None else None
    cold_days = (climate.t2m_min[index] < temp_abs_min_c).sum(axis=1) if temp_abs_min_c is not None else None

    results: list[DekadResult] = []
    for dekad in range(1, DEKADS_PER_YEAR + 1):
        rows = slice((dekad - 1) * n_years, dekad * n_years)
        valid = complete[rows]
        n_valid = int(valid.sum())
        if n_valid == 0:
            results.append(DekadResult(dekad, 0, 0, 0.0, 0.0, 1.0, None, None, None, None, None, None))
            continue
        ratio, deficit = eta_etc[rows][valid], deficit_mid[rows][valid]
        n_success = int(((ratio >= ETA_ETC_MIN) & (deficit < MID_DEFICIT_MAX_MM)).sum())
        lo, hi = wilson_interval(n_success, n_valid)
        results.append(
            DekadResult(
                dekad=dekad,
                n_valid=n_valid,
                n_success=n_success,
                p=n_success / n_valid,
                lo=lo,
                hi=hi,
                eta_etc_p10=_percentile(ratio, 10),
                eta_etc_p50=_percentile(ratio, 50),
                eta_etc_p90=_percentile(ratio, 90),
                deficit_mid_p50_mm=_percentile(deficit, 50),
                heat_days_p50=None if heat_days is None else _percentile(heat_days[rows][valid], 50),
                cold_days_p50=None if cold_days is None else _percentile(cold_days[rows][valid], 50),
            )
        )
    return results
