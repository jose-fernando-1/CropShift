from pydantic import BaseModel, Field


class LocationInput(BaseModel):
    latitude: float = Field(
        ge=-90,
        le=90,
        description="Latitude in decimal degrees",
        examples=[-8.60],
    )

    longitude: float = Field(
        ge=-180,
        le=180,
        description="Longitude in decimal degrees",
        examples=[-36.40],
    )
