"""FastAPI dependencies shared by the route modules."""

from typing import Annotated

from fastapi import Depends, Header, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.i18n import Locale, resolve_locale
from app.integrations.gemini import GeminiExplainer
from app.repositories.climate import ClimateRepository
from app.repositories.crops import CropRepository
from app.repositories.geo import MunicipalityRepository
from app.repositories.reference import ReferenceRepository
from app.repositories.windows import WindowRepository
from app.services.catalog_service import CatalogService
from app.services.environment_service import EnvironmentService
from app.services.explain_service import ExplainService
from app.services.location_service import LocationService
from app.services.recommendation_service import RecommendationService

DbSession = Annotated[Session, Depends(get_db)]


def get_locale(response: Response, accept_language: Annotated[str | None, Header()] = None) -> Locale:
    """Resolve the response language and announce it (`Content-Language`, `Vary`)."""
    locale = resolve_locale(accept_language)
    response.headers["Content-Language"] = locale
    response.headers["Vary"] = "Accept-Language"
    return locale


LocaleDep = Annotated[Locale, Depends(get_locale)]


def get_catalog_service(db: DbSession) -> CatalogService:
    return CatalogService(CropRepository(db))


CatalogServiceDep = Annotated[CatalogService, Depends(get_catalog_service)]


def get_location_service(db: DbSession) -> LocationService:
    return LocationService(MunicipalityRepository(db))


LocationServiceDep = Annotated[LocationService, Depends(get_location_service)]


def get_recommendation_service(db: DbSession) -> RecommendationService:
    return RecommendationService(
        CropRepository(db),
        MunicipalityRepository(db),
        WindowRepository(db),
        ReferenceRepository(db),
        ClimateRepository(db),
    )


RecommendationServiceDep = Annotated[RecommendationService, Depends(get_recommendation_service)]


def get_explain_service(recommendations: RecommendationServiceDep) -> ExplainService:
    return ExplainService(recommendations, _gemini())


_gemini_instance: GeminiExplainer | None = None


def _gemini() -> GeminiExplainer | None:
    """One Gemini client config per process; None (template only) without a key and a model."""
    global _gemini_instance
    if _gemini_instance is None and settings.gemini_api_key and settings.gemini_model:
        _gemini_instance = GeminiExplainer(settings.gemini_api_key, settings.gemini_model, settings.gemini_timeout_s)
    return _gemini_instance


ExplainServiceDep = Annotated[ExplainService, Depends(get_explain_service)]


def get_environment_service(db: DbSession) -> EnvironmentService:
    return EnvironmentService(MunicipalityRepository(db), ClimateRepository(db))


EnvironmentServiceDep = Annotated[EnvironmentService, Depends(get_environment_service)]
