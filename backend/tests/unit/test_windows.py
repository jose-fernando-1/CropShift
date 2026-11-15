"""Golden tests: the Python ports reproduce the windows and confidence of the contract examples (made by the mock)."""

import json

import pytest

from app.core.config import REPO_ROOT
from app.engines.confidence import assess_confidence
from app.engines.windows import best_windows, ranking_score, spearman, wilson_interval

EXAMPLES = [
    path
    for path in sorted((REPO_ROOT / "contract/examples").glob("recommendation.*.json"))
    if not path.name.startswith("recommendation-request")
]


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.name)
def test_best_windows_and_ranking_match_example(path):
    rec = json.loads(path.read_text(encoding="utf-8"))
    scores = []
    for crop in rec["crops"]:
        p = [d["p"] for d in crop["p_success"]]
        got = [{"start_dekad": w.start_dekad, "end_dekad": w.end_dekad, "mean_p": w.mean_p} for w in best_windows(p)]
        assert got == crop["best_windows"], (path.name, crop["crop_id"])
        scores.append((ranking_score(p), crop["crop_id"]))
    expected = [c["crop_id"] for c in rec["crops"]]
    assert [cid for _, cid in sorted(scores, key=lambda s: (-s[0], s[1]))] == expected


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.name)
def test_confidence_level_matches_example(path):
    rec = json.loads(path.read_text(encoding="utf-8"))
    for crop in rec["crops"]:
        p = [d["p"] for d in crop["p_success"]]
        zarc = crop["zarc"]["values"] if crop["zarc"] else None
        result = assess_confidence(True, p, zarc, rec["location"]["near_centroid"])
        assert result.level == crop["confidence"]["level"], (path.name, crop["crop_id"])


def test_wilson_band_matches_example_bands():
    path = REPO_ROOT / "contract/examples/recommendation.sao-bento-do-una.soil2.rainfed.json"
    rec = json.loads(path.read_text("utf-8"))
    for entry in rec["crops"][0]["p_success"]:
        lo, hi = wilson_interval(round(entry["p"] * 40), 40)
        assert lo == pytest.approx(entry["lo"], abs=1e-3) and hi == pytest.approx(entry["hi"], abs=1e-3)


def test_wilson_edges():
    assert wilson_interval(0, 0) == (0.0, 1.0)
    lo, hi = wilson_interval(40, 40)
    assert hi == 1.0 and 0.9 < lo < 1.0


def test_spearman_known_values_and_ties():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)
    assert spearman([1, 1, 1], [1, 2, 3]) is None  # constant input has no rank correlation
    assert spearman([1, 2, 2, 3], [1, 2, 2, 3]) == pytest.approx(1.0)
