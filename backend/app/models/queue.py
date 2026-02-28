"""
Modelo ORM para la cola de impresión de TurtleForge.

Define PrintQueueItem, que representa un trabajo de impresión en cola.
Solo se pueden encolar impresiones que tengan un costo calculado (Quote).
Al marcar como 'done' se descuenta el inventario y se suman las horas a la impresora.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Integer, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class PrintQueueItem(Base):
    """
    Ítem de la cola de impresión.

    Representa un trabajo de impresión pendiente, en proceso o completado.
    Referencia opcionalmente a una cotización (Quote) — si la cotización
    se elimina, el campo quote_id queda NULL pero el historial se preserva.

    Estados posibles: 'pending' | 'printing' | 'done' | 'cancelled'

    Atributos:
        id:           PK autoincremental.
        company_id:   UUID de la empresa (multi-tenant).
        quote_id:     FK opcional a quotes.id (SET NULL si se borra la cotización).
        status:       Estado actual del trabajo en cola.
        position:     Orden en la cola de espera (menor = primero).
        started_at:   Momento en que pasó a 'printing'.
        completed_at: Momento en que pasó a 'done' o 'cancelled'.
        notes:        Notas libres sobre el trabajo.
        created_at:   Timestamp UTC de creación.
    """

    __tablename__ = "print_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    quote_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
