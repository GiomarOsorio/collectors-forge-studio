"""
Modelo ORM para el historial de tarifas de electricidad EPM por mes y estrato.

Cada registro almacena la tarifa para un mes y estrato específico,
scrapeada del PDF oficial de EPM. Permite consultar históricos y
elegir la tarifa de cualquier mes guardado sin re-descargar el PDF.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from app.database import Base


class ElectricityTariff(Base):
    """
    Tarifa de electricidad EPM para un mes y estrato específico.

    Atributos:
        id:               Identificador único autoincremental.
        year:             Año de la tarifa. Ej: 2026.
        month:            Mes de la tarifa (1-12). Ej: 2 para febrero.
        month_label:      Texto del mes. Ej: "Febrero 2026".
        estrato:          Número de estrato socioeconómico (1-6).
        cop_market_rate:  Tarifa EPM original en COP/kWh.
        cop_rate_used:    Tarifa con multiplicador ×2 aplicado (COP/kWh).
        usd_rate:         Equivalente en USD/kWh listo para usar en cálculos.
        usd_to_cop:       Tasa de cambio usada para la conversión.
        multiplier:       Factor multiplicador aplicado (normalmente 2.0).
        pdf_url:          URL del PDF oficial de donde se extrajo la tarifa.
        scraped_at:       Fecha y hora UTC en que se obtuvo el dato.
    """

    __tablename__ = "electricity_tariffs"
    __table_args__ = (
        # Evitar duplicados para el mismo mes y estrato
        UniqueConstraint("year", "month", "estrato", name="uq_tariff_month_estrato"),
    )

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False)
    month_label = Column(String, nullable=False)
    estrato = Column(Integer, nullable=False)
    cop_market_rate = Column(Float, nullable=False)
    cop_rate_used = Column(Float, nullable=False)
    usd_rate = Column(Float, nullable=False)
    usd_to_cop = Column(Float, nullable=False)
    multiplier = Column(Float, nullable=False, default=2.0)
    pdf_url = Column(String, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)
