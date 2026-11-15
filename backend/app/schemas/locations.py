"""Contract models for location resolution (contract/resolve-*.schema.json)."""

from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import ContractModel

MunicipalityCode = Annotated[str, Field(pattern=r"^\d{7}$", description="7-digit IBGE municipality code")]


class Coordinates(ContractModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class PowerCell(ContractModel):
    id: str = Field(description="POWER grid cell id, e.g. 'r163c230'")
    lat: float = Field(description="cell centre latitude")
    lon: float = Field(description="cell centre longitude")


class ResolvedMunicipality(ContractModel):
    municipality_code: MunicipalityCode
    municipality_name: str
    state: Literal["PE"]
    power_cell: PowerCell
    near_centroid: bool = Field(description="point falls in the same POWER cell as the municipality centroid")


class ResolveCovered(ContractModel):
    coverage: Literal["covered"]
    mock: bool
    municipality: ResolvedMunicipality


class ResolveOutOfState(ContractModel):
    coverage: Literal["out_of_state"]
    mock: bool
    municipality: None


ResolveResponse = ResolveCovered | ResolveOutOfState
