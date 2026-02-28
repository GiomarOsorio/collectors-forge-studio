"""
Modelo ORM para los insumos adicionales de impresión 3D.

Los insumos son materiales no plásticos que se incorporan a las piezas
terminadas: argollas metálicas para keychains, switches para clickers,
imanes, insertos de rosca, etc. Se catalogan con precio unitario en USD
y se pueden añadir a cualquier cotización en la calculadora.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, Numeric, Text, DateTime, CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class Supply(Base):
    """
    Catálogo de insumos adicionales utilizados en piezas impresas.

    Atributos:
        id:             Identificador único autoincremental.
        name:           Nombre del insumo. Ej: "Argolla metálica 25mm".
        description:    Descripción opcional del insumo.
        unit:           Unidad de medida. Ej: "unidad", "par", "set".
        price_per_unit: Precio por unidad en USD. Numeric(12,4).
        pack_qty:       Cantidad de unidades en el paquete de compra.
        pack_price:     Precio total del paquete en USD. Numeric(12,4).
        notes:          Notas adicionales opcionales.
        created_at:     Fecha y hora UTC de creación del registro.
    """

    __tablename__ = "supplies"
    __table_args__ = (
        CheckConstraint("price_per_unit >= 0", name="ck_supplies_price_ge0"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String, nullable=False, server_default="unidad")
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    pack_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pack_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
