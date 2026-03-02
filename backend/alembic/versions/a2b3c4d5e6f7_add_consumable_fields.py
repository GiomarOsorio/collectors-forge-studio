"""sprint-C: campos de consumibles en inventory_items y categoría Consumible

Revision ID: a2b3c4d5e6f7
Revises: f5a6b7c8d9e1
Create Date: 2026-03-02

Agrega dos columnas opcionales a inventory_items para soportar los
consumibles de la impresora (boquillas, calcetas, filtros, etc.) que
se desgastan proporcionalmente a las horas de impresión:

  useful_life_hours — vida útil en horas de impresión (p.ej. 500 para boquilla).
  unit_cost_cal     — precio que se carga en la cotización por unidad (puede
                      diferir de unit_cost si hay impuestos de importación).

La fórmula de desgaste por impresión es:
    unit_cost_cal / useful_life_hours × print_time_hours

También inserta la categoría 'Consumible' (allows_decimals=False) en la
tabla inventory_categories para todas las empresas existentes.
"""

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = 'a2b3c4d5e6f7'
down_revision = 'f5a6b7c8d9e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Nuevos campos en inventory_items ────────────────────────────────────
    op.add_column(
        "inventory_items",
        sa.Column("useful_life_hours", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("unit_cost_cal", sa.Numeric(12, 4), nullable=True),
    )

    # ── Categoría 'Consumible' para todas las empresas existentes ───────────
    conn = op.get_bind()
    companies = conn.execute(sa.text("SELECT id FROM companies")).fetchall()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    rows = [
        {
            "company_id":      str(company_id),
            "name":            "Consumible",
            "allows_decimals": False,
            "is_system":       False,
            "created_at":      now,
        }
        for (company_id,) in companies
    ]

    if rows:
        conn.execute(
            sa.text(
                "INSERT INTO inventory_categories "
                "(company_id, name, allows_decimals, is_system, created_at) "
                "VALUES (:company_id, :name, :allows_decimals, :is_system, :created_at) "
                "ON CONFLICT (company_id, name) DO NOTHING"
            ),
            rows,
        )


def downgrade() -> None:
    op.drop_column("inventory_items", "unit_cost_cal")
    op.drop_column("inventory_items", "useful_life_hours")
    # No se elimina la categoría 'Consumible' para evitar pérdida de datos
