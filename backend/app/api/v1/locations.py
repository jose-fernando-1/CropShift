from fastapi import APIRouter, Depends

from app.api.deps import LocaleDep, LocationServiceDep
from app.core.rate_limit import enforce_rate_limit
from app.schemas.locations import Coordinates, ResolveResponse

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("/resolve", response_model=ResolveResponse, dependencies=[Depends(enforce_rate_limit)])
def resolve_location(body: Coordinates, service: LocationServiceDep, locale: LocaleDep) -> ResolveResponse:
    """Which Pernambuco municipality and POWER cell a point belongs to (`out_of_state` elsewhere)."""
    return service.resolve(body)
