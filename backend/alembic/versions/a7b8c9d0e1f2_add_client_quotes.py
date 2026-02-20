"""Agregar tabla client_quotes para cotizaciones de cliente multi-producto

Revision ID: a7b8c9d0e1f2
Revises: f4a1b9c2d8e7
Create Date: 2026-02-20 12:00:00.000000

Crea la tabla client_quotes que almacena cotizaciones generadas manualmente
para clientes, con múltiples líneas de producto en formato JSON.

A diferencia de quotes (historial de costos de impresión), client_quotes
no almacena el desglose técnico sino ítems con precio definido por el usuario.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f4a1b9c2d8e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_quotes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("client_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quote_date", sa.Date(), nullable=False),
        sa.Column("expiry_days", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("items", sa.Text(), nullable=False, server_default="'[]'"),
        sa.Column("subtotal", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name="fk_client_quotes_company_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_client_quotes_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_quotes_company_id", "client_quotes", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_client_quotes_company_id", table_name="client_quotes")
    op.drop_table("client_quotes")
