from fastapi import APIRouter

from app.api.deps import CatalogServiceDep, LocaleDep
from app.schemas.catalog import Crop, CropsResponse

router = APIRouter(prefix="/crops", tags=["Crops"])


@router.get("", response_model=CropsResponse)
def list_crops(service: CatalogServiceDep, locale: LocaleDep) -> CropsResponse:
    """Crop catalog with the raw FAO-56 / EcoCrop requirements and each crop's quality gate."""
    return service.list_crops(locale)


@router.get("/{crop_id}", response_model=Crop)
def get_crop(crop_id: str, service: CatalogServiceDep, locale: LocaleDep) -> Crop:
    return service.get_crop(crop_id, locale)
