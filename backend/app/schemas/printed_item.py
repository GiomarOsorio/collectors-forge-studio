"""
Esquemas Pydantic para ítems de impresiones del inventario.

Define los modelos de validación y serialización para crear, actualizar
y retornar ítems de impresiones 3D. Los campos monetarios usan Decimal
internamente y se serializan como float en JSON.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


# Decimal internamente -> float en JSON (serialización explícita)
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class PrintedItemCreate(BaseModel):
    """
    Datos para crear un nuevo ítem de impresión en el inventario.

    La imagen no se envía en este payload: se sube luego vía
    `POST /api/inventory/prints/{id}/image` (formato multipart).
    """

    name: str = Field(min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    quantity: int = Field(default=0, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)


class PrintedItemUpdate(BaseModel):
    """
    Datos opcionales para actualizar un ítem (PUT parcial).

    La imagen se gestiona vía endpoints separados:
    `POST /api/inventory/prints/{id}/image` (subir / reemplazar).
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)


class PrintedItemResponse(BaseModel):
    """
    Datos completos de un ítem de impresión (respuesta de la API).

    `image_url` apunta al endpoint proxy
    (`/api/inventory/prints/{id}/image?v=<updated_at>`) que streamea el
    binario desde MinIO; vacío si el ítem no tiene imagen cargada.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: Optional[str]
    description: Optional[str]
    image_url: Optional[str] = None
    quantity: int
    unit_price: Optional[DecimalAsFloat]
    material: Optional[str]
    color: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None


class PrintedItemListResponse(BaseModel):
    """
    Respuesta paginada con la lista de ítems de impresiones.

    Atributos:
        items: Lista de ítems de impresión para la página actual.
        total: Total de ítems disponibles (sin paginación).
    """

    items: List[PrintedItemResponse]
    total: int


class PrintedItemSellRequest(BaseModel):
    """
    Solicitud para registrar la venta de unidades de un ítem de impresión.

    Atributos:
        quantity: Número de unidades vendidas (debe ser mayor que 0).
    """

    quantity: int = Field(gt=0)


class PrintedItemImageResponse(BaseModel):
    """
    Respuesta tras subir la imagen de un ítem.

    `image_url` apunta al endpoint proxy del binario en MinIO
    (`/api/inventory/prints/{id}/image?v=<updated_at>`).
    """

    image_url: str
