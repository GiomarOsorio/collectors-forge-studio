"""Queue: permitir items que vienen del Vault (no solo de Quote).

Hasta ahora un `PrintQueueItem` siempre apuntaba a un `Quote`. Con el
picker "Agregar a cola desde Vault" (chunk C), ahora también puede
apuntar a un `ModelFile` con `.gcode.3mf` y traer los datos de impresión
denormalizados (peso, tiempo, impresora, filamento, copias, pieza,
snapshot del .gcode.3mf path).

Cambios:
- ADD `vault_model_id` (FK → model_files.id, ondelete SET NULL, indexed)
- ADD `print_file_snapshot_path` (String 500)
- ADD denormalizados: `piece_name`, `printer_id` (FK), `filament_id` (FK
  → inventory_items.id), `quantity`, `weight_grams`, `print_time_hours`
- ADD CHECK constraint: al menos uno de quote_id/vault_model_id presente
  al crear (o estados terminales done/cancelled — esos pueden quedar
  huérfanos si se borra la fuente).

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op


revision: str = "n8o9p0q1r2s3"
down_revision: Union[str, None] = "m7n8o9p0q1r2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Vault link + denormalizados ────────────────────────────────────────
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS vault_model_id INTEGER "
        "REFERENCES model_files(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_print_queue_vault_model_id "
        "ON print_queue(vault_model_id)"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS "
        "print_file_snapshot_path VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS piece_name VARCHAR(200)"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS printer_id INTEGER "
        "REFERENCES printers(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS filament_id INTEGER "
        "REFERENCES inventory_items(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS quantity INTEGER"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10, 2)"
    )
    op.execute(
        "ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS print_time_hours NUMERIC(10, 4)"
    )

    # ── CHECK constraint ───────────────────────────────────────────────────
    # Acepta items con cualquiera de las dos fuentes, o terminales huérfanos
    # (done/cancelled cuya fuente fue borrada después).
    op.execute(
        """
        ALTER TABLE print_queue
        ADD CONSTRAINT ck_print_queue_has_source
        CHECK (
            quote_id IS NOT NULL
            OR vault_model_id IS NOT NULL
            OR status IN ('done', 'cancelled')
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE print_queue DROP CONSTRAINT IF EXISTS ck_print_queue_has_source"
    )
    op.execute("DROP INDEX IF EXISTS ix_print_queue_vault_model_id")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS vault_model_id")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS print_file_snapshot_path")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS piece_name")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS printer_id")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS filament_id")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS quantity")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS weight_grams")
    op.execute("ALTER TABLE print_queue DROP COLUMN IF EXISTS print_time_hours")
