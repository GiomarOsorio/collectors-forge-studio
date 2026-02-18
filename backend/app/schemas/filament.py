from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FilamentCreate(BaseModel):
    brand: str
    type: str
    color: str
    price_per_kg: float
    weight_per_roll: float = 1000.0
    diameter: float = 1.75
    density: float = 1.24
    notes: Optional[str] = None


class FilamentUpdate(BaseModel):
    brand: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    price_per_kg: Optional[float] = None
    weight_per_roll: Optional[float] = None
    diameter: Optional[float] = None
    density: Optional[float] = None
    notes: Optional[str] = None


class FilamentResponse(BaseModel):
    id: int
    brand: str
    type: str
    color: str
    price_per_kg: float
    weight_per_roll: float
    diameter: float
    density: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
