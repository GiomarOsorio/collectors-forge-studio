"""
Router de categorías de inventario para TurtleForge Cost.

Gestiona el CRUD de categorías de inventario configurables por empresa.
Las categorías marcadas como is_system=True (ej: Filamento) no pueden eliminarse.
Todos los endpoints filtran por company_id del usuario autenticado (multi-tenant).

Endpoints:
    GET    /api/inventory/categories/        — Listar categorías de la empresa.
    POST   /api/inventory/categories/        — Crear una nueva categoría.
    PUT    /api/inventory/categories/{id}    — Actualizar nombre o allows_decimals.
    DELETE /api/inventory/categories/{id}    — Eliminar (si no es sistema y sin ítems).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory_category import InventoryCategory
from app.models.inventory import InventoryItem
from app.models.user import User
from app.schemas.inventory_category import (
    InventoryCategoryCreate,
    InventoryCategoryUpdate,
    InventoryCategoryResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/inventory/categories", tags=["inventory-categories"])


async def _get_company_category(
    db: AsyncSession, category_id: int, company_id
) -> InventoryCategory:
    """
    Obtiene una categoría verificando que pertenezca a la empresa.

    Args:
        db:          Sesión de base de datos.
        category_id: ID de la categoría.
        company_id:  UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de InventoryCategory si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(InventoryCategory).where(
            InventoryCategory.id == category_id,
            InventoryCategory.company_id == company_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )
    return cat


@router.get("/", response_model=List[InventoryCategoryResponse])
async def list_inventory_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todas las categorías de inventario de la empresa, ordenadas por nombre.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de InventoryCategoryResponse ordenada alfabéticamente.
    """
    result = await db.execute(
        select(InventoryCategory)
        .where(InventoryCategory.company_id == current_user.company_id)
        .order_by(InventoryCategory.name)
    )
    return result.scalars().all()


@router.post("/", response_model=InventoryCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_category(
    data: InventoryCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva categoría de inventario para la empresa.

    No se pueden crear categorías con nombres duplicados dentro de la misma empresa.

    Args:
        data:         Datos de la categoría (name, allows_decimals).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryCategoryResponse con los datos de la categoría creada.

    Raises:
        HTTPException 409: Si ya existe una categoría con ese nombre en la empresa.
    """
    # Verificar nombre duplicado
    existing = await db.execute(
        select(InventoryCategory).where(
            InventoryCategory.company_id == current_user.company_id,
            InventoryCategory.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una categoría llamada '{data.name}' en esta empresa",
        )

    cat = InventoryCategory(
        company_id=current_user.company_id,
        name=data.name,
        allows_decimals=data.allows_decimals,
        is_system=False,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=InventoryCategoryResponse)
async def update_inventory_category(
    category_id: int,
    data: InventoryCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza el nombre o el flag allows_decimals de una categoría.

    Las categorías de sistema (is_system=True) pueden actualizarse en allows_decimals
    pero no en nombre (para preservar la integridad del sistema).

    Args:
        category_id:  ID de la categoría a actualizar.
        data:         Datos parciales de actualización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryCategoryResponse con los datos actualizados.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 403: Si se intenta renombrar una categoría de sistema.
        HTTPException 409: Si el nuevo nombre ya está en uso.
    """
    cat = await _get_company_category(db, category_id, current_user.company_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != cat.name:
        if cat.is_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Las categorías del sistema no pueden renombrarse",
            )
        # Verificar nombre duplicado
        existing = await db.execute(
            select(InventoryCategory).where(
                InventoryCategory.company_id == current_user.company_id,
                InventoryCategory.name == update_data["name"],
                InventoryCategory.id != category_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una categoría llamada '{update_data['name']}' en esta empresa",
            )

    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una categoría de inventario.

    No se pueden eliminar categorías de sistema (is_system=True) ni categorías
    que tengan ítems de inventario asociados.

    Args:
        category_id:  ID de la categoría a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 403: Si es una categoría de sistema.
        HTTPException 409: Si tiene ítems de inventario asociados.
    """
    cat = await _get_company_category(db, category_id, current_user.company_id)

    if cat.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Las categorías del sistema no pueden eliminarse",
        )

    # Verificar que no haya ítems usando esta categoría
    items_result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.company_id == current_user.company_id,
            InventoryItem.category == cat.name,
        )
    )
    if items_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la categoría porque tiene ítems de inventario asociados",
        )

    await db.delete(cat)
    await db.commit()
