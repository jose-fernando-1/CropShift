"""enable postgis

Revision ID: 0002_enable_postgis
Revises: 6a848fcf993f
Create Date: 2026-11-15 18:30:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_enable_postgis"
down_revision: str | Sequence[str] | None = "6a848fcf993f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # Deliberately keeps the extension: the postgis image creates it before any migration runs.
    pass
