"""Official reference data shown next to the simulation: MAPA ZARC windows and IBGE PAM yields."""

from sqlalchemy import CheckConstraint, Float, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ZarcWindow(Base):
    """ZARC risk values per dekad for a municipality, crop and texture soil class (rainfed rows only)."""

    __tablename__ = "zarc_windows"
    __table_args__ = (
        UniqueConstraint("municipality_code", "crop_id", "soil_code", name="uq_zarc_windows"),
        CheckConstraint("cardinality(values) = 36", name="ck_zarc_windows_36_dekads"),
        CheckConstraint("soil_code BETWEEN 1 AND 3", name="ck_zarc_windows_soil_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    municipality_code: Mapped[str] = mapped_column(ForeignKey("municipalities.code", ondelete="CASCADE"), index=True)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"), index=True)
    soil_code: Mapped[int] = mapped_column(SmallInteger)
    cycle_code: Mapped[str] = mapped_column(String(8))
    ordinance: Mapped[str] = mapped_column(String(80))
    season: Mapped[str] = mapped_column(String(9))  # "2025/2026"
    climate: Mapped[str] = mapped_column(String(80))
    values: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))  # 0, 20, 30 or 40 per dekad


class PamYield(Base):
    """IBGE PAM municipal yield per crop and year (a municipal statistic, not field-level)."""

    __tablename__ = "pam_yields"
    __table_args__ = (UniqueConstraint("municipality_code", "pam_crop", "year", name="uq_pam_yields"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    municipality_code: Mapped[str] = mapped_column(ForeignKey("municipalities.code", ondelete="CASCADE"), index=True)
    pam_crop: Mapped[str] = mapped_column(String(40), index=True)
    year: Mapped[int] = mapped_column(SmallInteger)
    yield_kg_ha: Mapped[float] = mapped_column(Float)
    harvested_area_ha: Mapped[float | None] = mapped_column(Float)
    production_t: Mapped[float | None] = mapped_column(Float)
