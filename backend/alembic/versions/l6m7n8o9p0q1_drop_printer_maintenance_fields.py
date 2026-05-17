"""Eliminar campos de mantenimiento de Printer y maintenance_cost de Quote.

El costo de mantenimiento se rastrea ahora en la app Mantenimiento (logs
con descuento de inventario) y los Consumibles del inventario cubren el
desgaste prospectivo (via consumables_wear_cost en el calculator).
Tener los campos en Printer + el cálculo en Quote era duplicación.

Cambios:
- DROP columns en `printers`: nozzle_price, nozzle_lifespan_hours,
  buildplate_price, buildplate_lifespan_hours, other_maintenance_per_hour
- DROP check constraints asociados: ck_printers_nozzle_pos, ck_printers_plate_pos
- DROP column en `quotes`: maintenance_cost (cotizaciones históricas pierden
  ese desglose; el subtotal/total NO se recalcula, queda como estaba)

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op


revision: str = "l6m7n8o9p0q1"
down_revision: Union[str, None] = "k5l6m7n8o9p0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop CHECK constraints primero (PostgreSQL los mantiene incluso si la
    # columna desaparece — pero ser explícito evita warnings).
    op.execute("ALTER TABLE printers DROP CONSTRAINT IF EXISTS ck_printers_nozzle_pos")
    op.execute("ALTER TABLE printers DROP CONSTRAINT IF EXISTS ck_printers_plate_pos")

    # Drop columnas de mantenimiento en printers.
    op.execute("ALTER TABLE printers DROP COLUMN IF EXISTS nozzle_price")
    op.execute("ALTER TABLE printers DROP COLUMN IF EXISTS nozzle_lifespan_hours")
    op.execute("ALTER TABLE printers DROP COLUMN IF EXISTS buildplate_price")
    op.execute("ALTER TABLE printers DROP COLUMN IF EXISTS buildplate_lifespan_hours")
    op.execute("ALTER TABLE printers DROP COLUMN IF EXISTS other_maintenance_per_hour")

    # Drop maintenance_cost en quotes. Las cotizaciones históricas pierden
    # este desglose pero su `subtotal` y `total_price` quedan intactos.
    op.execute("ALTER TABLE quotes DROP COLUMN IF EXISTS maintenance_cost")


def downgrade() -> None:
    # Recrea columnas con defaults razonables; los valores históricos no se
    # pueden restaurar (data perdida). Útil solo para tests / rollback
    # inmediato post-deploy.
    op.execute(
        "ALTER TABLE printers ADD COLUMN nozzle_price NUMERIC(12, 4) NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE printers ADD COLUMN nozzle_lifespan_hours NUMERIC(10, 2) NOT NULL DEFAULT 500"
    )
    op.execute(
        "ALTER TABLE printers ADD COLUMN buildplate_price NUMERIC(12, 4) NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE printers ADD COLUMN buildplate_lifespan_hours NUMERIC(10, 2) NOT NULL DEFAULT 2000"
    )
    op.execute(
        "ALTER TABLE printers ADD COLUMN other_maintenance_per_hour NUMERIC(12, 6) NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE printers ADD CONSTRAINT ck_printers_nozzle_pos CHECK (nozzle_lifespan_hours > 0)"
    )
    op.execute(
        "ALTER TABLE printers ADD CONSTRAINT ck_printers_plate_pos CHECK (buildplate_lifespan_hours > 0)"
    )
    op.execute(
        "ALTER TABLE quotes ADD COLUMN maintenance_cost NUMERIC(12, 4) NOT NULL DEFAULT 0"
    )
