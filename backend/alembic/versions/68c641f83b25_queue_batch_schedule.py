"""Queue avanzada: batch_id + scheduled_at.

Revision ID: 68c641f83b25
Revises: 2787aa619580
Create Date: 2026-07-14

Issue #133 — agrupar items de la cola en lotes (batch_id, UUID compartido
entre items agrupados) y programar organizativamente una fecha/hora
(scheduled_at, no dispara nada automático — CFS no habla con la impresora).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "68c641f83b25"
down_revision: Union[str, None] = "2787aa619580"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "print_queue",
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_print_queue_batch_id", "print_queue", ["batch_id"])
    op.add_column(
        "print_queue", sa.Column("scheduled_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("print_queue", "scheduled_at")
    op.drop_index("ix_print_queue_batch_id", table_name="print_queue")
    op.drop_column("print_queue", "batch_id")
