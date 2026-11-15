"""Error envelope of the API contract: `{"error": {"code", "message"}}`.

Every failure path (domain errors, request validation, framework HTTP errors,
unhandled exceptions) goes through here, so clients never see FastAPI's default
`{"detail": ...}` body. Messages never repeat request values: coordinates travel
only in request bodies and must not end up in responses or logs.
"""

import logging
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.i18n import Locale, resolve_locale
from app.core.messages import message

logger = logging.getLogger(__name__)

ErrorCode = Literal[
    "invalid_request",
    "invalid_coordinates",
    "out_of_coverage",
    "not_found",
    "no_data",
    "upstream_unavailable",
    "rate_limited",
    "internal",
]

_HTTP_STATUS_CODES: dict[int, ErrorCode] = {
    400: "invalid_request",
    404: "not_found",
    405: "invalid_request",
    422: "invalid_request",
    429: "rate_limited",
}

_RANGE_ERROR_TYPES = {"greater_than_equal", "less_than_equal", "greater_than", "less_than"}
_COORDINATE_FIELDS = {"lat", "lon"}


class AppError(Exception):
    """A domain failure. `message_key` selects a localized text in app.core.messages."""

    def __init__(self, code: ErrorCode, message_key: str, status_code: int = 400):
        super().__init__(message_key)
        self.code = code
        self.message_key = message_key
        self.status_code = status_code


def request_locale(request: Request) -> Locale:
    return resolve_locale(request.headers.get("accept-language"))


def error_response(code: ErrorCode, message_key: str, status_code: int, request: Request) -> JSONResponse:
    locale = request_locale(request)
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message(message_key, locale)}},
        headers={"Content-Language": locale},
    )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.code, exc.message_key, exc.status_code, request)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Static localized message: never echo the offending values (coordinates must not leak)."""
    out_of_range = any(
        error["type"] in _RANGE_ERROR_TYPES and error["loc"] and error["loc"][-1] in _COORDINATE_FIELDS
        for error in exc.errors()
    )
    if out_of_range:
        return error_response("invalid_coordinates", "invalid_coordinates", 422, request)
    return error_response("invalid_request", "invalid_request", 422, request)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_STATUS_CODES.get(exc.status_code, "internal")
    key = {"not_found": "not_found", "rate_limited": "rate_limited", "internal": "internal"}.get(code, "bad_request")
    return error_response(code, key, exc.status_code, request)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response("internal", "internal", 500, request)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
