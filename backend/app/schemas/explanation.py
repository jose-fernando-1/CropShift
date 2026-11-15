"""Contract model for the explanation (contract/explanation.schema.json)."""

from typing import Literal

from app.schemas.common import ContractModel
from app.schemas.recommendations import AnalysisId


class ExplanationSection(ContractModel):
    id: str
    title: str
    paragraphs: list[str]


class Explanation(ContractModel):
    analysis_id: AnalysisId
    source: Literal["template", "ai"]
    mock: bool
    generated_at: str
    sections: list[ExplanationSection]
    field_checks: list[str]
