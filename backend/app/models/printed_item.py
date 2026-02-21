"""
Modelo ORM para ítems de impresiones del inventario.

Define la entidad PrintedItem que representa una pieza o producto impreso
en 3D listo para venta o catálogo. Almacena el nombre, categoría, material,
color, cantidad disponible, precio de venta y URL de imagen. Se vincula a la
empresa mediante company_id (multi-tenant).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

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
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # Identificación del producto
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Imagen de referencia (URL relativa al directorio estático)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Stock y precio de venta
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    # Material y acabado
    material: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
