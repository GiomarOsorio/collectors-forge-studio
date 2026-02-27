"""Agrega columnas include_iva e iva_percent a client_quotes.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_quotes",
        sa.Column(
            "include_iva",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "client_quotes",
        sa.Column(
            "iva_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("19.00"),
        ),
    )


def downgrade() -> None:
    op.drop_column("client_quotes", "iva_percent")
    op.drop_column("client_quotes", "include_iva")
