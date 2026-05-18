"""Renombrar columnas de storage local a keys de MinIO.

Migra los 3 tipos de blobs (Vault thumbnails, Company logos, PrintedItem
images) de `/app/static/...` a MinIO bajo prefijos dedicados.

Cambios de esquema:
    - model_files.local_thumbnail_path  → thumbnail_key
    - companies.logo_url                 → logo_key
    - printed_items.image_url            → image_key

Las filas existentes se NULLean: los valores viejos apuntaban a rutas en
`/app/static/...` (no persistente, ya inválidas tras redeploys). El
backend re-poblará `thumbnail_key` vía `_backfill_vault_thumbnails`;
logos e imágenes deben re-subirse manualmente desde la UI (en producción
hay un único logo y un puñado de imágenes de printed_items).

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-05-18
"""

from typing import Sequence, Union

from alembic import op


revision: str = "o9p0q1r2s3t4"
down_revision: Union[str, None] = "n8o9p0q1r2s3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) model_files.local_thumbnail_path → thumbnail_key
    #    NULLeamos antes del rename: los paths viejos (/app/static/...)
    #    apuntan a archivos no persistentes; el backfill al arrancar el
    #    backend repobla desde MinIO.
    op.execute("UPDATE model_files SET local_thumbnail_path = NULL")
    op.execute(
        "ALTER TABLE model_files RENAME COLUMN local_thumbnail_path TO thumbnail_key"
    )

    # 2) companies.logo_url → logo_key
    op.execute("UPDATE companies SET logo_url = NULL")
    op.execute("ALTER TABLE companies RENAME COLUMN logo_url TO logo_key")

    # 3) printed_items.image_url → image_key
    op.execute("UPDATE printed_items SET image_url = NULL")
    op.execute(
        "ALTER TABLE printed_items RENAME COLUMN image_url TO image_key"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE printed_items RENAME COLUMN image_key TO image_url"
    )
    op.execute("ALTER TABLE companies RENAME COLUMN logo_key TO logo_url")
    op.execute(
        "ALTER TABLE model_files RENAME COLUMN thumbnail_key TO local_thumbnail_path"
    )
