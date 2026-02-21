"""Migrar supplies_detail y additional_filaments_detail de TEXT a JSONB

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-02-21 12:00:00.000000

Convierte las columnas supplies_detail y additional_filaments_detail de la
tabla quotes de tipo TEXT a JSONB. Esto permite consultas nativas de
PostgreSQL sobre los documentos JSON (índices GIN, operadores @>, etc.)
y elimina la capa de serialización/deserialización manual en el router.

El CAST uses supplies_detail::jsonb es seguro porque los valores existentes
ya son JSON válido ('[]' o arrays serializados con json.dumps).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.alter_column(
        "quotes",
        "supplies_detail",
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="supplies_detail::jsonb",
        existing_nullable=True,
        existing_server_default=sa.text("'[]'"),
    )
    op.alter_column(
        "quotes",
        "additional_filaments_detail",
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="additional_filaments_detail::jsonb",
        existing_nullable=True,
        existing_server_default=sa.text("'[]'"),
    )
    # Actualizar server_default al equivalente JSONB
    op.alter_column("quotes", "supplies_detail", server_default=sa.text("'[]'::jsonb"))
    op.alter_column("quotes", "additional_filaments_detail", server_default=sa.text("'[]'::jsonb"))


def downgrade() -> None:
    op.alter_column(
        "quotes",
        "supplies_detail",
        type_=sa.Text(),
        postgresql_using="supplies_detail::text",
        existing_nullable=True,
        existing_server_default=sa.text("'[]'::jsonb"),
    )
    op.alter_column(
        "quotes",
        "additional_filaments_detail",
        type_=sa.Text(),
        postgresql_using="additional_filaments_detail::text",
        existing_nullable=True,
        existing_server_default=sa.text("'[]'::jsonb"),
    )
    op.alter_column("quotes", "supplies_detail", server_default=sa.text("'[]'"))
    op.alter_column("quotes", "additional_filaments_detail", server_default=sa.text("'[]'"))
