"""
Modelo ORM para la tabla de impresoras 3D.

Define la entidad Printer que representa una impresora 3D registrada en el
sistema. A partir de sus parámetros técnicos y económicos se calculan tres
componentes del costo de impresión: depreciación del equipo, consumo eléctrico
y mantenimiento periódico (boquilla, placa de construcción y otros gastos).

El modelo fue diseñado tomando como referencia la BambuLab P1S Combo, pero
es compatible con cualquier impresora FDM.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, DateTime, Text, Numeric
from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Printer(Base):
    """
    Modelo de base de datos que representa una impresora 3D.

    Contiene tanto datos de identificación (nombre, modelo) como parámetros
    económicos y técnicos utilizados por el motor de cálculo de costos para
    determinar cuánto cuesta operar la impresora por hora de uso.

    Atributos:
        id: Clave primaria autoincremental.
        name: Nombre personalizado dado por el usuario. Ej: "Mi BambuLab P1S Combo".
        model: Modelo comercial de la impresora. Ej: "BambuLab P1S Combo".
        purchase_price: Precio de compra de la impresora en la moneda configurada.
            Se utiliza para calcular la depreciación lineal por hora.
        power_consumption_watts: Consumo eléctrico promedio durante la impresión
            en vatios. Se usa para calcular el costo de electricidad.
        estimated_lifespan_hours: Vida útil estimada de la impresora en horas.
            Junto con el precio de compra determina la depreciación por hora.
        current_hours: Horas de uso acumuladas actualmente en la impresora.
            Permite llevar un registro del desgaste real del equipo.
        nozzle_price: Precio de reemplazo de la boquilla (nozzle) en la moneda
            configurada.
        nozzle_lifespan_hours: Cantidad de horas de impresión que dura una
            boquilla antes de requerir reemplazo.
        buildplate_price: Precio de reemplazo de la placa de construcción
            (build plate) en la moneda configurada.
        buildplate_lifespan_hours: Cantidad de horas de uso que dura una
            placa de construcción antes de requerir reemplazo.
        other_maintenance_per_hour: Costo de otros gastos de mantenimiento
            no cubiertos por boquilla ni placa, expresado por hora de uso.
            Incluye lubricantes, correas, rodamientos, etc.
        notes: Campo libre para anotaciones adicionales sobre la impresora.
        created_at: Marca de tiempo UTC de creación del registro.
        updated_at: Marca de tiempo UTC de la última modificación, actualizada
            automáticamente en cada UPDATE.
    """

    __tablename__ = "printers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    model: Mapped[str] = mapped_column(String(100))
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    power_consumption_watts: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    estimated_lifespan_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    current_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    nozzle_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    nozzle_lifespan_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("500.00")
    )
    buildplate_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("0.00")
    )
    buildplate_lifespan_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), server_default=text("2000.00")
    )
    other_maintenance_per_hour: Mapped[Decimal] = mapped_column(
        Numeric(10, 6), server_default=text("0.000000")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
