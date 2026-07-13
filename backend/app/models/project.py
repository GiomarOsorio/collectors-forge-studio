"""
Modelo ORM para proyectos — agrupador de ítems de la cola de impresión.

Un `Project` agrupa varios `PrintQueueItem` (vía `PrintQueueItem.project_id`)
para llevar el progreso de un encargo con varias impresiones (ej. "10
figuras para el cliente X"). No participa en cálculos de costo ni de
inventario — es puramente organizativo.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    """
    Proyecto — agrupador de trabajos de la cola de impresión.

    Atributos:
        id:          PK autoincremental.
        name:        Nombre del proyecto.
        client_name: Cliente asociado (texto libre — no existe entidad
                     Cliente en el sistema; mismo patrón que `Quote.client_name`).
        status:      'active' | 'completed' | 'archived'. Default 'active'.
        notes:       Notas libres del proyecto.
        created_at, updated_at: Timestamps UTC.
    """

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'active'")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
