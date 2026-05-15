"""
Esquemas Pydantic para ítems de inventario.

Define los modelos de validación y serialización para crear, actualizar
y retornar ítems del inventario. Los campos monetarios y de cantidad
usan Decimal internamente y se serializan como float en JSON.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, PlainSerializer, model_validator

# Decimal internamente -> float en JSON (serialización explícita)
DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class InventoryItemCreate(BaseModel):
    """
    Datos para crear un nuevo ítem de inventario.

    Atributos:
        name:             Nombre del artículo (requerido, max 200 caracteres).
        category:         Categoría del artículo (default 'General').
        description:      Descripción detallada (opcional).
        unit:             Unidad de medida (default 'unidades').
        quantity:         Cantidad actual en stock (default 0).
        min_quantity:     Cantidad mínima antes de alerta (default 0).
        unit_cost:        Costo unitario en USD (default 0).
        supplier_name:    Nombre del proveedor (opcional).
        supplier_contact: Contacto del proveedor: email/tel/web (opcional).
        supplier_info:    Información adicional del proveedor (opcional).
        needs_purchase:   Marcar si necesita recompra (default False).
        notes:            Notas adicionales (opcional).
    """
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="General", max_length=100)
    description: Optional[str] = None
    unit: str = Field(default="unidades", max_length=50)
    quantity: Decimal = Field(default=Decimal("0"), ge=0)
    min_quantity: Decimal = Field(default=Decimal("0"), ge=0)
    unit_cost: Decimal = Field(default=Decimal("0"), ge=0)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    supplier_contact: Optional[str] = Field(default=None, max_length=300)
    supplier_info: Optional[str] = None
    needs_purchase: bool = False
    notes: Optional[str] = None
    # Campos específicos para filamentos (calculadora)
    price_per_kg: Optional[Decimal] = None
    filament_brand: Optional[str] = Field(default=None, max_length=100)
    filament_type: Optional[str] = Field(default=None, max_length=50)
    filament_color: Optional[str] = Field(default=None, max_length=50)
    # Campos visuales agregados con la UI inspirada en Claude Design
    batch: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    color_hex: Optional[str] = Field(default=None, max_length=7)
    color_name: Optional[str] = Field(default=None, max_length=100)
    filament_diameter: Optional[Decimal] = None
    filament_density: Optional[Decimal] = None
    weight_per_roll: Optional[Decimal] = None
    # Precio por unidad para insumos (calculadora)
    price_per_unit: Optional[Decimal] = None
    # Campos específicos para consumibles (calculadora)
    useful_life_hours: Optional[Decimal] = None
    unit_cost_cal: Optional[Decimal] = None


class InventoryItemUpdate(BaseModel):
    """
    Datos opcionales para actualizar un ítem de inventario (PUT parcial).

    Todos los campos son opcionales. Solo se actualizan los que se envíen.

    Atributos:
        name:             Nuevo nombre del artículo.
        category:         Nueva categoría.
        description:      Nueva descripción.
        unit:             Nueva unidad de medida.
        quantity:         Nueva cantidad en stock.
        min_quantity:     Nuevo stock mínimo.
        unit_cost:        Nuevo costo unitario.
        supplier_name:    Nuevo nombre del proveedor.
        supplier_contact: Nuevo contacto del proveedor.
        supplier_info:    Nueva información del proveedor.
        needs_purchase:   Nuevo estado de necesidad de compra.
        notes:            Nuevas notas.
    """
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    unit: Optional[str] = Field(default=None, max_length=50)
    quantity: Optional[Decimal] = Field(default=None, ge=0)
    min_quantity: Optional[Decimal] = Field(default=None, ge=0)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    supplier_contact: Optional[str] = Field(default=None, max_length=300)
    supplier_info: Optional[str] = None
    needs_purchase: Optional[bool] = None
    notes: Optional[str] = None
    # Campos específicos para filamentos (calculadora)
    price_per_kg: Optional[Decimal] = None
    filament_brand: Optional[str] = Field(default=None, max_length=100)
    filament_type: Optional[str] = Field(default=None, max_length=50)
    filament_color: Optional[str] = Field(default=None, max_length=50)
    # Campos visuales agregados con la UI inspirada en Claude Design
    batch: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    color_hex: Optional[str] = Field(default=None, max_length=7)
    color_name: Optional[str] = Field(default=None, max_length=100)
    filament_diameter: Optional[Decimal] = None
    filament_density: Optional[Decimal] = None
    weight_per_roll: Optional[Decimal] = None
    # Precio por unidad para insumos (calculadora)
    price_per_unit: Optional[Decimal] = None
    # Campos específicos para consumibles (calculadora)
    useful_life_hours: Optional[Decimal] = None
    unit_cost_cal: Optional[Decimal] = None


class InventoryItemResponse(BaseModel):
    """
    Datos completos de un ítem de inventario (respuesta de la API).

    Incluye el campo calculado low_stock que indica si la cantidad actual
    está por debajo del stock mínimo configurado.

    Atributos:
        id:               Identificador único.
        name:             Nombre del artículo.
        category:         Categoría del artículo.
        description:      Descripción detallada.
        unit:             Unidad de medida.
        quantity:         Cantidad actual en stock.
        min_quantity:     Cantidad mínima configurada.
        unit_cost:        Costo unitario.
        supplier_name:    Nombre del proveedor.
        supplier_contact: Contacto del proveedor.
        supplier_info:    Información adicional del proveedor.
        needs_purchase:   Flag de necesidad de recompra.
        notes:            Notas adicionales.
        low_stock:        True si quantity < min_quantity y min_quantity > 0.
        created_at:       Fecha de creación.
        updated_at:       Fecha de última actualización.
    """
    id: int
    name: str
    category: str
    description: Optional[str]
    unit: str
    quantity: DecimalAsFloat
    min_quantity: DecimalAsFloat
    unit_cost: DecimalAsFloat
    supplier_name: Optional[str]
    supplier_contact: Optional[str]
    supplier_info: Optional[str]
    needs_purchase: bool
    notes: Optional[str]
    # Campos específicos para filamentos (calculadora)
    price_per_kg: Optional[DecimalAsFloat] = None
    filament_brand: Optional[str] = None
    filament_type: Optional[str] = None
    filament_color: Optional[str] = None
    # Campos visuales agregados con la UI inspirada en Claude Design
    batch: Optional[str] = None
    location: Optional[str] = None
    color_hex: Optional[str] = None
    color_name: Optional[str] = None
    filament_diameter: Optional[DecimalAsFloat] = None
    filament_density: Optional[DecimalAsFloat] = None
    weight_per_roll: Optional[DecimalAsFloat] = None
    # Precio por unidad para insumos (calculadora)
    price_per_unit: Optional[DecimalAsFloat] = None
    # Campos específicos para consumibles (calculadora)
    useful_life_hours: Optional[DecimalAsFloat] = None
    unit_cost_cal: Optional[DecimalAsFloat] = None
    low_stock: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_low_stock(self):
        """Calcula low_stock: True si quantity < min_quantity y min_quantity > 0."""
        if self.min_quantity > 0 and self.quantity < self.min_quantity:
            self.low_stock = True
        else:
            self.low_stock = False
        return self


class InventoryItemFlagResponse(BaseModel):
    """
    Respuesta tras alternar el flag needs_purchase de un ítem.

    Atributos:
        id:             Identificador del ítem.
        needs_purchase: Nuevo estado del flag.
    """
    id: int
    needs_purchase: bool

    model_config = {"from_attributes": True}


class InventoryItemAdjustRequest(BaseModel):
    """
    Solicitud para ajustar la cantidad de un ítem (suma o resta al stock).

    Atributos:
        quantity: Cantidad a sumar (positiva) o restar (negativa) del stock.
    """
    quantity: Decimal


class InventoryItemExport(BaseModel):
    """
    Datos de un ítem de inventario para exportar (sin id, company_id ni timestamps).

    Se usa tanto para serializar desde el ORM (exportación) como para
    deserializar desde JSON (importación).
    """
    name: str
    category: str
    description: Optional[str] = None
    unit: str
    quantity: DecimalAsFloat
    min_quantity: DecimalAsFloat
    unit_cost: DecimalAsFloat
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    supplier_info: Optional[str] = None
    needs_purchase: bool
    notes: Optional[str] = None
    price_per_kg: Optional[DecimalAsFloat] = None
    filament_brand: Optional[str] = None
    filament_type: Optional[str] = None
    filament_color: Optional[str] = None
    batch: Optional[str] = None
    location: Optional[str] = None
    color_hex: Optional[str] = None
    color_name: Optional[str] = None
    filament_diameter: Optional[DecimalAsFloat] = None
    filament_density: Optional[DecimalAsFloat] = None
    weight_per_roll: Optional[DecimalAsFloat] = None
    price_per_unit: Optional[DecimalAsFloat] = None
    useful_life_hours: Optional[DecimalAsFloat] = None
    unit_cost_cal: Optional[DecimalAsFloat] = None

    model_config = {"from_attributes": True}


class PrintedItemExport(BaseModel):
    """
    Datos de un ítem de impresión para exportar (sin id, company_id, image_url ni timestamps).
    """
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: int
    unit_price: Optional[DecimalAsFloat] = None
    material: Optional[str] = None
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class InventoryExportResponse(BaseModel):
    """
    Estructura completa del archivo de exportación de inventario.

    Atributos:
        exported_at:      Fecha y hora ISO 8601 de la exportación.
        version:          Versión del formato de exportación.
        inventory_items:  Lista de ítems de stock exportados.
        printed_items:    Lista de ítems de impresiones exportados.
    """
    exported_at: str
    version: str = "1"
    inventory_items: List[InventoryItemExport]
    printed_items: List[PrintedItemExport]


class InventoryImportResult(BaseModel):
    """
    Resultado de una operación de importación de inventario.

    Atributos:
        items_created:  Número de ítems de stock creados.
        items_merged:   Número de ítems de stock cuya cantidad se sumó.
        prints_created: Número de ítems de impresiones creados.
        prints_merged:  Número de ítems de impresiones cuya cantidad se sumó.
    """
    items_created: int
    items_merged: int
    prints_created: int
    prints_merged: int
