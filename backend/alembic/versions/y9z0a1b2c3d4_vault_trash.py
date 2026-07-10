"""Agregar papelera (soft-delete) al Vault.

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-07-10

`model_files.deleted_at`: NULL = activo. El borrado normal ahora es
soft-delete (mueve a la papelera); el borrado permanente (bytes MinIO +
fila) vive en los endpoints de /vault/trash.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "y9z0a1b2c3d4"
down_revision: Union[str, None] = "x8y9z0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("model_files", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("model_files", "deleted_at")
