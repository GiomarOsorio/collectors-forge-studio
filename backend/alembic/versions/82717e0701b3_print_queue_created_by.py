"""Print Log: created_by en print_queue.

Revision ID: 82717e0701b3
Revises: 68c641f83b25
Create Date: 2026-07-14

Issue #131 — atribuir cada item de la cola al usuario que lo creó
(add_to_queue / add_to_queue_from_vault). Nullable: items históricos
pre-existentes quedan sin atribución ("—" en el frontend).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "82717e0701b3"
down_revision: Union[str, None] = "68c641f83b25"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "print_queue", sa.Column("created_by", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_print_queue_created_by",
        "print_queue",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_print_queue_created_by", "print_queue", type_="foreignkey")
    op.drop_column("print_queue", "created_by")
