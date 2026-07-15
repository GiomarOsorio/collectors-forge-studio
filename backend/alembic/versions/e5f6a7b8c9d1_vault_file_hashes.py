"""Hashes SHA-256 en ModelFile (issue #128).

Revision ID: e5f6a7b8c9d1
Revises: d4e5f6a7b8c0
Create Date: 2026-07-15

Agrega source_file_hash / print_file_hash (String(64), indexado, nullable)
a model_files. NO backfillea — los bytes viven en MinIO, no en la BD;
POST /api/vault/backfill-hashes (admin, por lotes) calcula los hashes de
archivos ya existentes.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d1"
down_revision: Union[str, None] = "d4e5f6a7b8c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("model_files", sa.Column("source_file_hash", sa.String(length=64), nullable=True))
    op.add_column("model_files", sa.Column("print_file_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_model_files_source_file_hash", "model_files", ["source_file_hash"])
    op.create_index("ix_model_files_print_file_hash", "model_files", ["print_file_hash"])


def downgrade() -> None:
    op.drop_index("ix_model_files_print_file_hash", table_name="model_files")
    op.drop_index("ix_model_files_source_file_hash", table_name="model_files")
    op.drop_column("model_files", "print_file_hash")
    op.drop_column("model_files", "source_file_hash")
