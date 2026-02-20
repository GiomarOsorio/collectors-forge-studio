"""
Esquemas Pydantic para cotizaciones de cliente (client_quotes).

Define los modelos de validación para crear y retornar cotizaciones
con múltiples líneas de producto, nombre de cliente y fechas de vigencia.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, PlainSerializer, model_validator

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class ClientQuoteLineItem(BaseModel):
    """
    Línea de producto dentro de una cotización de cliente.

    Atributos:
        name:       Nombre o descripción del producto/servicio.
        quantity:   Cantidad de unidades.
        unit_price: Precio unitario en USD.
    """
    name: str = Field(min_length=1)
    quantity: DecimalAsFloat = Field(gt=0)
    unit_price: DecimalAsFloat = Field(ge=0)


class ClientQuoteCreate(BaseModel):
    """
    Datos para crear una nueva cotización de cliente.

    Atributos:
        client_name:  Nombre del cliente (requerido).
        description:  Descripción general de la cotización (opcional).
        quote_date:   Fecha de emisión. Si se omite, se usa la fecha actual.
        expiry_days:  Días de vigencia desde quote_date (default 15).
        items:        Lista de líneas de producto (al menos 1).
        notes:        Notas adicionales (opcional).
    """
    client_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    quote_date: Optional[date] = None
    expiry_days: int = Field(default=15, ge=1)
    items: List[ClientQuoteLineItem] = Field(min_length=1)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def set_quote_date_default(self):
        """Si no se indica quote_date, usa la fecha de hoy."""
        if self.quote_date is None:
            self.quote_date = date.today()
        return self


class ClientQuoteResponse(BaseModel):
    """
    Datos completos de una cotización de cliente guardada.

    Atributos:
        id:          Identificador único.
        client_name: Nombre del cliente.
        description: Descripción general.
        quote_date:  Fecha de emisión.
        expiry_days: Días de vigencia.
        expiry_date: Fecha de vencimiento (quote_date + expiry_days).
        items:       Líneas de producto en formato JSON string.
        subtotal:    Suma de (quantity × unit_price) de todos los ítems.
        notes:       Notas adicionales.
        created_at:  Fecha y hora de creación del registro.
    """
    id: int
    client_name: str
    description: Optional[str]
    quote_date: date
    expiry_days: int
    expiry_date: date
    items: str
    subtotal: DecimalAsFloat
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
