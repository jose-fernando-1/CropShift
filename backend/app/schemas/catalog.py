"""Contract models for the crop catalog (contract/crops.schema.json)."""

from typing import Literal

from pydantic import Field

from app.schemas.common import ContractModel


class NumberRange(ContractModel):
    """Inclusive range as the source lists it; min == max for a single value."""

    min: float
    max: float


class StageDays(ContractModel):
    initial: int = Field(ge=0)
    development: int = Field(ge=0)
    mid_season: int = Field(ge=0)
    late_season: int = Field(ge=0)
    total: int = Field(gt=0, description="As published; may differ from the stage sum.")


class Kc(ContractModel):
    initial: float | None
    mid: NumberRange
    end: NumberRange


class Fao56(ContractModel):
    stage_days: StageDays
    kc: Kc
    max_height_m: NumberRange
    max_root_depth_m: NumberRange
    depletion_fraction: float = Field(ge=0, le=1)
    salinity_threshold_ece_ds_m: NumberRange | None


class EcoCrop(ContractModel):
    species: str
    temperature_optimal_c: NumberRange
    temperature_absolute_c: NumberRange
    rainfall_optimal_mm: NumberRange
    rainfall_absolute_mm: NumberRange
    ph_optimal: NumberRange
    cycle_days: NumberRange
    tolerances: list[str]


class CropRequirements(ContractModel):
    fao56: Fao56
    ecocrop: EcoCrop


class QualityGate(ContractModel):
    passed: bool
    status: Literal["passed", "failed", "not_run"]
    metric: Literal["spearman"]
    value: float | None
    threshold: float
    note: str


class Crop(ContractModel):
    crop_id: str
    name: str
    scientific_name: str
    family: str
    legume: bool
    cycle_days: int = Field(gt=0)
    gate: QualityGate
    has_zarc: bool
    has_pam: bool
    requirements: CropRequirements | None


class CropsResponse(ContractModel):
    contract_version: str
    mock: bool
    crops: list[Crop]
