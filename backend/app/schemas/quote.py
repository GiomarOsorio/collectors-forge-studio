from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class QuoteCalculateRequest(BaseModel):
    piece_name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    filament_id: int
    printer_id: int
    weight_grams: float
    print_time_hours: float
    preparation_time_hours: float = 0.0
    post_processing_time_hours: float = 0.0
    quantity: int = 1
    margin_percent: Optional[float] = None  # Si es None, usa el default de settings
    save: bool = True  # Si guardar en historial


class QuoteCostBreakdown(BaseModel):
    material_cost: float
    electricity_cost: float
    depreciation_cost: float
    maintenance_cost: float
    labor_cost: float
    failure_cost: float
    subtotal: float
    margin_percent: float
    margin_amount: float
    total_per_unit: float
    quantity: int
    total_price: float


class QuoteResponse(BaseModel):
    id: int
    piece_name: str
    description: Optional[str]
    client_name: Optional[str]
    filament_id: int
    printer_id: int
    weight_grams: float
    print_time_hours: float
    preparation_time_hours: float
    post_processing_time_hours: float
    quantity: int
    material_cost: float
    electricity_cost: float
    depreciation_cost: float
    maintenance_cost: float
    labor_cost: float
    failure_cost: float
    subtotal: float
    margin_percent: float
    margin_amount: float
    total_per_unit: float
    total_price: float
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
