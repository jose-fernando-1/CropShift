from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.models.catalog import Crop
from app.models.reference import PamYield, ZarcWindow


class ReferenceRepository:
    """ZARC windows and PAM yields (official reference data shown next to the simulation)."""

    def __init__(self, db: Session):
        self.db = db

    def replace_zarc(self, windows: list[dict]) -> None:
        self.db.execute(delete(ZarcWindow))
        self.db.execute(ZarcWindow.__table__.insert(), windows)
        with_zarc = {w["crop_id"] for w in windows}
        self.db.execute(update(Crop).values(has_zarc=Crop.id.in_(with_zarc)))

    def replace_pam(self, rows: list[dict]) -> None:
        self.db.execute(delete(PamYield))
        self.db.execute(PamYield.__table__.insert(), rows)

    def zarc_for(self, municipality_code: str, crop_id: str, soil_code: int) -> ZarcWindow | None:
        return self.db.scalars(
            select(ZarcWindow).where(
                ZarcWindow.municipality_code == municipality_code,
                ZarcWindow.crop_id == crop_id,
                ZarcWindow.soil_code == soil_code,
            )
        ).first()

    def pam_series(self, municipality_code: str, pam_crop: str) -> list[tuple[int, float]]:
        stmt = (
            select(PamYield.year, PamYield.yield_kg_ha)
            .where(PamYield.municipality_code == municipality_code, PamYield.pam_crop == pam_crop)
            .order_by(PamYield.year)
        )
        return [(year, value) for year, value in self.db.execute(stmt)]

    def pam_state_median(self, pam_crop: str) -> float | None:
        stmt = select(func.percentile_cont(0.5).within_group(PamYield.yield_kg_ha)).where(PamYield.pam_crop == pam_crop)
        value = self.db.execute(stmt).scalar()
        return None if value is None else float(value)
