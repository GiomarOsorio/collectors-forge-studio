"""Agrega tablas de mantenimiento de impresoras.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabla de impresoras de mantenimiento
    op.create_table(
        "maintenance_printers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("current_hours", sa.Numeric(8, 1), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_maintenance_printers_company_id", "maintenance_printers", ["company_id"])

    # Tabla de registros de mantenimiento
    op.create_table(
        "maintenance_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("printer_id", sa.Integer(), nullable=False),
        sa.Column("hours_at_maintenance", sa.Numeric(8, 1), nullable=False),
        sa.Column("maintenance_type", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("performed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(
            ["printer_id"], ["maintenance_printers.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_maintenance_logs_company_id", "maintenance_logs", ["company_id"])

    # Tabla de ítems usados en un registro de mantenimiento
    op.create_table(
        "maintenance_log_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("log_id", sa.Integer(), nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(
            ["log_id"], ["maintenance_logs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["inventory_item_id"], ["inventory_items.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("maintenance_log_items")
    op.drop_index("ix_maintenance_logs_company_id", table_name="maintenance_logs")
    op.drop_table("maintenance_logs")
    op.drop_index("ix_maintenance_printers_company_id", table_name="maintenance_printers")
    op.drop_table("maintenance_printers")
