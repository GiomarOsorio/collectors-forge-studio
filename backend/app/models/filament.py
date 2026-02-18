from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Filament(Base):
    __tablename__ = "filaments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    brand: Mapped[str] = mapped_column(String(100))  # Ej: eSun, Bambu, Polymaker
    type: Mapped[str] = mapped_column(String(50))  # PLA, PETG, ABS, TPU, etc.
    color: Mapped[str] = mapped_column(String(50))
    price_per_kg: Mapped[float] = mapped_column(Float)  # Precio por kg
    weight_per_roll: Mapped[float] = mapped_column(Float, default=1000.0)  # Gramos por rollo
    diameter: Mapped[float] = mapped_column(Float, default=1.75)  # mm
    density: Mapped[float] = mapped_column(Float, default=1.24)  # g/cm³ (PLA default)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
