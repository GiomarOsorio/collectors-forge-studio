"""
Modelo ORM para cotizaciones de cliente con múltiples productos.

Define la entidad ClientQuote que representa una cotización generada
manualmente para un cliente: nombre, fechas, líneas de producto (JSON)
y subtotal. Se diferencia de Quote (costo de impresión) en que no
almacena el desglose técnico de costos sino una lista de ítems con
precio unitario definido por el usuario.
"""

import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, DateTime, Date, Text, Integer, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class ClientQuote(Base):
    """
    Cotización de cliente con múltiples líneas de producto.

    Los ítems se almacenan en la columna items como JSON con el formato:
    [{"name": str, "quantity": float, "unit_price": float}]

    El subtotal es la suma de (quantity × unit_price) de todos los ítems.
    """

    __tablename__ = "client_quotes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # Datos del cliente
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Vigencia
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("15"))
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Líneas de producto (JSON: [{name, quantity, unit_price}])
    items: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'[]'"))

    # Subtotal calculado (en USD, moneda de entrada del usuario)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Tasa USD→COP vigente al momento de crear la cotización
    usd_to_cop_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    # Notas opcionales
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
