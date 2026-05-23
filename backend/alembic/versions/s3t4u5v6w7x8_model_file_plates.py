"""Tabla `model_file_plates` + columna `active_plate_index` (issue #68).

Soporte multi-plate para modelos `.gcode.3mf`. Cada plate del archivo se
persiste en su propia row con su weight/time/thumbnail. El plate activo
del modelo se indica con `active_plate_index` (0-based) y sincroniza
los campos `sliced_*` (cache) del `ModelFile` para queue/calc.

Backfill: para cada `model_file` existente con `sliced_weight_g IS NOT NULL`
crea un row en `model_file_plates` con `plate_index=0` copiando los
valores actuales. Esto garantiza que la API existente siga retornando
el mismo plate como activo sin pérdida de datos.

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "s3t4u5v6w7x8"
down_revision: Union[str, None] = "r2s3t4u5v6w7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabla model_file_plates
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS model_file_plates (
            id              SERIAL       PRIMARY KEY,
            model_file_id   INTEGER      NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
            plate_index     INTEGER      NOT NULL,
            weight_g        NUMERIC(10, 2),
            time_seconds    INTEGER,
            filament_type   VARCHAR(50),
            printer_model   VARCHAR(100),
            thumbnail_key   VARCHAR(500),
            created_at      TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
            CONSTRAINT uq_model_file_plate_idx UNIQUE (model_file_id, plate_index)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_model_file_plates_model_file_id "
        "ON model_file_plates(model_file_id)"
    )

    # Columna active_plate_index en model_files
    op.execute(
        "ALTER TABLE model_files "
        "ADD COLUMN IF NOT EXISTS active_plate_index INTEGER NOT NULL DEFAULT 0"
    )

    # Backfill: 1 plate por modelo existente con sliced metadata.
    # plate_index=0, copiando los valores cache actuales + thumbnail_key.
    op.execute(
        """
        INSERT INTO model_file_plates (
            model_file_id, plate_index, weight_g, time_seconds,
            filament_type, printer_model, thumbnail_key
        )
        SELECT
            id, 0, sliced_weight_g, sliced_time_seconds,
            sliced_filament_type, sliced_printer_model, thumbnail_key
        FROM model_files
        WHERE sliced_weight_g IS NOT NULL
           OR sliced_time_seconds IS NOT NULL
           OR thumbnail_key IS NOT NULL
        ON CONFLICT (model_file_id, plate_index) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS active_plate_index")
    op.execute("DROP TABLE IF EXISTS model_file_plates")
