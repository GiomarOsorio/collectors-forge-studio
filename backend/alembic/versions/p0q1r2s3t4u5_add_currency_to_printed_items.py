"""Agregar `currency` a printed_items.

Permite definir el `unit_price` en USD o COP por ítem (ver issue #78).
Default 'USD' para retrocompatibilidad: items existentes se asumen en
USD porque la UI V1 etiquetaba el campo como "Precio de venta (USD)".

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-05-22
"""

from typing import Sequence, Union

from alembic import op


revision: str = "p0q1r2s3t4u5"
down_revision: Union[str, None] = "o9p0q1r2s3t4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE printed_items "
        "ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE printed_items DROP COLUMN IF EXISTS currency")
