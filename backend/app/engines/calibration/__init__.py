"""ML calibration layer: READY BUT NOT IMPLEMENTED.

The proposal adds an ML calibrator that learns from ZARC (window/risk) and IBGE PAM (yield) what the simple water
balance misses (e.g. castor) and reports uncertainty. That training is a later phase. What exists now is the seam:
`Calibrator` (the interface the recommendation service calls), `IdentityCalibrator` (the only implementation: it
returns the simulation unchanged and reports `applied=False`, so responses carry `flags.ml_applied = false`), and
`features.FEATURES` (the documented inputs a trained model will receive). See data/ml/README.md for the plan.
"""

from app.engines.calibration.identity import IdentityCalibrator
from app.engines.calibration.interface import CalibratedCurve, CalibrationInput, Calibrator

__all__ = ["CalibratedCurve", "CalibrationInput", "Calibrator", "IdentityCalibrator"]
