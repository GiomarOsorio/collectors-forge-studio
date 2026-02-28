"""sprint4: agregar updated_at a quotes y client_quotes

Revision ID: d3e4f5a6b7c9
Revises: c2d3e4f5a6b8
Create Date: 2026-02-28

Agrega la columna updated_at (nullable) a quotes y client_quotes para
permitir auditar cuándo fue modificada una cotización por última vez.
"""

import sqlalchemy as sa
from alembic import op

revision = 'd3e4f5a6b7c9'
down_revision = 'c2d3e4f5a6b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quotes', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('client_quotes', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('quotes', 'updated_at')
    op.drop_column('client_quotes', 'updated_at')
