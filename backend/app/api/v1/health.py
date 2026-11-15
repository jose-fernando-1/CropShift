import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/health/db")
def database_health(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")

        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from None

    return {
        "status": "ok",
        "database": "connected",
    }
