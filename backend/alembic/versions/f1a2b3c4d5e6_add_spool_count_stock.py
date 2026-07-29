"""issue #214: stock de filamento por bobinas (sealed/open/min_spools)

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d1
Create Date: 2026-07-28

Agrega a inventory_items el conteo de bobinas:
    sealed_spools     — bobinas sin abrir
    open_remaining_g  — gramos de la bobina abierta (NULL = ninguna)
    min_spools        — stock mínimo en bobinas

Backfill para ítems de categoría Filamento con weight_per_roll definido,
repartiendo `quantity` (gramos) en bobinas llenas + resto en la abierta, y
`min_quantity` en bobinas (ceil). Se hace en Python para ser agnóstico de
dialecto (SQLite/Postgres no comparten FLOOR/CEIL).
"""

import math
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("sealed_spools", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "inventory_items",
        sa.Column("open_remaining_g", sa.Numeric(8, 1), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("min_spools", sa.Integer(), nullable=False, server_default="0"),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, quantity, min_quantity, weight_per_roll "
            "FROM inventory_items "
            "WHERE category = 'Filamento' "
            "AND weight_per_roll IS NOT NULL AND weight_per_roll > 0"
        )
    ).fetchall()

    for row in rows:
        w = Decimal(str(row.weight_per_roll))
        if w <= 0:
            continue
        q = Decimal(str(row.quantity or 0))
        if q < 0:
            q = Decimal("0")
        mq = Decimal(str(row.min_quantity or 0))

        sealed = int(q // w)
        open_g = q - sealed * w
        min_spools = int(math.ceil(mq / w)) if mq > 0 else 0

        conn.execute(
            sa.text(
                "UPDATE inventory_items "
                "SET sealed_spools = :s, open_remaining_g = :o, min_spools = :m "
                "WHERE id = :id"
            ),
            {
                "s": sealed,
                "o": None if open_g == 0 else str(open_g),
                "m": min_spools,
                "id": row.id,
            },
        )


def downgrade() -> None:
    op.drop_column("inventory_items", "min_spools")
    op.drop_column("inventory_items", "open_remaining_g")
    op.drop_column("inventory_items", "sealed_spools")
