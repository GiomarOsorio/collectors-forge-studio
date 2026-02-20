"""
Esquemas Pydantic para la configuración de la aplicación por usuario.

Todos los campos financieros usan Decimal internamente y se serializan
a float en JSON via PlainSerializer.
"""

from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class AppSettingsUpdate(BaseModel):
    """
    Esquema para la actualización parcial de la configuración.

    Pydantic v2 coerciona números JSON a Decimal para campos Decimal.
    Todos los campos son opcionales.
    """

    electricity_rate: Optional[Decimal] = Field(default=None, ge=0)
    failure_rate_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    labor_cost_per_hour: Optional[Decimal] = Field(default=None, ge=0)
    default_margin_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    currency: Optional[str] = None


class AppSettingsResponse(BaseModel):
    """
    Respuesta con la configuración completa del usuario.

    Los campos Decimal se serializan a float en JSON via PlainSerializer.
    """

    id: int
    user_id: int
    electricity_rate: DecimalAsFloat
    failure_rate_percent: DecimalAsFloat
    labor_cost_per_hour: DecimalAsFloat
    default_margin_percent: DecimalAsFloat
    currency: str

    model_config = {"from_attributes": True}
