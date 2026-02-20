"""Migrar filamentos y supplies al inventario unificado

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-02-20 22:00:00.000000

Agrega columnas especificas de filamento e insumo a inventory_items,
copia los datos existentes de filaments y supplies, y agrega la FK
inventory_item_id a quotes. Las tablas originales (filaments, supplies)
se mantienen intactas por seguridad.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar columnas nuevas a inventory_items
    op.add_column("inventory_items", sa.Column("price_per_kg", sa.Numeric(12, 4), nullable=True))
    op.add_column("inventory_items", sa.Column("filament_brand", sa.String(100), nullable=True))
    op.add_column("inventory_items", sa.Column("filament_type", sa.String(50), nullable=True))
    op.add_column("inventory_items", sa.Column("filament_color", sa.String(50), nullable=True))
    op.add_column("inventory_items", sa.Column("filament_diameter", sa.Numeric(6, 3), nullable=True))
    op.add_column("inventory_items", sa.Column("filament_density", sa.Numeric(8, 6), nullable=True))
    op.add_column("inventory_items", sa.Column("weight_per_roll", sa.Numeric(10, 3), nullable=True))
    op.add_column("inventory_items", sa.Column("price_per_unit", sa.Numeric(12, 4), nullable=True))

    # 2. Copiar filamentos existentes a inventory_items
    op.execute(text("""
        INSERT INTO inventory_items
          (company_id, name, category, unit, quantity, min_quantity, unit_cost,
           price_per_kg, filament_brand, filament_type, filament_color,
           filament_diameter, filament_density, weight_per_roll, created_at, updated_at)
        SELECT
          company_id,
          CONCAT(brand, ' ', type, ' ', color) AS name,
          'Filamento' AS category,
          'kg' AS unit,
          0 AS quantity,
          0 AS min_quantity,
          price_per_kg AS unit_cost,
          price_per_kg,
          brand AS filament_brand,
          type AS filament_type,
          color AS filament_color,
          diameter AS filament_diameter,
          density AS filament_density,
          weight_per_roll / 1000 AS weight_per_roll,
          created_at,
          updated_at
        FROM filaments
        WHERE company_id IS NOT NULL
    """))

    # 3. Copiar supplies existentes a inventory_items
    op.execute(text("""
        INSERT INTO inventory_items
          (company_id, name, category, description, unit, quantity, min_quantity,
           unit_cost, price_per_unit, notes, created_at, updated_at)
        SELECT
          company_id,
          name,
          'Insumo' AS category,
          description,
          unit,
          0 AS quantity,
          0 AS min_quantity,
          price_per_unit AS unit_cost,
          price_per_unit,
          notes,
          created_at,
          NOW() AS updated_at
        FROM supplies
        WHERE company_id IS NOT NULL
    """))

    # 4. Agregar inventory_item_id a quotes (nullable FK)
    op.add_column(
        "quotes",
        sa.Column("inventory_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_quotes_inventory_item_id",
        "quotes",
        "inventory_items",
        ["inventory_item_id"],
        ["id"],
    )

    # 5. Intentar vincular quotes existentes con los filamentos migrados
    # Nota: PostgreSQL no permite referenciar el alias de la tabla actualizada
    # dentro de JOIN en FROM; se usa FROM con coma y condiciones en WHERE.
    op.execute(text("""
        UPDATE quotes
        SET inventory_item_id = ii.id
        FROM inventory_items ii,
             filaments f
        WHERE f.id = quotes.filament_id
          AND ii.company_id = quotes.company_id
          AND ii.filament_brand = f.brand
          AND ii.filament_type = f.type
          AND ii.filament_color = f.color
          AND ii.category = 'Filamento'
    """))

    # 6. Hacer filament_id nullable en quotes
    op.alter_column("quotes", "filament_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Restaurar filament_id como NOT NULL en quotes
    op.alter_column("quotes", "filament_id", existing_type=sa.Integer(), nullable=False)

    # Eliminar FK y columna inventory_item_id de quotes
    op.drop_constraint("fk_quotes_inventory_item_id", "quotes", type_="foreignkey")
    op.drop_column("quotes", "inventory_item_id")

    # Eliminar columnas agregadas a inventory_items (no se borran datos migrados)
    op.drop_column("inventory_items", "price_per_unit")
    op.drop_column("inventory_items", "weight_per_roll")
    op.drop_column("inventory_items", "filament_density")
    op.drop_column("inventory_items", "filament_diameter")
    op.drop_column("inventory_items", "filament_color")
    op.drop_column("inventory_items", "filament_type")
    op.drop_column("inventory_items", "filament_brand")
    op.drop_column("inventory_items", "price_per_kg")
