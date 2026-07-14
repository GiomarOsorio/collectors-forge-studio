"""
Schemas Pydantic para bobinas individuales de filamento (issue #134).
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, Field, PlainSerializer, field_validator

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]

#: Efectos visuales soportados por el swatch (port de bambuddy
#: filamentSwatchHelpers.ts, AGPL-3.0). NULL = sin efecto (color sólido/gradiente simple).
VisualEffect = Literal[
    "sparkle", "wood", "marble", "glow", "matte",
    "silk", "galaxy", "rainbow", "metal", "translucent",
    "gradient", "dual-color", "tri-color", "multicolor",
]

_HEX_STOP_RE = re.compile(r"^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")


class SpoolExtraColors(BaseModel):
    """`{"stops": ["RRGGBB", ...]}` — gradiente/multi-color del swatch."""

    stops: List[str] = Field(default_factory=list, max_length=8)

    @field_validator("stops")
    @classmethod
    def _validar_stops(cls, v: List[str]) -> List[str]:
        for s in v:
            if not _HEX_STOP_RE.match(s.lstrip("#")):
                raise ValueError(f"Color inválido: '{s}' — use hex de 6 u 8 caracteres")
        return v


class SpoolCreate(BaseModel):
    """
    Alta de bobina(s) — soporta alta masiva con `count`.

    `add_to_stock`: si True, suma `initial_weight_g × count` al
    `InventoryItem.quantity` del padre (compra nueva). Default False:
    las bobinas se crean para trackear en detalle stock que YA estaba
    contado en el agregado (ver docstring de `Spool`).
    """

    inventory_item_id: int
    count: int = Field(default=1, ge=1, le=100)
    initial_weight_g: Optional[Decimal] = Field(default=None, gt=0)
    cost: Optional[Decimal] = Field(default=None, ge=0)
    extra_colors: Optional[SpoolExtraColors] = None
    visual_effect: Optional[VisualEffect] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    add_to_stock: bool = False


class SpoolUpdate(BaseModel):
    """Edición de una bobina existente — todos los campos opcionales."""

    remaining_weight_g: Optional[Decimal] = Field(default=None, ge=0)
    cost: Optional[Decimal] = Field(default=None, ge=0)
    extra_colors: Optional[SpoolExtraColors] = None
    visual_effect: Optional[VisualEffect] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    status: Optional[Literal["active", "finished", "archived"]] = None


class SpoolResponse(BaseModel):
    """Bobina con datos del ítem de inventario padre embebidos."""

    id: int
    inventory_item_id: int
    label_code: str
    initial_weight_g: DecimalAsFloat
    remaining_weight_g: DecimalAsFloat
    percent_remaining: float
    cost: Optional[DecimalAsFloat] = None
    effective_cost_per_kg: Optional[DecimalAsFloat] = None
    extra_colors: Optional[dict] = None
    visual_effect: Optional[str] = None
    status: str
    opened_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Datos del padre (InventoryItem) embebidos — evita un round-trip aparte.
    inventory_item_name: str
    color_hex: Optional[str] = None
    color_name: Optional[str] = None
    filament_type: Optional[str] = None
    filament_brand: Optional[str] = None
    filament_subtype: Optional[str] = None


class SpoolLowStockEntry(BaseModel):
    """Agregado de bobinas activas por tipo de filamento vs. el umbral configurado."""

    filament_type: str
    total_remaining_g: DecimalAsFloat
    threshold_g: DecimalAsFloat
    below: bool
