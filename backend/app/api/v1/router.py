from fastapi import APIRouter

from app import __version__
from app.api.v1.crops import router as crops_router
from app.api.v1.explain import router as explain_router
from app.api.v1.locations import router as locations_router
from app.api.v1.recommendations import router as recommendations_router
from app.core.config import settings

# Business routes only; health lives outside the prefix (see health.py).
router = APIRouter()
router.include_router(crops_router)
router.include_router(locations_router)
router.include_router(recommendations_router)
router.include_router(explain_router)


@router.get("/", tags=["General"])
def api_info() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": "v1",
        "app_version": __version__,
        "contract_version": settings.contract_version,
        "status": "active",
    }
