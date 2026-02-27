"""Reemplaza columnas fijas de color PDF por pdf_palette JSONB en companies.

Migra de 4 columnas String(7) separadas a una lista JSONB [{name, hex}]
que permite a cada empresa definir tantos colores como necesite.

Revision ID: a9b0c1d2e3f4
Revises: f7a8b9c0d1e2
Create Date: 2026-02-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna JSONB para la paleta dinámica de colores
    op.add_column(
        "companies",
        sa.Column("pdf_palette", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Migrar datos existentes a la nueva estructura si las columnas fijas tienen datos
    op.execute("""
        UPDATE companies
        SET pdf_palette = json_build_array(
            json_build_object('name', 'primary',    'hex', COALESCE(pdf_color_primary,    '#1A1A1A')),
            json_build_object('name', 'accent',     'hex', COALESCE(pdf_color_accent,     '#B67E3A')),
            json_build_object('name', 'highlight',  'hex', COALESCE(pdf_color_highlight,  '#A33221')),
            json_build_object('name', 'table_text', 'hex', COALESCE(pdf_color_table_text, '#D1A054'))
        )::jsonb
        WHERE pdf_color_primary IS NOT NULL
           OR pdf_color_accent IS NOT NULL
           OR pdf_color_highlight IS NOT NULL
           OR pdf_color_table_text IS NOT NULL
    """)

    # Eliminar las 4 columnas fijas ya migradas
    op.drop_column("companies", "pdf_color_primary")
    op.drop_column("companies", "pdf_color_accent")
    op.drop_column("companies", "pdf_color_highlight")
    op.drop_column("companies", "pdf_color_table_text")


def downgrade() -> None:
    # Restaurar columnas fijas
    op.add_column("companies", sa.Column("pdf_color_primary",    sa.String(7), nullable=True))
    op.add_column("companies", sa.Column("pdf_color_accent",     sa.String(7), nullable=True))
    op.add_column("companies", sa.Column("pdf_color_highlight",  sa.String(7), nullable=True))
    op.add_column("companies", sa.Column("pdf_color_table_text", sa.String(7), nullable=True))

    # Intentar restaurar valores desde JSONB
    op.execute("""
        UPDATE companies
        SET
            pdf_color_primary    = (SELECT x->>'hex' FROM jsonb_array_elements(pdf_palette) x WHERE x->>'name'='primary'    LIMIT 1),
            pdf_color_accent     = (SELECT x->>'hex' FROM jsonb_array_elements(pdf_palette) x WHERE x->>'name'='accent'     LIMIT 1),
            pdf_color_highlight  = (SELECT x->>'hex' FROM jsonb_array_elements(pdf_palette) x WHERE x->>'name'='highlight'  LIMIT 1),
            pdf_color_table_text = (SELECT x->>'hex' FROM jsonb_array_elements(pdf_palette) x WHERE x->>'name'='table_text' LIMIT 1)
        WHERE pdf_palette IS NOT NULL
    """)

    op.drop_column("companies", "pdf_palette")
