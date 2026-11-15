"""Precomputed planting-window simulation results and the audit log of served analyses."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PlantingWindowResult(Base):
    """One row per (climate cell, crop, soil class, dekad) and method version. Rainfed only."""

    __tablename__ = "planting_window_results"
    __table_args__ = (
        CheckConstraint("soil_class BETWEEN 1 AND 3", name="ck_pwr_soil_class"),
        CheckConstraint("dekad BETWEEN 1 AND 36", name="ck_pwr_dekad"),
        CheckConstraint("n_success <= n_valid", name="ck_pwr_counts"),
        CheckConstraint("p BETWEEN 0 AND 1 AND lo BETWEEN 0 AND 1 AND hi BETWEEN 0 AND 1", name="ck_pwr_probabilities"),
    )

    cell_id: Mapped[str] = mapped_column(ForeignKey("climate_cells.id", ondelete="CASCADE"), primary_key=True)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"), primary_key=True)
    soil_class: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    dekad: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    method_version: Mapped[str] = mapped_column(String(40), primary_key=True)

    first_season: Mapped[int] = mapped_column(SmallInteger)
    last_season: Mapped[int] = mapped_column(SmallInteger)
    n_valid: Mapped[int] = mapped_column(SmallInteger)  # seasons with complete data
    n_success: Mapped[int] = mapped_column(SmallInteger)
    p: Mapped[float] = mapped_column(Float)  # success frequency (NOT a calibrated probability)
    lo: Mapped[float] = mapped_column(Float)  # Wilson 95%
    hi: Mapped[float] = mapped_column(Float)
    eta_etc_p10: Mapped[float | None] = mapped_column(Float)
    eta_etc_p50: Mapped[float | None] = mapped_column(Float)
    eta_etc_p90: Mapped[float | None] = mapped_column(Float)
    deficit_mid_p50_mm: Mapped[float | None] = mapped_column(Float)
    heat_days_p50: Mapped[float | None] = mapped_column(Float)
    cold_days_p50: Mapped[float | None] = mapped_column(Float)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecommendationRun(Base):
    """Append-only audit log of served recommendations: what was asked, with which versions. Nothing reads it back."""

    __tablename__ = "recommendation_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[str] = mapped_column(String(120), index=True)
    municipality_code: Mapped[str] = mapped_column(String(7))
    soil_class: Mapped[int] = mapped_column(SmallInteger)
    soil_source: Mapped[str] = mapped_column(String(8))
    regime: Mapped[str] = mapped_column(String(10))
    method_version: Mapped[str] = mapped_column(String(40))
    data_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
