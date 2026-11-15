"""Crop catalog use cases: turns stored crops into localized contract models."""

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.i18n import Locale
from app.models.catalog import Crop as CropRow
from app.models.catalog import CropRequirement
from app.repositories.crops import CropRepository
from app.schemas.catalog import (
    Crop,
    CropRequirements,
    CropsResponse,
    EcoCrop,
    Fao56,
    Kc,
    NumberRange,
    QualityGate,
    StageDays,
)

_NOT_RUN_NOTE = {
    "en": "FAO-56 crop sheet ready; quality gate not computed yet.",
    "pt-BR": "Ficha FAO-56 pronta; portão de qualidade ainda não calculado.",
}


def _range(low: float, high: float) -> NumberRange:
    return NumberRange(min=low, max=high)


def _optional_range(low: float | None, high: float | None) -> NumberRange | None:
    return None if low is None or high is None else _range(low, high)


def requirements_to_contract(row: CropRequirement) -> CropRequirements:
    return CropRequirements(
        fao56=Fao56(
            stage_days=StageDays(
                initial=row.stage_initial_days,
                development=row.stage_development_days,
                mid_season=row.stage_mid_days,
                late_season=row.stage_late_days,
                total=row.stage_total_days,
            ),
            kc=Kc(
                initial=row.kc_ini,
                mid=_range(row.kc_mid_min, row.kc_mid_max),
                end=_range(row.kc_end_min, row.kc_end_max),
            ),
            max_height_m=_range(row.height_min_m, row.height_max_m),
            max_root_depth_m=_range(row.root_depth_min_m, row.root_depth_max_m),
            depletion_fraction=row.depletion_fraction,
            salinity_threshold_ece_ds_m=_optional_range(row.salinity_min_ds_m, row.salinity_max_ds_m),
        ),
        ecocrop=EcoCrop(
            species=row.eco_species,
            temperature_optimal_c=_range(row.temp_opt_min_c, row.temp_opt_max_c),
            temperature_absolute_c=_range(row.temp_abs_min_c, row.temp_abs_max_c),
            rainfall_optimal_mm=_range(row.rain_opt_min_mm, row.rain_opt_max_mm),
            rainfall_absolute_mm=_range(row.rain_abs_min_mm, row.rain_abs_max_mm),
            ph_optimal=_range(row.ph_opt_min, row.ph_opt_max),
            cycle_days=_range(row.eco_cycle_min_days, row.eco_cycle_max_days),
            tolerances=list(row.tolerances),
        ),
    )


def gate_to_contract(row: CropRow, locale: Locale) -> QualityGate:
    return QualityGate(
        passed=row.gate_status == "passed",
        status=row.gate_status,  # type: ignore[arg-type]  # constrained by ck_crops_gate_status
        metric="spearman",
        value=row.gate_value,
        threshold=row.gate_threshold,
        note=row.gate_note or _NOT_RUN_NOTE[locale],
    )


def crop_to_contract(row: CropRow, locale: Locale) -> Crop:
    return Crop(
        crop_id=row.id,
        name=row.name_pt if locale == "pt-BR" else row.name_en,
        scientific_name=row.scientific_name,
        family=row.family,
        legume=row.legume,
        cycle_days=row.cycle_days,
        gate=gate_to_contract(row, locale),
        has_zarc=row.has_zarc,
        has_pam=row.pam_crop is not None,
        requirements=requirements_to_contract(row.requirements) if row.requirements else None,
    )


class CatalogService:
    def __init__(self, crops: CropRepository):
        self.crops = crops

    def list_crops(self, locale: Locale) -> CropsResponse:
        return CropsResponse(
            contract_version=settings.contract_version,
            mock=False,
            crops=[crop_to_contract(row, locale) for row in self.crops.list_active()],
        )

    def get_crop(self, crop_id: str, locale: Locale) -> Crop:
        row = self.crops.get(crop_id)
        if row is None:
            raise AppError("not_found", "unknown_crop", 404)
        return crop_to_contract(row, locale)
