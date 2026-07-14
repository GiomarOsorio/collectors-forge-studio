"""
Esquemas Pydantic para la app de Mantenimiento de Impresoras.

Las impresoras usan directamente PrinterResponse del schema de la
app Cost; no hay schemas separados para impresoras de mantenimiento.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional, Dict

from pydantic import BaseModel, Field, PlainSerializer

from app.schemas.printer import PrinterResponse

# Decimal internamente -> float en JSON
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


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
    # issue #138: schedules a marcar como "hechos" en la misma transacción
    # (además del auto-match por task_name == maintenance_type).
    schedule_ids: List[int] = Field(default_factory=list)


class MaintenanceLogUpdate(BaseModel):
    """Campos editables de un registro (no modifica ítems ni impresora)."""
    performed_at: datetime
    hours_at_maintenance: DecimalAsFloat = Field(ge=0)
    maintenance_type: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)


class MaintenanceLogResponse(BaseModel):
    """Respuesta de registro de mantenimiento con ítems e impresora."""
    id: int
    printer_id: int
    hours_at_maintenance: DecimalAsFloat
    maintenance_type: str
    description: Optional[str]
    performed_at: datetime
    created_at: datetime
    items: List[MaintenanceLogItemResponse] = []
    printer: Optional[PrinterResponse] = None
    matched_schedules: List[int] = []

    model_config = {"from_attributes": True}


# ─── Summary (Dashboard) ──────────────────────────────────────────────────────

class MaintenanceLastEntry(BaseModel):
    """Último registro de un tipo de mantenimiento para una impresora."""
    log_id: int
    performed_at: datetime
    hours_at_maintenance: DecimalAsFloat
    hours_since: Optional[DecimalAsFloat]


class MaintenancePrinterSummary(BaseModel):
    """Resumen de una impresora con el último mantenimiento por tipo."""
    printer: PrinterResponse
    last_per_type: Dict[str, MaintenanceLastEntry]


# ─── MaintenanceSchedule (issue #138) ─────────────────────────────────────────

ScheduleStatus = Literal["ok", "due_soon", "overdue"]


class MaintenanceScheduleCreate(BaseModel):
    """Datos para crear un recordatorio de mantenimiento."""
    printer_id: int
    task_name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    interval_type: Literal["print_hours", "days"]
    interval_value: DecimalAsFloat = Field(gt=0)


class MaintenanceScheduleUpdate(BaseModel):
    """Campos editables de un recordatorio (no reasigna la impresora)."""
    task_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    interval_type: Optional[Literal["print_hours", "days"]] = None
    interval_value: Optional[DecimalAsFloat] = Field(default=None, gt=0)
    enabled: Optional[bool] = None


class MaintenanceScheduleResponse(BaseModel):
    """Respuesta de un recordatorio con progreso calculado hacia el vencimiento."""
    id: int
    printer_id: int
    printer_name: Optional[str] = None
    task_name: str
    description: Optional[str]
    interval_type: Literal["print_hours", "days"]
    interval_value: DecimalAsFloat
    last_done_at: datetime
    last_done_hours: DecimalAsFloat
    enabled: bool
    created_at: datetime
    updated_at: datetime
    progress_pct: DecimalAsFloat
    status: ScheduleStatus

    model_config = {"from_attributes": True}
