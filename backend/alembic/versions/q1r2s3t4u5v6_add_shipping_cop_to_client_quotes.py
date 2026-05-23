"""Agregar `shipping_cop` a client_quotes.

Costo de envío de la cotización al cliente. Siempre en COP (moneda
canónica de la cotización). Se suma al subtotal antes de IVA. Default 0
para retrocompatibilidad: cotizaciones existentes asumen sin envío.

Ver design `HANDOFF-manual-quote.md` y fixture `MANUAL_QUOTE_DRAFT.shippingCOP`.

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2026-05-22
"""

from typing import Sequence, Union

from alembic import op


revision: str = "q1r2s3t4u5v6"
down_revision: Union[str, None] = "p0q1r2s3t4u5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE client_quotes "
        "ADD COLUMN IF NOT EXISTS shipping_cop NUMERIC(12, 2) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE client_quotes DROP COLUMN IF EXISTS shipping_cop")
