"""Recordatorios de mantenimiento por intervalo (schedules).

Revision ID: 9533b1d4f6a2
Revises: 8422a0c213e9
Create Date: 2026-07-14

Issue #138 — tabla `maintenance_schedules` (recordatorio recurrente de
mantenimiento por impresora, por horas de impresión o por días).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "9533b1d4f6a2"
down_revision: Union[str, None] = "8422a0c213e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "maintenance_schedules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("printer_id", sa.Integer(), nullable=False),
        sa.Column("task_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("interval_type", sa.String(length=12), nullable=False),
        sa.Column("interval_value", sa.Numeric(8, 1), nullable=False),
        sa.Column("last_done_at", sa.DateTime(), nullable=False),
        sa.Column("last_done_hours", sa.Numeric(10, 2), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_notified_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False,
            server_default=sa.text("(now() at time zone 'utc')"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False,
            server_default=sa.text("(now() at time zone 'utc')"),
        ),
        sa.ForeignKeyConstraint(["printer_id"], ["printers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "interval_type IN ('print_hours', 'days')",
            name="ck_maintenance_schedules_interval_type",
        ),
        sa.CheckConstraint(
            "interval_value > 0",
            name="ck_maintenance_schedules_interval_value_pos",
        ),
    )
    op.create_index(
        "ix_maintenance_schedules_printer_id",
        "maintenance_schedules",
        ["printer_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_maintenance_schedules_printer_id", table_name="maintenance_schedules")
    op.drop_table("maintenance_schedules")
