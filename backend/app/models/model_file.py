"""
Modelo ORM para la tabla de archivos del Vault.

Representa un archivo .3mf almacenado en MinIO junto con sus metadatos
de display (nombre, descripción, fuente, tags). Cada archivo pertenece
a una empresa (multi-tenant) y solo los usuarios de esa empresa pueden
acceder a él.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, BigInteger, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class ModelFile(Base):
    """
    Archivo .3mf almacenado en MinIO con metadatos de display.

    Atributos:
        id:              PK autoincremental.
        company_id:      UUID de la empresa propietaria (multi-tenant).
        uploaded_by:     ID del usuario que subió el archivo (nullable al borrar usuario).
        file_key:        Clave del objeto en MinIO: "{company_id}/{uuid}-{filename}.3mf".
        file_name:       Nombre original del archivo tal como fue subido.
        file_size:       Tamaño en bytes del archivo almacenado.
        name:            Nombre de display editable por el usuario.
        description:     Descripción libre del modelo (opcional).
        thumbnail_url:   URL externa de miniatura (MakerWorld/Printables), no se descarga.
        local_thumbnail_path: Ruta interna al PNG de plate render extraído del .3mf
                              (sirve `/static/thumbnails/{id}.png`). Tiene prioridad sobre
                              thumbnail_url al renderizar en frontend.
        tags:            Array JSONB de etiquetas de texto libre.
        source_url:      URL de origen del modelo (MakerWorld, Printables, etc.).
        source_platform: Plataforma de origen ('makerworld'|'printables'|'thingiverse'|'otro').
        creator_name:    Nombre del creador del modelo original.
        creator_url:     URL del perfil del creador.
        created_at:      Timestamp UTC de creación.
        updated_at:      Timestamp UTC de última modificación.
    """

    __tablename__ = "model_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uploaded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    local_thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    source_platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    creator_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    creator_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
