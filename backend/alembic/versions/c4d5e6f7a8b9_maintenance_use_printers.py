"""Mantenimiento: referenciar printers en lugar de maintenance_printers.

Elimina la tabla maintenance_printers y cambia la FK de
maintenance_logs.printer_id para que apunte a printers.id.

Revision ID: c4d5e6f7a8b9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Vaciar logs existentes para poder cambiar la FK sin conflictos de datos
    #    (no hay datos reales en producción aún — feature recién creada)
    op.execute("DELETE FROM maintenance_log_items")
    op.execute("DELETE FROM maintenance_logs")

    # 2. Eliminar la FK antigua que apunta a maintenance_printers
    op.drop_constraint(
        "maintenance_logs_printer_id_fkey",
        "maintenance_logs",
        type_="foreignkey",
    )

    # 3. Crear nueva FK que apunta a printers
    op.create_foreign_key(
        "maintenance_logs_printer_id_fkey",
        "maintenance_logs",
        "printers",
        ["printer_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 4. Eliminar tabla maintenance_printers (ya sin referencias)
    op.drop_index("ix_maintenance_printers_company_id", table_name="maintenance_printers")
    op.drop_table("maintenance_printers")


def downgrade() -> None:
    # Recrear maintenance_printers
    op.create_table(
        "maintenance_printers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("current_hours", sa.Numeric(8, 1), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_maintenance_printers_company_id",
        "maintenance_printers",
        ["company_id"],
    )

    # Revertir FK de maintenance_logs a maintenance_printers
    op.execute("DELETE FROM maintenance_log_items")
    op.execute("DELETE FROM maintenance_logs")

    op.drop_constraint(
        "maintenance_logs_printer_id_fkey",
        "maintenance_logs",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "maintenance_logs_printer_id_fkey",
        "maintenance_logs",
        "maintenance_printers",
        ["printer_id"],
        ["id"],
        ondelete="CASCADE",
    )
