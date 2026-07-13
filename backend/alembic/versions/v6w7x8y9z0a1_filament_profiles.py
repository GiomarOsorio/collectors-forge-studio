"""Agregar perfiles de impresión (slicer) de filamento.

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-07-09

Crea `filament_profiles`, 1:1 con `inventory_items` (categoría Filamento).
Guarda parámetros de slicer (temperaturas, velocidad, retracción, flow,
fan) como referencia — no participa en cálculos de costo.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "v6w7x8y9z0a1"
down_revision: Union[str, None] = "u5v6w7x8y9z0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "filament_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("nozzle_temp_min", sa.Integer(), nullable=True),
        sa.Column("nozzle_temp_max", sa.Integer(), nullable=True),
        sa.Column("bed_temp", sa.Integer(), nullable=True),
        sa.Column("bed_temp_first_layer", sa.Integer(), nullable=True),
        sa.Column("print_speed_mms", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("retraction_distance_mm", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("retraction_speed_mms", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("flow_ratio", sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column("fan_speed_percent", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("inventory_item_id", name="uq_filament_profiles_inventory_item_id"),
    )
    op.create_index(
        "ix_filament_profiles_inventory_item_id", "filament_profiles", ["inventory_item_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_filament_profiles_inventory_item_id", table_name="filament_profiles")
    op.drop_table("filament_profiles")
