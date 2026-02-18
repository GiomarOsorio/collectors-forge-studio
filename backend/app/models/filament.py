"""
Modelo ORM para la tabla de filamentos de impresión 3D.

Define la entidad Filament que representa un carrete de filamento registrado
en el sistema. Los filamentos son uno de los insumos principales para el
cálculo de costos de impresión: a partir del precio por kilogramo y la
densidad del material se determina el costo exacto de material por pieza.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Filament(Base):
    """
    Modelo de base de datos que representa un filamento de impresión 3D.

    Almacena tanto los datos comerciales del filamento (marca, tipo, color,
    precio) como sus propiedades físicas (diámetro, densidad) necesarias para
    los cálculos de costo de material.

    Atributos:
        id: Clave primaria autoincremental del filamento.
        brand: Fabricante del filamento. Ej: eSun, Bambu, Polymaker, Prusament.
        type: Tipo de material. Ej: PLA, PETG, ABS, TPU, ASA, PA.
        color: Color del filamento. Ej: Blanco, Negro, Rojo translúcido.
        price_per_kg: Precio de compra del filamento por kilogramo en la moneda
            configurada por el usuario.
        weight_per_roll: Peso neto de filamento por carrete en gramos.
            El valor por defecto es 1000 g (1 kg), que es el estándar más común.
        diameter: Diámetro del filamento en milímetros. El estándar FDM es 1.75 mm.
        density: Densidad del material en g/cm³. El valor por defecto (1.24)
            corresponde al PLA estándar. Cada material tiene su propia densidad.
        notes: Campo libre para anotaciones adicionales sobre el filamento.
        created_at: Marca de tiempo UTC de creación del registro.
        updated_at: Marca de tiempo UTC de la última modificación del registro,
            actualizada automáticamente en cada UPDATE.
    """

    __tablename__ = "filaments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    brand: Mapped[str] = mapped_column(String(100))  # Ej: eSun, Bambu, Polymaker
    type: Mapped[str] = mapped_column(String(50))    # PLA, PETG, ABS, TPU, etc.
    color: Mapped[str] = mapped_column(String(50))
    price_per_kg: Mapped[float] = mapped_column(Float)           # Precio por kg
    weight_per_roll: Mapped[float] = mapped_column(Float, default=1000.0)  # Gramos por rollo
    diameter: Mapped[float] = mapped_column(Float, default=1.75)  # mm
    density: Mapped[float] = mapped_column(Float, default=1.24)   # g/cm³ (PLA default)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
