"""Import every model module so `Base.metadata` (Alembic autogenerate) sees all tables."""

from app.models import catalog, climate, geo, reference, results  # noqa: F401
