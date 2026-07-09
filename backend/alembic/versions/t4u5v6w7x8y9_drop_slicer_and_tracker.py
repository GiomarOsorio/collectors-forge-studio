"""Eliminar slicing_jobs y columnas de tracking del microservicio tracker.

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-07-09

Los microservicios `slicer` (OrcaSlicer) y `tracker` (scraper de
parcelsapp.com) se eliminaron del proyecto. Nada vuelve a poblar la tabla
slicing_jobs ni las columnas tracking_data/tracking_checked_at de
purchase_orders, así que se eliminan. tracking_number y carrier se
mantienen — son texto libre que el usuario tipea a mano, no dependen del
microservicio tracker.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "t4u5v6w7x8y9"
down_revision: Union[str, None] = "s3t4u5v6w7x8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("purchase_orders", "tracking_checked_at")
    op.drop_column("purchase_orders", "tracking_data")

    op.drop_table("slicing_jobs")


def downgrade() -> None:
    op.create_table(
        "slicing_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("makerworld_url", sa.String(length=500), nullable=True),
        sa.Column("makerworld_model_id", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("print_time_seconds", sa.Integer(), nullable=True),
        sa.Column("filament_weight_g", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("filament_type", sa.String(length=50), nullable=True),
        sa.Column("layer_height_mm", sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column("nozzle_temp", sa.Integer(), nullable=True),
        sa.Column("bed_temp", sa.Integer(), nullable=True),
        sa.Column("model_x_mm", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("model_y_mm", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("model_z_mm", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("printer_preset", sa.String(length=100), nullable=True),
        sa.Column("filament_preset", sa.String(length=100), nullable=True),
        sa.Column("config_preset", sa.String(length=100), nullable=True),
        sa.Column("plates_data", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column(
        "purchase_orders",
        sa.Column("tracking_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "purchase_orders",
        sa.Column("tracking_checked_at", sa.DateTime(), nullable=True),
    )
