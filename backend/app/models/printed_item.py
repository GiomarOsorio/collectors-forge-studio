"""
Modelo ORM para ítems de impresiones del inventario.

Define la entidad PrintedItem que representa una pieza o producto impreso
en 3D listo para venta o catálogo. Almacena el nombre, categoría, material,
color, cantidad disponible, precio de venta y URL de imagen. Se vincula a la
empresa mediante company_id (multi-tenant).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, DateTime, Text, Integer, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PrintedItem(Base):
    """
    Ítem de impresión 3D del catálogo de productos de la empresa.

    Almacena información sobre piezas o productos impresos disponibles para
    venta: nombre, categoría, material utilizado, color, stock disponible,
    precio unitario de venta e imagen de referencia. Cada registro pertenece
    a una empresa (company_id) para el aislamiento multi-tenant.
    """

    __tablename__ = "printed_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identificación del producto
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Key de la imagen en MinIO (formato `prints/{uuid}.{ext}`). El response
    # del API expone `image_url` apuntando al proxy `GET /api/inventory/prints/{id}/image`.
    image_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Stock y precio de venta
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    # Moneda del unit_price: 'USD' o 'COP'. Default USD por compat con UI V1.
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default=text("'USD'")
    )

    # Material y acabado
    material: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
