from dataclasses import asdict

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.engines.simulation import DekadResult
from app.models.results import PlantingWindowResult


class WindowRepository:
    """Precomputed planting-window results (rainfed) per climate cell, crop and soil class."""

    def __init__(self, db: Session):
        self.db = db

    def replace(
        self,
        cell_id: str,
        crop_id: str,
        soil_class: int,
        method_version: str,
        seasons: tuple[int, int],
        results: list[DekadResult],
    ) -> None:
        self.db.execute(
            delete(PlantingWindowResult).where(
                PlantingWindowResult.cell_id == cell_id,
                PlantingWindowResult.crop_id == crop_id,
                PlantingWindowResult.soil_class == soil_class,
                PlantingWindowResult.method_version == method_version,
            )
        )
        self.db.execute(
            PlantingWindowResult.__table__.insert(),
            [
                {
                    "cell_id": cell_id,
                    "crop_id": crop_id,
                    "soil_class": soil_class,
                    "method_version": method_version,
                    "first_season": seasons[0],
                    "last_season": seasons[1],
                    **asdict(r),
                }
                for r in results
            ],
        )

    def curve(self, cell_id: str, crop_id: str, soil_class: int, method_version: str) -> list[PlantingWindowResult]:
        """The 36 dekads of one cell/crop/soil, ordered; empty when nothing was precomputed."""
        stmt = (
            select(PlantingWindowResult)
            .where(
                PlantingWindowResult.cell_id == cell_id,
                PlantingWindowResult.crop_id == crop_id,
                PlantingWindowResult.soil_class == soil_class,
                PlantingWindowResult.method_version == method_version,
            )
            .order_by(PlantingWindowResult.dekad)
        )
        return list(self.db.scalars(stmt))
