"""Relajar el CHECK de margin_percent en quotes: 0–100 → 0–500.

Revision ID: a1b2c3d4e5f6
Revises: z0a1b2c3d4e5
Create Date: 2026-08-20

La calculadora ofrece el Stepper de margen hasta 150%, pero el schema y el
CHECK de BD lo topaban en 100 → cualquier cotización con margen alto moría
en 422. Se sube el techo a 500% (el Numeric(7,4) ya lo soporta) para que UI,
schema y BD queden alineados.
"""

from typing import Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "z0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_quotes_margin_range", "quotes", type_="check")
    op.create_check_constraint(
        "ck_quotes_margin_range",
        "quotes",
        "margin_percent >= 0 AND margin_percent <= 500",
    )


def downgrade() -> None:
    # Las cotizaciones con margen > 100 bloquearían el CHECK viejo: se recortan
    # a 100 antes de restaurarlo para que el downgrade no falle.
    op.execute("UPDATE quotes SET margin_percent = 100 WHERE margin_percent > 100")
    op.drop_constraint("ck_quotes_margin_range", "quotes", type_="check")
    op.create_check_constraint(
        "ck_quotes_margin_range",
        "quotes",
        "margin_percent >= 0 AND margin_percent <= 100",
    )
