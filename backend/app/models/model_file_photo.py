"""
Modelo ORM para fotos adjuntas a un archivo del Vault.

Documentación técnica del resultado de una impresión (foto del objeto
terminado, de un fallo de adhesión, etc.) — distinto de `PrintedItem`
(catálogo comercial de piezas listas para vender, sin relación con
`ModelFile`). Ambos modelos coexisten a propósito, ver issue #130.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModelFilePhoto(Base):
    """
    Foto adjunta a un `ModelFile` del Vault.

    Atributos:
        id:            PK autoincremental.
        model_file_id: FK a `model_files.id` (cascade delete).
        minio_key:     Clave del objeto en MinIO (`photos/{model_file_id}/{uuid}.{ext}`).
        caption:       Descripción corta opcional (ej. "Fallo de adhesión en capa 40").
        created_at:    Timestamp UTC de subida.
    """

    __tablename__ = "model_file_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_file_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("model_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    minio_key: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
