"""
Modelo ORM para la tabla de cotizaciones de impresión 3D.

Define la entidad Quote que representa el resultado completo de un cálculo de
costo de impresión guardado en el historial del usuario. Almacena tanto los
parámetros de entrada (peso, tiempo, cantidad) como el desglose detallado de
todos los componentes del costo.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, DateTime, Text, Integer, ForeignKey, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB

from app.database import Base


class Quote(Base):
    """
    Cotización de impresión 3D guardada en el historial.

    Todos los campos monetarios usan Numeric(12,4).
    Los porcentajes usan Numeric(7,4) con restricción 0–100.
    Los valores COP usan Numeric(16,0).
    """

    __tablename__ = "quotes"
    __table_args__ = (
        CheckConstraint(
            "margin_percent >= 0 AND margin_percent <= 100",
            name="ck_quotes_margin_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # Información de la pieza
    piece_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Referencias al filamento e impresora utilizados
    filament_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("filaments.id"), nullable=True)
    printer_id: Mapped[int] = mapped_column(Integer, ForeignKey("printers.id"))
    inventory_item_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inventory_items.id"), nullable=True
    )

    # Parámetros de impresión ingresados por el usuario
    weight_grams: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    print_time_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    preparation_time_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    post_processing_time_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    quantity: Mapped[int] = mapped_column(Integer, server_default=text("1"))

    # Desglose de costos calculados — Numeric(12,4)
    material_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    electricity_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    depreciation_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    maintenance_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    labor_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    failure_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    margin_percent: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    margin_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    total_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 4))

    # Insumos adicionales
    supplies_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), server_default=text("0.0000")
    )
    supplies_detail: Mapped[Optional[list]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=True
    )
    additional_filaments_detail: Mapped[Optional[list]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=True
    )

    # Conversión a pesos colombianos (guardada al momento de cotizar)
    usd_to_cop_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    total_per_unit_cop: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(16, 0), nullable=True
    )
    total_price_cop: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(16, 0), nullable=True
    )

    # Metadata
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
