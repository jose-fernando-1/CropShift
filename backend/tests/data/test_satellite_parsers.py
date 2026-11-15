"""Parsers for the real NASA sample extractions of 2026-11-14 reproduce the figures the proposal reports."""

import pytest

from app.core.config import REPO_ROOT
from data.sources.earthdata_appeears.parse import read_layer
from data.sources.earthdata_harmony.parse import read_giovanni_series

APPEEARS = REPO_ROOT / "data/sources/earthdata_appeears/sample"
IMERG = REPO_ROOT / "data/sources/earthdata_harmony/sample/imerg_final_serie_2024_ponto_agreste_PE.csv"


def values(rows):
    return [v for _, v in rows if v is not None]


def test_imerg_2024_total_matches_the_proposal():
    metadata, series = read_giovanni_series(IMERG)
    assert metadata["unit"] == "mm/day" and len(series) == 366
    rain = values(series.items())
    assert len(rain) == 366  # no fill values
    assert sum(rain) == pytest.approx(410, abs=1)  # proposal: 410 mm in 2024
    assert sum(1 for v in rain if v > 1) == 56
    assert max(rain) == pytest.approx(45.2, abs=0.05)


def test_smap_l4_has_728_valid_three_hourly_readings():
    rows = read_layer(APPEEARS / "appeears_SPL4SMGP-008-results.csv", "smap_l4_surface")
    surface = values(rows)
    assert len(rows) == 728 and len(surface) == 728
    assert min(surface) == pytest.approx(0.05, abs=0.005) and max(surface) == pytest.approx(0.28, abs=0.01)
    rootzone = values(read_layer(APPEEARS / "appeears_SPL4SMGP-008-results.csv", "smap_l4_rootzone"))
    assert min(rootzone) >= 0.07 and max(rootzone) <= 0.13


def test_smap_l3_gaps_are_none_not_zero():
    rows = read_layer(APPEEARS / "appeears_SPL3SMP-E-006-results.csv", "smap_l3_am")
    valid = values(rows)
    assert len(rows) == 91 and len(valid) == 33  # proposal: 33 of 91 days (36%)
    assert all(v > 0 for v in valid)


def test_modis_layers():
    ndvi = values(read_layer(APPEEARS / "appeears_MOD13Q1-061-results.csv", "mod13_ndvi"))
    assert len(ndvi) == 7 and min(ndvi) == pytest.approx(0.29, abs=0.01) and max(ndvi) == pytest.approx(0.74, abs=0.01)
    et = values(read_layer(APPEEARS / "appeears_MOD16A2GF-061-results.csv", "mod16_et"))
    assert len(et) == 13 and min(et) == pytest.approx(3.1) and max(et) == pytest.approx(16.8)
    lai = values(read_layer(APPEEARS / "appeears_fieldshift-bases-novas-teste-MOD15A2H-061-results.csv", "mod15_lai"))
    assert len(lai) == 93 and min(lai) >= 0.1 and max(lai) <= 2.3
    gpp = values(read_layer(APPEEARS / "appeears_fieldshift-bases-novas-teste-MOD17A2HGF-061-results.csv", "mod17_gpp"))
    assert len(gpp) == 93 and min(gpp) >= 0.008 and max(gpp) <= 0.061


def test_elevation_samples_agree_with_power_grid_elevation():
    nasadem = values(
        read_layer(APPEEARS / "appeears_fieldshift-bases-novas-teste-NASADEM-NC-001-results.csv", "nasadem_height")
    )
    srtm = values(read_layer(APPEEARS / "appeears_SRTMGL1-NC-003-results.csv", "srtm_height"))
    assert nasadem == [618.0] and srtm == [620.0]  # POWER grid says 618.18 m: coherent


def test_unknown_layer_column_is_an_error():
    with pytest.raises(ValueError, match="no column"):
        read_layer(APPEEARS / "appeears_MOD13Q1-061-results.csv", "mod16_et")
