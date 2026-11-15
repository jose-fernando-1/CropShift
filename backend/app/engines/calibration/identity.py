from app.engines.calibration.interface import CalibratedCurve, CalibrationInput


class IdentityCalibrator:
    """No ML: the simulation passes through unchanged and says so (`applied=False`)."""

    def calibrate(self, data: CalibrationInput) -> CalibratedCurve:
        return CalibratedCurve(p=list(data.p), lo=list(data.lo), hi=list(data.hi), applied=False)
