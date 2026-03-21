"""
Modelo ORM para trabajos de laminado (slicing) 3D.

Define la entidad SlicingJob que representa un trabajo de laminado
realizado por el servidor. Puede originarse de: subida de STL (que se
lamina con OrcaSlicer en el contenedor slicer), subida de .gcode/.3mf
ya laminado por Bambu Studio, o URL de MakerWorld para extraer estimaciones.

Almacena los resultados: tiempo de impresión, gramos de filamento, tipo
de material, temperaturas y dimensiones del modelo.

Se vincula a la empresa mediante company_id (multi-tenant).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import String, Numeric, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID

from app.database import Base


class SlicingJob(Base):
    """
    Trabajo de laminado 3D.

    Registra cada solicitud de laminado o extracción de metadatos de un
    archivo 3D. El campo source indica el origen del trabajo. El campo
    status evoluciona de 'pending' → 'slicing' → 'done' (o 'error').

    Para trabajos de tipo 'upload_stl', el laminado ocurre de forma
    asíncrona en el contenedor OrcaSlicer. Para los demás tipos, el
    resultado se obtiene de forma inmediata al parsear el archivo.
    """

    __tablename__ = "slicing_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # Origen del trabajo
    source: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    # Valores posibles: "upload_stl", "upload_gcode", "upload_3mf", "makerworld"

    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    makerworld_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    makerworld_model_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Estado del trabajo
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # Valores posibles: "pending", "slicing", "done", "error"

    # Resultados del laminado
    print_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    filament_weight_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    filament_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    layer_height_mm: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3), nullable=True)
    nozzle_temp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bed_temp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Dimensiones del modelo (bounding box)
    model_x_mm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    model_y_mm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    model_z_mm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)

    # Configuración de laminado usada (cuando source="upload_stl")
    printer_preset: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    filament_preset: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    config_preset: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Datos por placa (multi-placa .3mf)
    plates_data: Mapped[Optional[list]] = mapped_column(
        JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False
    )

    # Mensaje de error si el laminado falló
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
