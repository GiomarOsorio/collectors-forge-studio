"""
Esquemas Pydantic para los insumos adicionales de collectors-forge-studio.

Todos los campos financieros usan Decimal internamente y se serializan
a float en JSON via PlainSerializer.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class SupplyCreate(BaseModel):
    """
    Esquema para crear un nuevo insumo en el catálogo.

    Si se proporcionan pack_qty y pack_price, el backend calcula
    price_per_unit = pack_price / pack_qty automáticamente.
    """
    name: str
    description: Optional[str] = None
    unit: str = "unidad"
    pack_qty: Optional[int] = None
    pack_price: Optional[Decimal] = Field(default=None, ge=0)
    price_per_unit: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class SupplyUpdate(BaseModel):
    """Esquema para actualizar parcialmente un insumo existente."""
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    pack_qty: Optional[int] = None
    pack_price: Optional[Decimal] = Field(default=None, ge=0)
    price_per_unit: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class SupplyResponse(BaseModel):
    """Esquema de respuesta con los datos completos de un insumo."""
    id: int
    name: str
    description: Optional[str]
    unit: str
    pack_qty: Optional[int]
    pack_price: Optional[DecimalAsFloat]
    price_per_unit: DecimalAsFloat
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplyItem(BaseModel):
    """
    Insumo con cantidad para incluir en una cotización.

    Atributos:
        supply_id: ID del insumo del catálogo.
        quantity:  Cantidad de unidades del insumo por pieza impresa.
    """
    supply_id: int
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
