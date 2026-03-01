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
    # 1. Eliminar el DEFAULT TEXT ('[]') antes de cambiar el tipo,
    #    porque PostgreSQL no puede castearlo automáticamente a JSONB.
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items DROP DEFAULT")
    # 2. Convertir la columna de TEXT a JSONB usando el cast explícito.
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items TYPE JSONB USING items::jsonb")
    # 3. Restaurar el DEFAULT como JSONB nativo.
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items SET DEFAULT '[]'::jsonb")


def downgrade() -> None:
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items DROP DEFAULT")
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items TYPE TEXT USING items::text")
    op.execute("ALTER TABLE client_quotes ALTER COLUMN items SET DEFAULT '[]'")
