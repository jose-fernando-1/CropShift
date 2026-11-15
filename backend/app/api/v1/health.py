import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppError
from app.schemas.common import Health

logger = logging.getLogger(__name__)

# Served outside the versioned prefix, as in the contract (`GET /health`).
router = APIRouter(tags=["Health"])


@router.get("/health", response_model=Health)
def health_check() -> Health:
    """Liveness and version report. Never touches the database."""
    return Health(
        status="ok",
        contract_version=settings.contract_version,
        method_version=settings.method_version,
        data_version=settings.data_version,
        mock=False,
    )


@router.get("/health/db")
def database_health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness: 200 only when the database answers."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise AppError("upstream_unavailable", "database_unavailable", 503) from None
    return {"status": "ok", "database": "connected"}
