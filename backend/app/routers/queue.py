"""
Router de cola de impresión para Collector's Forge Studio.

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
from app.models.model_file import ModelFile
from app.models.printer import Printer
from app.models.queue import PrintQueueItem
from app.models.quote import Quote
from app.models.user import User
from app.schemas.queue import (
    PrintQueueItemCreate,
    PrintQueueItemFromVaultCreate,
    PrintQueueItemResponse,
    PrintQueueStatusUpdate,
    QueueQuoteSnapshot,
    QueueVaultSnapshot,
)
from app.services.auth import get_current_user, get_operator_user

router = APIRouter(prefix="/api/queue", tags=["queue"])

# Estados válidos para la cola
_ACTIVE_STATUSES = ("pending", "printing")
_TERMINAL_STATUSES = ("done", "cancelled")


# ─── Helpers privados ─────────────────────────────────────────────────────────

async def _get_item(db: AsyncSession, item_id: int) -> PrintQueueItem:
    """
    Recupera un ítem de la cola por ID.

    Raises:
        HTTPException 404: Si no existe el ítem.
    """
    result = await db.execute(
        select(PrintQueueItem).where(PrintQueueItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de cola no encontrado")
    return item


async def _build_response(
    item: PrintQueueItem, db: AsyncSession
) -> PrintQueueItemResponse:
    """
    Construye la respuesta enriquecida con el snapshot de la fuente
    (Quote o Vault). Si la fuente fue eliminada después de encolar, el
    snapshot correspondiente queda None — el item sigue siendo válido en
    historial (terminales).

    Úsese para ítems individuales. Para listas usar `_build_responses_bulk`.
    """
    quote_snapshot: Optional[QueueQuoteSnapshot] = None
    vault_snapshot: Optional[QueueVaultSnapshot] = None

    if item.quote_id is not None:
        q_result = await db.execute(select(Quote).where(Quote.id == item.quote_id))
        quote = q_result.scalar_one_or_none()
        if quote is not None:
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

    if item.vault_model_id is not None or item.piece_name is not None:
        # Vault items: cargar impresora + filamento + (opcional) modelo del Vault.
        printer_name: Optional[str] = None
        if item.printer_id is not None:
            p_result = await db.execute(
                select(Printer).where(Printer.id == item.printer_id)
            )
            printer = p_result.scalar_one_or_none()
            printer_name = printer.name if printer else f"Impresora #{item.printer_id}"

        filament_name: Optional[str] = None
        if item.filament_id is not None:
            f_result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == item.filament_id)
            )
            fil = f_result.scalar_one_or_none()
            filament_name = fil.name if fil else None

        sliced_filament_type: Optional[str] = None
        print_file_name: Optional[str] = None
        if item.vault_model_id is not None:
            m_result = await db.execute(
                select(ModelFile).where(ModelFile.id == item.vault_model_id)
            )
            model = m_result.scalar_one_or_none()
            if model is not None:
                sliced_filament_type = model.sliced_filament_type
                print_file_name = model.print_file_name

        vault_snapshot = QueueVaultSnapshot(
            vault_model_id=item.vault_model_id or 0,
            name=item.piece_name or "Modelo del Vault",
            printer_id=item.printer_id,
            printer_name=printer_name,
            filament_id=item.filament_id,
            filament_name=filament_name,
            sliced_filament_type=sliced_filament_type,
            weight_grams=item.weight_grams,
            print_time_hours=item.print_time_hours,
            quantity=int(item.quantity or 1),
            print_file_name=print_file_name,
        )

    return PrintQueueItemResponse(
        id=item.id,
        quote_id=item.quote_id,
        vault_model_id=item.vault_model_id,
        status=item.status,
        position=item.position,
        started_at=item.started_at,
        completed_at=item.completed_at,
        notes=item.notes,
        created_at=item.created_at,
        quote=quote_snapshot,
        vault=vault_snapshot,
    )


async def _build_responses_bulk(
    items: list, db: AsyncSession
) -> list:
    """
    Construye respuestas enriquecidas para una lista de ítems con queries
    batched (evita N+1). Carga en IN(...) batches separados todas las
    cotizaciones, todas las impresoras (mezclando las referenciadas por
    quotes y las referenciadas directamente por vault items), todos los
    filamentos referenciados, y todos los ModelFiles referenciados.

    Args:
        items: Lista de PrintQueueItem.
        db:    Sesión de base de datos.

    Returns:
        Lista de PrintQueueItemResponse en el mismo orden que items.
    """
    if not items:
        return []

    # Batch 1: cargar todas las cotizaciones referenciadas (quote items).
    quote_ids = {item.quote_id for item in items if item.quote_id is not None}
    quotes_by_id: dict = {}
    if quote_ids:
        q_result = await db.execute(select(Quote).where(Quote.id.in_(quote_ids)))
        quotes_by_id = {q.id: q for q in q_result.scalars().all()}

    # Batch 2: cargar TODAS las impresoras referenciadas (quotes + vault items).
    printer_ids: set = {q.printer_id for q in quotes_by_id.values()}
    printer_ids.update(
        item.printer_id for item in items if item.printer_id is not None
    )
    printers_by_id: dict = {}
    if printer_ids:
        p_result = await db.execute(select(Printer).where(Printer.id.in_(printer_ids)))
        printers_by_id = {p.id: p for p in p_result.scalars().all()}

    # Batch 3: filamentos referenciados por vault items.
    filament_ids = {item.filament_id for item in items if item.filament_id is not None}
    filaments_by_id: dict = {}
    if filament_ids:
        f_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id.in_(filament_ids))
        )
        filaments_by_id = {f.id: f for f in f_result.scalars().all()}

    # Batch 4: ModelFiles referenciados por vault items.
    model_ids = {item.vault_model_id for item in items if item.vault_model_id is not None}
    models_by_id: dict = {}
    if model_ids:
        m_result = await db.execute(
            select(ModelFile).where(ModelFile.id.in_(model_ids))
        )
        models_by_id = {m.id: m for m in m_result.scalars().all()}

    # Construir respuestas en memoria (0 queries adicionales).
    responses = []
    for item in items:
        quote_snapshot: Optional[QueueQuoteSnapshot] = None
        vault_snapshot: Optional[QueueVaultSnapshot] = None

        if item.quote_id is not None:
            quote = quotes_by_id.get(item.quote_id)
            if quote is not None:
                printer = printers_by_id.get(quote.printer_id)
                printer_name = (
                    printer.name if printer else f"Impresora #{quote.printer_id}"
                )
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

        if item.vault_model_id is not None or item.piece_name is not None:
            printer = (
                printers_by_id.get(item.printer_id) if item.printer_id else None
            )
            printer_name = (
                printer.name
                if printer
                else (f"Impresora #{item.printer_id}" if item.printer_id else None)
            )
            fil = filaments_by_id.get(item.filament_id) if item.filament_id else None
            model = (
                models_by_id.get(item.vault_model_id) if item.vault_model_id else None
            )
            vault_snapshot = QueueVaultSnapshot(
                vault_model_id=item.vault_model_id or 0,
                name=item.piece_name or "Modelo del Vault",
                printer_id=item.printer_id,
                printer_name=printer_name,
                filament_id=item.filament_id,
                filament_name=fil.name if fil else None,
                sliced_filament_type=model.sliced_filament_type if model else None,
                weight_grams=item.weight_grams,
                print_time_hours=item.print_time_hours,
                quantity=int(item.quantity or 1),
                print_file_name=model.print_file_name if model else None,
            )

        responses.append(
            PrintQueueItemResponse(
                id=item.id,
                quote_id=item.quote_id,
                vault_model_id=item.vault_model_id,
                status=item.status,
                position=item.position,
                started_at=item.started_at,
                completed_at=item.completed_at,
                notes=item.notes,
                created_at=item.created_at,
                quote=quote_snapshot,
                vault=vault_snapshot,
            )
        )
    return responses


async def _deduct_vault_item(
    db: AsyncSession, item: PrintQueueItem
) -> None:
    """
    Descuenta inventario y suma horas a la impresora para un item que vino
    del Vault (no de un Quote). Mucho más simple que el camino de Quote:
    no hay additional_filaments_detail ni supplies_detail.

    - Si `filament_id` está seteado, descuenta `weight_grams * quantity` del item.
    - Si `printer_id` está seteado, suma `print_time_hours * quantity` a current_hours.
    """
    multiplier = Decimal(str(int(item.quantity or 1)))
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if item.filament_id is not None and item.weight_grams is not None:
        inv_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id == item.filament_id).with_for_update()
        )
        inv = inv_result.scalar_one_or_none()
        if inv is not None:
            deduct = Decimal(str(item.weight_grams)) * multiplier
            inv.quantity = (inv.quantity or Decimal("0")) - deduct
            if inv.quantity < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente: {inv.name} (necesita {float(deduct):.1f} g)",
                )
            if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                inv.needs_purchase = True

    if item.printer_id is not None and item.print_time_hours is not None:
        p_result = await db.execute(
            select(Printer).where(Printer.id == item.printer_id).with_for_update()
        )
        printer = p_result.scalar_one_or_none()
        if printer is None:
            raise HTTPException(
                status_code=404, detail="Impresora del item no encontrada"
            )
        printer.current_hours = (printer.current_hours or Decimal("0")) + (
            Decimal(str(item.print_time_hours)) * multiplier
        )
        printer.updated_at = now


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
        inv_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id == quote.inventory_item_id).with_for_update()
        )
        inv = inv_result.scalar_one_or_none()
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
            inv_result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == int(iid)).with_for_update()
            )
            inv = inv_result.scalar_one_or_none()
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
            inv_result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == int(iid)).with_for_update()
            )
            inv = inv_result.scalar_one_or_none()
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
    p_result = await db.execute(
        select(Printer).where(Printer.id == quote.printer_id).with_for_update()
    )
    printer = p_result.scalar_one_or_none()
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
            PrintQueueItem.status.in_(list(_TERMINAL_STATUSES)),
        )
        .order_by(PrintQueueItem.completed_at.desc())
        .limit(50)
    )
    items = result.scalars().all()
    return await _build_responses_bulk(items, db)


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
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
        .order_by(PrintQueueItem.position.asc())
    )
    items = result.scalars().all()
    return await _build_responses_bulk(items, db)


@router.post("/", response_model=PrintQueueItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_queue(
    data: PrintQueueItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Agrega una cotización guardada a la cola de impresión.

    Asigna automáticamente la siguiente posición disponible (MAX + 1).

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    # Verificar que la cotización existe
    q_result = await db.execute(
        select(Quote).where(Quote.id == data.quote_id)
    )
    if q_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    # Calcular la siguiente posición en la cola
    max_result = await db.execute(
        select(func.max(PrintQueueItem.position)).where(
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
    )
    max_pos = max_result.scalar() or 0

    item = PrintQueueItem(
        quote_id=data.quote_id,
        status="pending",
        position=max_pos + 1,
        notes=data.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _build_response(item, db)


@router.post(
    "/from-vault",
    response_model=PrintQueueItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_to_queue_from_vault(
    data: PrintQueueItemFromVaultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Agrega un `ModelFile` del Vault a la cola de impresión.

    El modelo debe tener un `print_file` (.gcode.3mf) — si solo tiene
    `source_file` editable, no se puede encolar (lamina primero en Slicer
    y vuelve a subir).

    Toma los datos físicos de impresión (peso, tiempo) del `sliced_*` del
    modelo y los **denormaliza** en el item: cambios futuros en el Vault
    no afectan items ya encolados. También congela el `print_file_key`
    en `print_file_snapshot_path` por la misma razón.

    Raises:
        404 si el modelo o la impresora no existen.
        400 si el modelo no tiene `print_file` (no es imprimible).
    """
    # Verificar modelo + print_file presente.
    m_result = await db.execute(
        select(ModelFile).where(ModelFile.id == data.vault_model_id)
    )
    model = m_result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status_code=404, detail="Modelo del Vault no encontrado")
    if not model.print_file_key:
        raise HTTPException(
            status_code=400,
            detail="Este modelo no tiene .gcode.3mf laminado. Lamínalo en Slicer y vuelve a subirlo.",
        )

    # Verificar impresora.
    p_result = await db.execute(
        select(Printer).where(Printer.id == data.printer_id)
    )
    if p_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")

    # Verificar filamento si se eligió.
    if data.filament_id is not None:
        f_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id == data.filament_id)
        )
        if f_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Filamento no encontrado")

    # Calcular siguiente posición.
    max_result = await db.execute(
        select(func.max(PrintQueueItem.position)).where(
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
    )
    max_pos = max_result.scalar() or 0

    # Convertir tiempo (sliced_time_seconds → horas para denorm).
    print_time_hours: Optional[Decimal] = None
    if model.sliced_time_seconds is not None:
        print_time_hours = (Decimal(model.sliced_time_seconds) / Decimal(3600)).quantize(
            Decimal("0.0001")
        )

    item = PrintQueueItem(
        vault_model_id=model.id,
        print_file_snapshot_path=model.print_file_key,
        piece_name=model.name,
        printer_id=data.printer_id,
        filament_id=data.filament_id,
        quantity=data.quantity,
        weight_grams=model.sliced_weight_g,
        print_time_hours=print_time_hours,
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
    current_user: User = Depends(get_operator_user),
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

    item = await _get_item(db, item_id)
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

    # Lógica atómica al marcar como 'done'. Dos caminos según la fuente:
    if new_status == "done":
        if item.quote_id is not None:
            q_result = await db.execute(
                select(Quote).where(Quote.id == item.quote_id)
            )
            quote = q_result.scalar_one_or_none()
            if quote is None:
                raise HTTPException(
                    status_code=404,
                    detail="Cotización original no encontrada.",
                )
            await _deduct_inventory_and_update_printer(db, quote)
        elif item.vault_model_id is not None or item.printer_id is not None:
            # Vault item: descontar filamento + sumar horas según los datos
            # denormalizados del propio item (no dependen del ModelFile, así
            # que sigue funcionando aunque el modelo haya sido borrado).
            await _deduct_vault_item(db, item)
        else:
            raise HTTPException(
                status_code=400,
                detail="No se puede marcar como hecho: el item no tiene fuente (ni quote ni vault).",
            )
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
    current_user: User = Depends(get_operator_user),
):
    """
    Elimina un ítem de la cola.

    Solo se pueden eliminar ítems en estado 'pending' o 'cancelled'.

    Raises:
        HTTPException 400: Si el ítem está en estado 'printing' o 'done'.
        HTTPException 404: Si el ítem no existe o no pertenece a la empresa.
    """
    item = await _get_item(db, item_id)
    if item.status not in ("pending", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar un ítem con estado '{item.status}'.",
        )
    await db.delete(item)
    await db.commit()
