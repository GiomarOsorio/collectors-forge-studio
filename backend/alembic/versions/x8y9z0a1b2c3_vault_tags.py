"""Migrar tags del Vault de JSONB a catálogo relacional M2M.

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-07-10

Reemplaza `model_files.tags` (JSONB array) por `vault_tags` (catálogo
global) + `model_file_tags` (asociación M2M). Migra los tags existentes
antes de dropear la columna vieja — dedup case-insensitive por
`name_key` (trim + lower).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "x8y9z0a1b2c3"
down_revision: Union[str, None] = "w7x8y9z0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vault_tags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_key", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name_key", name="uq_vault_tags_name_key"),
    )
    op.create_table(
        "model_file_tags",
        sa.Column("model_file_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["model_file_id"], ["model_files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["vault_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("model_file_id", "tag_id"),
    )
    op.create_index("ix_model_file_tags_tag_id", "model_file_tags", ["tag_id"])

    # Migrar tags existentes del JSONB a las tablas relacionales, antes de
    # dropear la columna vieja. Dedup case-insensitive: "PLA" y "pla" en
    # archivos distintos colapsan al mismo VaultTag.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, tags FROM model_files WHERE tags IS NOT NULL AND tags != '[]'::jsonb")
    ).fetchall()
    tag_id_by_key: dict[str, int] = {}
    for model_file_id, tags_json in rows:
        for raw_name in (tags_json or []):
            name = str(raw_name).strip()
            if not name:
                continue
            key = name.lower()
            if key not in tag_id_by_key:
                result = conn.execute(
                    sa.text(
                        "INSERT INTO vault_tags (name, name_key, created_at) "
                        "VALUES (:name, :key, now()) "
                        "ON CONFLICT (name_key) DO UPDATE SET name_key = EXCLUDED.name_key "
                        "RETURNING id"
                    ),
                    {"name": name, "key": key},
                )
                tag_id_by_key[key] = result.scalar()
            conn.execute(
                sa.text(
                    "INSERT INTO model_file_tags (model_file_id, tag_id) "
                    "VALUES (:mfid, :tid) ON CONFLICT DO NOTHING"
                ),
                {"mfid": model_file_id, "tid": tag_id_by_key[key]},
            )

    op.drop_column("model_files", "tags")


def downgrade() -> None:
    op.add_column(
        "model_files",
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE model_files mf
            SET tags = COALESCE(sub.tags_array, '[]'::jsonb)
            FROM (
                SELECT mft.model_file_id, jsonb_agg(vt.name) AS tags_array
                FROM model_file_tags mft
                JOIN vault_tags vt ON vt.id = mft.tag_id
                GROUP BY mft.model_file_id
            ) sub
            WHERE mf.id = sub.model_file_id
            """
        )
    )
    op.drop_index("ix_model_file_tags_tag_id", table_name="model_file_tags")
    op.drop_table("model_file_tags")
    op.drop_table("vault_tags")
