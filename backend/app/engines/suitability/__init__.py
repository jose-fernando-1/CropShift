"""Static environmental suitability (PDF plan phase 4): how well a place's long-term climate and soil fit a crop's
EcoCrop ranges. Pure functions, no I/O.

It complements, and never replaces, the water-balance simulation: it is NOT used for ranking (so water is not counted
twice, PDF step 15); it feeds the risk and missing-data notes of a result. A factor with no data is "not evaluated",
never a score of 0 in disguise. The weights are versioned configuration, and the score is not a probability.
"""

from app.engines.suitability.models import FactorResult, SuitabilityResult
from app.engines.suitability.scoring import SUITABILITY_VERSION, WEIGHTS, assess_suitability

__all__ = ["SUITABILITY_VERSION", "WEIGHTS", "FactorResult", "SuitabilityResult", "assess_suitability"]
