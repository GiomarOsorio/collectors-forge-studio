from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))

    # Información de la pieza
    piece_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Referencias
    filament_id: Mapped[int] = mapped_column(Integer, ForeignKey("filaments.id"))
    printer_id: Mapped[int] = mapped_column(Integer, ForeignKey("printers.id"))

    # Parámetros de impresión
    weight_grams: Mapped[float] = mapped_column(Float)  # Gramos de filamento
    print_time_hours: Mapped[float] = mapped_column(Float)  # Tiempo de impresión
    preparation_time_hours: Mapped[float] = mapped_column(Float, default=0.0)  # Preparación
    post_processing_time_hours: Mapped[float] = mapped_column(Float, default=0.0)  # Post-procesado
    quantity: Mapped[int] = mapped_column(Integer, default=1)  # Cantidad de piezas

    # Desglose de costos (por unidad)
    material_cost: Mapped[float] = mapped_column(Float)
    electricity_cost: Mapped[float] = mapped_column(Float)
    depreciation_cost: Mapped[float] = mapped_column(Float)
    maintenance_cost: Mapped[float] = mapped_column(Float)
    labor_cost: Mapped[float] = mapped_column(Float)
    failure_cost: Mapped[float] = mapped_column(Float)  # Costo absorbido por fallos
    subtotal: Mapped[float] = mapped_column(Float)
    margin_percent: Mapped[float] = mapped_column(Float)
    margin_amount: Mapped[float] = mapped_column(Float)
    total_per_unit: Mapped[float] = mapped_column(Float)
    total_price: Mapped[float] = mapped_column(Float)  # total_per_unit * quantity

    # Metadata
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
