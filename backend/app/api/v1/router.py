from fastapi import APIRouter

from app.schemas.location import LocationInput


router = APIRouter()


@router.get("/", tags=["General"])
def api_info():
    return {
        "name": "Rurotation API",
        "version": "v1",
        "status": "active",
    }


@router.post("/validate-location", tags=["Development"])
def validate_location(
    location: LocationInput,
):
    return {
        "valid": True,
        "location": location.model_dump(),
    }
