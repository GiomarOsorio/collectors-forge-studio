"""Schemas Pydantic para perfiles de impresión (slicer) de filamento."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class FilamentProfileUpsert(BaseModel):
    """Crear o actualizar el perfil de slicer de un filamento (todos opcionales)."""
    nozzle_temp_min: Optional[int] = Field(default=None, ge=0, le=400)
    nozzle_temp_max: Optional[int] = Field(default=None, ge=0, le=400)
    bed_temp: Optional[int] = Field(default=None, ge=0, le=200)
    bed_temp_first_layer: Optional[int] = Field(default=None, ge=0, le=200)
    print_speed_mms: Optional[Decimal] = Field(default=None, ge=0)
    retraction_distance_mm: Optional[Decimal] = Field(default=None, ge=0)
    retraction_speed_mms: Optional[Decimal] = Field(default=None, ge=0)
    flow_ratio: Optional[Decimal] = Field(default=None, gt=0)
    fan_speed_percent: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None


class FilamentProfileResponse(BaseModel):
    """Perfil de slicer completo, tal como está en BD."""
    id: int
    inventory_item_id: int
    nozzle_temp_min: Optional[int]
    nozzle_temp_max: Optional[int]
    bed_temp: Optional[int]
    bed_temp_first_layer: Optional[int]
    print_speed_mms: Optional[DecimalAsFloat] = None
    retraction_distance_mm: Optional[DecimalAsFloat] = None
    retraction_speed_mms: Optional[DecimalAsFloat] = None
    flow_ratio: Optional[DecimalAsFloat] = None
    fan_speed_percent: Optional[int]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
