"""Daily climate per POWER cell, dataset provenance, and SoilGrids profiles per municipality."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ClimateDaily(Base):
    """NASA POWER daily values (AG community). NULL where POWER reported its -999 fill value."""

    __tablename__ = "climate_daily"

    cell_id: Mapped[str] = mapped_column(ForeignKey("climate_cells.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    t2m: Mapped[float | None] = mapped_column(Float)  # °C, mean air temperature at 2 m
    t2m_max: Mapped[float | None] = mapped_column(Float)  # °C
    t2m_min: Mapped[float | None] = mapped_column(Float)  # °C
    rh2m: Mapped[float | None] = mapped_column(Float)  # %
    ws2m: Mapped[float | None] = mapped_column(Float)  # m/s at 2 m
    ps: Mapped[float | None] = mapped_column(Float)  # kPa, surface pressure
    allsky_sfc_sw_dwn: Mapped[float | None] = mapped_column(Float)  # MJ/m²/day, all-sky shortwave downward
    prectotcorr: Mapped[float | None] = mapped_column(Float)  # mm/day, bias-corrected precipitation
    quality: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")  # bit i set = column i missing


class DatasetVersion(Base):
    """What data the results were computed from; `name` + `version` is unique and `retrieved_at` is real."""

    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("name", "version", name="uq_dataset_versions_name_version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    version: Mapped[str] = mapped_column(String(40))
    url: Mapped[str | None] = mapped_column(String(300))
    licence: Mapped[str | None] = mapped_column(String(120))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text)


class SoilProfile(Base):
    """SoilGrids 2.0 values per municipality centroid and depth, already unscaled. NULL = masked/no data."""

    __tablename__ = "soil_profiles"
    __table_args__ = (UniqueConstraint("municipality_code", "depth", name="uq_soil_profiles_depth"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    municipality_code: Mapped[str] = mapped_column(ForeignKey("municipalities.code", ondelete="CASCADE"), index=True)
    depth: Mapped[str] = mapped_column(String(12))  # "0-5cm", "5-15cm", "15-30cm"
    clay_g_kg: Mapped[float | None] = mapped_column(Float)
    sand_g_kg: Mapped[float | None] = mapped_column(Float)
    silt_g_kg: Mapped[float | None] = mapped_column(Float)
    ph: Mapped[float | None] = mapped_column(Float)  # pH in water
    soc_g_kg: Mapped[float | None] = mapped_column(Float)  # soil organic carbon
    bulk_density_g_cm3: Mapped[float | None] = mapped_column(Float)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
