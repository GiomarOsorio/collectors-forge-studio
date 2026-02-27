"""
Router de órdenes de compra para TurtleForge Cost.

Gestiona el CRUD de pedidos a proveedores y la lógica de recepción de
mercancía. Al marcar una orden como "llegado", actualiza automáticamente
el stock de los ítems de inventario vinculados (transacción atómica).

Endpoints:
    GET    /api/inventory/purchases/              — Listar órdenes de compra.
    POST   /api/inventory/purchases/              — Crear una orden con ítems.
    GET    /api/inventory/purchases/{id}          — Obtener orden por ID con ítems.
    PUT    /api/inventory/purchases/{id}          — Actualizar campos de la orden.
    DELETE /api/inventory/purchases/{id}          — Eliminar una orden.
    POST   /api/inventory/purchases/{id}/arrive   — Marcar como llegado y actualizar stock.
    GET    /api/inventory/purchases/{id}/tracking — Proxy: consultar tracking en parcelsapp.
    POST   /api/inventory/purchases/scan-tracking  — Proxy: lanzar escaneo masivo de tracking.
"""

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.user import User
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/inventory/purchases", tags=["purchase-orders"])


async def _get_company_purchase_order(
    db: AsyncSession, order_id: int, company_id
) -> PurchaseOrder:
    """
    Obtiene una orden de compra verificando que pertenezca a la empresa.

    Carga los ítems de la orden con selectinload para evitar lazy loading.

    Args:
        db:         Sesión de base de datos.
        order_id:   ID de la orden de compra.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de PurchaseOrder con ítems cargados.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(
            PurchaseOrder.id == order_id,
            PurchaseOrder.company_id == company_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de compra no encontrada",
        )
    return order


@router.get("/", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todas las órdenes de compra de la empresa con sus ítems.

    Ordena por fecha de creación descendente y carga los ítems con
    selectinload para evitar el problema N+1.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de PurchaseOrderResponse ordenada por created_at descendente.
    """
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.company_id == current_user.company_id)
        .order_by(PurchaseOrder.created_at.desc())
    )
    return result.scalars().unique().all()


@router.post("/", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva orden de compra con sus ítems.

    Cada ítem puede vincularse opcionalmente a un InventoryItem existente
    para permitir la actualización automática del stock al recibir la orden.

    Args:
        data:         Datos de la orden incluyendo la lista de ítems.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PurchaseOrderResponse con la orden creada y sus ítems.
    """
    order = PurchaseOrder(
        company_id=current_user.company_id,
        supplier=data.supplier,
        tracking_number=data.tracking_number,
        carrier=data.carrier,
        estimated_arrival=data.estimated_arrival,
        notes=data.notes,
    )

    # Crear los ítems del pedido
    for item_data in data.items:
        order_item = PurchaseOrderItem(
            name=item_data.name,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            inventory_item_id=item_data.inventory_item_id,
            notes=item_data.notes,
        )
        order.items.append(order_item)

    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Recargar con los ítems para la respuesta
    return await _get_company_purchase_order(db, order.id, current_user.company_id)


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene una orden de compra por ID con sus ítems.

    Args:
        order_id:     ID de la orden de compra.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PurchaseOrderResponse si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_company_purchase_order(db, order_id, current_user.company_id)


@router.put("/{order_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    order_id: int,
    data: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza los campos de una orden de compra (no modifica los ítems).

    Solo actualiza los campos que se envíen (exclude_unset=True).
    Para modificar los ítems se debe eliminar y recrear la orden.

    Args:
        order_id:     ID de la orden a actualizar.
        data:         Datos parciales de actualización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PurchaseOrderResponse con los datos actualizados.

    Raises:
        HTTPException 404: Si no existe.
    """
    order = await _get_company_purchase_order(db, order_id, current_user.company_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    await db.commit()
    await db.refresh(order)

    # Recargar con ítems
    return await _get_company_purchase_order(db, order.id, current_user.company_id)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una orden de compra y todos sus ítems (cascade).

    Args:
        order_id:     ID de la orden a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    order = await _get_company_purchase_order(db, order_id, current_user.company_id)
    await db.delete(order)
    await db.commit()


@router.post("/{order_id}/arrive", response_model=PurchaseOrderResponse)
async def mark_order_arrived(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marca una orden de compra como "llegado" y actualiza el stock.

    Operación atómica (transacción): cambia el estado a "llegado",
    registra la fecha de llegada y, para cada ítem del pedido que tenga
    un inventory_item_id vinculado, incrementa la cantidad del ítem
    de inventario correspondiente. Si tras el incremento el stock supera
    el mínimo configurado, desactiva el flag needs_purchase.

    Solo se puede marcar como llegada una orden en estado "pendiente"
    o "en_transito".

    Args:
        order_id:     ID de la orden a marcar como llegada.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PurchaseOrderResponse con el estado actualizado y los ítems.

    Raises:
        HTTPException 404: Si no existe.
        HTTPException 400: Si la orden ya fue marcada como llegada o cancelada.
    """
    order = await _get_company_purchase_order(db, order_id, current_user.company_id)

    # Validar que la orden esté en un estado que permita marcarla como llegada
    if order.status not in ("pendiente", "en_transito"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede marcar como llegada una orden con estado '{order.status}'",
        )

    # Actualizar estado y fecha de llegada
    order.status = "llegado"
    order.arrived_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Actualizar stock de los ítems de inventario vinculados
    for order_item in order.items:
        if order_item.inventory_item_id is not None:
            # Obtener el ítem de inventario (debe pertenecer a la misma empresa)
            result = await db.execute(
                select(InventoryItem).where(
                    InventoryItem.id == order_item.inventory_item_id,
                    InventoryItem.company_id == current_user.company_id,
                )
            )
            inv_item = result.scalar_one_or_none()
            if inv_item:
                inv_item.quantity += order_item.quantity
                # Si el stock ya supera el mínimo, desactivar needs_purchase
                if inv_item.quantity >= inv_item.min_quantity:
                    inv_item.needs_purchase = False

    await db.commit()

    # Recargar la orden completa con ítems para la respuesta
    return await _get_company_purchase_order(db, order.id, current_user.company_id)


TRACKER_URL = os.environ.get("TRACKER_URL", "http://tracker:8002")


@router.post("/scan-tracking")
async def scan_tracking(
    current_user: User = Depends(get_current_user),
):
    """
    Proxy al microservicio tracker para actualizar tracking de todos los pedidos.

    El microservicio tracker lee directamente la base de datos, abre
    parcelsapp.com con Playwright para cada pedido activo y actualiza
    el estado y los datos de tracking.

    Args:
        current_user: Usuario autenticado (cualquier rol puede disparar el escaneo).

    Returns:
        Resultado del escaneo retornado por el microservicio tracker.

    Raises:
        HTTPException 503: Si el microservicio tracker no está disponible.
    """
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{TRACKER_URL}/scan")
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio de tracking no disponible",
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        )
