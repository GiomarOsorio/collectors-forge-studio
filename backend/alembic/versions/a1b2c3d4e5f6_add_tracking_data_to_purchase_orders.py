"""Agrega tracking_data y tracking_checked_at a purchase_orders.

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("tracking_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "purchase_orders",
        sa.Column("tracking_checked_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_orders", "tracking_checked_at")
    op.drop_column("purchase_orders", "tracking_data")
