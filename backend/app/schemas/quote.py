"""
Esquemas Pydantic para las cotizaciones de impresión 3D.

Define los modelos de validación y serialización de datos para los endpoints
de cotizaciones. Todos los campos financieros usan Decimal internamente.
En JSON se serializan como float a través de DecimalAsFloat (PlainSerializer).
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, PlainSerializer, field_serializer

# Decimal internamente → float en JSON (serialización explícita)
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class FilamentItem(BaseModel):
    """
    Referencia a un filamento adicional para piezas multicolor o multimaterial.

    Atributos:
        filament_id:  ID del filamento adicional registrado en el catálogo.
        weight_grams: Gramos de este filamento consumidos por la pieza.
    """
    filament_id: int
    weight_grams: Decimal = Field(gt=0)


class QuoteCalculateRequest(BaseModel):
    """
    Esquema de solicitud para calcular o crear una cotización de impresión 3D.

    Pydantic v2 coerciona los números JSON (float) a Decimal automáticamente
    para los campos declarados como Decimal.

    Atributos:
        piece_name: Nombre de la pieza.
        filament_id: ID del filamento principal.
        printer_id: ID de la impresora.
        weight_grams: Gramos totales de filamento (placa completa).
        print_time_hours: Horas totales de impresión (placa completa).
        preparation_time_hours: Horas de preparación para mano de obra.
        post_processing_time_hours: Horas de post-procesado para mano de obra.
        quantity: Número de piezas producidas en la placa.
        margin_percent: Margen de ganancia (0–100). None usa el default del usuario.
    """

    piece_name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    filament_id: int
    printer_id: int
    weight_grams: Decimal = Field(gt=0)
    print_time_hours: Decimal = Field(gt=0)
    preparation_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    post_processing_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    quantity: int = Field(default=1, ge=1)
    margin_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    save: bool = True
    supplies: List["SupplyItemRef"] = []
    additional_filaments: List[FilamentItem] = []


class QuoteCostBreakdown(BaseModel):
    """
    Desglose completo de costos de una cotización (respuesta de /calculate).

    Internamente todos los campos monetarios son Decimal.
    La serialización a JSON produce float via PlainSerializer.
    """

    material_cost: DecimalAsFloat
    electricity_cost: DecimalAsFloat
    depreciation_cost: DecimalAsFloat
    maintenance_cost: DecimalAsFloat
    labor_cost: DecimalAsFloat
    failure_cost: DecimalAsFloat
    subtotal: DecimalAsFloat
    margin_percent: DecimalAsFloat
    margin_amount: DecimalAsFloat
    total_per_unit: DecimalAsFloat
    quantity: int
    total_price: DecimalAsFloat
    supplies_cost: DecimalAsFloat = Decimal("0")
    supplies_detail: list = []
    usd_to_cop_rate: Optional[DecimalAsFloat] = None
    total_per_unit_cop: Optional[DecimalAsFloat] = None
    total_price_cop: Optional[DecimalAsFloat] = None

    @field_serializer("supplies_detail", when_used="json")
    @staticmethod
    def _serialize_supplies_detail(v: list) -> list:
        """Convierte Decimal→float en los dicts de supplies_detail al serializar a JSON."""
        return [
            {k: (float(val) if isinstance(val, Decimal) else val) for k, val in item.items()}
            for item in v
        ]


class QuoteResponse(BaseModel):
    """
    Datos completos de una cotización guardada en el historial.

    Todos los campos monetarios son Decimal internamente,
    serializados a float en JSON via PlainSerializer.
    """

    id: int
    piece_name: str
    description: Optional[str]
    client_name: Optional[str]
    filament_id: int
    printer_id: int
    weight_grams: DecimalAsFloat
    print_time_hours: DecimalAsFloat
    preparation_time_hours: DecimalAsFloat
    post_processing_time_hours: DecimalAsFloat
    quantity: int
    material_cost: DecimalAsFloat
    electricity_cost: DecimalAsFloat
    depreciation_cost: DecimalAsFloat
    maintenance_cost: DecimalAsFloat
    labor_cost: DecimalAsFloat
    failure_cost: DecimalAsFloat
    subtotal: DecimalAsFloat
    margin_percent: DecimalAsFloat
    margin_amount: DecimalAsFloat
    total_per_unit: DecimalAsFloat
    total_price: DecimalAsFloat
    supplies_cost: DecimalAsFloat = Decimal("0")
    supplies_detail: Optional[str] = "[]"
    additional_filaments_detail: Optional[str] = "[]"
    usd_to_cop_rate: Optional[DecimalAsFloat] = None
    total_per_unit_cop: Optional[DecimalAsFloat] = None
    total_price_cop: Optional[DecimalAsFloat] = None
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplyItemRef(BaseModel):
    """
    Referencia a un insumo del catálogo para incluir en una cotización.

    Atributos:
        supply_id: ID del insumo registrado en el catálogo.
        quantity:  Cantidad de unidades de este insumo por pieza.
    """
    supply_id: int
    quantity: Decimal = Field(default=Decimal("1"), gt=0)


QuoteCalculateRequest.model_rebuild()
