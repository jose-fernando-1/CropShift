"""Environment profile of a place: stored POWER climate, SoilGrids layers and elevation, and what is missing."""

from datetime import date

from sqlalchemy import extract, func, select

from app.core.exceptions import AppError
from app.models.climate import ClimateDaily, SoilProfile
from app.repositories.climate import ClimateRepository
from app.repositories.geo import MunicipalityRepository
from app.schemas.environment import ClimateSummary, EnvironmentProfile, EnvironmentRequest, SoilLayer
from app.schemas.locations import Coordinates
from app.services.location_service import LocationService, municipality_cell
from app.services.recommendation_service import POWER_SOURCE, SOILGRIDS_SOURCE


class EnvironmentService:
    def __init__(self, municipalities: MunicipalityRepository, climate: ClimateRepository):
        self.municipalities = municipalities
        self.climate = climate
        self.locations = LocationService(municipalities)

    def profile(self, request: EnvironmentRequest) -> EnvironmentProfile:
        if request.municipality_code and (request.lat is not None or request.lon is not None):
            raise AppError("invalid_request", "invalid_request", 422)
        if request.municipality_code:
            municipality = self.municipalities.get(request.municipality_code)
            if municipality is None:
                raise AppError("out_of_coverage", "municipality_not_covered", 422)
        elif request.lat is not None and request.lon is not None:
            municipality, _ = self.locations.locate(Coordinates(lat=request.lat, lon=request.lon))
        else:
            raise AppError("invalid_request", "invalid_request", 422)

        db = self.climate.db
        coverage = self.climate.coverage(municipality.power_cell_id)
        if coverage["days"] == 0:
            raise AppError("no_data", "no_data", 404)
        years = (
            select(extract("year", ClimateDaily.day).label("y"), func.sum(ClimateDaily.prectotcorr).label("rain"))
            .where(
                ClimateDaily.cell_id == municipality.power_cell_id,
                ClimateDaily.day < date(coverage["last_day"].year, 1, 1),
            )
            .group_by("y")
            .subquery()
        )
        mean_rain = db.execute(select(func.avg(years.c.rain))).scalar()
        tmax, tmin = db.execute(
            select(func.avg(ClimateDaily.t2m_max), func.avg(ClimateDaily.t2m_min)).where(
                ClimateDaily.cell_id == municipality.power_cell_id
            )
        ).one()
        layers = list(
            db.scalars(
                select(SoilProfile).where(SoilProfile.municipality_code == municipality.code).order_by(SoilProfile.id)
            )
        )
        missing = []
        if not layers or all(layer.clay_g_kg is None for layer in layers):
            missing.append(
                "SoilGrids has no value at this municipality centroid (masked cell); soil class defaults to 2."
            )
        if municipality.power_cell.elevation_m is None:
            missing.append("Grid elevation not stored.")
        return EnvironmentProfile(
            municipality_code=municipality.code,
            municipality_name=municipality.name,
            municipality_centroid=Coordinates(lat=municipality.centroid_lat, lon=municipality.centroid_lon),
            power_cell=municipality_cell(municipality),
            elevation_m=municipality.power_cell.elevation_m,
            climate=ClimateSummary(
                first_day=coverage["first_day"].isoformat(),
                last_day=coverage["last_day"].isoformat(),
                days=coverage["days"],
                days_with_gaps=coverage["days_with_gaps"],
                mean_annual_rain_mm=None if mean_rain is None else round(float(mean_rain), 1),
                mean_tmax_c=None if tmax is None else round(float(tmax), 2),
                mean_tmin_c=None if tmin is None else round(float(tmin), 2),
            ),
            soil=[
                SoilLayer(
                    depth=layer.depth,
                    clay_g_kg=layer.clay_g_kg,
                    sand_g_kg=layer.sand_g_kg,
                    silt_g_kg=layer.silt_g_kg,
                    ph=layer.ph,
                    soc_g_kg=layer.soc_g_kg,
                    bulk_density_g_cm3=layer.bulk_density_g_cm3,
                )
                for layer in layers
            ],
            default_soil_class=municipality.default_soil_class,  # type: ignore[arg-type]
            missing_data=missing,
            sources=[POWER_SOURCE, SOILGRIDS_SOURCE],
        )
