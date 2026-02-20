"""
Esquemas Pydantic para la gestión de filamentos de impresión 3D.

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


class FilamentCreate(BaseModel):
    """
    Esquema para la creación de un nuevo filamento.

    Atributos:
        brand: Nombre del fabricante. Ej: eSun, Bambu, Polymaker, Prusament.
        type: Tipo de material. Ej: PLA, PETG, ABS, TPU, ASA, PA-CF.
        color: Descripción del color del filamento. Ej: Blanco, Azul marino.
        price_per_kg: Precio de compra por kilogramo en USD. Debe ser > 0.
        weight_per_roll: Peso neto del carrete en gramos. Por defecto 1000 g.
        diameter: Diámetro del filamento en mm. Por defecto 1.75 mm.
        density: Densidad del material en g/cm³. Por defecto 1.24 (PLA).
        notes: Notas opcionales.
    """

    brand: str
    type: str
    color: str
    price_per_kg: Decimal = Field(gt=0)
    weight_per_roll: Decimal = Field(default=Decimal("1000"), gt=0)
    diameter: Decimal = Field(default=Decimal("1.75"), gt=0)
    density: Decimal = Field(default=Decimal("1.24"), gt=0)
    notes: Optional[str] = None


class FilamentUpdate(BaseModel):
    """
    Esquema para la actualización parcial de un filamento existente.

    Todos los campos son opcionales; solo se actualizan los que se envíen.

    Atributos:
        brand: Nuevo nombre del fabricante (opcional).
        type: Nuevo tipo de material (opcional).
        color: Nuevo color (opcional).
        price_per_kg: Nuevo precio por kilogramo (opcional, > 0).
        weight_per_roll: Nuevo peso por carrete en gramos (opcional, > 0).
        diameter: Nuevo diámetro en mm (opcional, > 0).
        density: Nueva densidad en g/cm³ (opcional, > 0).
        notes: Nuevas notas (opcional).
    """

    brand: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    price_per_kg: Optional[Decimal] = Field(default=None, gt=0)
    weight_per_roll: Optional[Decimal] = Field(default=None, gt=0)
    diameter: Optional[Decimal] = Field(default=None, gt=0)
    density: Optional[Decimal] = Field(default=None, gt=0)
    notes: Optional[str] = None


class FilamentResponse(BaseModel):
    """
    Esquema de respuesta con los datos completos de un filamento.

    Los campos Decimal se serializan a float en JSON via PlainSerializer.

    Atributos:
        id: Identificador numérico único del filamento.
        brand: Nombre del fabricante.
        type: Tipo de material.
        color: Color del filamento.
        price_per_kg: Precio por kilogramo en USD.
        weight_per_roll: Peso del carrete en gramos.
        diameter: Diámetro en milímetros.
        density: Densidad en g/cm³.
        notes: Notas adicionales (puede ser None).
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de la última modificación.
    """

    id: int
    brand: str
    type: str
    color: str
    price_per_kg: DecimalAsFloat
    weight_per_roll: DecimalAsFloat
    diameter: DecimalAsFloat
    density: DecimalAsFloat
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
