"""sprint4: agregar tabla inventory_categories con categorías configurables

Revision ID: e4f5a6b7c8d0
Revises: d3e4f5a6b7c9
Create Date: 2026-02-28

Crea la tabla inventory_categories para gestionar categorías de inventario
por empresa. Inserta las 7 categorías por defecto para todas las empresas
existentes. 'Filamento' se marca como is_system=True y allows_decimals=True.
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = 'e4f5a6b7c8d0'
down_revision = 'd3e4f5a6b7c9'
branch_labels = None
depends_on = None

# Categorías por defecto para cada empresa
_DEFAULT_CATEGORIES = [
    {"name": "Filamento",                    "allows_decimals": True,  "is_system": True},
    {"name": "Accesorio",                    "allows_decimals": False, "is_system": False},
    {"name": "Accesorios de postprocesado",  "allows_decimals": False, "is_system": False},
    {"name": "Accesorios de preprocesado",   "allows_decimals": False, "is_system": False},
    {"name": "Repuesto impresora",           "allows_decimals": False, "is_system": False},
    {"name": "Herramienta",                  "allows_decimals": False, "is_system": False},
    {"name": "General",                      "allows_decimals": False, "is_system": False},
]


def upgrade() -> None:
    op.create_table(
        "inventory_categories",
        sa.Column("id",              sa.Integer,  primary_key=True, autoincrement=True),
        sa.Column("company_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("name",            sa.String(100), nullable=False),
        sa.Column("allows_decimals", sa.Boolean,     nullable=False, server_default=sa.text("false")),
        sa.Column("is_system",       sa.Boolean,     nullable=False, server_default=sa.text("false")),
        sa.Column("created_at",      sa.DateTime,    nullable=False),
        sa.UniqueConstraint("company_id", "name", name="uq_inventory_category_company_name"),
    )

    # Insertar categorías por defecto para todas las empresas existentes
    conn = op.get_bind()
    companies = conn.execute(sa.text("SELECT id FROM companies")).fetchall()
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    rows = []
    for (company_id,) in companies:
        for cat in _DEFAULT_CATEGORIES:
            rows.append({
                "company_id":      str(company_id),
                "name":            cat["name"],
                "allows_decimals": cat["allows_decimals"],
                "is_system":       cat["is_system"],
                "created_at":      now,
            })

    if rows:
        conn.execute(
            sa.text(
                "INSERT INTO inventory_categories (company_id, name, allows_decimals, is_system, created_at) "
                "VALUES (:company_id, :name, :allows_decimals, :is_system, :created_at)"
            ),
            rows,
        )


def downgrade() -> None:
    op.drop_table("inventory_categories")
