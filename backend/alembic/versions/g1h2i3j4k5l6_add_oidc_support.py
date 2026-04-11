"""Agrega soporte OIDC: columna oidc_sub en users y hashed_password nullable.

Revision ID: g1h2i3j4k5l6
Revises: c6d7e8f9a0b1
Create Date: 2026-04-11
"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, None] = "c6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna oidc_sub (nullable, para JIT provisioning)
    op.add_column("users", sa.Column("oidc_sub", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_oidc_sub", "users", ["oidc_sub"])
    op.create_index("ix_users_oidc_sub", "users", ["oidc_sub"])
    # Hacer hashed_password nullable (usuarios OIDC no tienen contraseña local)
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_oidc_sub", table_name="users")
    op.drop_constraint("uq_users_oidc_sub", "users", type_="unique")
    op.drop_column("users", "oidc_sub")
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=False,
    )
