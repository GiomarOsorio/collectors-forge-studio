"""sprint4: migrar client_quotes.items de TEXT a JSONB

Revision ID: b1c2d3e4f5a7
Revises: a0b1c2d3e4f5
Create Date: 2026-02-28

Convierte la columna items de TEXT (JSON serializado manualmente) a JSONB
nativo de PostgreSQL. Esto elimina la necesidad de json.loads/json.dumps
en el código y permite queries más eficientes sobre la estructura JSON.
"""

import sqlalchemy as sa
from alembic import op

revision = 'b1c2d3e4f5a7'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE client_quotes ALTER COLUMN items TYPE JSONB USING items::jsonb"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE client_quotes ALTER COLUMN items TYPE TEXT USING items::text"
    )
