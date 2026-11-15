import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.health import router as health_router
from app.api.v1.router import router as api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, request_id_var

configure_logging()

logger = logging.getLogger(__name__)

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")

app = FastAPI(
    title=settings.app_name,
    description="Crop suitability and planting-window recommendations for Pernambuco (Cropshift).",
    version=__version__,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Accept-Language", "X-Request-ID"],
)

register_exception_handlers(app)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Tag each request with an id and log method, path, status and duration.

    Only the path is logged: never the query string or the body, because
    coordinates must not reach the logs.
    """
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex[:16]
    token = request_id_var.set(request_id)
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info("%s %s | %s | %.2f ms", request.method, request.url.path, status, duration_ms)
        request_id_var.reset(token)
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(health_router)
app.include_router(api_router, prefix=settings.api_v1_prefix)
