"""
Esquemas Pydantic para categorías de inventario.

Define los modelos de validación para crear, actualizar y retornar
categorías de inventario configurables por empresa.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InventoryCategoryCreate(BaseModel):
    """
    Datos para crear una nueva categoría de inventario.

    Atributos:
        name:            Nombre de la categoría (requerido, max 100 chars).
        allows_decimals: Si los ítems de esta categoría admiten decimales.
                         Por defecto False (solo enteros).
    """
    name: str = Field(min_length=1, max_length=100)
    allows_decimals: bool = False


class InventoryCategoryUpdate(BaseModel):
    """
    Datos opcionales para actualizar una categoría de inventario.

    Atributos:
        name:            Nuevo nombre (opcional).
        allows_decimals: Nuevo flag de decimales (opcional).
    """
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    allows_decimals: Optional[bool] = None


class InventoryCategoryResponse(BaseModel):
    """
    Datos completos de una categoría de inventario.

    Atributos:
        id:              Identificador único.
        name:            Nombre de la categoría.
        allows_decimals: True si los ítems admiten cantidades decimales.
        is_system:       True si fue creada por el sistema (no eliminable).
        created_at:      Fecha de creación.
    """
    id: int
    name: str
    allows_decimals: bool
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}
