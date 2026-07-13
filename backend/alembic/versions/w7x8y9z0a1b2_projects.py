"""Agregar proyectos (agrupador de la cola de impresión).

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-07-09

Crea `projects` y agrega `print_queue.project_id` (nullable, SET NULL al
borrar el proyecto — los items no se pierden, solo quedan sin agrupar).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "w7x8y9z0a1b2"
down_revision: Union[str, None] = "v6w7x8y9z0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("client_name", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("print_queue", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_index("ix_print_queue_project_id", "print_queue", ["project_id"])
    op.create_foreign_key(
        "fk_print_queue_project_id",
        "print_queue",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_print_queue_project_id", "print_queue", type_="foreignkey")
    op.drop_index("ix_print_queue_project_id", table_name="print_queue")
    op.drop_column("print_queue", "project_id")

    op.drop_table("projects")
