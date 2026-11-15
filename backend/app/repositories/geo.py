import json

from geoalchemy2 import functions as gf
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.geo import ClimateCell, Municipality


class MunicipalityRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, code: str) -> Municipality | None:
        stmt = select(Municipality).options(joinedload(Municipality.power_cell)).where(Municipality.code == code)
        return self.db.scalars(stmt).first()

    def find_containing(self, lat: float, lon: float) -> Municipality | None:
        """The municipality whose polygon contains the point (borders count), or None outside Pernambuco."""
        point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        stmt = (
            select(Municipality)
            .options(joinedload(Municipality.power_cell))
            .where(gf.ST_Intersects(Municipality.geom, point))
            .order_by(Municipality.code)
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def list_cells(self) -> list[ClimateCell]:
        return list(self.db.scalars(select(ClimateCell).order_by(ClimateCell.id)))

    def upsert_cell(self, cell_id: str, lat: float, lon: float) -> None:
        cell = self.db.get(ClimateCell, cell_id)
        if cell is None:
            self.db.add(ClimateCell(id=cell_id, lat=lat, lon=lon))
        else:
            cell.lat, cell.lon = lat, lon

    def upsert_municipality(self, record: dict) -> None:
        """Insert or update one municipality from `data/processed/geo/municipalities.json` (idempotent)."""
        geom = func.ST_Multi(func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(record["geometry"])), 4326))
        municipality = self.db.get(Municipality, record["code"])
        if municipality is None:
            municipality = Municipality(code=record["code"])
            self.db.add(municipality)
        municipality.name = record["name"]
        municipality.search = record["search"]
        municipality.centroid_lat = record["centroid"]["lat"]
        municipality.centroid_lon = record["centroid"]["lon"]
        municipality.power_cell_id = record["power_cell"]["id"]
        municipality.geom = geom
