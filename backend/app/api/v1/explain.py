from fastapi import APIRouter, Depends

from app.api.deps import ExplainServiceDep, LocaleDep
from app.core.rate_limit import enforce_rate_limit
from app.schemas.explanation import Explanation

router = APIRouter(prefix="/recommendations", tags=["Explanation"])


@router.post("/{analysis_id}/explain", response_model=Explanation, dependencies=[Depends(enforce_rate_limit)])
def explain_recommendation(analysis_id: str, service: ExplainServiceDep, locale: LocaleDep) -> Explanation:
    """Plain-language explanation of an analysis: AI-written when Gemini is configured, else a template."""
    return service.explain(analysis_id, locale)
