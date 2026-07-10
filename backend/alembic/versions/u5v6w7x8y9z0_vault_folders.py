"""Agregar carpetas anidadas al Vault.

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-07-09

Crea `vault_folders` (árbol simple, auto-referencia por `parent_id`) y
agrega `model_files.folder_id` para asociar cada archivo a una carpeta.
NULL = raíz en ambos casos.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "u5v6w7x8y9z0"
down_revision: Union[str, None] = "t4u5v6w7x8y9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vault_folders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["parent_id"], ["vault_folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_folders_parent_id", "vault_folders", ["parent_id"])

    op.add_column("model_files", sa.Column("folder_id", sa.Integer(), nullable=True))
    op.create_index("ix_model_files_folder_id", "model_files", ["folder_id"])
    op.create_foreign_key(
        "fk_model_files_folder_id",
        "model_files",
        "vault_folders",
        ["folder_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_model_files_folder_id", "model_files", type_="foreignkey")
    op.drop_index("ix_model_files_folder_id", table_name="model_files")
    op.drop_column("model_files", "folder_id")

    op.drop_index("ix_vault_folders_parent_id", table_name="vault_folders")
    op.drop_table("vault_folders")
