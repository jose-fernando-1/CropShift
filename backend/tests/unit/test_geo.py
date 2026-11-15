import json

import pytest

from app.core.config import REPO_ROOT
from app.core.geo import fold_accents, js_round, polygon_centroid, power_cell


def test_pilot_point_cell():
    assert power_cell(-8.60, -36.40) == {"id": "r163c230", "lat": -8.5, "lon": -36.25}


def test_js_round_is_half_up():
    assert [js_round(x) for x in (0.5, 1.5, 2.5, -0.5, -1.5)] == [1, 2, 3, 0, -1]


def test_fold_accents():
    assert fold_accents("São Bento do Úna") == "sao bento do una"


def test_centroid_of_unit_square():
    square = {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}
    assert polygon_centroid(square) == pytest.approx((1.0, 1.0))


def test_matches_web_fixture_for_all_185_municipalities():
    """Same geometry in, same centroid and POWER cell out as the web's generator produced."""
    geo = json.loads((REPO_ROOT / "web/public/geo/pe-municipalities.json").read_text(encoding="utf-8"))
    expected = {
        m["code"]: m for m in json.loads((REPO_ROOT / "web/mock-data/municipalities.json").read_text(encoding="utf-8"))
    }
    assert len(geo["features"]) == len(expected) == 185
    for feature in geo["features"]:
        code = feature["properties"]["code"]
        lon, lat = polygon_centroid(feature["geometry"])
        assert power_cell(lat, lon) == expected[code]["power_cell"], code
        assert round(lat, 5) == pytest.approx(expected[code]["centroid"]["lat"], abs=1e-5), code
        assert round(lon, 5) == pytest.approx(expected[code]["centroid"]["lon"], abs=1e-5), code
    assert len({m["power_cell"]["id"] for m in expected.values()}) == 38
