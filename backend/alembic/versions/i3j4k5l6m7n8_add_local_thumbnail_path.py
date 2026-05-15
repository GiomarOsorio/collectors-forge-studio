"""Agregar columna local_thumbnail_path a model_files.

Almacena la URL relativa al PNG de plate render extraído del `.3mf` en
`/app/static/thumbnails/{model_file_id}.png`. La extracción ocurre en el
upload del Vault y mediante el backfill idempotente al arrancar el backend.

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i3j4k5l6m7n8"
down_revision: Union[str, None] = "h2i3j4k5l6m7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "model_files",
        sa.Column("local_thumbnail_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("model_files", "local_thumbnail_path")
