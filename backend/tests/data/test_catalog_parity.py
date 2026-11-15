"""The Python crop-sheet parser must agree with the web mock's generator on the same sheet."""

import itertools
import json

from app.core.config import REPO_ROOT
from data.sources.fao_ecocrop.parse import build_catalog, growth_stages


def test_requirements_equal_web_fixture():
    web = json.loads((REPO_ROOT / "web/mock-data/requirements.json").read_text(encoding="utf-8"))
    ours = {entry["crop_id"]: entry["requirements"] for entry in build_catalog()}
    assert set(web) <= set(ours)
    for crop_id, expected in web.items():
        assert ours[crop_id] == expected, crop_id


def test_catalog_has_the_eleven_crops_of_the_proposal():
    assert [c["crop_id"] for c in build_catalog()] == [
        "cowpea", "peanut", "sorghum", "maize", "common_bean", "sunflower",
        "castor", "cotton", "pearl_millet", "cassava", "sweet_potato",
    ]  # fmt: skip


def test_stage_durations_follow_the_sheet_and_kc_is_continuous():
    for entry in build_catalog():
        stages = growth_stages(entry["requirements"])
        days = entry["requirements"]["fao56"]["stage_days"]
        assert [s["duration_days"] for s in stages] == [
            days["initial"],
            days["development"],
            days["mid_season"],
            days["late_season"],
        ]
        for previous, current in itertools.pairwise(stages):
            assert previous["kc_end"] == current["kc_start"]
            assert previous["root_depth_end_m"] == current["root_depth_start_m"]
        assert all(s["kc_start"] > 0 and s["root_depth_end_m"] >= s["root_depth_start_m"] for s in stages)


def test_missing_kc_ini_is_an_explicit_assumption():
    cowpea = next(c for c in build_catalog() if c["crop_id"] == "cowpea")
    assert cowpea["requirements"]["fao56"]["kc"]["initial"] is None  # kept NULL as published
    assert any(s["parameter"] == "kc_ini" and s["kind"] == "assumption" for s in cowpea["sources"])
