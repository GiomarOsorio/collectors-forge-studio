"""Agregar campos de perfil a la tabla companies

Revision ID: f5a6b7c8d9e0
Revises: e2f3a4b5c6d7
Create Date: 2026-02-21 18:00:00.000000

Agrega los campos de perfil empresarial a la tabla companies:
slogan, address, phone, contact_email, nit, logo_url.
Todos son nullable para no romper registros existentes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE companies"
        " ADD COLUMN IF NOT EXISTS slogan VARCHAR(200),"
        " ADD COLUMN IF NOT EXISTS address VARCHAR(300),"
        " ADD COLUMN IF NOT EXISTS phone VARCHAR(50),"
        " ADD COLUMN IF NOT EXISTS contact_email VARCHAR(100),"
        " ADD COLUMN IF NOT EXISTS nit VARCHAR(50),"
        " ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE companies"
        " DROP COLUMN IF EXISTS slogan,"
        " DROP COLUMN IF EXISTS address,"
        " DROP COLUMN IF EXISTS phone,"
        " DROP COLUMN IF EXISTS contact_email,"
        " DROP COLUMN IF EXISTS nit,"
        " DROP COLUMN IF EXISTS logo_url"
    ))
