from fastapi import APIRouter, Depends

from app.api.deps import LocaleDep, RecommendationServiceDep
from app.core.rate_limit import enforce_rate_limit
from app.schemas.recommendations import Recommendation, RecommendationRequest

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.post("", response_model=Recommendation, dependencies=[Depends(enforce_rate_limit)])
def create_recommendation(
    body: RecommendationRequest, service: RecommendationServiceDep, locale: LocaleDep
) -> Recommendation:
    """Ranked crops and planting windows for a point or municipality in Pernambuco (rainfed by default)."""
    return service.recommend(body, locale)


@router.get("/{analysis_id}", response_model=Recommendation, dependencies=[Depends(enforce_rate_limit)])
def get_recommendation(analysis_id: str, service: RecommendationServiceDep, locale: LocaleDep) -> Recommendation:
    """Re-derives an earlier analysis from its (decodable, coordinate-free) id."""
    return service.recommend_for_id(analysis_id, locale)
