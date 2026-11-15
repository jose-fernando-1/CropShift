from app.engines.calibration import CalibrationInput, IdentityCalibrator
from app.engines.calibration.features import FEATURE_NAMES, FEATURES


def test_identity_passes_the_simulation_through_and_says_no_ml_was_applied():
    data = CalibrationInput("cowpea", "2613008", 2, [0.1] * 36, [0.0] * 36, [0.3] * 36, {})
    out = IdentityCalibrator().calibrate(data)
    assert (out.p, out.lo, out.hi) == (data.p, data.lo, data.hi) and out.applied is False
    assert out.p is not data.p  # a copy: a trained model must never mutate the stored curve


def test_feature_names_are_unique_and_documented():
    assert len(set(FEATURE_NAMES)) == len(FEATURES)
    assert all(f.unit and f.source for f in FEATURES)
