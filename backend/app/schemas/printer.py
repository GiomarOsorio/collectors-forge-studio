from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PrinterCreate(BaseModel):
    name: str
    model: str
    purchase_price: float
    power_consumption_watts: float
    estimated_lifespan_hours: float
    current_hours: float = 0.0
    nozzle_price: float = 0.0
    nozzle_lifespan_hours: float = 500.0
    buildplate_price: float = 0.0
    buildplate_lifespan_hours: float = 2000.0
    other_maintenance_per_hour: float = 0.0
    notes: Optional[str] = None


class PrinterUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    purchase_price: Optional[float] = None
    power_consumption_watts: Optional[float] = None
    estimated_lifespan_hours: Optional[float] = None
    current_hours: Optional[float] = None
    nozzle_price: Optional[float] = None
    nozzle_lifespan_hours: Optional[float] = None
    buildplate_price: Optional[float] = None
    buildplate_lifespan_hours: Optional[float] = None
    other_maintenance_per_hour: Optional[float] = None
    notes: Optional[str] = None


class PrinterResponse(BaseModel):
    id: int
    name: str
    model: str
    purchase_price: float
    power_consumption_watts: float
    estimated_lifespan_hours: float
    current_hours: float
    nozzle_price: float
    nozzle_lifespan_hours: float
    buildplate_price: float
    buildplate_lifespan_hours: float
    other_maintenance_per_hour: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
