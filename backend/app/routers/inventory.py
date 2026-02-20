"""
Router de ítems de inventario para TurtleForge Cost.

Gestiona el CRUD de artículos del inventario de la empresa: materiales,
herramientas, repuestos, accesorios, etc. Todos los endpoints filtran
por company_id del usuario autenticado (multi-tenant).

Endpoints:
    GET    /api/inventory/items/              — Listar ítems del inventario.
    POST   /api/inventory/items/              — Crear un ítem.
    GET    /api/inventory/items/{id}          — Obtener ítem por ID.
    PUT    /api/inventory/items/{id}          — Actualizar un ítem.
    DELETE /api/inventory/items/{id}          — Eliminar un ítem.
    PATCH  /api/inventory/items/{id}/flag     — Alternar needs_purchase.
    PATCH  /api/inventory/items/{id}/adjust   — Ajustar cantidad (suma/resta).
"""

from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemFlagResponse,
    InventoryItemAdjustRequest,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/inventory/items", tags=["inventory"])


async def _get_company_inventory_item(
    db: AsyncSession, item_id: int, company_id
) -> InventoryItem:
    """
    Obtiene un ítem de inventario verificando que pertenezca a la empresa.

    Args:
        db:         Sesión de base de datos.
        item_id:    ID del ítem de inventario.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de InventoryItem si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.company_id == company_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ítem de inventario no encontrado",
        )
    return item


@router.get("/", response_model=List[InventoryItemResponse])
async def list_inventory_items(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los ítems de inventario de la empresa, ordenados por fecha desc.

    Si se proporciona el parámetro category, filtra por esa categoría exacta.

    Args:
        category:     Categoría para filtrar (opcional). Ej: "Filamento", "Insumo".
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de InventoryItemResponse ordenada por created_at descendente.
    """
    query = select(InventoryItem).where(InventoryItem.company_id == current_user.company_id)
    if category:
        query = query.where(InventoryItem.category == category)
    query = query.order_by(InventoryItem.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un nuevo ítem en el inventario de la empresa.

    Args:
        data:         Datos del ítem a crear.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryItemResponse con los datos del ítem creado.
    """
    item = InventoryItem(
        company_id=current_user.company_id,
        name=data.name,
        category=data.category,
        description=data.description,
        unit=data.unit,
        quantity=data.quantity,
        min_quantity=data.min_quantity,
        unit_cost=data.unit_cost,
        supplier_name=data.supplier_name,
        supplier_contact=data.supplier_contact,
        supplier_info=data.supplier_info,
        needs_purchase=data.needs_purchase,
        notes=data.notes,
        # Campos específicos para filamentos (calculadora)
        price_per_kg=data.price_per_kg,
        filament_brand=data.filament_brand,
        filament_type=data.filament_type,
        filament_color=data.filament_color,
        filament_diameter=data.filament_diameter,
        filament_density=data.filament_density,
        weight_per_roll=data.weight_per_roll,
        # Precio por unidad para insumos (calculadora)
        price_per_unit=data.price_per_unit,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene un ítem de inventario por ID.

    Args:
        item_id:      ID del ítem.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryItemResponse si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_company_inventory_item(db, item_id, current_user.company_id)


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: int,
    data: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza un ítem de inventario existente.

    Solo actualiza los campos que se envíen (no-None). El campo updated_at
    se actualiza automáticamente por el ORM (onupdate).

    Args:
        item_id:      ID del ítem a actualizar.
        data:         Datos parciales de actualización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryItemResponse con los datos actualizados.

    Raises:
        HTTPException 404: Si no existe.
    """
    item = await _get_company_inventory_item(db, item_id, current_user.company_id)

    # Actualizar solo los campos que se enviaron (exclude_unset=True)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina un ítem de inventario por ID.

    Args:
        item_id:      ID del ítem a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    item = await _get_company_inventory_item(db, item_id, current_user.company_id)
    await db.delete(item)
    await db.commit()


@router.patch("/{item_id}/flag", response_model=InventoryItemFlagResponse)
async def toggle_needs_purchase(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Alterna el flag needs_purchase del ítem (True <-> False).

    Args:
        item_id:      ID del ítem.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryItemFlagResponse con el nuevo estado del flag.

    Raises:
        HTTPException 404: Si no existe.
    """
    item = await _get_company_inventory_item(db, item_id, current_user.company_id)
    item.needs_purchase = not item.needs_purchase
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{item_id}/adjust", response_model=InventoryItemResponse)
async def adjust_inventory_quantity(
    item_id: int,
    data: InventoryItemAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ajusta la cantidad del ítem sumando o restando al stock actual.

    Un valor positivo incrementa el stock; un valor negativo lo reduce.
    La cantidad resultante no puede ser negativa.

    Args:
        item_id:      ID del ítem.
        data:         Objeto con el campo quantity (Decimal, puede ser negativo).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryItemResponse con la cantidad actualizada.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 400: Si el ajuste resultaría en stock negativo.
    """
    item = await _get_company_inventory_item(db, item_id, current_user.company_id)

    new_quantity = item.quantity + data.quantity
    if new_quantity < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ajuste resultaría en stock negativo",
        )

    item.quantity = new_quantity
    await db.commit()
    await db.refresh(item)
    return item
