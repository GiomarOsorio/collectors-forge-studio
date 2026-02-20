"""
Esquemas Pydantic para la gestión de impresoras 3D.

Todos los campos financieros y de tiempo usan Decimal internamente y se
serializan a float en JSON via PlainSerializer.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class PrinterCreate(BaseModel):
    """
    Esquema para el registro de una nueva impresora 3D.

    Atributos:
        name: Nombre personalizado dado por el usuario. Ej: "Mi BambuLab P1S".
        model: Modelo comercial. Ej: "BambuLab P1S Combo".
        purchase_price: Precio de compra en USD (>= 0).
        power_consumption_watts: Consumo eléctrico promedio en vatios (>= 0).
        estimated_lifespan_hours: Vida útil estimada en horas (> 0).
        current_hours: Horas de uso acumuladas al registrar (>= 0).
        nozzle_price: Precio de reemplazo de la boquilla en USD (>= 0).
        nozzle_lifespan_hours: Vida útil de la boquilla en horas (> 0).
        buildplate_price: Precio de reemplazo de la placa en USD (>= 0).
        buildplate_lifespan_hours: Vida útil de la placa en horas (> 0).
        other_maintenance_per_hour: Otros costos de mantenimiento por hora (>= 0).
        notes: Notas opcionales sobre la impresora.
    """

    name: str
    model: str
    purchase_price: Decimal = Field(ge=0)
    power_consumption_watts: Decimal = Field(ge=0)
    estimated_lifespan_hours: Decimal = Field(gt=0)
    current_hours: Decimal = Field(default=Decimal("0"), ge=0)
    nozzle_price: Decimal = Field(default=Decimal("0"), ge=0)
    nozzle_lifespan_hours: Decimal = Field(default=Decimal("500"), gt=0)
    buildplate_price: Decimal = Field(default=Decimal("0"), ge=0)
    buildplate_lifespan_hours: Decimal = Field(default=Decimal("2000"), gt=0)
    other_maintenance_per_hour: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None


class PrinterUpdate(BaseModel):
    """
    Esquema para la actualización parcial de una impresora existente.

    Todos los campos son opcionales; solo se actualizan los que se envíen.

    Atributos:
        name: Nuevo nombre personalizado (opcional).
        model: Nuevo modelo comercial (opcional).
        purchase_price: Nuevo precio de compra (opcional, >= 0).
        power_consumption_watts: Nuevo consumo en vatios (opcional, >= 0).
        estimated_lifespan_hours: Nueva vida útil en horas (opcional, > 0).
        current_hours: Nuevas horas acumuladas (opcional, >= 0).
        nozzle_price: Nuevo precio de boquilla (opcional, >= 0).
        nozzle_lifespan_hours: Nueva vida útil de boquilla (opcional, > 0).
        buildplate_price: Nuevo precio de placa (opcional, >= 0).
        buildplate_lifespan_hours: Nueva vida útil de placa (opcional, > 0).
        other_maintenance_per_hour: Otros costos por hora (opcional, >= 0).
        notes: Nuevas notas (opcional).
    """

    name: Optional[str] = None
    model: Optional[str] = None
    purchase_price: Optional[Decimal] = Field(default=None, ge=0)
    power_consumption_watts: Optional[Decimal] = Field(default=None, ge=0)
    estimated_lifespan_hours: Optional[Decimal] = Field(default=None, gt=0)
    current_hours: Optional[Decimal] = Field(default=None, ge=0)
    nozzle_price: Optional[Decimal] = Field(default=None, ge=0)
    nozzle_lifespan_hours: Optional[Decimal] = Field(default=None, gt=0)
    buildplate_price: Optional[Decimal] = Field(default=None, ge=0)
    buildplate_lifespan_hours: Optional[Decimal] = Field(default=None, gt=0)
    other_maintenance_per_hour: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class PrinterResponse(BaseModel):
    """
    Esquema de respuesta con los datos completos de una impresora.

    Los campos Decimal se serializan a float en JSON via PlainSerializer.

    Atributos:
        id: Identificador numérico único de la impresora.
        name: Nombre personalizado de la impresora.
        model: Modelo comercial.
        purchase_price: Precio de compra en USD.
        power_consumption_watts: Consumo eléctrico en vatios.
        estimated_lifespan_hours: Vida útil estimada en horas.
        current_hours: Horas de uso acumuladas.
        nozzle_price: Precio de la boquilla en USD.
        nozzle_lifespan_hours: Vida útil de la boquilla en horas.
        buildplate_price: Precio de la placa en USD.
        buildplate_lifespan_hours: Vida útil de la placa en horas.
        other_maintenance_per_hour: Otros costos de mantenimiento por hora.
        notes: Notas adicionales (puede ser None).
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de la última modificación.
    """

    id: int
    name: str
    model: str
    purchase_price: DecimalAsFloat
    power_consumption_watts: DecimalAsFloat
    estimated_lifespan_hours: DecimalAsFloat
    current_hours: DecimalAsFloat
    nozzle_price: DecimalAsFloat
    nozzle_lifespan_hours: DecimalAsFloat
    buildplate_price: DecimalAsFloat
    buildplate_lifespan_hours: DecimalAsFloat
    other_maintenance_per_hour: DecimalAsFloat
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
