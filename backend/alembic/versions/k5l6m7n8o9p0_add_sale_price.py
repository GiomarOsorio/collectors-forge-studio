"""Agregar `sale_price` a inventory_items.

Precio de venta sugerido al cliente. Distinto del `unit_cost` (costo
real de adquisición). Aplica a todas las categorías:
- Filamento: sale_price COP/kg sugerido para cotizaciones
- Insumo / Herramienta / Consumible: sale_price COP/unidad cobrable

Nullable: items existentes quedan con NULL hasta que se editen. UI
muestra "—" cuando es null.

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op


revision: str = "k5l6m7n8o9p0"
down_revision: Union[str, None] = "j4k5l6m7n8o9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE inventory_items "
        "ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS sale_price")
