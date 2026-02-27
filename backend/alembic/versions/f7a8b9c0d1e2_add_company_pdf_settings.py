"""Agrega configuración de colores PDF a companies y crea tabla company_templates.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Columnas de paleta PDF en companies
    op.add_column("companies", sa.Column("pdf_color_primary",    sa.String(7),  nullable=True))
    op.add_column("companies", sa.Column("pdf_color_accent",     sa.String(7),  nullable=True))
    op.add_column("companies", sa.Column("pdf_color_highlight",  sa.String(7),  nullable=True))
    op.add_column("companies", sa.Column("pdf_color_table_text", sa.String(7),  nullable=True))
    op.add_column("companies", sa.Column("pdf_terms",            sa.Text(),     nullable=True))

    # Tabla de templates de cotización Liquid
    op.create_table(
        "company_templates",
        sa.Column("id",            sa.Integer(),                                        nullable=False),
        sa.Column("company_id",    postgresql.UUID(as_uuid=True),                       nullable=False),
        sa.Column("name",          sa.String(200),                                      nullable=False),
        sa.Column("description",   sa.Text(),                                           nullable=True),
        sa.Column("template_type", sa.String(20),  server_default=sa.text("'cot'"),     nullable=False),
        sa.Column("content",       sa.Text(),                                           nullable=False),
        sa.Column("is_default",    sa.Boolean(),   server_default=sa.text("false"),     nullable=False),
        sa.Column("created_at",    sa.DateTime(),                                       nullable=False),
        sa.Column("updated_at",    sa.DateTime(),                                       nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_company_templates_company_id", "company_templates", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_company_templates_company_id", table_name="company_templates")
    op.drop_table("company_templates")

    op.drop_column("companies", "pdf_terms")
    op.drop_column("companies", "pdf_color_table_text")
    op.drop_column("companies", "pdf_color_highlight")
    op.drop_column("companies", "pdf_color_accent")
    op.drop_column("companies", "pdf_color_primary")
