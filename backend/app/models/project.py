"""
Modelo ORM para proyectos — agrupador de ítems de la cola de impresión.

Un `Project` agrupa varios `PrintQueueItem` (vía `PrintQueueItem.project_id`)
para llevar el progreso de un encargo con varias impresiones (ej. "10
figuras para el cliente X"). No participa en cálculos de costo ni de
inventario — es puramente organizativo.

Metadata (issue #136, sub-ticket 1/3): cover photo, color, link externo
y vínculo opcional a una cotización de cliente ya existente.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    """
    Proyecto — agrupador de trabajos de la cola de impresión.

    Atributos:
        id:               PK autoincremental.
        name:             Nombre del proyecto.
        client_name:      Cliente asociado (texto libre — no existe entidad
                          Cliente en el sistema; mismo patrón que `Quote.client_name`).
        status:           'active' | 'completed' | 'archived'. Default 'active'.
        notes:            Notas libres del proyecto.
        cover_photo_key:  Key en MinIO de la foto de portada (mismo patrón
                          que `ModelFile.thumbnail_key` — un solo archivo,
                          servido vía proxy `GET /{id}/cover`, no una colección).
        color:            Hex `#RRGGBB` para el badge/acento visual de la card.
                          NULL = usa el color por defecto de la app Proyectos.
        external_url:     Link externo (MakerWorld, Printables, pedido del
                          cliente, etc.) — se renderiza como link clicable.
        client_quote_id:  FK opcional a `client_quotes.id` (SET NULL) — vínculo
                          formal a una cotización ya emitida. El código
                          "COT-XXXX" se calcula desde el id (mismo criterio
                          que en `pdf_generator.py`/`liquid_pdf.py`), no se
                          duplica como columna.
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
    cover_photo_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    external_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    client_quote_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("client_quotes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
