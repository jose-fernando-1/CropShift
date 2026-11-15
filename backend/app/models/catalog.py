"""Agronomic catalog: crops, their FAO-56 / EcoCrop requirements, growth stages and provenance.

Absent values are NULL, never 0. Ranges are stored as min/max pairs (min == max for single values).
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Crop(Base):
    __tablename__ = "crops"
    __table_args__ = (
        CheckConstraint("gate_status IN ('passed', 'failed', 'not_run')", name="ck_crops_gate_status"),
        CheckConstraint("cycle_days > 0", name="ck_crops_cycle_days"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # slug, e.g. "cowpea"
    name_en: Mapped[str] = mapped_column(String(80))
    name_pt: Mapped[str] = mapped_column(String(80))
    scientific_name: Mapped[str] = mapped_column(String(120))
    family: Mapped[str] = mapped_column(String(60))
    legume: Mapped[bool]
    cycle_days: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(default=True, server_default="true")
    pam_crop: Mapped[str | None] = mapped_column(String(40))  # IBGE PAM product label, if any
    zarc_name: Mapped[str | None] = mapped_column(String(80))  # MAPA ZARC "Nome_cultura", if any
    has_zarc: Mapped[bool] = mapped_column(default=False, server_default="false")

    # Quality gate (Spearman vs ZARC), written by the validation step; "not_run" until then.
    gate_status: Mapped[str] = mapped_column(String(10), default="not_run", server_default="not_run")
    gate_value: Mapped[float | None] = mapped_column(Float)
    gate_threshold: Mapped[float] = mapped_column(Float, default=0.7, server_default="0.7")
    gate_note: Mapped[str | None] = mapped_column(Text)

    requirements: Mapped["CropRequirement | None"] = relationship(back_populates="crop", uselist=False)
    stages: Mapped[list["CropGrowthStage"]] = relationship(
        back_populates="crop", order_by="CropGrowthStage.position", cascade="all, delete-orphan"
    )


class CropRequirement(Base):
    __tablename__ = "crop_requirements"
    __table_args__ = (
        CheckConstraint("depletion_fraction BETWEEN 0 AND 1", name="ck_req_depletion_fraction"),
        CheckConstraint("stage_total_days > 0", name="ck_req_stage_total"),
        CheckConstraint("kc_mid_min <= kc_mid_max AND kc_end_min <= kc_end_max", name="ck_req_kc_ranges"),
        CheckConstraint("root_depth_min_m <= root_depth_max_m", name="ck_req_root_range"),
        CheckConstraint(
            "temp_opt_min_c <= temp_opt_max_c AND temp_abs_min_c <= temp_abs_max_c", name="ck_req_temp_ranges"
        ),
        CheckConstraint("ph_opt_min <= ph_opt_max", name="ck_req_ph_range"),
    )

    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"), primary_key=True)

    # FAO-56 Table 11: stage lengths in days. `stage_total_days` is kept as published; it can differ from the sum.
    stage_initial_days: Mapped[int] = mapped_column(SmallInteger)
    stage_development_days: Mapped[int] = mapped_column(SmallInteger)
    stage_mid_days: Mapped[int] = mapped_column(SmallInteger)
    stage_late_days: Mapped[int] = mapped_column(SmallInteger)
    stage_total_days: Mapped[int] = mapped_column(SmallInteger)

    # FAO-56 Table 12 (Kc), 22 (root depth, p), 23 (salinity). kc_ini is NULL when the bulletin derives it.
    kc_ini: Mapped[float | None] = mapped_column(Float)
    kc_mid_min: Mapped[float] = mapped_column(Float)
    kc_mid_max: Mapped[float] = mapped_column(Float)
    kc_end_min: Mapped[float] = mapped_column(Float)
    kc_end_max: Mapped[float] = mapped_column(Float)
    height_min_m: Mapped[float] = mapped_column(Float)
    height_max_m: Mapped[float] = mapped_column(Float)
    root_depth_min_m: Mapped[float] = mapped_column(Float)
    root_depth_max_m: Mapped[float] = mapped_column(Float)
    depletion_fraction: Mapped[float] = mapped_column(Float)
    salinity_min_ds_m: Mapped[float | None] = mapped_column(Float)
    salinity_max_ds_m: Mapped[float | None] = mapped_column(Float)

    # FAO EcoCrop.
    eco_species: Mapped[str] = mapped_column(String(120))
    temp_opt_min_c: Mapped[float] = mapped_column(Float)
    temp_opt_max_c: Mapped[float] = mapped_column(Float)
    temp_abs_min_c: Mapped[float] = mapped_column(Float)
    temp_abs_max_c: Mapped[float] = mapped_column(Float)
    rain_opt_min_mm: Mapped[float] = mapped_column(Float)
    rain_opt_max_mm: Mapped[float] = mapped_column(Float)
    rain_abs_min_mm: Mapped[float] = mapped_column(Float)
    rain_abs_max_mm: Mapped[float] = mapped_column(Float)
    ph_opt_min: Mapped[float] = mapped_column(Float)
    ph_opt_max: Mapped[float] = mapped_column(Float)
    eco_cycle_min_days: Mapped[float] = mapped_column(Float)
    eco_cycle_max_days: Mapped[float] = mapped_column(Float)
    tolerances: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list, server_default="{}")

    crop: Mapped[Crop] = relationship(back_populates="requirements")


class CropGrowthStage(Base):
    """Per-stage Kc and duration derived from the crop sheet, the input of the water balance."""

    __tablename__ = "crop_growth_stages"
    __table_args__ = (
        UniqueConstraint("crop_id", "position", name="uq_crop_growth_stages_position"),
        CheckConstraint("position BETWEEN 1 AND 4", name="ck_stage_position"),
        CheckConstraint("duration_days >= 0", name="ck_stage_duration"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(SmallInteger)  # 1 initial, 2 development, 3 mid-season, 4 late
    stage: Mapped[str] = mapped_column(String(20))
    duration_days: Mapped[int] = mapped_column(SmallInteger)
    kc_start: Mapped[float] = mapped_column(Float)
    kc_end: Mapped[float] = mapped_column(Float)
    root_depth_start_m: Mapped[float] = mapped_column(Float)
    root_depth_end_m: Mapped[float] = mapped_column(Float)
    depletion_fraction: Mapped[float] = mapped_column(Float)

    crop: Mapped[Crop] = relationship(back_populates="stages")


class CropParameterSource(Base):
    """Where each group of parameters came from, including documented assumptions."""

    __tablename__ = "crop_parameter_sources"
    __table_args__ = (UniqueConstraint("crop_id", "parameter", name="uq_crop_parameter_sources"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"), index=True)
    parameter: Mapped[str] = mapped_column(String(60))
    source: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(12))  # "published" or "assumption"
    quality_note: Mapped[str | None] = mapped_column(Text)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
