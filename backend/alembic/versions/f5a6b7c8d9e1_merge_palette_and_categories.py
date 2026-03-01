"""merge: unir rama palette_jsonb con rama inventory_categories

Revision ID: f5a6b7c8d9e1
Revises: a9b0c1d2e3f4, e4f5a6b7c8d0
Create Date: 2026-02-28

Combina los dos heads independientes:
  - a9b0c1d2e3f4: palette JSONB en companies
  - e4f5a6b7c8d0: tabla inventory_categories
en un único head para poder usar 'alembic upgrade head'.
"""

from alembic import op

revision = 'f5a6b7c8d9e1'
down_revision = ('a9b0c1d2e3f4', 'e4f5a6b7c8d0')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
