"""
Modelo ORM para ítems de inventario.

Define la entidad InventoryItem que representa un artículo en el inventario
de la empresa: materiales, herramientas, repuestos, accesorios, etc.
Cada ítem tiene stock actual, stock mínimo, costo unitario y datos del
proveedor. Se vincula a la empresa mediante company_id (multi-tenant).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Numeric, DateTime, Text, Boolean, Integer, ForeignKey, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.purchase_order import PurchaseOrderItem


class InventoryItem(Base):
    """
    Ítem del inventario de la empresa.

    Almacena información del artículo, cantidades, costos y datos del
    proveedor. El campo needs_purchase indica si el usuario marcó
    manualmente que necesita recompra. El campo calculado low_stock
    (quantity < min_quantity) se expone a través del schema de respuesta.
    """

    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # Identificación del artículo
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default=text("'General'")
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Unidad y cantidades
    unit: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'unidades'")
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False, server_default=text("'0'")
    )
    min_quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False, server_default=text("'0'")
    )

    # Costo unitario
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("'0'")
    )

    # Datos del proveedor
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    supplier_contact: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    supplier_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Flags y notas
    needs_purchase: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Campos específicos para ítems de categoría "Filamento" (calculadora)
    price_per_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    filament_brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    filament_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # PLA, PETG, ABS...
    filament_color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    filament_diameter: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 3), nullable=True)
    filament_density: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 6), nullable=True)
    weight_per_roll: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True)
    # Precio por unidad para insumos (usado por la calculadora)
    price_per_unit: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    # Relación inversa: líneas de órdenes de compra que referencian este ítem
    purchase_items: Mapped[List["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="inventory_item"
    )
