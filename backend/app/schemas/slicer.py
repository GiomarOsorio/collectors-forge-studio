"""
Schemas Pydantic para el módulo Slicer.

Define los modelos de validación y serialización para los trabajos de
laminado 3D: solicitudes de entrada (MakerWorld URL, parámetros de STL)
y respuestas de la API (detalle y lista de SlicingJob).
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, field_validator


@dataclass
class SliceResult:
    """
    Resultado interno de parsear un archivo .gcode o .3mf.

    Devuelto por los servicios slicer_parser y por el microservicio
    OrcaSlicer. Contiene todos los metadatos extraídos del encabezado
    del G-code generado.
    """
    print_time_seconds: Optional[int] = None
    filament_weight_g: Optional[float] = None
    filament_type: Optional[str] = None
    layer_height_mm: Optional[float] = None
    nozzle_temp: Optional[int] = None
    bed_temp: Optional[int] = None


class MakerworldRequest(BaseModel):
    """Solicitud para extraer datos de un modelo de MakerWorld."""
    url: str


class SlicingJobResponse(BaseModel):
    """Respuesta completa de un trabajo de laminado."""

    id: int
    company_id: str
    source: str
    original_filename: Optional[str] = None
    makerworld_url: Optional[str] = None
    makerworld_model_id: Optional[str] = None
    status: str
    print_time_seconds: Optional[int] = None
    filament_weight_g: Optional[Decimal] = None
    filament_type: Optional[str] = None
    layer_height_mm: Optional[Decimal] = None
    nozzle_temp: Optional[int] = None
    bed_temp: Optional[int] = None
    model_x_mm: Optional[Decimal] = None
    model_y_mm: Optional[Decimal] = None
    model_z_mm: Optional[Decimal] = None
    printer_preset: Optional[str] = None
    filament_preset: Optional[str] = None
    config_preset: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("company_id", mode="before")
    @classmethod
    def uuid_to_str(cls, v):
        """Convierte UUID a string para la serialización JSON."""
        return str(v)

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class SlicingJobListResponse(BaseModel):
    """Lista paginada de trabajos de laminado."""
    items: List[SlicingJobResponse]
    total: int
