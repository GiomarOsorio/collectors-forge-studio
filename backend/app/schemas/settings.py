"""
Esquemas Pydantic para la configuración de la aplicación por usuario.

Todos los campos financieros usan Decimal internamente y se serializan
a float en JSON via PlainSerializer.
"""

from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer, field_validator

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
    spool_low_stock_threshold_g: Optional[Decimal] = Field(default=None, ge=0)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = Field(default=None, ge=1, le=65535)
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_tls: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest_hour: Optional[int] = Field(default=None, ge=0, le=23)

    @field_validator("quiet_hours_start", "quiet_hours_end")
    @classmethod
    def _check_hhmm(cls, v):
        if v is None or v == "":
            return None
        import re
        if not re.fullmatch(r"[0-2]\d:[0-5]\d", v):
            raise ValueError("Formato esperado HH:MM")
        return v


class AppSettingsResponse(BaseModel):
    """
    Respuesta con la configuración completa del usuario.

    Los campos Decimal se serializan a float en JSON via PlainSerializer.
    """

    id: int
    user_id: Optional[int] = None
    electricity_rate: DecimalAsFloat
    failure_rate_percent: DecimalAsFloat
    labor_cost_per_hour: DecimalAsFloat
    default_margin_percent: DecimalAsFloat
    currency: str
    spool_low_stock_threshold_g: DecimalAsFloat
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_tls: bool
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest_hour: Optional[int] = None

    model_config = {"from_attributes": True}
