"""Backend-only environment profile (PDF plan step 11; not part of contract v0.1)."""

from pydantic import Field

from app.schemas.common import ContractModel
from app.schemas.locations import Coordinates, MunicipalityCode, PowerCell
from app.schemas.recommendations import SoilClass, Source


class EnvironmentRequest(ContractModel):
    """A point (lat/lon) or a municipality, never both. Coordinates travel in the body, never the query string."""

    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    municipality_code: MunicipalityCode | None = None


class ClimateSummary(ContractModel):
    first_day: str
    last_day: str
    days: int
    days_with_gaps: int
    mean_annual_rain_mm: float | None
    mean_tmax_c: float | None
    mean_tmin_c: float | None


class SoilLayer(ContractModel):
    depth: str
    clay_g_kg: float | None
    sand_g_kg: float | None
    silt_g_kg: float | None
    ph: float | None
    soc_g_kg: float | None
    bulk_density_g_cm3: float | None


class EnvironmentProfile(ContractModel):
    municipality_code: MunicipalityCode
    municipality_name: str
    municipality_centroid: Coordinates
    power_cell: PowerCell
    elevation_m: float | None
    climate: ClimateSummary
    soil: list[SoilLayer]
    default_soil_class: SoilClass | None
    missing_data: list[str]
    sources: list[Source]
