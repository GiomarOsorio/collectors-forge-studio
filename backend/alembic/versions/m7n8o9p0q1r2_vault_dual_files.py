"""Vault: soportar source_file + print_file en ModelFile.

Hasta ahora `model_files` tenía un único trio `file_key/file_name/file_size`
(asumiendo `.3mf` editable). Para soportar también el paquete laminado
`.gcode.3mf` (necesario para el picker "Agregar a cola desde Vault"),
desdoblamos el trio en dos slots:

- `source_file_*`: el `.3mf` editable (proyecto OrcaSlicer/BambuStudio).
- `print_file_*`:  el `.gcode.3mf` laminado.

Al menos uno tiene que estar presente (CHECK constraint). Además agregamos
metadatos pre-parseados del header del G-code para que el picker de cola
no tenga que volver a parsear el archivo:

- `sliced_weight_g` (Numeric 10,2)
- `sliced_time_seconds` (Integer)
- `sliced_printer_model` (String 100)
- `sliced_filament_type` (String 50)

Datos existentes: se asume que todos los `file_*` actuales corresponden a
.3mf editables (que es el único formato que el upload V1 aceptaba).
Por eso copiamos `file_key/file_name/file_size` → `source_file_*` y
después dropeamos las columnas viejas.

Si en producción hay alguna fila cuyo `file_name` termina en `.gcode.3mf`,
se mueve al slot print en su lugar.

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op


revision: str = "m7n8o9p0q1r2"
down_revision: Union[str, None] = "l6m7n8o9p0q1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear columnas nuevas (todas nullable inicialmente).
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS source_file_key VARCHAR(500)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS source_file_name VARCHAR(255)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS source_file_size BIGINT")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS print_file_key VARCHAR(500)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS print_file_name VARCHAR(255)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS print_file_size BIGINT")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS sliced_weight_g NUMERIC(10, 2)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS sliced_time_seconds INTEGER")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS sliced_printer_model VARCHAR(100)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS sliced_filament_type VARCHAR(50)")

    # 2. Migrar datos: las filas cuyo file_name termina en .gcode.3mf van
    #    al slot print; el resto al slot source (incluye .3mf y cualquier
    #    extensión legacy).
    op.execute(
        """
        UPDATE model_files
        SET print_file_key = file_key,
            print_file_name = file_name,
            print_file_size = file_size
        WHERE LOWER(file_name) LIKE '%.gcode.3mf'
        """
    )
    op.execute(
        """
        UPDATE model_files
        SET source_file_key = file_key,
            source_file_name = file_name,
            source_file_size = file_size
        WHERE LOWER(file_name) NOT LIKE '%.gcode.3mf'
        """
    )

    # 3. Dropear columnas viejas.
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS file_key")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS file_name")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS file_size")

    # 4. Check constraint: al menos un slot tiene que estar presente.
    op.execute(
        """
        ALTER TABLE model_files
        ADD CONSTRAINT ck_model_files_at_least_one_file
        CHECK (source_file_key IS NOT NULL OR print_file_key IS NOT NULL)
        """
    )


def downgrade() -> None:
    # Recrea las columnas legacy con datos del slot que esté presente
    # (preferencia source > print porque el upload V1 era source-only).
    op.execute("ALTER TABLE model_files DROP CONSTRAINT IF EXISTS ck_model_files_at_least_one_file")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS file_key VARCHAR(500)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)")
    op.execute("ALTER TABLE model_files ADD COLUMN IF NOT EXISTS file_size BIGINT")
    op.execute(
        """
        UPDATE model_files
        SET file_key = COALESCE(source_file_key, print_file_key),
            file_name = COALESCE(source_file_name, print_file_name),
            file_size = COALESCE(source_file_size, print_file_size)
        """
    )
    op.execute("ALTER TABLE model_files ALTER COLUMN file_key SET NOT NULL")
    op.execute("ALTER TABLE model_files ALTER COLUMN file_name SET NOT NULL")
    op.execute("ALTER TABLE model_files ALTER COLUMN file_size SET NOT NULL")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS source_file_key")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS source_file_name")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS source_file_size")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS print_file_key")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS print_file_name")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS print_file_size")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS sliced_weight_g")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS sliced_time_seconds")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS sliced_printer_model")
    op.execute("ALTER TABLE model_files DROP COLUMN IF EXISTS sliced_filament_type")
