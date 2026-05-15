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
import sqlalchemy as sa


revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, None] = "i3j4k5l6m7n8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("batch", sa.String(50), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("location", sa.String(100), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("color_hex", sa.String(7), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("color_name", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inventory_items", "color_name")
    op.drop_column("inventory_items", "color_hex")
    op.drop_column("inventory_items", "location")
    op.drop_column("inventory_items", "batch")
