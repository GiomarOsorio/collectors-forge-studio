"""
Esquemas Pydantic para la app de Mantenimiento de Impresoras.

Define los modelos de validación y serialización para crear, actualizar
y retornar impresoras de mantenimiento, registros de mantenimiento,
ítems de mantenimiento y el resumen del dashboard.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional, Dict, Any

from pydantic import BaseModel, Field, PlainSerializer

# Decimal internamente -> float en JSON
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


# ─── MaintenancePrinter ──────────────────────────────────────────────────────

class MaintenancePrinterCreate(BaseModel):
    """Datos para crear una impresora en el módulo de mantenimiento."""
    name: str = Field(min_length=1, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    current_hours: DecimalAsFloat = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class MaintenancePrinterUpdate(BaseModel):
    """Datos para actualizar una impresora (todos opcionales)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    current_hours: Optional[DecimalAsFloat] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class MaintenancePrinterResponse(BaseModel):
    """Respuesta de impresora de mantenimiento."""
    id: int
    name: str
    model: Optional[str]
    current_hours: DecimalAsFloat
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── MaintenanceLogItem ───────────────────────────────────────────────────────

class MaintenanceLogItemCreate(BaseModel):
    """Datos para un ítem usado en un registro de mantenimiento."""
    inventory_item_id: Optional[int] = None
    name: str = Field(min_length=1, max_length=200)
    quantity: DecimalAsFloat = Field(gt=0)
    unit_cost: DecimalAsFloat = Field(ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class MaintenanceLogItemResponse(BaseModel):
    """Respuesta de ítem de mantenimiento."""
    id: int
    inventory_item_id: Optional[int]
    name: str
    quantity: DecimalAsFloat
    unit_cost: DecimalAsFloat
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ─── MaintenanceLog ───────────────────────────────────────────────────────────

class MaintenanceLogCreate(BaseModel):
    """Datos para crear un registro de mantenimiento."""
    printer_id: int
    hours_at_maintenance: DecimalAsFloat = Field(ge=0)
    maintenance_type: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    performed_at: Optional[datetime] = None
    items: List[MaintenanceLogItemCreate] = Field(default_factory=list)


class MaintenanceLogResponse(BaseModel):
    """Respuesta de registro de mantenimiento con ítems y printer."""
    id: int
    printer_id: int
    hours_at_maintenance: DecimalAsFloat
    maintenance_type: str
    description: Optional[str]
    performed_at: datetime
    created_at: datetime
    items: List[MaintenanceLogItemResponse] = []
    printer: Optional[MaintenancePrinterResponse] = None

    model_config = {"from_attributes": True}


# ─── Summary (Dashboard) ──────────────────────────────────────────────────────

class MaintenanceLastEntry(BaseModel):
    """Último registro de un tipo de mantenimiento para una impresora."""
    log_id: int
    performed_at: datetime
    hours_at_maintenance: DecimalAsFloat
    hours_since: Optional[DecimalAsFloat]  # horas desde el último mantenimiento


class MaintenancePrinterSummary(BaseModel):
    """Resumen de una impresora con el último mantenimiento por tipo."""
    printer: MaintenancePrinterResponse
    last_per_type: Dict[str, MaintenanceLastEntry]
