"""Fotos + notas por modelo del Vault, motivo de fallo en la cola.

Revision ID: 2787aa619580
Revises: z0a1b2c3d4e5
Create Date: 2026-07-13

Issue #130 — tabla model_file_photos (documentación técnica de resultados/
fallos de impresión, distinta de PrintedItem que es el catálogo comercial),
ModelFile.notes (texto libre), y PrintQueueItem.failure_reason/
failure_category (motivo de cancelación, alimenta el historial por modelo
y el futuro epic de Stats).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "2787aa619580"
down_revision: Union[str, None] = "z0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_file_photos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("model_file_id", sa.Integer(), nullable=False),
        sa.Column("minio_key", sa.String(length=500), nullable=False),
        sa.Column("caption", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["model_file_id"], ["model_files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_model_file_photos_model_file_id", "model_file_photos", ["model_file_id"]
    )

    op.add_column("model_files", sa.Column("notes", sa.Text(), nullable=True))

    op.add_column(
        "print_queue", sa.Column("failure_reason", sa.String(length=200), nullable=True)
    )
    op.add_column(
        "print_queue", sa.Column("failure_category", sa.String(length=30), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("print_queue", "failure_category")
    op.drop_column("print_queue", "failure_reason")
    op.drop_column("model_files", "notes")
    op.drop_index("ix_model_file_photos_model_file_id", table_name="model_file_photos")
    op.drop_table("model_file_photos")
