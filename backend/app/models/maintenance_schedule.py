"""
Modelo ORM para recordatorios de mantenimiento por intervalo.

Define MaintenanceSchedule: un recordatorio recurrente ("Lubricar ejes XY
cada 300h") asociado a una impresora. El progreso hacia el vencimiento se
calcula en el schema de respuesta (schemas/maintenance.py), no se guarda
como columna.

Baseline al crear un schedule nuevo (issue #138): `last_done_at` se
inicializa en `created_at` y `last_done_hours` en `printer.current_hours`
al momento de la creación, de modo que el progreso arranca en 0% sin
necesitar NULL-handling especial en el cálculo. Al completarse (endpoint
`/complete` o al coincidir con un MaintenanceLog manual del mismo
`task_name`), ambos campos se resetean al estado actual de la impresora.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.printer import Printer


class MaintenanceSchedule(Base):
    """
    Recordatorio recurrente de mantenimiento para una impresora.

    Atributos:
        id:                PK autoincremental.
        printer_id:        FK a printers.id (CASCADE).
        task_name:         Nombre de la tarea. Ej: "Lubricar ejes XY".
        description:       Descripción opcional.
        interval_type:     'print_hours' o 'days'.
        interval_value:    Magnitud del intervalo en la unidad de interval_type. > 0.
        last_done_at:      Fecha del último "hecho" (o created_at si nunca se completó).
        last_done_hours:   Horas de la impresora en el último "hecho" (snapshot).
        enabled:           Si está activo (false = no cuenta para vencidos/badges).
        last_notified_at:  Última vez que se emitió maintenance.due para este
                            schedule (issue #137, evita spam — máx 1 vez/7 días).
        created_at/updated_at: Timestamps UTC.
        printer:           Relación con Printer.
    """

    __tablename__ = "maintenance_schedules"
    __table_args__ = (
        CheckConstraint(
            "interval_type IN ('print_hours', 'days')",
            name="ck_maintenance_schedules_interval_type",
        ),
        CheckConstraint(
            "interval_value > 0",
            name="ck_maintenance_schedules_interval_value_pos",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    printer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    interval_type: Mapped[str] = mapped_column(String(12), nullable=False)
    interval_value: Mapped[Decimal] = mapped_column(Numeric(8, 1), nullable=False)
    last_done_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_done_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    last_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    printer: Mapped["Printer"] = relationship("Printer")
