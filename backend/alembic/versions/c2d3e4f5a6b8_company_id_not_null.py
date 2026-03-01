"""sprint4: company_id NOT NULL en 7 tablas

Revision ID: c2d3e4f5a6b8
Revises: b1c2d3e4f5a7
Create Date: 2026-02-28

Rellena los company_id NULL con la empresa por defecto y luego aplica
NOT NULL constraint en filaments, supplies, users, printers, print_queue,
app_settings y quotes.
"""

import sqlalchemy as sa
from alembic import op

revision = 'c2d3e4f5a6b8'
down_revision = 'b1c2d3e4f5a7'
branch_labels = None
depends_on = None

DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

_TABLES = [
    'filaments',
    'supplies',
    'users',
    'printers',
    'print_queue',
    'app_settings',
    'quotes',
]


def upgrade() -> None:
    # app_settings tiene UNIQUE(company_id) y puede ya tener una fila con el company_id
    # por defecto. Las filas NULL que conflictúan deben borrarse en vez de actualizarse.
    op.execute(
        f"DELETE FROM app_settings WHERE company_id IS NULL "
        f"AND EXISTS (SELECT 1 FROM app_settings a2 WHERE a2.company_id = '{DEFAULT_COMPANY_ID}')"
    )
    for table in _TABLES:
        op.execute(
            f"UPDATE {table} SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL"
        )
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN company_id SET NOT NULL"
        )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN company_id DROP NOT NULL"
        )
