import itertools

import numpy as np
import pytest

from app.engines.crop_cycle import Stage, build_cycle
from app.engines.water_balance import BalanceAssumptions, simulate_seasons


def flat_cycle(days_per_stage=10, kc=1.0, root=1.0, p=0.5):
    return build_cycle([Stage(i, days_per_stage, kc, kc, root, root, p) for i in range(1, 5)])


def run(rain_per_day, et0_per_day=5.0, seasons=1, cycle=None, **kwargs):
    cycle = cycle or flat_cycle()
    shape = (seasons, cycle.length)
    return simulate_seasons(np.full(shape, rain_per_day), np.full(shape, et0_per_day), cycle, **kwargs)


def test_cycle_vectors_interpolate_and_concatenate():
    cycle = build_cycle([Stage(1, 2, 0.4, 0.4, 0.2, 0.2, 0.5), Stage(2, 4, 0.4, 1.2, 0.2, 0.6, 0.5)])
    assert cycle.length == 6
    assert cycle.kc.tolist() == pytest.approx([0.4, 0.4, 0.5, 0.7, 0.9, 1.1])
    assert cycle.root_depth_m[-1] == pytest.approx(0.55)


def test_plenty_of_rain_means_no_stress():
    outcome = run(rain_per_day=20.0)
    assert outcome.eta_etc[0] == pytest.approx(1.0)
    assert outcome.deficit_total_mm[0] == pytest.approx(0.0) and outcome.deficit_mid_mm[0] == pytest.approx(0.0)


def test_drought_stresses_but_stored_water_delays_it():
    drought = run(rain_per_day=0.0)
    assert 0.0 < drought.eta_etc[0] < 1.0
    # 40 days x 5 mm = 200 mm demand; the soil holds 0.11*1000*1.0*0.6 = 66 mm, so ETa cannot exceed it
    assert drought.etc_total_mm[0] == pytest.approx(200.0)
    used = 200.0 * drought.eta_etc[0]
    assert 60.0 < used <= 66.0  # extracts almost all of it, never more


def test_irrigation_removes_water_stress():
    assert run(rain_per_day=0.0, irrigated=True).eta_etc[0] == pytest.approx(1.0)


@pytest.mark.parametrize("theta_aw", [0.06, 0.11, 0.2])
def test_more_rain_never_lowers_eta_etc(theta_aw):
    assumptions = BalanceAssumptions(theta_aw=theta_aw)
    ratios = [run(rain, assumptions=assumptions).eta_etc[0] for rain in (0, 1, 2, 3, 4, 5)]
    assert all(b >= a - 1e-12 for a, b in itertools.pairwise(ratios))


def test_more_stored_water_never_lowers_eta_etc():
    ratios = [run(1.0, assumptions=BalanceAssumptions(theta_aw=t)).eta_etc[0] for t in (0.06, 0.09, 0.11, 0.15)]
    assert ratios == sorted(ratios)


def test_deficit_in_the_mid_stage_is_isolated():
    cycle = flat_cycle(days_per_stage=10, root=0.3)  # shallow roots: only ~20 mm of stored water
    rain = np.zeros((1, cycle.length))
    rain[0, :20] = 30.0  # wet through development, dry afterwards
    outcome = simulate_seasons(rain, np.full(rain.shape, 5.0), cycle)
    assert outcome.deficit_mid_mm[0] > 0 and outcome.deficit_mid_mm[0] <= outcome.deficit_total_mm[0]


def test_seasons_are_independent():
    cycle = flat_cycle()
    rain = np.stack([np.zeros(cycle.length), np.full(cycle.length, 20.0)])
    both = simulate_seasons(rain, np.full(rain.shape, 5.0), cycle)
    alone = simulate_seasons(rain[:1], np.full((1, cycle.length), 5.0), cycle)
    assert both.eta_etc[0] == pytest.approx(alone.eta_etc[0]) and both.eta_etc[1] == pytest.approx(1.0)


def test_shape_mismatch_is_rejected():
    cycle = flat_cycle()
    with pytest.raises(ValueError, match="same number of days"):
        simulate_seasons(np.zeros((1, 5)), np.zeros((1, 5)), cycle)
