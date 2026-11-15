"""Pernambuco municipalities and the NASA POWER grid cells their centroids fall in."""

from geoalchemy2 import Geometry
from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ClimateCell(Base):
    """One cell of the POWER daily grid (MERRA-2, 0.5° x 0.625°); its centre is the climate query point."""

    __tablename__ = "climate_cells"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # e.g. "r163c230"
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    elevation_m: Mapped[float | None] = mapped_column(Float)  # grid elevation reported by POWER

    municipalities: Mapped[list["Municipality"]] = relationship(back_populates="power_cell")


class Municipality(Base):
    __tablename__ = "municipalities"
    __table_args__ = (
        CheckConstraint("code ~ '^[0-9]{7}$'", name="ck_municipalities_code"),
        # Explicit (not `spatial_index=True`) so Alembic creates it once, not twice.
        Index("idx_municipalities_geom", "geom", postgresql_using="gist"),
    )

    code: Mapped[str] = mapped_column(String(7), primary_key=True)  # 7-digit IBGE code
    name: Mapped[str] = mapped_column(String(120))
    search: Mapped[str] = mapped_column(String(120))  # accent-free lowercase name
    centroid_lat: Mapped[float] = mapped_column(Float)
    centroid_lon: Mapped[float] = mapped_column(Float)
    power_cell_id: Mapped[str] = mapped_column(ForeignKey("climate_cells.id"), index=True)
    default_soil_class: Mapped[int | None] = mapped_column(SmallInteger)  # ZARC 1-3 derived from SoilGrids, or NULL
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326, spatial_index=False))

    power_cell: Mapped[ClimateCell] = relationship(back_populates="municipalities")
