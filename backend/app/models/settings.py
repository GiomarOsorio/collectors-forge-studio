"""
Modelo ORM para la tabla de configuración de la aplicación por usuario.

Define la entidad AppSettings que almacena los parámetros globales que influyen
en el cálculo de costos: tarifa eléctrica, tasa de fallos, costo de mano de
obra y margen de ganancia por defecto. Cada usuario tiene exactamente una fila
en esta tabla (relación uno-a-uno con users).
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Integer, ForeignKey, Numeric, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSettings(Base):
    """
    Modelo de base de datos para la configuración de la aplicación por usuario.

    Atributos:
        id: Clave primaria autoincremental.
        user_id: Clave foránea hacia users. Restricción UNIQUE (una fila por usuario).
        electricity_rate: Tarifa eléctrica en USD/kWh. Numeric(12,6).
        failure_rate_percent: Porcentaje de fallos (0–100). Numeric(7,4).
        labor_cost_per_hour: Costo de mano de obra por hora en USD. Numeric(12,4).
        default_margin_percent: Margen por defecto (0–100). Numeric(7,4).
        currency: Código ISO de moneda. Ej: "USD".
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("electricity_rate >= 0",                                        name="ck_settings_rate_ge0"),
        CheckConstraint("failure_rate_percent >= 0 AND failure_rate_percent <= 100",    name="ck_settings_failure_range"),
        CheckConstraint("labor_cost_per_hour >= 0",                                     name="ck_settings_labor_ge0"),
        CheckConstraint("default_margin_percent >= 0 AND default_margin_percent <= 100", name="ck_settings_margin_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    electricity_rate: Mapped[Decimal] = mapped_column(
        Numeric(12, 6), server_default=text("0.150000")
    )
    failure_rate_percent: Mapped[Decimal] = mapped_column(
        Numeric(7, 4), server_default=text("5.0000")
    )
    labor_cost_per_hour: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), server_default=text("10.0000")
    )
    default_margin_percent: Mapped[Decimal] = mapped_column(
        Numeric(7, 4), server_default=text("30.0000")
    )
    currency: Mapped[str] = mapped_column(server_default=text("'USD'"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
