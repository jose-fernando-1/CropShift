"""Contract models for recommendations (contract/recommendation*.schema.json)."""

from typing import Annotated, Literal

from pydantic import ConfigDict, Field

from app.schemas.common import ContractModel
from app.schemas.locations import Coordinates, MunicipalityCode, PowerCell

SoilClass = Literal[1, 2, 3]
Regime = Literal["rainfed", "irrigated"]
InputSource = Literal["user", "default"]
Dekad = Annotated[int, Field(ge=1, le=36)]
Probability = Annotated[float, Field(ge=0, le=1)]
AnalysisId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_.~-]+$")]


class PointRequest(ContractModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    soil_class: SoilClass | None = None
    regime: Regime | None = None


class MunicipalityRequest(ContractModel):
    municipality_code: MunicipalityCode
    soil_class: SoilClass | None = None
    regime: Regime | None = None


RecommendationRequest = PointRequest | MunicipalityRequest


class Source(ContractModel):
    id: str
    name: str
    url: str | None
    version: str | None


class DatasetVersion(ContractModel):
    name: str
    version: str
    retrieved_at: str


class Location(ContractModel):
    municipality_code: MunicipalityCode
    municipality_name: str
    power_cell: PowerCell
    soil_class: SoilClass
    soil_source: InputSource
    regime: Regime
    regime_source: InputSource
    input_mode: Literal["point", "municipality"]
    municipality_centroid: Coordinates
    near_centroid: bool


class DekadProbability(ContractModel):
    p: Probability
    lo: Probability
    hi: Probability


class PlantingWindow(ContractModel):
    start_dekad: Dekad
    end_dekad: Dekad
    mean_p: Probability


class Zarc(ContractModel):
    values: Annotated[list[Literal[0, 20, 30, 40]], Field(min_length=36, max_length=36)]
    cycle_code: str
    soil_code: int
    ordinance: str
    season: str


class Pam(ContractModel):
    crop_label: str
    years: list[int]
    yield_kg_ha: list[float]
    municipality_median: float | None
    state_median: float | None


class Flags(ContractModel):
    engine_reliable: bool
    ml_applied: bool


class Confidence(ContractModel):
    level: Literal["high", "medium", "low"]
    reasons: Annotated[list[str], Field(min_length=1)]


class RankedCrop(ContractModel):
    crop_id: str
    name: str
    rank: int = Field(ge=1)
    eligible: Literal[True]
    legume: bool
    best_windows: list[PlantingWindow]
    p_success: Annotated[list[DekadProbability], Field(min_length=36, max_length=36)]
    zarc: Zarc | None
    pam: Pam | None
    flags: Flags
    strengths: list[str]
    risks: list[str]
    missing_data: list[str]
    sources: list[Source]
    confidence: Confidence


class ExcludedCrop(ContractModel):
    crop_id: str
    name: str
    eligible: Literal[False]
    reason_code: Literal["gate_failed", "engine_not_run", "no_data_for_regime"]
    reason: str
    zarc: Zarc | None
    pam: Pam | None
    sources: list[Source]


class Disclaimer(ContractModel):
    id: str
    text: str


class Recommendation(ContractModel):
    analysis_id: AnalysisId
    contract_version: str
    method_version: str
    dataset_versions: list[DatasetVersion]
    mock: bool
    generated_at: str
    location: Location
    crops: list[RankedCrop]
    excluded: list[ExcludedCrop]
    disclaimers: list[Disclaimer]
