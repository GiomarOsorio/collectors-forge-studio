"""
Esquemas Pydantic para los insumos adicionales de Calculator3D.

Define los modelos de validación para las operaciones CRUD del catálogo
de insumos y el esquema SupplyItem usado en las solicitudes de cotización
para especificar qué insumos y en qué cantidad se incluyen.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


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
    pack_price: Optional[float] = None
    price_per_unit: Optional[float] = None
    notes: Optional[str] = None


class SupplyUpdate(BaseModel):
    """Esquema para actualizar parcialmente un insumo existente."""
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    pack_qty: Optional[int] = None
    pack_price: Optional[float] = None
    price_per_unit: Optional[float] = None
    notes: Optional[str] = None


class SupplyResponse(BaseModel):
    """Esquema de respuesta con los datos completos de un insumo."""
    id: int
    name: str
    description: Optional[str]
    unit: str
    pack_qty: Optional[int]
    pack_price: Optional[float]
    price_per_unit: float
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplyItem(BaseModel):
    """
    Insumo con cantidad para incluir en una cotización.

    Usado dentro de QuoteCalculateRequest para especificar los insumos
    adicionales de una pieza concreta y cuántos se necesitan por unidad.

    Atributos:
        supply_id: ID del insumo del catálogo.
        quantity:  Cantidad de unidades del insumo por pieza impresa.
    """
    supply_id: int
    quantity: float = 1.0
