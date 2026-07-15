"""
Modelo ORM para el historial de imports de MakerWorld (issue #139).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MakerworldImport(Base):
    """
    Registro de un import completado desde MakerWorld — alimenta
    `GET /makerworld/recent` (últimos 10).

    Atributos:
        id:              PK autoincremental.
        design_id:       ID entero del diseño en MakerWorld (`/models/{id}`).
        profile_id:      ID de la instancia/plate importada.
        title:           Título del diseño al momento del import (snapshot;
                          no se re-sincroniza si MakerWorld lo cambia después).
        model_file_id:   FK opcional a `model_files.id` (SET NULL si se borra
                          el archivo — el registro de "importado alguna vez"
                          sobrevive aunque el archivo ya no exista).
        created_at:      Timestamp UTC del import.
    """

    __tablename__ = "makerworld_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    design_id: Mapped[int] = mapped_column(Integer, nullable=False)
    profile_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    model_file_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("model_files.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
