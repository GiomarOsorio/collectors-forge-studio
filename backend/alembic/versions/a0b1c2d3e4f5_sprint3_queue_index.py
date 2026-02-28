"""sprint3: índice en print_queue.quote_id

Revision ID: a0b1c2d3e4f5
Revises: f7a8b9c0d1e2
Create Date: 2026-02-28

Agrega un índice explícito en print_queue.quote_id para acelerar las
consultas de _build_responses_bulk (IN lookups) y el JOIN implícito
al cargar el historial de la cola por cotización.
"""

from alembic import op


revision = 'a0b1c2d3e4f5'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_print_queue_quote_id',
        'print_queue',
        ['quote_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_print_queue_quote_id', table_name='print_queue')
