"""Shared contract models (contract/api-error.schema.json, contract/health.schema.json)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.exceptions import ErrorCode


class ContractModel(BaseModel):
    """Base for response models: mirrors the schemas' `additionalProperties: false`."""

    model_config = ConfigDict(extra="forbid")


class ErrorBody(ContractModel):
    code: ErrorCode
    message: str


class ApiError(ContractModel):
    error: ErrorBody


class Health(ContractModel):
    status: Literal["ok", "degraded"]
    contract_version: str
    method_version: str
    data_version: str
    mock: bool
