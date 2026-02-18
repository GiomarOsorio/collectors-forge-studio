from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Printer(Base):
    __tablename__ = "printers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))  # Ej: "Mi BambuLab P1S Combo"
    model: Mapped[str] = mapped_column(String(100))  # Ej: "BambuLab P1S Combo"
    purchase_price: Mapped[float] = mapped_column(Float)  # Precio de compra
    power_consumption_watts: Mapped[float] = mapped_column(Float)  # Consumo promedio en watts
    estimated_lifespan_hours: Mapped[float] = mapped_column(Float)  # Vida útil estimada en horas
    current_hours: Mapped[float] = mapped_column(Float, default=0.0)  # Horas de uso actual
    # Costos de mantenimiento
    nozzle_price: Mapped[float] = mapped_column(Float, default=0.0)  # Precio boquilla
    nozzle_lifespan_hours: Mapped[float] = mapped_column(Float, default=500.0)  # Horas por boquilla
    buildplate_price: Mapped[float] = mapped_column(Float, default=0.0)  # Precio placa
    buildplate_lifespan_hours: Mapped[float] = mapped_column(Float, default=2000.0)  # Horas por placa
    other_maintenance_per_hour: Mapped[float] = mapped_column(Float, default=0.0)  # Otros costos/hora
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
