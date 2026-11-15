import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.router import router as api_router
from app.core.config import settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
)
from app.core.logging import configure_logging


configure_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    description=(
        "Agricultural environmental suitability and planting window recommendation API"
    ),
    version="0.1.0",
    debug=settings.debug,
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


# Request logging
@app.middleware("http")
async def log_requests(
    request: Request,
    call_next,
):
    start_time = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "%s %s | %s | %.2f ms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    return response


# Error handling
app.add_exception_handler(
    AppError,
    app_error_handler,
)


# Operational endpoints
app.include_router(health_router)


# Versioned API
app.include_router(
    api_router,
    prefix=settings.api_v1_prefix,
)
