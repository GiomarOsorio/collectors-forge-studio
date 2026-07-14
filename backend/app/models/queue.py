"""
Modelo ORM para la cola de impresión de Collector's Forge.

Define `PrintQueueItem`, que representa un trabajo de impresión en cola.
Un ítem puede provenir de dos fuentes distintas (mutuamente excluyentes):

- **Quote** (camino histórico): `quote_id` apunta a una cotización guardada.
  Los datos de display (pieza, impresora, peso, tiempo) se cargan desde
  la cotización en cada request.
- **Vault** (chunk C): `vault_model_id` apunta a un `ModelFile` con
  `print_file` (.gcode.3mf laminado). Los datos de display + el path
  al .gcode.3mf snapshot (`print_file_snapshot_path`) y los parámetros
  de impresión seleccionados (`printer_id`, `filament_id`, `quantity`,
  `weight_grams`, `print_time_hours`, `piece_name`) se almacenan
  denormalizados en el propio ítem para que cambios futuros en el
  Vault no rompan items ya encolados.

Al marcar como 'done' se descuenta el inventario del filamento elegido y
se suman las horas a la impresora — funciona para ambos caminos.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PrintQueueItem(Base):
    """
    Ítem de la cola de impresión.

    Representa un trabajo de impresión pendiente, en proceso o completado.
    Puede provenir de una cotización (Quote) o de un modelo del Vault con
    `.gcode.3mf` laminado.

    Estados posibles: 'pending' | 'printing' | 'done' | 'cancelled'

    Atributos:
        id:                       PK autoincremental.
        quote_id:                 FK opcional a quotes.id (SET NULL si se borra la cotización).
        vault_model_id:           FK opcional a model_files.id (SET NULL si se borra el modelo).
        print_file_snapshot_path: Path MinIO del `.gcode.3mf` congelado al
                                  momento de encolar (solo vault items).
        piece_name:               Nombre denormalizado de la pieza (solo vault items).
        printer_id:               FK a printers.id (solo vault items; en quote items
                                  se deriva del quote.printer_id).
        filament_id:              FK opcional a inventory_items.id (solo vault items).
        quantity:                 Cantidad de copias (solo vault items; quote items
                                  usan quote.quantity).
        weight_grams:             Peso por copia (solo vault items; quote items
                                  usan quote.weight_grams).
        print_time_hours:         Tiempo de impresión por copia (solo vault items).
        status:                   Estado actual del trabajo en cola.
        position:                 Orden en la cola de espera (menor = primero).
        started_at:               Momento en que pasó a 'printing'.
        completed_at:             Momento en que pasó a 'done' o 'cancelled'.
        notes:                    Notas libres sobre el trabajo.
        failure_reason:           Motivo de cancelación en texto libre (opcional).
        failure_category:         Categoría fija del motivo de cancelación (opcional).
        created_at:               Timestamp UTC de creación.
    """

    __tablename__ = "print_queue"
    __table_args__ = (
        # Un ítem viene de un quote O de un vault model (al menos uno).
        # quote_id puede ser NULL si el quote se borra después (ondelete=SET NULL),
        # idem vault_model_id, así que esto solo valida la creación inicial.
        CheckConstraint(
            "quote_id IS NOT NULL OR vault_model_id IS NOT NULL "
            "OR (status IN ('done', 'cancelled'))",
            name="ck_print_queue_has_source",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Fuente: Quote (camino histórico) ────────────────────────────────────
    quote_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Fuente: Vault model (chunk C) — datos denormalizados ───────────────
    vault_model_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("model_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    print_file_snapshot_path: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    piece_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    printer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("printers.id", ondelete="SET NULL"), nullable=True
    )
    filament_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight_grams: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    print_time_hours: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4), nullable=True
    )

    # ── Proyecto (agrupador opcional, aplica a items de cualquier fuente) ──
    project_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Estado de cola ──────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── Motivo de cancelación (issue #130) — opcional, solo aplica cuando
    # status='cancelled'. Alimenta el historial por modelo del Vault y el
    # futuro epic de Stats. failure_category es una de 6 categorías fijas
    # (ver schemas.queue.FailureCategory); failure_reason es texto libre.
    failure_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    failure_category: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    @property
    def is_vault_item(self) -> bool:
        """True si el ítem proviene del Vault (en vez de un Quote)."""
        return self.vault_model_id is not None
