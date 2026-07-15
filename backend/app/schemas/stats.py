"""
Esquemas Pydantic para el dashboard de analytics de impresión y costos
(issue #132).

Todos los campos financieros/de peso usan Decimal internamente,
serializados a float en JSON via DecimalAsFloat.
"""

from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class FilamentGramsEntry(BaseModel):
    """Gramos consumidos y costo de material por tipo de filamento."""
    filament_type: str
    grams: DecimalAsFloat
    cost_cop: DecimalAsFloat


class PrinterStatsEntry(BaseModel):
    """Impresiones y horas acumuladas por impresora en el rango."""
    printer_id: int
    printer_name: str
    prints: int
    hours: DecimalAsFloat


class UserStatsEntry(BaseModel):
    """Impresiones (done + cancelled) atribuidas a un usuario en el rango."""
    user_id: Optional[int]
    username: str
    prints: int


class FailureBreakdownEntry(BaseModel):
    """Conteo de cancelaciones por categoría de fallo (issue #130)."""
    category: str
    count: int


class StatsOverviewResponse(BaseModel):
    """Resumen agregado del rango de fechas consultado."""
    prints_done: int
    prints_cancelled: int
    success_rate_pct: DecimalAsFloat
    total_hours: DecimalAsFloat
    grams_by_filament_type: List[FilamentGramsEntry]
    by_printer: List[PrinterStatsEntry]
    by_user: List[UserStatsEntry]
    failure_breakdown: List[FailureBreakdownEntry]
    material_cost_cop: DecimalAsFloat
    electricity_cost_cop: DecimalAsFloat


class StatsTrendPoint(BaseModel):
    """Un punto de la serie temporal (un bucket day/week/month)."""
    bucket_start: str
    prints_done: int
    prints_cancelled: int
    grams: DecimalAsFloat


class StatsTrendsResponse(BaseModel):
    """Serie temporal de impresiones y consumo de filamento."""
    bucket: str
    series: List[StatsTrendPoint]
