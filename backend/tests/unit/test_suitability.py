import pytest

from app.engines.suitability import SUITABILITY_VERSION, assess_suitability
from app.engines.suitability.scoring import trapezoid

COWPEA = dict(
    temp_optimal=(25, 35),
    temp_absolute=(15, 40),
    rain_optimal=(500, 1500),
    rain_absolute=(300, 4100),
    ph_optimal=(5.5, 7.5),
)


def test_trapezoid_shape_and_boundaries():
    t, o = (15, 40), (25, 35)
    assert trapezoid(14.9, t, o) == 0 and trapezoid(40.1, t, o) == 0
    assert trapezoid(20, t, o) == pytest.approx(0.5) and trapezoid(37.5, t, o) == pytest.approx(0.5)
    assert trapezoid(25, t, o) == 1 and trapezoid(35, t, o) == 1 and trapezoid(None, t, o) is None


def test_monotone_towards_the_optimum():
    t, o = (15, 40), (25, 35)
    left = [trapezoid(v, t, o) for v in range(15, 26)]
    right = [trapezoid(v, t, o) for v in range(35, 41)]
    assert left == sorted(left) and right == sorted(right, reverse=True)


def test_pilot_like_place_is_optimal_for_cowpea():
    r = assess_suitability(mean_annual_temp_c=25.5, annual_rain_mm=957, ph=6.6, **COWPEA)
    assert r.version == SUITABILITY_VERSION and r.score == pytest.approx(100) and r.coverage == 1
    assert {f.status for f in r.factors} == {"optimal"}


def test_missing_soil_is_not_evaluated_not_zero():
    r = assess_suitability(mean_annual_temp_c=25.5, annual_rain_mm=957, ph=None, **COWPEA)
    assert r.coverage == pytest.approx(2 / 3) and r.score == pytest.approx(100)  # not dragged down by the gap
    assert next(f for f in r.factors if f.name == "ph").status == "not_evaluated"


def test_nothing_evaluable_gives_no_score():
    r = assess_suitability(mean_annual_temp_c=None, annual_rain_mm=None, ph=None, **COWPEA)
    assert r.score is None and r.coverage == 0


def test_outside_range_scores_zero_and_lowers_the_aggregate():
    r = assess_suitability(mean_annual_temp_c=25.5, annual_rain_mm=250, ph=6.6, **COWPEA)
    assert next(f for f in r.factors if f.name == "rainfall").status == "outside"
    assert r.score == pytest.approx(200 / 3)


def test_ph_has_a_one_unit_tolerance_band():
    r = assess_suitability(mean_annual_temp_c=25.5, annual_rain_mm=957, ph=4.9, **COWPEA)
    ph = next(f for f in r.factors if f.name == "ph")
    assert ph.status == "tolerable" and ph.score == pytest.approx(0.4)
