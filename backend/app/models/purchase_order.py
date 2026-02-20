"""
Modelos ORM para órdenes de compra y sus ítems.

Define las entidades PurchaseOrder y PurchaseOrderItem que representan
pedidos a proveedores. Cada orden contiene una lista de ítems que pueden
vincularse opcionalmente a un InventoryItem del inventario. Cuando la
orden se marca como "llegado", el stock de los InventoryItems vinculados
se actualiza automáticamente.

Estados posibles de una orden: pendiente, en_transito, llegado, cancelado.
"""

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Numeric, DateTime, Date, Text, Integer, ForeignKey, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class PurchaseOrder(Base):
    """
    Orden de compra a un proveedor.

    Registra el proveedor, número de seguimiento, transportista, estado
    y fecha estimada de llegada. Contiene una lista de ítems (PurchaseOrderItem)
    que se eliminan en cascada al borrar la orden.
    """

    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # Datos del pedido
    supplier: Mapped[str] = mapped_column(String(200), nullable=False)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    carrier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'pendiente'")
    )
    estimated_arrival: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Fecha real de llegada (se llena al marcar como "llegado")
    arrived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Timestamp de creación
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relación con los ítems del pedido (cascade: se borran al eliminar la orden)
    items: Mapped[List["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base):
    """
    Línea de ítem dentro de una orden de compra.

    Puede vincularse opcionalmente a un InventoryItem para actualizar
    automáticamente el stock cuando la orden se marca como "llegado".
    """

    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    inventory_item_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inventory_items.id"), nullable=True
    )

    # Datos del ítem
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("'0'")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relaciones
    order: Mapped["PurchaseOrder"] = relationship(
        "PurchaseOrder", back_populates="items"
    )
    inventory_item: Mapped[Optional["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="purchase_items"
    )
