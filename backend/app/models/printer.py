"""
Modelo ORM para la tabla de impresoras 3D.

Define la entidad Printer que representa una impresora 3D registrada en el
sistema. A partir de sus parámetros técnicos y económicos se calculan dos
componentes del costo de impresión: depreciación del equipo y consumo
eléctrico. El costo de mantenimiento se rastrea por separado en la app
Mantenimiento (logs con descuento de inventario) y no se duplica acá.

El modelo fue diseñado tomando como referencia la BambuLab P1S Combo, pero
es compatible con cualquier impresora FDM.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, DateTime, Text, Numeric, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Printer(Base):
    """
    Modelo de base de datos que representa una impresora 3D.

    Atributos:
        id: Clave primaria autoincremental.
        name: Nombre personalizado. Ej: "Mi BambuLab P1S Combo".
        model: Modelo comercial. Ej: "BambuLab P1S Combo".
        purchase_price: Precio de compra en USD. Numeric(12,4).
        power_consumption_watts: Consumo promedio en vatios. Numeric(10,2).
        estimated_lifespan_hours: Vida útil estimada en horas. Numeric(10,2). > 0.
        current_hours: Horas de uso acumuladas. Numeric(10,2).
        notes: Anotaciones opcionales.
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "printers"
    __table_args__ = (
        CheckConstraint("purchase_price >= 0",          name="ck_printers_purchase_ge0"),
        CheckConstraint("estimated_lifespan_hours > 0", name="ck_printers_lifespan_pos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    model: Mapped[str] = mapped_column(String(100))
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    power_consumption_watts: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    estimated_lifespan_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    current_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
