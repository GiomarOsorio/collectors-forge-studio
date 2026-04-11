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

    Atributos:
        name:        Nombre del producto impreso (requerido, max 200 caracteres).
        category:    Categoría del producto (opcional). Ej: "Llaveros", "Figuras".
        description: Descripción detallada del producto (opcional).
        image_url:   URL relativa de la imagen de referencia (opcional).
        quantity:    Cantidad disponible en stock (default 0).
        unit_price:  Precio de venta unitario (opcional).
        material:    Material utilizado en la impresión (opcional). Ej: PLA, PETG.
        color:       Color del filamento utilizado (opcional).
    """

    name: str = Field(min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    quantity: int = Field(default=0, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)


class PrintedItemUpdate(BaseModel):
    """
    Datos opcionales para actualizar un ítem de impresión (PUT parcial).

    Todos los campos son opcionales. Solo se actualizan los que se envíen.

    Atributos:
        name:        Nuevo nombre del producto.
        category:    Nueva categoría.
        description: Nueva descripción.
        image_url:   Nueva URL de imagen.
        quantity:    Nueva cantidad en stock.
        unit_price:  Nuevo precio de venta unitario.
        material:    Nuevo material utilizado.
        color:       Nuevo color del filamento.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    quantity: Optional[int] = Field(default=None, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)


class PrintedItemResponse(BaseModel):
    """
    Datos completos de un ítem de impresión (respuesta de la API).

    Atributos:
        id:          Identificador único del ítem.
        company_id:  UUID de la empresa propietaria.
        name:        Nombre del producto impreso.
        category:    Categoría del producto.
        description: Descripción detallada.
        image_url:   URL relativa de la imagen de referencia.
        quantity:    Cantidad disponible en stock.
        unit_price:  Precio de venta unitario.
        material:    Material utilizado en la impresión.
        color:       Color del filamento utilizado.
        created_at:  Fecha y hora de creación del registro.
        updated_at:  Fecha y hora de la última actualización.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: Optional[str]
    description: Optional[str]
    image_url: Optional[str]
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
    Respuesta tras subir la imagen de un ítem de impresión.

    Atributos:
        image_url: URL relativa de la imagen guardada en el servidor.
    """

    image_url: str
