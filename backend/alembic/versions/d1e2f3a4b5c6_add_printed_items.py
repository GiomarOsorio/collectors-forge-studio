"""Agregar tabla de ítems de impresiones 3D (printed_items)

Revision ID: d1e2f3a4b5c6
Revises: d3e4f5a6b7c8
Create Date: 2026-02-20 23:30:00.000000

Crea la tabla printed_items para registrar los productos impresos en 3D
del inventario de cada empresa: llaveros, figuras, repuestos, accesorios,
etc. Incluye nombre, categoría, descripción, imagen, stock, precio de
venta, material y color. Soporta multi-tenant mediante company_id.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'printed_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('material', sa.String(length=100), nullable=True),
        sa.Column('color', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_printed_items_company_id'),
        'printed_items',
        ['company_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_printed_items_company_id'), table_name='printed_items')
    op.drop_table('printed_items')
