"""Metadata de proyectos: cover, color, external_url, cotización vinculada.

Revision ID: a1b2c3d4e5f7
Revises: 9533b1d4f6a2
Create Date: 2026-07-14

Issue #136 (sub-ticket 1/3 — metadata): agrega `cover_photo_key` (MinIO,
mismo patrón que `ModelFile.thumbnail_key`), `color` (hex, badge visual),
`external_url` (link a MakerWorld/Printables/pedido) y `client_quote_id`
(FK opcional a `client_quotes`, SET NULL) a `projects`.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "9533b1d4f6a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("cover_photo_key", sa.String(length=500), nullable=True))
    op.add_column("projects", sa.Column("color", sa.String(length=7), nullable=True))
    op.add_column("projects", sa.Column("external_url", sa.String(length=500), nullable=True))
    op.add_column("projects", sa.Column("client_quote_id", sa.Integer(), nullable=True))
    op.create_index("ix_projects_client_quote_id", "projects", ["client_quote_id"])
    op.create_foreign_key(
        "fk_projects_client_quote_id",
        "projects",
        "client_quotes",
        ["client_quote_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_projects_client_quote_id", "projects", type_="foreignkey")
    op.drop_index("ix_projects_client_quote_id", table_name="projects")
    op.drop_column("projects", "client_quote_id")
    op.drop_column("projects", "external_url")
    op.drop_column("projects", "color")
    op.drop_column("projects", "cover_photo_key")
