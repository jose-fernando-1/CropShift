"""ET0 against the worked example of the FAO-56 bulletin (Example 18, Brussels, 6 July, daily data)."""

import math

import numpy as np
import pytest

from app.engines.et0 import (
    actual_vapour_pressure_from_rh_mean,
    et0_penman_monteith,
    extraterrestrial_radiation,
    net_radiation,
    pressure_from_elevation,
    saturation_vapour_pressure,
    slope_vapour_pressure_curve,
)

# Example 18: Tmax 21.5, Tmin 12.3 °C, RHmax 84 %, RHmin 63 %, u2 = 2.078 m/s, Rs 22.07 MJ/m²/day,
# 100 m elevation, 50°48'N, 6 July (day 187). Bulletin results: ET0 = 3.9 mm/day.
T_MAX, T_MIN = 21.5, 12.3
T_MEAN = (T_MAX + T_MIN) / 2
LAT = math.radians(50.8)
DOY = 187


def test_saturation_vapour_pressure_and_slope():
    assert saturation_vapour_pressure(T_MAX) == pytest.approx(2.564, abs=0.002)
    assert saturation_vapour_pressure(T_MIN) == pytest.approx(1.431, abs=0.002)
    assert slope_vapour_pressure_curve(T_MEAN) == pytest.approx(0.122, abs=0.001)


def test_pressure_and_extraterrestrial_radiation():
    assert pressure_from_elevation(100) == pytest.approx(100.1, abs=0.1)
    assert extraterrestrial_radiation(LAT, DOY) == pytest.approx(41.09, abs=0.1)


def test_net_radiation_and_et0_match_the_bulletin():
    ea = (saturation_vapour_pressure(T_MIN) * 84 / 100 + saturation_vapour_pressure(T_MAX) * 63 / 100) / 2
    assert ea == pytest.approx(1.409, abs=0.002)
    ra = extraterrestrial_radiation(LAT, DOY)
    assert net_radiation(22.07, ra, T_MAX, T_MIN, ea, 100) == pytest.approx(13.28, abs=0.1)
    et0 = et0_penman_monteith(T_MEAN, T_MAX, T_MIN, ea, 2.078, 22.07, pressure_from_elevation(100), LAT, DOY, 100)
    assert et0 == pytest.approx(3.9, abs=0.1)


def test_vectorized_and_non_negative():
    n = 5
    et0 = et0_penman_monteith(
        np.full(n, 25.0), np.full(n, 32.0), np.full(n, 19.0), np.full(n, 2.0), np.full(n, 3.0),
        np.linspace(5, 28, n), np.full(n, 94.0), math.radians(-8.5), np.arange(100, 100 + n), 618.0,
    )  # fmt: skip
    assert et0.shape == (n,) and (et0 >= 0).all()
    assert np.all(np.diff(et0) > 0)  # more sunshine, more evapotranspiration


def test_humidity_from_mean_rh():
    assert actual_vapour_pressure_from_rh_mean(30.0, 20.0, 70.0) == pytest.approx(
        0.7 * (saturation_vapour_pressure(30.0) + saturation_vapour_pressure(20.0)) / 2
    )
