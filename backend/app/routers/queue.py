"""
Router de cola de impresión para TurtleForge Studio.

Gestiona los trabajos de impresión encolados. Solo se pueden agregar cotizaciones
guardadas (Quote). Al marcar un trabajo como 'done', se descuenta automáticamente
el inventario de filamentos e insumos y se suman las horas de impresión a la
impresora correspondiente (transacción atómica).

Endpoints disponibles bajo el prefijo /api/queue:
    GET    /           — Lista ítems pendientes + en impresión (ordenados por posición).
    POST   /           — Agrega un ítem a la cola.
    PUT    /{id}/status — Cambia el estado de un ítem (con lógica atómica si done).
    DELETE /{id}       — Elimina un ítem (solo si pending o cancelled).
    GET    /history    — Historial done + cancelled (últimos 50, desc por completed_at).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.printer import Printer
from app.models.queue import PrintQueueItem
from app.models.quote import Quote
from app.models.user import User
from app.schemas.queue import (
    PrintQueueItemCreate,
    PrintQueueItemResponse,
    PrintQueueStatusUpdate,
    QueueQuoteSnapshot,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/queue", tags=["queue"])

# Estados válidos para la cola
_ACTIVE_STATUSES = ("pending", "printing")
_TERMINAL_STATUSES = ("done", "cancelled")


# ─── Helpers privados ─────────────────────────────────────────────────────────

async def _get_item(db: AsyncSession, item_id: int, company_id) -> PrintQueueItem:
    """
    Recupera un ítem de la cola por ID filtrando por company_id.

    Raises:
        HTTPException 404: Si no existe el ítem o no pertenece a la empresa.
    """
    result = await db.execute(
        select(PrintQueueItem).where(
            PrintQueueItem.id == item_id,
            PrintQueueItem.company_id == company_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cola no encontrado")
    return item


async def _build_response(
    item: PrintQueueItem, db: AsyncSession
) -> PrintQueueItemResponse:
    """
    Construye la respuesta enriquecida con el snapshot de la cotización.

    Si la cotización fue eliminada (quote_id es None), el campo quote queda None.
    """
    quote_snapshot: Optional[QueueQuoteSnapshot] = None

    if item.quote_id is not None:
        q_result = await db.execute(
            select(Quote).where(Quote.id == item.quote_id)
        )
        quote = q_result.scalar_one_or_none()

        if quote is not None:
            # Cargar nombre de impresora
            p_result = await db.execute(
                select(Printer).where(Printer.id == quote.printer_id)
            )
            printer = p_result.scalar_one_or_none()
            printer_name = printer.name if printer else f"Impresora #{quote.printer_id}"

            quote_snapshot = QueueQuoteSnapshot(
                id=quote.id,
                piece_name=quote.piece_name,
                printer_id=quote.printer_id,
                printer_name=printer_name,
                weight_grams=float(quote.weight_grams),
                print_time_hours=float(quote.print_time_hours),
                quantity=int(quote.quantity),
                total_price=float(quote.total_price),
            )

    return PrintQueueItemResponse(
        id=item.id,
        company_id=item.company_id,
        quote_id=item.quote_id,
        status=item.status,
        position=item.position,
        started_at=item.started_at,
        completed_at=item.completed_at,
        notes=item.notes,
        created_at=item.created_at,
        quote=quote_snapshot,
    )


async def _deduct_inventory_and_update_printer(
    db: AsyncSession, quote: Quote
) -> None:
    """
    Descuenta el inventario de filamentos e insumos y suma las horas de impresión
    a la impresora. Se ejecuta al marcar un ítem como 'done'.

    La lógica multiplica cantidades por quote.quantity para reflejar el total real.

    Raises:
        HTTPException 400: Si hay stock insuficiente en algún ítem de inventario.
        HTTPException 404: Si la impresora no existe.
    """
    multiplier = Decimal(str(int(quote.quantity)))
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Filamento principal
    if quote.inventory_item_id is not None:
        inv = await db.get(InventoryItem, quote.inventory_item_id)
        if inv is not None:
            deduct = Decimal(str(quote.weight_grams)) * multiplier
            inv.quantity = (inv.quantity or Decimal("0")) - deduct
            if inv.quantity < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente: {inv.name} (necesita {float(deduct):.1f} g)",
                )
            if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                inv.needs_purchase = True

    # 2. Filamentos adicionales (additional_filaments_detail JSONB)
    for af in (quote.additional_filaments_detail or []):
        iid = af.get("filament_id")
        if iid is not None:
            inv = await db.get(InventoryItem, int(iid))
            if inv is not None:
                deduct = Decimal(str(af["weight_grams"])) * multiplier
                inv.quantity = (inv.quantity or Decimal("0")) - deduct
                if inv.quantity < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente (filamento adicional): {inv.name}",
                    )
                if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                    inv.needs_purchase = True

    # 3. Insumos (supplies_detail JSONB)
    for s in (quote.supplies_detail or []):
        iid = s.get("supply_id")
        if iid is not None:
            inv = await db.get(InventoryItem, int(iid))
            if inv is not None:
                deduct = Decimal(str(s["quantity"])) * multiplier
                inv.quantity = (inv.quantity or Decimal("0")) - deduct
                if inv.quantity < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente (insumo): {inv.name}",
                    )
                if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                    inv.needs_purchase = True

    # 4. Horas de impresora
    printer = await db.get(Printer, quote.printer_id)
    if printer is None:
        raise HTTPException(status_code=404, detail="Impresora de la cotización no encontrada")
    printer.current_hours = (printer.current_hours or Decimal("0")) + (
        Decimal(str(quote.print_time_hours)) * multiplier
    )
    printer.updated_at = now


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/history", response_model=List[PrintQueueItemResponse])
async def list_queue_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los últimos 50 trabajos completados o cancelados de la empresa.

    Ordenados por completed_at descendente (más recientes primero).
    """
    result = await db.execute(
        select(PrintQueueItem)
        .where(
            PrintQueueItem.company_id == current_user.company_id,
            PrintQueueItem.status.in_(list(_TERMINAL_STATUSES)),
        )
        .order_by(PrintQueueItem.completed_at.desc())
        .limit(50)
    )
    items = result.scalars().all()
    return [await _build_response(item, db) for item in items]


