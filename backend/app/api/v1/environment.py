from fastapi import APIRouter, Depends

from app.api.deps import EnvironmentServiceDep, LocaleDep
from app.core.rate_limit import enforce_rate_limit
from app.schemas.environment import EnvironmentProfile, EnvironmentRequest

router = APIRouter(prefix="/environment", tags=["Environment"])


@router.post("", response_model=EnvironmentProfile, dependencies=[Depends(enforce_rate_limit)])
def environment_profile(
    body: EnvironmentRequest, service: EnvironmentServiceDep, locale: LocaleDep
) -> EnvironmentProfile:
    """Stored climate summary, soil layers and elevation behind an analysis (backend-only; body, not query string)."""
    return service.profile(body)
