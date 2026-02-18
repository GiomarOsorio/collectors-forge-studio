from datetime import datetime

from sqlalchemy import Float, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    electricity_rate: Mapped[float] = mapped_column(Float, default=0.15)  # Costo por kWh
    failure_rate_percent: Mapped[float] = mapped_column(Float, default=5.0)  # % tasa de fallos
    labor_cost_per_hour: Mapped[float] = mapped_column(Float, default=10.0)  # Costo hora de trabajo
    default_margin_percent: Mapped[float] = mapped_column(Float, default=30.0)  # Margen por defecto
    currency: Mapped[str] = mapped_column(default="USD")  # Moneda
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
