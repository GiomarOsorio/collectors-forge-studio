"""Agrega usd_to_cop_rate a client_quotes

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-02-21

"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_quotes",
        sa.Column("usd_to_cop_rate", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("client_quotes", "usd_to_cop_rate")