@router.get("/", response_model=List[PrintQueueItemResponse])
async def list_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todos los trabajos pendientes o en impresión de la empresa.

    Ordenados por position ascendente (primero en cola = primero en la lista).
    """
    result = await db.execute(
        select(PrintQueueItem)
        .where(
            PrintQueueItem.company_id == current_user.company_id,
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
        .order_by(PrintQueueItem.position.asc())
    )
    items = result.scalars().all()
    return [await _build_response(item, db) for item in items]


@router.post("/", response_model=PrintQueueItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_queue(
    data: PrintQueueItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Agrega una cotización guardada a la cola de impresión.

    Asigna automáticamente la siguiente posición disponible (MAX + 1).

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    # Verificar que la cotización existe y pertenece a la empresa
    q_result = await db.execute(
        select(Quote).where(
            Quote.id == data.quote_id,
            Quote.company_id == current_user.company_id,
        )
    )
    if q_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    # Calcular la siguiente posición en la cola
    max_result = await db.execute(
        select(func.max(PrintQueueItem.position)).where(
            PrintQueueItem.company_id == current_user.company_id,
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
    )
    max_pos = max_result.scalar() or 0

    item = PrintQueueItem(
        company_id=current_user.company_id,
        quote_id=data.quote_id,
        status="pending",
        position=max_pos + 1,
        notes=data.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _build_response(item, db)


@router.put("/{item_id}/status", response_model=PrintQueueItemResponse)
async def update_queue_status(
    item_id: int,
    data: PrintQueueStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cambia el estado de un ítem de la cola de impresión.

    Transiciones válidas:
      - pending   → printing   (marca inicio de impresión)
      - pending   → cancelled  (cancela sin imprimir)
      - printing  → done       (marca como impreso, descuenta inventario y suma horas)
      - printing  → cancelled  (cancela durante impresión)

    Los estados 'done' y 'cancelled' son terminales: no se pueden cambiar.

    Raises:
        HTTPException 400: Si la transición no es válida o hay stock insuficiente.
        HTTPException 404: Si el ítem no existe o no pertenece a la empresa.
    """
    new_status = data.status
    if new_status not in ("printing", "done", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Estado inválido: '{new_status}'. Use 'printing', 'done' o 'cancelled'.",
        )

    item = await _get_item(db, item_id, current_user.company_id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Bloquear transiciones desde estados terminales
    if item.status in _TERMINAL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cambiar el estado de un ítem '{item.status}'.",
        )

    # Validar transición específica
    valid_transitions = {
        "pending":  ("printing", "cancelled"),
        "printing": ("done", "cancelled"),
    }
    allowed = valid_transitions.get(item.status, ())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: {item.status} → {new_status}.",
        )

    # Lógica atómica al marcar como 'done'
    if new_status == "done":
        if item.quote_id is None:
            raise HTTPException(
                status_code=400,
                detail="No se puede marcar como hecho: la cotización original fue eliminada.",
            )
        q_result = await db.execute(
            select(Quote).where(
                Quote.id == item.quote_id,
                Quote.company_id == current_user.company_id,
            )
        )
        quote = q_result.scalar_one_or_none()
        if quote is None:
            raise HTTPException(
                status_code=404,
                detail="Cotización original no encontrada en la empresa.",
            )
        await _deduct_inventory_and_update_printer(db, quote)
        item.completed_at = now

    elif new_status == "cancelled":
        item.completed_at = now

    elif new_status == "printing":
        item.started_at = now

    item.status = new_status
    await db.commit()
    await db.refresh(item)
    return await _build_response(item, db)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_queue_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina un ítem de la cola.

    Solo se pueden eliminar ítems en estado 'pending' o 'cancelled'.

    Raises:
        HTTPException 400: Si el ítem está en estado 'printing' o 'done'.
        HTTPException 404: Si el ítem no existe o no pertenece a la empresa.
    """
    item = await _get_item(db, item_id, current_user.company_id)
    if item.status not in ("pending", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar un ítem con estado '{item.status}'.",
        )
    await db.delete(item)
    await db.commit()
