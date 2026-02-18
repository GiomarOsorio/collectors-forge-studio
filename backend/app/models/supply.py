"""
Modelo ORM para los insumos adicionales de impresión 3D.

Los insumos son materiales no plásticos que se incorporan a las piezas
terminadas: argollas metálicas para keychains, switches para clickers,
imanes, insertos de rosca, etc. Se catalogan con precio unitario en USD
y se pueden añadir a cualquier cotización en la calculadora.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from app.database import Base


class Supply(Base):
    """
    Catálogo de insumos adicionales utilizados en piezas impresas.

    Atributos:
        id:             Identificador único autoincremental.
        name:           Nombre del insumo. Ej: "Argolla metálica 25mm".
        description:    Descripción opcional del insumo.
        unit:           Unidad de medida. Ej: "unidad", "par", "set".
        price_per_unit: Precio por unidad en USD.
        notes:          Notas adicionales opcionales (proveedor, talla, etc.).
        created_at:     Fecha y hora UTC de creación del registro.
    """

    __tablename__ = "supplies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String, default="unidad", nullable=False)
    price_per_unit = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
