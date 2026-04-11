"""
Modelo ORM para la tabla de impresoras 3D.

Define la entidad Printer que representa una impresora 3D registrada en el
sistema. A partir de sus parámetros técnicos y económicos se calculan tres
componentes del costo de impresión: depreciación del equipo, consumo eléctrico
y mantenimiento periódico (boquilla, placa de construcción y otros gastos).

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
        nozzle_price: Precio de reemplazo de boquilla. Numeric(12,4).
        nozzle_lifespan_hours: Horas de vida de la boquilla. Numeric(10,2). > 0.
        buildplate_price: Precio de reemplazo de placa. Numeric(12,4).
        buildplate_lifespan_hours: Horas de vida de la placa. Numeric(10,2). > 0.
        other_maintenance_per_hour: Otros costos de mantenimiento por hora. Numeric(12,6).
        notes: Anotaciones opcionales.
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "printers"
    __table_args__ = (
        CheckConstraint("purchase_price >= 0",           name="ck_printers_purchase_ge0"),
        CheckConstraint("estimated_lifespan_hours > 0",  name="ck_printers_lifespan_pos"),
        CheckConstraint("nozzle_lifespan_hours > 0",     name="ck_printers_nozzle_pos"),
        CheckConstraint("buildplate_lifespan_hours > 0", name="ck_printers_plate_pos"),
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
    nozzle_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), server_default=text("0.0000")
    )
    nozzle_lifespan_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("500.00")
    )
    buildplate_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), server_default=text("0.0000")
    )
    buildplate_lifespan_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("2000.00")
    )
    other_maintenance_per_hour: Mapped[Decimal] = mapped_column(
        Numeric(12, 6), server_default=text("0.000000")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
