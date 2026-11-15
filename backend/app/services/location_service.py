"""Location use cases: which municipality (and POWER cell) a point belongs to."""

from app.core.exceptions import AppError
from app.core.geo import power_cell
from app.models.geo import Municipality
from app.repositories.geo import MunicipalityRepository
from app.schemas.locations import (
    Coordinates,
    PowerCell,
    ResolveCovered,
    ResolvedMunicipality,
    ResolveOutOfState,
    ResolveResponse,
)


def municipality_cell(municipality: Municipality) -> PowerCell:
    """The POWER cell of the municipality's centroid: the climate series every analysis there uses."""
    cell = municipality.power_cell
    return PowerCell(id=cell.id, lat=cell.lat, lon=cell.lon)


def is_near_centroid(municipality: Municipality, lat: float, lon: float) -> bool:
    """True when the point falls in the same POWER cell as the municipality centroid."""
    return power_cell(lat, lon)["id"] == municipality.power_cell_id


class LocationService:
    def __init__(self, municipalities: MunicipalityRepository):
        self.municipalities = municipalities

    def locate(self, point: Coordinates) -> tuple[Municipality, bool]:
        """Municipality and `near_centroid` for a point; raises out_of_coverage outside Pernambuco."""
        municipality = self.municipalities.find_containing(point.lat, point.lon)
        if municipality is None:
            raise AppError("out_of_coverage", "point_not_covered", 422)
        return municipality, is_near_centroid(municipality, point.lat, point.lon)

    def resolve(self, point: Coordinates) -> ResolveResponse:
        municipality = self.municipalities.find_containing(point.lat, point.lon)
        if municipality is None:
            return ResolveOutOfState(coverage="out_of_state", mock=False, municipality=None)
        return ResolveCovered(
            coverage="covered",
            mock=False,
            municipality=ResolvedMunicipality(
                municipality_code=municipality.code,
                municipality_name=municipality.name,
                state="PE",
                power_cell=municipality_cell(municipality),
                near_centroid=is_near_centroid(municipality, point.lat, point.lon),
            ),
        )
