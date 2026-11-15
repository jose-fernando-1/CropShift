from dataclasses import asdict

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.integrations.soilgrids import SoilProfileValues, default_soil_class
from app.models.climate import SoilProfile
from app.models.geo import Municipality


class SoilRepository:
    def __init__(self, db: Session):
        self.db = db

    def replace_profiles(self, code: str, profiles: list[SoilProfileValues], retrieved_at) -> int | None:
        """Replace a municipality's profiles and store its default ZARC soil class (None when masked)."""
        self.db.execute(delete(SoilProfile).where(SoilProfile.municipality_code == code))
        self.db.add_all(SoilProfile(municipality_code=code, retrieved_at=retrieved_at, **asdict(p)) for p in profiles)
        soil_class = default_soil_class(profiles)
        municipality = self.db.get(Municipality, code)
        if municipality is not None:
            municipality.default_soil_class = soil_class
        return soil_class

    def topsoil_ph(self, municipality_code: str) -> float | None:
        """SoilGrids pH (water) of the 0-5 cm layer at the municipality centroid; None when masked."""
        from sqlalchemy import select

        return self.db.scalars(
            select(SoilProfile.ph).where(
                SoilProfile.municipality_code == municipality_code, SoilProfile.depth == "0-5cm"
            )
        ).first()
