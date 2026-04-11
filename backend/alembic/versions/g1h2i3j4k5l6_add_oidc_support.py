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
    # Usar SQL raw con IF NOT EXISTS para hacer la migración idempotente.
    # La DB del servidor puede ya tener estas columnas/constraints de un deploy anterior.

    # Agregar columna oidc_sub (nullable, para JIT provisioning)
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_sub VARCHAR(255)")

    # Crear unique constraint si no existe
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_oidc_sub'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT uq_users_oidc_sub UNIQUE (oidc_sub);
            END IF;
        END
        $$;
    """)

    # Crear índice si no existe
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_oidc_sub ON users (oidc_sub)")

    # Hacer hashed_password nullable si aún no lo es
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users'
                  AND column_name = 'hashed_password'
                  AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
            END IF;
        END
        $$;
    """)


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
