"""Agregar `filament_subtype` a inventory_items.

Subtipo dentro de un material (PLA Silk, PLA Matte, PETG CF, TPU 95A,
etc.). Aplica solo cuando `category = 'Filamento'` y `filament_type`
está definido. Nullable para retrocompatibilidad.

Issue #59.

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "r2s3t4u5v6w7"
down_revision: Union[str, None] = "q1r2s3t4u5v6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE inventory_items "
        "ADD COLUMN IF NOT EXISTS filament_subtype VARCHAR(50)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE inventory_items DROP COLUMN IF EXISTS filament_subtype")
