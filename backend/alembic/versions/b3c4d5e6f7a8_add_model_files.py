"""Sprint D: tabla model_files para el Vault de archivos .3mf

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-06

Crea la tabla model_files que almacena los metadatos de los archivos
.3mf subidos al Vault. El archivo en sí reside en MinIO; aquí solo
se guardan la clave de objeto (file_key) y los metadatos de display.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB

revision = 'b3c4d5e6f7a8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("companies.id"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("file_key", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.String(1000), nullable=True),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("source_platform", sa.String(50), nullable=True),
        sa.Column("creator_name", sa.String(200), nullable=True),
        sa.Column("creator_url", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_model_files_company_id", "model_files", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_model_files_company_id", table_name="model_files")
    op.drop_table("model_files")
