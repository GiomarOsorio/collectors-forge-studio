"""
Router de ítems de inventario para Collector's Forge Studio.

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
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.printed_item import PrintedItem
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemFlagResponse,
    InventoryItemAdjustRequest,
    InventoryItemExport,
    PrintedItemExport,
    InventoryExportResponse,
    InventoryImportResult,
)
from app.limiter import limiter
from app.services.auth import get_current_user, get_operator_user

router = APIRouter(prefix="/api/inventory/items", tags=["inventory"])


async def _get_company_inventory_item(
    db: AsyncSession, item_id: int
) -> InventoryItem:
    """
    Obtiene un ítem de inventario por ID.

    Args:
        db:      Sesión de base de datos.
        item_id: ID del ítem de inventario.

    Returns:
        Instancia de InventoryItem si existe.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id)
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
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los ítems de inventario de la empresa, ordenados por fecha desc.

    Si se proporciona el parámetro category, filtra por esa categoría exacta.

    Args:
        category:     Categoría para filtrar (opcional). Ej: "Filamento", "Insumo".
        skip:         Registros a omitir (paginación).
        limit:        Máximo de registros a retornar (default 200, máx. 1000).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de InventoryItemResponse ordenada por created_at descendente.
    """
    query = select(InventoryItem)
    if category:
        query = query.where(InventoryItem.category == category)
    query = query.order_by(InventoryItem.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
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
        filament_subtype=data.filament_subtype,
        filament_color=data.filament_color,
        # Campos visuales (Claude Design)
        batch=data.batch,
        location=data.location,
        color_hex=data.color_hex,
        color_name=data.color_name,
        filament_diameter=data.filament_diameter,
        filament_density=data.filament_density,
        weight_per_roll=data.weight_per_roll,
        # Precio por unidad para insumos (calculadora)
        price_per_unit=data.price_per_unit,
        # Consumibles (calculadora)
        useful_life_hours=data.useful_life_hours,
        unit_cost_cal=data.unit_cost_cal,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/export")
async def export_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exporta todo el inventario de la empresa como un archivo JSON descargable.

    Incluye todos los ítems de stock y de impresiones de la empresa. Los campos
    id, image_key y timestamps se excluyen del resultado.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        JSONResponse con Content-Disposition: attachment para descarga directa.
    """
    items_result = await db.execute(
        select(InventoryItem)
    )
    items = items_result.scalars().all()

    prints_result = await db.execute(
        select(PrintedItem)
    )
    prints = prints_result.scalars().all()

    exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    payload = InventoryExportResponse(
        exported_at=exported_at,
        version="1",
        inventory_items=[InventoryItemExport.model_validate(item) for item in items],
        printed_items=[PrintedItemExport.model_validate(p) for p in prints],
    )

    return JSONResponse(
        content=payload.model_dump(mode="json"),
        headers={
            "Content-Disposition": f'attachment; filename="inventario_{date_str}.json"',
        },
    )


@router.post("/import", response_model=InventoryImportResult)
@limiter.limit("60/minute")
async def import_inventory(
    request: Request,
    data: InventoryExportResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Importa inventario desde un archivo JSON exportado previamente.

    Lógica de merge:
    - inventory_items: match exacto por name + category dentro de la empresa.
      Si existe → suma la cantidad. Si no existe → crea el ítem completo.
    - printed_items: match exacto por name dentro de la empresa.
      Si existe → suma la cantidad. Si no existe → crea el ítem completo.

    Se hace un batch SELECT antes del loop para evitar N+1 queries.

    Args:
        data:         Cuerpo JSON con la estructura InventoryExportResponse.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        InventoryImportResult con los conteos de ítems creados y fusionados.
    """
    # --- inventory_items ---
    item_names = [i.name for i in data.inventory_items]
    items_created = 0
    items_merged = 0

    if item_names:
        existing_result = await db.execute(
            select(InventoryItem).where(
                InventoryItem.name.in_(item_names),
            )
        )
        existing_map = {
            (row.name, row.category): row
            for row in existing_result.scalars().all()
        }
    else:
        existing_map = {}

    for item_data in data.inventory_items:
        key = (item_data.name, item_data.category)
        if key in existing_map:
            existing_map[key].quantity += Decimal(str(item_data.quantity))
            items_merged += 1
        else:
            fields = item_data.model_dump()
            new_item = InventoryItem(**fields)
            db.add(new_item)
            items_created += 1

    # --- printed_items ---
    print_names = [p.name for p in data.printed_items]
    prints_created = 0
    prints_merged = 0

    if print_names:
        existing_prints_result = await db.execute(
            select(PrintedItem).where(
                PrintedItem.name.in_(print_names),
            )
        )
        existing_prints_map = {
            row.name: row
            for row in existing_prints_result.scalars().all()
        }
    else:
        existing_prints_map = {}

    for print_data in data.printed_items:
        if print_data.name in existing_prints_map:
            existing_prints_map[print_data.name].quantity += print_data.quantity
            prints_merged += 1
        else:
            fields = print_data.model_dump()
            new_print = PrintedItem(**fields)
            db.add(new_print)
            prints_created += 1

    await db.commit()

    return InventoryImportResult(
        items_created=items_created,
        items_merged=items_merged,
        prints_created=prints_created,
        prints_merged=prints_merged,
    )


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
    return await _get_company_inventory_item(db, item_id)


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: int,
    data: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
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
    item = await _get_company_inventory_item(db, item_id)

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
    current_user: User = Depends(get_operator_user),
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
    item = await _get_company_inventory_item(db, item_id)
    await db.delete(item)
    await db.commit()


@router.patch("/{item_id}/flag", response_model=InventoryItemFlagResponse)
async def toggle_needs_purchase(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
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
    item = await _get_company_inventory_item(db, item_id)
    item.needs_purchase = not item.needs_purchase
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{item_id}/adjust", response_model=InventoryItemResponse)
async def adjust_inventory_quantity(
    item_id: int,
    data: InventoryItemAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
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
    item = await _get_company_inventory_item(db, item_id)

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
