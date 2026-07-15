"""Import completo de MakerWorld (issue #139).

Revision ID: d4e5f6a7b8c0
Revises: c3d4e5f6a7b9
Create Date: 2026-07-15

Agrega:
- `bambu_cloud_auth` (singleton): credenciales de sesión de Bambu Cloud.
- `makerworld_imports`: historial de imports (últimos 10 vía GET /recent).

`model_files.source_url` / `source_platform` / `creator_name` /
`creator_url` YA existen desde antes (no requieren migración) — se
reutilizan para poblar el badge "MakerWorld" y trazar el origen.
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c0"
down_revision: Union[str, None] = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bambu_cloud_auth",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("access_token", sa.String(length=2000), nullable=True),
        sa.Column("refresh_token", sa.String(length=2000), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "makerworld_imports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("design_id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("model_file_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["model_file_id"], ["model_files.id"], ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("makerworld_imports")
    op.drop_table("bambu_cloud_auth")
