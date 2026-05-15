"""Agregar campos visuales de inventario inspirados en Claude Design.

Suma `batch`, `location`, `color_hex` y `color_name` a `inventory_items` para
que los swatches y filas de la nueva UI tengan datos reales (no derivados
del string genérico `filament_color`). Todos son nullable: ítems no-filamento
los dejan vacíos, filamentos existentes se completan a medida que se editen.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op


revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, None] = "i3j4k5l6m7n8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: IF NOT EXISTS evita romper el deploy si las columnas ya
    # existen (p.ej. agregadas por SQL manual o migración previa parcial).
    op.execute("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS batch VARCHAR(50)")
    op.execute("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location VARCHAR(100)")
    op.execute("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7)")
    op.execute("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS color_name VARCHAR(100)")


def downgrade() -> None:
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS color_name")
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS color_hex")
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS location")
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS batch")
