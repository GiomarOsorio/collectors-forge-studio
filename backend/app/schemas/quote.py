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
        inventory_item_id: ID del ítem de inventario (categoría Filamento).
        weight_grams:      Gramos de este filamento consumidos por la pieza.
    """
    inventory_item_id: int
    weight_grams: Decimal = Field(gt=0)


class QuoteCalculateRequest(BaseModel):
    """
    Esquema de solicitud para calcular o crear una cotización de impresión 3D.

    Pydantic v2 coerciona los números JSON (float) a Decimal automáticamente
    para los campos declarados como Decimal.

    Atributos:
        piece_name: Nombre de la pieza.
        inventory_item_id: ID del ítem de inventario (filamento principal).
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
    inventory_item_id: int
    printer_id: int
    weight_grams: Decimal = Field(gt=0)
    print_time_hours: Decimal = Field(gt=0, le=720)  # máx 30 días
    preparation_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    post_processing_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    quantity: int = Field(default=1, ge=1)
    margin_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    color_changes: int = Field(default=0, ge=0, le=500)
    save: bool = True
    supplies: List["SupplyItemRef"] = []
    additional_filaments: List[FilamentItem] = []
    consumable_ids: Optional[List[int]] = None
    # Tasa USD/COP ya calculada: si se envía, el backend la reutiliza en lugar de
    # volver a consultar la API externa. Evita discrepancias entre "Calcular" y "Guardar".
    usd_to_cop_rate: Optional[Decimal] = None


class QuoteCostBreakdown(BaseModel):
    """
    Desglose completo de costos de una cotización (respuesta de /calculate).

    Internamente todos los campos monetarios son Decimal.
    La serialización a JSON produce float via PlainSerializer.
    """

    material_cost: DecimalAsFloat
    electricity_cost: DecimalAsFloat
    depreciation_cost: DecimalAsFloat
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
    consumables_wear_cost: DecimalAsFloat = Decimal("0")
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
    filament_id: Optional[int]
    printer_id: int
    inventory_item_id: Optional[int] = None
    weight_grams: DecimalAsFloat
    print_time_hours: DecimalAsFloat
    preparation_time_hours: DecimalAsFloat
    post_processing_time_hours: DecimalAsFloat
    quantity: int
    material_cost: DecimalAsFloat
    electricity_cost: DecimalAsFloat
    depreciation_cost: DecimalAsFloat
    labor_cost: DecimalAsFloat
    failure_cost: DecimalAsFloat
    subtotal: DecimalAsFloat
    margin_percent: DecimalAsFloat
    margin_amount: DecimalAsFloat
    total_per_unit: DecimalAsFloat
    total_price: DecimalAsFloat
    supplies_cost: DecimalAsFloat = Decimal("0")
    supplies_detail: Optional[list] = []
    additional_filaments_detail: Optional[list] = []
    usd_to_cop_rate: Optional[DecimalAsFloat] = None
    total_per_unit_cop: Optional[DecimalAsFloat] = None
    total_price_cop: Optional[DecimalAsFloat] = None
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QuoteUpdateMeta(BaseModel):
    """
    Esquema para actualizar los metadatos de una cotización guardada.

    Solo permite editar campos descriptivos; los valores de costo calculados
    no se modifican para preservar la integridad del historial.

    Atributos:
        piece_name:  Nombre de la pieza (requerido, no vacío).
        description: Descripción opcional.
        client_name: Nombre del cliente opcional.
        notes:       Notas adicionales opcionales.
    """
    piece_name: str = Field(min_length=1)
    description: Optional[str] = None
    client_name: Optional[str] = None
    notes: Optional[str] = None


class SupplyItemRef(BaseModel):
    """
    Referencia a un insumo del inventario para incluir en una cotización.

    Atributos:
        inventory_item_id: ID del ítem de inventario (insumo).
        quantity:          Cantidad de unidades de este insumo por pieza.
    """
    inventory_item_id: int
    quantity: Decimal = Field(default=Decimal("1"), gt=0)


class QuoteManualRequest(BaseModel):
    """
    Esquema de solicitud para cotización manual (sin filamento/impresora registrados).

    Permite calcular el costo de una impresión 3D proporcionando todos los
    parámetros directamente, sin necesidad de tener filamentos o impresoras
    pre-registrados en el sistema.

    Los campos de configuración (electricity_rate, failure_rate_percent,
    labor_cost_per_hour) son opcionales: si se omiten, se usan los valores
    guardados en la configuración de la empresa del usuario autenticado.

    Atributos de filamento:
        filament_name:  Nombre descriptivo del material (solo para referencia).
        price_per_kg:   Precio del filamento en USD por kilogramo.

    Atributos de impresora:
        power_consumption_watts:    Consumo promedio en vatios durante impresión.
        purchase_price:             Precio de compra de la impresora en USD.
        estimated_lifespan_hours:   Vida útil estimada en horas de impresión.

    Atributos de impresión:
        weight_grams:               Gramos totales de filamento consumidos.
        print_time_hours:           Horas totales de impresión.
        preparation_time_hours:     Horas de preparación para mano de obra.
        post_processing_time_hours: Horas de post-procesado para mano de obra.
        quantity:                   Número de piezas producidas.
        margin_percent:             Margen de ganancia (0–100). None usa el default de la empresa.

    Atributos de configuración (opcionales — usan los valores guardados si se omiten):
        electricity_rate:       Tarifa eléctrica en USD/kWh.
        failure_rate_percent:   Porcentaje de fallos esperados (0–100).
        labor_cost_per_hour:    Costo de mano de obra en USD por hora.
    """

    piece_name: str
    description: Optional[str] = None
    client_name: Optional[str] = None

    # Parámetros del filamento
    filament_name: str = "Material"
    price_per_kg: Decimal = Field(gt=0)

    # Parámetros de la impresora
    power_consumption_watts: Decimal = Field(gt=0)
    purchase_price: Decimal = Field(ge=0)
    estimated_lifespan_hours: Decimal = Field(gt=0)

    # Parámetros de impresión
    weight_grams: Decimal = Field(gt=0)
    print_time_hours: Decimal = Field(gt=0)
    preparation_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    post_processing_time_hours: Decimal = Field(default=Decimal("0"), ge=0)
    quantity: int = Field(default=1, ge=1)
    margin_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    color_changes: int = Field(default=0, ge=0, le=500)

    # Sobrescritura opcional de configuración de la empresa
    electricity_rate: Optional[Decimal] = Field(default=None, ge=0)
    failure_rate_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    labor_cost_per_hour: Optional[Decimal] = Field(default=None, ge=0)

    consumable_ids: Optional[List[int]] = None


QuoteCalculateRequest.model_rebuild()
