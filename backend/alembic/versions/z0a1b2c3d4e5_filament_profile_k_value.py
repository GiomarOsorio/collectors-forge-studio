"""Agregar K-value manual a FilamentProfile.

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-07-10

Issue #118 — a diferencia de bambuddy-cfs (K-profiles sincronizados en
vivo con la impresora vía MQTT), acá es 100% manual: el usuario calibra
por su cuenta y anota el resultado. `nozzle_diameter` acompaña al
`k_value` porque el K depende del diámetro de boquilla usado al calibrar.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "z0a1b2c3d4e5"
down_revision: Union[str, None] = "y9z0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("filament_profiles", sa.Column("k_value", sa.Numeric(precision=6, scale=4), nullable=True))
    op.add_column("filament_profiles", sa.Column("nozzle_diameter", sa.String(length=10), nullable=True))
    op.add_column("filament_profiles", sa.Column("calibrated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("filament_profiles", "calibrated_at")
    op.drop_column("filament_profiles", "nozzle_diameter")
    op.drop_column("filament_profiles", "k_value")
