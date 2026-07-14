"""Puente N:M Project <-> ModelFile (Vault).

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-07-14

Issue #136, sub-ticket 2/3: permite vincular archivos de Vault a un
proyecto (bulk-assign desde Vault, sección de archivos en el detalle
del proyecto). Tabla puente pura, sin columnas propias — PK compuesta.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_model_files",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("model_file_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_file_id"], ["model_files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "model_file_id"),
    )
    op.create_index(
        "ix_project_model_files_model_file_id", "project_model_files", ["model_file_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_project_model_files_model_file_id", table_name="project_model_files")
    op.drop_table("project_model_files")
