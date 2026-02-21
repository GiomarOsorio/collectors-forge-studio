"""Migrar supplies_detail y additional_filaments_detail de TEXT a JSONB

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-02-21 12:00:00.000000

Convierte las columnas supplies_detail y additional_filaments_detail de la
tabla quotes de tipo TEXT a JSONB. Esto permite consultas nativas de
PostgreSQL sobre los documentos JSON (índices GIN, operadores @>, etc.)
y elimina la capa de serialización/deserialización manual en el router.

El CAST USING supplies_detail::jsonb es seguro porque los valores existentes
ya son JSON válido ('[]' o arrays serializados con json.dumps).

Usa SQL directo (op.execute) en lugar de op.alter_column para garantizar
que toda la operación ocurra dentro de la misma transacción controlada
por env.py (engine.begin()), evitando el error "0 found" en alembic_version.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Un solo ALTER TABLE con dos cambios de tipo — más atómico que
    # cuatro llamadas a op.alter_column separadas.
    op.execute(sa.text(
        "ALTER TABLE quotes"
        " ALTER COLUMN supplies_detail"
        "   TYPE JSONB USING supplies_detail::jsonb,"
        " ALTER COLUMN additional_filaments_detail"
        "   TYPE JSONB USING additional_filaments_detail::jsonb"
    ))
    op.execute(sa.text(
        "ALTER TABLE quotes"
        " ALTER COLUMN supplies_detail SET DEFAULT '[]'::jsonb,"
        " ALTER COLUMN additional_filaments_detail SET DEFAULT '[]'::jsonb"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE quotes"
        " ALTER COLUMN supplies_detail"
        "   TYPE TEXT USING supplies_detail::text,"
        " ALTER COLUMN additional_filaments_detail"
        "   TYPE TEXT USING additional_filaments_detail::text"
    ))
    op.execute(sa.text(
        "ALTER TABLE quotes"
        " ALTER COLUMN supplies_detail SET DEFAULT '[]',"
        " ALTER COLUMN additional_filaments_detail SET DEFAULT '[]'"
    ))
