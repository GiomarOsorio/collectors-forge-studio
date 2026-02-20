"""
Esquemas Pydantic para órdenes de compra y sus ítems.

Define los modelos de validación y serialización para crear, actualizar
y retornar órdenes de compra con sus líneas de ítems. Los campos monetarios
y de cantidad usan Decimal internamente y se serializan como float en JSON.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, PlainSerializer

# Decimal internamente -> float en JSON (serialización explícita)
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class PurchaseOrderItemCreate(BaseModel):
    """
    Datos para crear una línea de ítem dentro de una orden de compra.

    Atributos:
        name:              Nombre o descripción del artículo.
        quantity:          Cantidad solicitada.
        unit_cost:         Costo unitario en USD (default 0).
        inventory_item_id: ID del ítem de inventario vinculado (opcional).
        notes:             Notas adicionales (opcional).
    """
    name: str = Field(min_length=1, max_length=200)
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(default=Decimal("0"), ge=0)
    inventory_item_id: Optional[int] = None
    notes: Optional[str] = None


class PurchaseOrderItemResponse(BaseModel):
    """
    Datos completos de una línea de ítem de una orden de compra.

    Atributos:
        id:                Identificador único de la línea.
        order_id:          ID de la orden de compra padre.
        inventory_item_id: ID del ítem de inventario vinculado (o null).
        name:              Nombre del artículo.
        quantity:          Cantidad solicitada.
        unit_cost:         Costo unitario.
        notes:             Notas adicionales.
    """
    id: int
    order_id: int
    inventory_item_id: Optional[int]
    name: str
    quantity: DecimalAsFloat
    unit_cost: DecimalAsFloat
    notes: Optional[str]

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    """
    Datos para crear una nueva orden de compra con sus ítems.

    Atributos:
        supplier:          Nombre del proveedor (requerido).
        tracking_number:   Número de seguimiento del envío (opcional).
        carrier:           Transportista (opcional).
        estimated_arrival: Fecha estimada de llegada (opcional).
        notes:             Notas adicionales (opcional).
        items:             Lista de ítems del pedido (al menos 1).
    """
    supplier: str = Field(min_length=1, max_length=200)
    tracking_number: Optional[str] = Field(default=None, max_length=200)
    carrier: Optional[str] = Field(default=None, max_length=100)
    estimated_arrival: Optional[date] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    """
    Datos opcionales para actualizar una orden de compra (sin ítems).

    Todos los campos son opcionales. Solo se actualizan los que se envíen.

    Atributos:
        supplier:          Nuevo nombre del proveedor.
        tracking_number:   Nuevo número de seguimiento.
        carrier:           Nuevo transportista.
        status:            Nuevo estado (pendiente, en_transito, llegado, cancelado).
        estimated_arrival: Nueva fecha estimada de llegada.
        notes:             Nuevas notas.
    """
    supplier: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tracking_number: Optional[str] = Field(default=None, max_length=200)
    carrier: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, max_length=50)
    estimated_arrival: Optional[date] = None
    notes: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    """
    Datos completos de una orden de compra con sus ítems.

    Atributos:
        id:                Identificador único de la orden.
        supplier:          Nombre del proveedor.
        tracking_number:   Número de seguimiento.
        carrier:           Transportista.
        status:            Estado actual de la orden.
        estimated_arrival: Fecha estimada de llegada.
        notes:             Notas adicionales.
        arrived_at:        Fecha y hora real de llegada (null si no ha llegado).
        created_at:        Fecha y hora de creación.
        items:             Lista de ítems del pedido.
    """
    id: int
    supplier: str
    tracking_number: Optional[str]
    carrier: Optional[str]
    status: str
    estimated_arrival: Optional[date]
    notes: Optional[str]
    arrived_at: Optional[datetime]
    created_at: datetime
    items: List[PurchaseOrderItemResponse] = []

    model_config = {"from_attributes": True}
