"""
Modelo ORM para categorías de inventario configurables por empresa.

Cada empresa gestiona su propio catálogo de categorías. La categoría
'Filamento' está marcada como is_system=True y no puede eliminarse.
El flag allows_decimals controla si los ítems de esa categoría admiten
cantidades decimales (filamento en gramos) o solo enteros (accesorios,
herramientas, insumos por unidad).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventoryCategory(Base):
    """
    Categoría de inventario del sistema (mono-empresa).

    Atributos:
        id:              Identificador autoincremental.
        name:            Nombre único (max 100 chars).
        allows_decimals: True solo para Filamento (gramos fraccionados).
                         False = cantidades enteras (unidades, piezas, etc.).
        is_system:       True = creada por el sistema, no se puede eliminar.
        created_at:      Fecha de creación.
    """

    __tablename__ = "inventory_categories"
    __table_args__ = (
        UniqueConstraint("name", name="uq_inventory_category_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    allows_decimals: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
