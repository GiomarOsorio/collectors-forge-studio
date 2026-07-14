"""Bobinas individuales (spools) con tracking de consumo.

Revision ID: 8422a0c213e9
Revises: 82717e0701b3
Create Date: 2026-07-14

Issue #134 — tabla `spools` (bobina física individual, hija de un
`InventoryItem` de categoría Filamento), `print_queue.spool_id` (FK
opcional al item de cola que la consumió) y
`app_settings.spool_low_stock_threshold_g` (umbral de alerta).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "8422a0c213e9"
down_revision: Union[str, None] = "82717e0701b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "spools",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("label_code", sa.String(length=12), nullable=False),
        sa.Column("initial_weight_g", sa.Numeric(8, 1), nullable=False),
        sa.Column("remaining_weight_g", sa.Numeric(8, 1), nullable=False),
        sa.Column("cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("extra_colors", JSONB(), nullable=True),
        sa.Column("visual_effect", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False, server_default=sa.text("'active'")),
        sa.Column("opened_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["inventory_item_id"], ["inventory_items.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("label_code", name="uq_spools_label_code"),
        sa.CheckConstraint(
            "status IN ('active', 'finished', 'archived')", name="ck_spools_status"
        ),
    )
    op.create_index("ix_spools_inventory_item_id", "spools", ["inventory_item_id"])

    op.add_column("print_queue", sa.Column("spool_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_print_queue_spool_id", "print_queue", "spools", ["spool_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_print_queue_spool_id", "print_queue", ["spool_id"])

    op.add_column(
        "app_settings",
        sa.Column(
            "spool_low_stock_threshold_g", sa.Numeric(8, 1),
            nullable=False, server_default=sa.text("200"),
        ),
    )
    op.create_check_constraint(
        "ck_settings_spool_threshold_ge0",
        "app_settings",
        "spool_low_stock_threshold_g >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_settings_spool_threshold_ge0", "app_settings", type_="check")
    op.drop_column("app_settings", "spool_low_stock_threshold_g")
    op.drop_index("ix_print_queue_spool_id", table_name="print_queue")
    op.drop_constraint("fk_print_queue_spool_id", "print_queue", type_="foreignkey")
    op.drop_column("print_queue", "spool_id")
    op.drop_index("ix_spools_inventory_item_id", table_name="spools")
    op.drop_table("spools")
