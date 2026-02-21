"""
Modelo ORM para la tabla de filamentos de impresión 3D.

Define la entidad Filament que representa un carrete de filamento registrado
en el sistema. Los filamentos son uno de los insumos principales para el
cálculo de costos de impresión: a partir del precio por kilogramo y la
densidad del material se determina el costo exacto de material por pieza.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, DateTime, Text, Numeric, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class Filament(Base):
    """
    Modelo de base de datos que representa un filamento de impresión 3D.

    Atributos:
        id: Clave primaria autoincremental.
        brand: Fabricante. Ej: eSun, Bambu, Polymaker.
        type: Tipo de material. Ej: PLA, PETG, ABS.
        color: Color. Ej: Blanco, Negro.
        price_per_kg: Precio por kilogramo en USD. Numeric(12,4).
        weight_per_roll: Peso neto del carrete en gramos. Numeric(10,3).
        diameter: Diámetro en milímetros. Numeric(6,3).
        density: Densidad en g/cm³. Numeric(8,6).
        notes: Anotaciones opcionales.
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "filaments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    brand: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(50))
    price_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    weight_per_roll: Mapped[Decimal] = mapped_column(
        Numeric(10, 3), server_default=text("1000.000")
    )
    diameter: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), server_default=text("1.750")
    )
    density: Mapped[Decimal] = mapped_column(
        Numeric(8, 6), server_default=text("1.240000")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True
    )
