"""
Modelo ORM para el historial de tarifas de electricidad EPM por mes y estrato.

Cada registro almacena la tarifa para un mes y estrato específico,
scrapeada del PDF oficial de EPM. Permite consultar históricos y
elegir la tarifa de cualquier mes guardado sin re-descargar el PDF.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Integer, String, Numeric, DateTime, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ElectricityTariff(Base):
    """
    Tarifa de electricidad EPM para un mes y estrato específico.

    Atributos:
        id:               Identificador único autoincremental.
        year:             Año de la tarifa. Ej: 2026.
        month:            Mes de la tarifa (1-12).
        month_label:      Texto del mes. Ej: "Febrero 2026".
        estrato:          Número de estrato socioeconómico (1-6).
        cop_market_rate:  Tarifa EPM original en COP/kWh. Numeric(14,4).
        cop_rate_used:    Tarifa con multiplicador aplicado (COP/kWh). Numeric(14,4).
        usd_rate:         Equivalente en USD/kWh. Numeric(12,6).
        usd_to_cop:       Tasa de cambio usada para la conversión. Numeric(10,2).
        multiplier:       Factor multiplicador aplicado (ej. 2.00). Numeric(5,2).
        pdf_url:          URL del PDF oficial de donde se extrajo la tarifa.
        scraped_at:       Fecha y hora UTC en que se obtuvo el dato.
    """

    __tablename__ = "electricity_tariffs"
    __table_args__ = (
        UniqueConstraint("year", "month", "estrato", name="uq_tariff_month_estrato"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    month_label: Mapped[str] = mapped_column(String, nullable=False)
    estrato: Mapped[int] = mapped_column(Integer, nullable=False)
    cop_market_rate: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    cop_rate_used: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    usd_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    usd_to_cop: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    multiplier: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, server_default=text("2.00")
    )
    pdf_url: Mapped[str] = mapped_column(String, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
