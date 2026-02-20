"""Agregar tablas de inventario y órdenes de compra

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-02-20 18:00:00.000000

Crea las tablas inventory_items, purchase_orders y purchase_order_items
para gestionar el inventario de materiales y las órdenes de compra a
proveedores. Incluye índices en company_id para consultas multi-tenant.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabla de ítems de inventario
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="General"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="unidades"),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False, server_default="0"),
        sa.Column("min_quantity", sa.Numeric(precision=12, scale=3), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("supplier_name", sa.String(length=200), nullable=True),
        sa.Column("supplier_contact", sa.String(length=300), nullable=True),
        sa.Column("supplier_info", sa.Text(), nullable=True),
        sa.Column("needs_purchase", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name="fk_inventory_items_company_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_items_company_id", "inventory_items", ["company_id"])

    # Tabla de órdenes de compra
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier", sa.String(length=200), nullable=False),
        sa.Column("tracking_number", sa.String(length=200), nullable=True),
        sa.Column("carrier", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pendiente"),
        sa.Column("estimated_arrival", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("arrived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name="fk_purchase_orders_company_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_purchase_orders_company_id", "purchase_orders", ["company_id"])

    # Tabla de ítems de las órdenes de compra
    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["purchase_orders.id"],
            name="fk_purchase_order_items_order_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["inventory_item_id"],
            ["inventory_items.id"],
            name="fk_purchase_order_items_inventory_item_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("purchase_order_items")
    op.drop_index("ix_purchase_orders_company_id", table_name="purchase_orders")
    op.drop_table("purchase_orders")
    op.drop_index("ix_inventory_items_company_id", table_name="inventory_items")
    op.drop_table("inventory_items")
