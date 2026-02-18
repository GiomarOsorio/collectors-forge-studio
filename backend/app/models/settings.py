"""
Modelo ORM para la tabla de configuración de la aplicación por usuario.

Define la entidad AppSettings que almacena los parámetros globales que influyen
en el cálculo de costos: tarifa eléctrica, tasa de fallos, costo de mano de
obra y margen de ganancia por defecto. Cada usuario tiene exactamente una fila
en esta tabla (relación uno-a-uno con users).
"""

from datetime import datetime

from sqlalchemy import Float, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSettings(Base):
    """
    Modelo de base de datos para la configuración de la aplicación por usuario.

    Contiene los parámetros económicos globales que se aplican en todos los
    cálculos de cotización del usuario. Estos valores pueden modificarse en
    cualquier momento desde la interfaz de configuración.

    La relación con la tabla users es uno-a-uno (unique=True en user_id),
    por lo que cada usuario tiene exactamente un conjunto de configuraciones.

    Atributos:
        id: Clave primaria autoincremental.
        user_id: Clave foránea hacia la tabla users. Restricción UNIQUE que
            garantiza una sola fila de configuración por usuario.
        electricity_rate: Tarifa de electricidad en la moneda configurada por
            kWh (kilovatio-hora). Valor por defecto: 0.15 USD/kWh.
        failure_rate_percent: Porcentaje del subtotal de costos que se suma
            para cubrir impresiones fallidas o desperdicio de material.
            Valor por defecto: 5%.
        labor_cost_per_hour: Costo de la mano de obra por hora en la moneda
            configurada. Se aplica sobre el tiempo de preparación y
            post-procesado declarado en cada cotización.
            Valor por defecto: 10.0 USD/hora.
        default_margin_percent: Margen de ganancia que se aplica por defecto
            cuando el usuario no especifica uno en la solicitud de cotización.
            Valor por defecto: 30%.
        currency: Código de la moneda utilizada en los cálculos y en la
            interfaz. Ej: "USD", "EUR", "ARS". Valor por defecto: "USD".
        updated_at: Marca de tiempo UTC de la última modificación del registro,
            actualizada automáticamente en cada UPDATE.
    """

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    electricity_rate: Mapped[float] = mapped_column(Float, default=0.15)        # Costo por kWh
    failure_rate_percent: Mapped[float] = mapped_column(Float, default=5.0)     # % tasa de fallos
    labor_cost_per_hour: Mapped[float] = mapped_column(Float, default=10.0)     # Costo hora de trabajo
    default_margin_percent: Mapped[float] = mapped_column(Float, default=30.0)  # Margen por defecto
    currency: Mapped[str] = mapped_column(default="USD")                        # Moneda
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
