from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import Crop


class CropRepository:
    def __init__(self, db: Session):
        self.db = db

    def _query(self):
        return select(Crop).options(selectinload(Crop.requirements)).where(Crop.active.is_(True))

    def list_active(self) -> list[Crop]:
        return list(self.db.scalars(self._query().order_by(Crop.id)))

    def get(self, crop_id: str) -> Crop | None:
        return self.db.scalars(self._query().where(Crop.id == crop_id)).first()

    def upsert_catalog_entry(self, entry: dict) -> None:
        """Insert or update one crop with its requirements, stages and sources (idempotent).

        Keeps the gate columns and `has_zarc`, which the validation and ZARC loads own."""
        from app.models.catalog import CropGrowthStage, CropParameterSource, CropRequirement

        crop = self.db.get(Crop, entry["crop_id"])
        fields = {
            "name_en": entry["name_en"],
            "name_pt": entry["name_pt"],
            "scientific_name": entry["scientific_name"],
            "family": entry["family"],
            "legume": entry["legume"],
            "cycle_days": entry["cycle_days"],
            "pam_crop": entry["pam_crop"],
            "zarc_name": entry["zarc_name"],
            "active": True,
        }
        if crop is None:
            crop = Crop(id=entry["crop_id"], **fields)
            self.db.add(crop)
        else:
            for name, value in fields.items():
                setattr(crop, name, value)

        fao, eco = entry["requirements"]["fao56"], entry["requirements"]["ecocrop"]
        salinity = fao["salinity_threshold_ece_ds_m"]
        values = {
            "stage_initial_days": fao["stage_days"]["initial"],
            "stage_development_days": fao["stage_days"]["development"],
            "stage_mid_days": fao["stage_days"]["mid_season"],
            "stage_late_days": fao["stage_days"]["late_season"],
            "stage_total_days": fao["stage_days"]["total"],
            "kc_ini": fao["kc"]["initial"],
            "kc_mid_min": fao["kc"]["mid"]["min"],
            "kc_mid_max": fao["kc"]["mid"]["max"],
            "kc_end_min": fao["kc"]["end"]["min"],
            "kc_end_max": fao["kc"]["end"]["max"],
            "height_min_m": fao["max_height_m"]["min"],
            "height_max_m": fao["max_height_m"]["max"],
            "root_depth_min_m": fao["max_root_depth_m"]["min"],
            "root_depth_max_m": fao["max_root_depth_m"]["max"],
            "depletion_fraction": fao["depletion_fraction"],
            "salinity_min_ds_m": salinity["min"] if salinity else None,
            "salinity_max_ds_m": salinity["max"] if salinity else None,
            "eco_species": eco["species"],
            "temp_opt_min_c": eco["temperature_optimal_c"]["min"],
            "temp_opt_max_c": eco["temperature_optimal_c"]["max"],
            "temp_abs_min_c": eco["temperature_absolute_c"]["min"],
            "temp_abs_max_c": eco["temperature_absolute_c"]["max"],
            "rain_opt_min_mm": eco["rainfall_optimal_mm"]["min"],
            "rain_opt_max_mm": eco["rainfall_optimal_mm"]["max"],
            "rain_abs_min_mm": eco["rainfall_absolute_mm"]["min"],
            "rain_abs_max_mm": eco["rainfall_absolute_mm"]["max"],
            "ph_opt_min": eco["ph_optimal"]["min"],
            "ph_opt_max": eco["ph_optimal"]["max"],
            "eco_cycle_min_days": eco["cycle_days"]["min"],
            "eco_cycle_max_days": eco["cycle_days"]["max"],
            "tolerances": eco["tolerances"],
        }
        if crop.requirements is None:
            crop.requirements = CropRequirement(**values)
        else:
            for name, value in values.items():
                setattr(crop.requirements, name, value)

        crop.stages.clear()
        self.db.flush()
        crop.stages.extend(CropGrowthStage(**stage) for stage in entry["stages"])
        self.db.execute(CropParameterSource.__table__.delete().where(CropParameterSource.crop_id == crop.id))
        self.db.add_all(CropParameterSource(crop_id=crop.id, **source) for source in entry["sources"])
