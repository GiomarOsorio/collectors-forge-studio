"""
Router de cola de impresión para Collector's Forge Studio.

Gestiona los trabajos de impresión encolados. Solo se pueden agregar cotizaciones
guardadas (Quote). Al marcar un trabajo como 'done', se descuenta automáticamente
el inventario de filamentos e insumos y se suman las horas de impresión a la
impresora correspondiente (transacción atómica).

Endpoints disponibles bajo el prefijo /api/queue:
    GET    /                — Lista ítems pendientes + en impresión (ordenados por posición).
    PUT    /reorder         — Reordena pending por drag-and-drop (issue #133).
    POST   /                — Agrega un ítem a la cola (desde Quote).
    POST   /from-vault      — Agrega un ítem a la cola (desde Vault, con split_copies).
    POST   /batch           — Agrupa ≥2 ítems pending como lote (issue #133).
    DELETE /batch/{id}      — Desagrupa un lote (issue #133).
    PUT    /{id}/status     — Cambia el estado de un ítem (con lógica atómica si done).
    POST   /{id}/duplicate  — Clona un ítem como uno nuevo pending (issue #133).
    PUT    /{id}/schedule   — Programa/desprograma un ítem (issue #133).
    PUT    /{id}/project    — (Re)asigna o quita el proyecto de un ítem.
    DELETE /{id}            — Elimina un ítem (solo si pending o cancelled).
    GET    /history         — Historial done + cancelled (últimos 50, desc por completed_at).
    GET    /log             — Bitácora global con filtros + paginación + export CSV (issue #131).
"""

import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.model_file import ModelFile
from app.models.settings import AppSettings
from app.models.printer import Printer
from app.models.project import Project
from app.models.queue import PrintQueueItem
from app.models.quote import Quote
from app.models.spool import Spool
from app.models.user import User
from app.schemas.queue import (
    PrintQueueItemCreate,
    PrintQueueItemFromVaultCreate,
    PrintQueueItemResponse,
    PrintQueueLogResponse,
    PrintQueueProjectUpdate,
    PrintQueueStatusUpdate,
    QueueBatchCreateRequest,
    QueueQuoteSnapshot,
    QueueReorderRequest,
    QueueScheduleUpdate,
    QueueVaultSnapshot,
)
from app.services.auth import get_current_user, get_operator_user
from app.services.notifier import emit

_BOGOTA_TZ = ZoneInfo("America/Bogota")

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
    item: PrintQueueItem, db: AsyncSession, spool_warning: Optional[str] = None
) -> PrintQueueItemResponse:
    """
    Construye la respuesta enriquecida con el snapshot de la fuente
    (Quote o Vault). Si la fuente fue eliminada después de encolar, el
    snapshot correspondiente queda None — el item sigue siendo válido en
    historial (terminales).

    `spool_warning` (issue #134) es transitorio — solo lo pasa
    `update_queue_status` justo después de descontar una bobina
    insuficiente; en cualquier otro llamado queda None.

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

        spool_label_code: Optional[str] = None
        spool_percent_remaining: Optional[float] = None
        if item.spool_id is not None:
            s_result = await db.execute(select(Spool).where(Spool.id == item.spool_id))
            sp = s_result.scalar_one_or_none()
            if sp is not None:
                spool_label_code = sp.label_code
                spool_percent_remaining = sp.percent_remaining

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
            spool_id=item.spool_id,
            spool_label_code=spool_label_code,
            spool_percent_remaining=spool_percent_remaining,
        )

    created_by_username: Optional[str] = None
    if item.created_by is not None:
        u_result = await db.execute(select(User).where(User.id == item.created_by))
        creator = u_result.scalar_one_or_none()
        created_by_username = creator.username if creator else None

    return PrintQueueItemResponse(
        id=item.id,
        quote_id=item.quote_id,
        vault_model_id=item.vault_model_id,
        project_id=item.project_id,
        status=item.status,
        position=item.position,
        started_at=item.started_at,
        completed_at=item.completed_at,
        notes=item.notes,
        failure_reason=item.failure_reason,
        failure_category=item.failure_category,
        batch_id=item.batch_id,
        scheduled_at=item.scheduled_at,
        created_by=item.created_by,
        created_by_username=created_by_username,
        spool_warning=spool_warning,
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

    # Batch 5: usuarios creadores (issue #131).
    creator_ids = {item.created_by for item in items if item.created_by is not None}
    users_by_id: dict = {}
    if creator_ids:
        u_result = await db.execute(select(User).where(User.id.in_(creator_ids)))
        users_by_id = {u.id: u for u in u_result.scalars().all()}

    # Batch 6: bobinas asignadas (issue #134).
    spool_ids = {item.spool_id for item in items if item.spool_id is not None}
    spools_by_id: dict = {}
    if spool_ids:
        sp_result = await db.execute(select(Spool).where(Spool.id.in_(spool_ids)))
        spools_by_id = {s.id: s for s in sp_result.scalars().all()}

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
            spool = spools_by_id.get(item.spool_id) if item.spool_id else None
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
                spool_id=item.spool_id,
                spool_label_code=spool.label_code if spool else None,
                spool_percent_remaining=spool.percent_remaining if spool else None,
            )

        creator = users_by_id.get(item.created_by) if item.created_by else None

        responses.append(
            PrintQueueItemResponse(
                id=item.id,
                quote_id=item.quote_id,
                vault_model_id=item.vault_model_id,
                project_id=item.project_id,
                status=item.status,
                position=item.position,
                started_at=item.started_at,
                completed_at=item.completed_at,
                notes=item.notes,
                failure_reason=item.failure_reason,
                failure_category=item.failure_category,
                batch_id=item.batch_id,
                scheduled_at=item.scheduled_at,
                created_by=item.created_by,
                created_by_username=creator.username if creator else None,
                created_at=item.created_at,
                quote=quote_snapshot,
                vault=vault_snapshot,
            )
        )
    return responses


def _emit_low_stock_if_crossed(inv: InventoryItem, was_above_min: bool) -> None:
    """
    Emite `inventory.low_stock` SOLO en el cruce (estaba OK antes, quedó bajo
    mínimo ahora) — evita spam en cada descuento sucesivo del mismo item ya
    bajo. `was_above_min` debe capturarse ANTES de mutar `inv.quantity`.
    """
    if inv.min_quantity is None:
        return
    now_below = inv.quantity < inv.min_quantity
    if now_below and was_above_min:
        emit("inventory.low_stock", {
            "item_name": inv.name,
            "quantity": float(inv.quantity),
            "min_quantity": float(inv.min_quantity),
            "unit": "g",
        })


async def _emit_spool_low_if_crossed(db: AsyncSession, spool: Spool, old_remaining: Decimal) -> None:
    """
    Emite `inventory.spool_low` SOLO en el cruce del umbral agregado por
    `filament_type` (mismo criterio que `GET /spools/low-stock`) — compara
    la suma de bobinas activas antes/después de este consumo puntual.
    """
    settings_result = await db.execute(select(AppSettings).limit(1))
    settings = settings_result.scalar_one_or_none()
    threshold = settings.spool_low_stock_threshold_g if settings else Decimal("200")

    parent_result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == spool.inventory_item_id)
    )
    parent = parent_result.scalar_one_or_none()
    if parent is None:
        return

    others_result = await db.execute(
        select(func.sum(Spool.remaining_weight_g))
        .join(InventoryItem, Spool.inventory_item_id == InventoryItem.id)
        .where(
            Spool.status == "active",
            Spool.id != spool.id,
            InventoryItem.filament_type == parent.filament_type,
        )
    )
    others_total = others_result.scalar() or Decimal("0")
    before_total = others_total + old_remaining
    after_total = others_total + spool.remaining_weight_g

    if after_total < threshold and before_total >= threshold:
        emit("inventory.spool_low", {
            "spool_code": parent.filament_type or spool.label_code,
            "remaining_g": float(after_total),
        })


async def _deduct_vault_item(
    db: AsyncSession, item: PrintQueueItem
) -> Optional[str]:
    """
    Descuenta inventario y suma horas a la impresora para un item que vino
    del Vault (no de un Quote). Mucho más simple que el camino de Quote:
    no hay additional_filaments_detail ni supplies_detail.

    - Si `spool_id` está seteado (issue #134): el descuento fino va SOLO
      a `Spool.remaining_weight_g` — el descuento agregado de abajo se
      OMITE por completo para evitar doble descuento (ver docstring de
      `Spool` para la regla completa de sincronía con el agregado).
      Insuficiente NO bloquea: floorea en 0 y devuelve un warning.
    - Si NO hay spool pero sí `filament_id`, descuenta `weight_grams *
      quantity` del agregado (comportamiento histórico, intacto).
    - Si `printer_id` está seteado, suma `print_time_hours * quantity` a
      current_hours (en AMBOS casos — el spool no afecta esto).

    Returns:
        Mensaje de advertencia si el consumo de la bobina excedió lo que
        quedaba (no bloquea) — None en cualquier otro caso.
    """
    multiplier = Decimal(str(int(item.quantity or 1)))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    warning: Optional[str] = None

    if item.spool_id is not None:
        spool_result = await db.execute(
            select(Spool).where(Spool.id == item.spool_id).with_for_update()
        )
        spool = spool_result.scalar_one_or_none()
        if spool is not None and item.weight_grams is not None:
            old_remaining = spool.remaining_weight_g
            consumed = Decimal(str(item.weight_grams)) * multiplier
            new_remaining = old_remaining - consumed
            if new_remaining < 0:
                warning = (
                    f"Bobina {spool.label_code}: quedaban "
                    f"{float(spool.remaining_weight_g):.1f}g, se consumieron "
                    f"{float(consumed):.1f}g (posible error de pesaje)."
                )
                new_remaining = Decimal("0")
            spool.remaining_weight_g = new_remaining
            await _emit_spool_low_if_crossed(db, spool, old_remaining)
            if spool.remaining_weight_g <= 0 and spool.status == "active":
                spool.status = "finished"
                spool.finished_at = now
                parent_result = await db.execute(
                    select(InventoryItem)
                    .where(InventoryItem.id == spool.inventory_item_id)
                    .with_for_update()
                )
                parent = parent_result.scalar_one_or_none()
                if parent is not None:
                    parent.quantity = max(
                        Decimal("0"), (parent.quantity or Decimal("0")) - spool.initial_weight_g
                    )
    elif item.filament_id is not None and item.weight_grams is not None:
        inv_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id == item.filament_id).with_for_update()
        )
        inv = inv_result.scalar_one_or_none()
        if inv is not None:
            was_above_min = inv.min_quantity is None or inv.quantity >= inv.min_quantity
            deduct = Decimal(str(item.weight_grams)) * multiplier
            inv.quantity = (inv.quantity or Decimal("0")) - deduct
            if inv.quantity < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente: {inv.name} (necesita {float(deduct):.1f} g)",
                )
            if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                inv.needs_purchase = True
            _emit_low_stock_if_crossed(inv, was_above_min)

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

    return warning


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
            was_above_min = inv.min_quantity is None or inv.quantity >= inv.min_quantity
            deduct = Decimal(str(quote.weight_grams)) * multiplier
            inv.quantity = (inv.quantity or Decimal("0")) - deduct
            if inv.quantity < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente: {inv.name} (necesita {float(deduct):.1f} g)",
                )
            if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                inv.needs_purchase = True
            _emit_low_stock_if_crossed(inv, was_above_min)

    # 2. Filamentos adicionales (additional_filaments_detail JSONB)
    for af in (quote.additional_filaments_detail or []):
        iid = af.get("filament_id")
        if iid is not None:
            inv_result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == int(iid)).with_for_update()
            )
            inv = inv_result.scalar_one_or_none()
            if inv is not None:
                was_above_min = inv.min_quantity is None or inv.quantity >= inv.min_quantity
                deduct = Decimal(str(af["weight_grams"])) * multiplier
                inv.quantity = (inv.quantity or Decimal("0")) - deduct
                if inv.quantity < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente (filamento adicional): {inv.name}",
                    )
                if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                    inv.needs_purchase = True
                _emit_low_stock_if_crossed(inv, was_above_min)

    # 3. Insumos (supplies_detail JSONB)
    for s in (quote.supplies_detail or []):
        iid = s.get("supply_id")
        if iid is not None:
            inv_result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == int(iid)).with_for_update()
            )
            inv = inv_result.scalar_one_or_none()
            if inv is not None:
                was_above_min = inv.min_quantity is None or inv.quantity >= inv.min_quantity
                deduct = Decimal(str(s["quantity"])) * multiplier
                inv.quantity = (inv.quantity or Decimal("0")) - deduct
                if inv.quantity < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente (insumo): {inv.name}",
                    )
                if inv.min_quantity is not None and inv.quantity < inv.min_quantity:
                    inv.needs_purchase = True
                _emit_low_stock_if_crossed(inv, was_above_min)

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


def _bogota_day_bounds_to_utc(date_str: str) -> tuple:
    """
    Convierte 'YYYY-MM-DD' (día calendario en América/Bogotá) a un rango
    `[inicio, fin)` en UTC naive — para comparar contra `created_at`
    (issue #131).

    Raises:
        HTTPException 400: Si `date_str` no tiene formato YYYY-MM-DD.
    """
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Fecha inválida: '{date_str}'. Use YYYY-MM-DD."
        )
    start_local = datetime(day.year, day.month, day.day, tzinfo=_BOGOTA_TZ)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def _log_display_fields(item: PrintQueueItemResponse) -> dict:
    """
    Unifica los campos de display entre el snapshot `quote` y `vault` de
    un `PrintQueueItemResponse` — para las columnas planas del CSV
    (issue #131). Mismo criterio que `itemView()` en el frontend
    (queueHelpers.js).
    """
    if item.quote is not None:
        return {
            "piece_name": item.quote.piece_name,
            "source": "quote",
            "printer_name": item.quote.printer_name,
            "quantity": item.quote.quantity,
            "weight_grams": item.quote.weight_grams,
            "print_time_hours": item.quote.print_time_hours,
            "total_price": item.quote.total_price,
        }
    if item.vault is not None:
        return {
            "piece_name": item.vault.name,
            "source": "vault",
            "printer_name": item.vault.printer_name,
            "quantity": item.vault.quantity,
            "weight_grams": item.vault.weight_grams,
            "print_time_hours": item.vault.print_time_hours,
            "total_price": None,
        }
    return {
        "piece_name": item.notes or f"Item #{item.id}",
        "source": "—",
        "printer_name": None,
        "quantity": 1,
        "weight_grams": None,
        "print_time_hours": None,
        "total_price": None,
    }


def _log_rows_to_csv(items: List[PrintQueueItemResponse]) -> str:
    """Serializa una lista de items del log a CSV (issue #131)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "fecha", "pieza", "origen", "impresora", "usuario", "estado",
        "cantidad", "peso_g", "tiempo_h", "costo",
    ])
    for item in items:
        f = _log_display_fields(item)
        writer.writerow([
            item.id,
            item.created_at.isoformat(),
            f["piece_name"],
            f["source"],
            f["printer_name"] or "",
            item.created_by_username or "",
            item.status,
            f["quantity"] if f["quantity"] is not None else "",
            f["weight_grams"] if f["weight_grams"] is not None else "",
            f["print_time_hours"] if f["print_time_hours"] is not None else "",
            f["total_price"] if f["total_price"] is not None else "",
        ])
    return buf.getvalue()


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


@router.get("/log")
async def get_print_log(
    q: Optional[str] = None,
    printer_id: Optional[int] = None,
    status_csv: Optional[str] = Query(default=None, alias="status"),
    user_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    format: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bitácora global de impresiones (issue #131) — TODOS los estados
    (pending/printing/done/cancelled), con filtros + paginación.

    Endpoint separado de `/history` (que solo trae done/cancelled para el
    tab Historial de QueuePage, sin filtros) — extenderlo hubiera forzado
    una respuesta de doble forma (lista plana vs paginada) para no romper
    ese consumidor existente.

    Query params:
        q:          Busca en piece_name (vault-items) y Quote.piece_name
                    (quote-items), ILIKE.
        printer_id: Filtra por impresora (vault-items: columna directa;
                    quote-items: Quote.printer_id).
        status:     CSV de estados, ej. 'done,cancelled'.
        user_id:    Filtra por `created_by` (items pre-#131 quedan fuera).
        date_from/date_to: 'YYYY-MM-DD', día calendario América/Bogotá,
                    ambos límites inclusive. Compara contra `created_at`.
        page/page_size: Paginación (ignorada si format=csv).
        format:     'csv' → descarga el set filtrado COMPLETO sin paginar.

    Ordenado por created_at descendente (más reciente primero).
    """
    base_query = select(PrintQueueItem).outerjoin(
        Quote, PrintQueueItem.quote_id == Quote.id
    )

    conditions = []
    if q:
        like = f"%{q}%"
        conditions.append(
            or_(PrintQueueItem.piece_name.ilike(like), Quote.piece_name.ilike(like))
        )
    if printer_id is not None:
        conditions.append(
            or_(PrintQueueItem.printer_id == printer_id, Quote.printer_id == printer_id)
        )
    if status_csv:
        statuses = [s.strip() for s in status_csv.split(",") if s.strip()]
        if statuses:
            conditions.append(PrintQueueItem.status.in_(statuses))
    if user_id is not None:
        conditions.append(PrintQueueItem.created_by == user_id)
    if date_from:
        start_utc, _ = _bogota_day_bounds_to_utc(date_from)
        conditions.append(PrintQueueItem.created_at >= start_utc)
    if date_to:
        _, end_utc = _bogota_day_bounds_to_utc(date_to)
        conditions.append(PrintQueueItem.created_at < end_utc)

    if conditions:
        base_query = base_query.where(and_(*conditions))

    if format == "csv":
        full_query = base_query.order_by(PrintQueueItem.created_at.desc())
        result = await db.execute(full_query)
        items = result.scalars().all()
        responses = await _build_responses_bulk(items, db)
        csv_text = _log_rows_to_csv(responses)
        return StreamingResponse(
            iter([csv_text]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=print_log.csv"},
        )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    paged_query = (
        base_query.order_by(PrintQueueItem.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(paged_query)
    items = result.scalars().all()
    responses = await _build_responses_bulk(items, db)
    return PrintQueueLogResponse(items=responses, total=total, page=page, page_size=page_size)


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


@router.put("/reorder", response_model=List[PrintQueueItemResponse])
async def reorder_queue(
    data: QueueReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Reordena la cola de pending por drag-and-drop.

    `item_ids` debe ser la lista COMPLETA de ids `pending` actuales, en el
    nuevo orden deseado — se valida que sea exactamente el mismo conjunto
    (sin faltantes ni sobrantes) antes de aplicar ningún cambio.
    `position` se reasigna como el índice en la lista (0-based). Los
    ítems `printing` no se tocan (el frontend los fija arriba, fuera del
    drag-and-drop).
    """
    if len(set(data.item_ids)) != len(data.item_ids):
        raise HTTPException(status_code=400, detail="La lista tiene ids duplicados")

    pending_result = await db.execute(
        select(PrintQueueItem).where(PrintQueueItem.status == "pending")
    )
    pending_items = {item.id: item for item in pending_result.scalars().all()}

    if set(data.item_ids) != set(pending_items.keys()):
        raise HTTPException(
            status_code=400,
            detail="La lista debe incluir exactamente todos los ítems pending actuales, sin repetir ni omitir.",
        )

    for index, item_id in enumerate(data.item_ids):
        pending_items[item_id].position = index

    await db.commit()
    ordered_items = [pending_items[i] for i in data.item_ids]
    for item in ordered_items:
        await db.refresh(item)
    return await _build_responses_bulk(ordered_items, db)


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

    if data.project_id is not None:
        p_result = await db.execute(select(Project).where(Project.id == data.project_id))
        if p_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Calcular la siguiente posición en la cola
    max_result = await db.execute(
        select(func.max(PrintQueueItem.position)).where(
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
    )
    max_pos = max_result.scalar() or 0

    item = PrintQueueItem(
        quote_id=data.quote_id,
        project_id=data.project_id,
        status="pending",
        position=max_pos + 1,
        notes=data.notes,
        created_by=current_user.id,
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
    `source_file` editable, no se puede encolar (lamina primero con tu
    slicer y vuelve a subir el resultado al Vault).

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
            detail="Este modelo no tiene .gcode.3mf laminado. Lamínalo con tu slicer y vuelve a subirlo al Vault.",
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

    # Verificar bobina si se eligió (issue #134). Debe pertenecer al mismo
    # ítem de inventario que `filament_id` (si ambos vienen); si solo
    # viene `spool_id`, se deriva `filament_id` de su padre.
    spool_item_id: Optional[int] = None
    if data.spool_id is not None:
        sp_result = await db.execute(select(Spool).where(Spool.id == data.spool_id))
        spool = sp_result.scalar_one_or_none()
        if spool is None:
            raise HTTPException(status_code=404, detail="Bobina no encontrada")
        if spool.status != "active":
            raise HTTPException(
                status_code=400, detail=f"La bobina {spool.label_code} no está activa"
            )
        spool_item_id = spool.inventory_item_id
        if data.filament_id is not None and data.filament_id != spool_item_id:
            raise HTTPException(
                status_code=400,
                detail="El filamento elegido no coincide con el ítem de inventario de la bobina",
            )

    if data.project_id is not None:
        p_result = await db.execute(select(Project).where(Project.id == data.project_id))
        if p_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

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

    base_kwargs = dict(
        vault_model_id=model.id,
        print_file_snapshot_path=model.print_file_key,
        piece_name=model.name,
        printer_id=data.printer_id,
        filament_id=data.filament_id or spool_item_id,
        spool_id=data.spool_id,
        weight_grams=model.sliced_weight_g,
        print_time_hours=print_time_hours,
        project_id=data.project_id,
        status="pending",
        notes=data.notes,
        created_by=current_user.id,
    )

    # "Separar copias": en vez de un item con quantity=N, crea N items
    # independientes (quantity=1 c/u) con un batch_id compartido — permite
    # repartirlas entre impresoras/horarios distintos después. El
    # descuento sigue siendo weight×quantity por item, así que con
    # quantity=1 funciona igual (issue #133).
    if data.split_copies and data.quantity > 1:
        new_batch_id = uuid.uuid4()
        items = [
            PrintQueueItem(
                **base_kwargs,
                quantity=1,
                position=max_pos + 1 + i,
                batch_id=new_batch_id,
            )
            for i in range(data.quantity)
        ]
        for new_item in items:
            db.add(new_item)
        await db.commit()
        for new_item in items:
            await db.refresh(new_item)
        return await _build_response(items[0], db)

    item = PrintQueueItem(**base_kwargs, quantity=data.quantity, position=max_pos + 1)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _build_response(item, db)


@router.post("/batch", response_model=List[PrintQueueItemResponse], status_code=status.HTTP_201_CREATED)
async def create_queue_batch(
    data: QueueBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Agrupa ≥2 ítems `pending` como un lote — asigna un `batch_id` (UUID)
    nuevo y compartido a todos. Puramente organizativo (no cambia
    `status`/`position`). Si un ítem ya pertenecía a otro lote, se mueve
    al nuevo.
    """
    if len(set(data.item_ids)) != len(data.item_ids):
        raise HTTPException(status_code=400, detail="La lista tiene ids duplicados")

    result = await db.execute(
        select(PrintQueueItem).where(PrintQueueItem.id.in_(data.item_ids))
    )
    items_by_id = {item.id: item for item in result.scalars().all()}

    missing = set(data.item_ids) - set(items_by_id.keys())
    if missing:
        raise HTTPException(
            status_code=404, detail=f"Ítems no encontrados: {sorted(missing)}"
        )

    not_pending = [i for i in data.item_ids if items_by_id[i].status != "pending"]
    if not_pending:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden agrupar ítems pending: {not_pending}",
        )

    new_batch_id = uuid.uuid4()
    for item_id in data.item_ids:
        items_by_id[item_id].batch_id = new_batch_id

    await db.commit()
    ordered_items = [items_by_id[i] for i in data.item_ids]
    for item in ordered_items:
        await db.refresh(item)
    return await _build_responses_bulk(ordered_items, db)


@router.delete("/batch/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_queue_batch(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Desagrupa un lote — pone `batch_id=NULL` a todos sus miembros."""
    result = await db.execute(
        select(PrintQueueItem).where(PrintQueueItem.batch_id == batch_id)
    )
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    for item in items:
        item.batch_id = None
    await db.commit()


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
    spool_warning: Optional[str] = None
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
            # Vault item: descontar filamento (o bobina, issue #134) + sumar
            # horas según los datos denormalizados del propio item (no
            # dependen del ModelFile, así que sigue funcionando aunque el
            # modelo haya sido borrado).
            spool_warning = await _deduct_vault_item(db, item)
        else:
            raise HTTPException(
                status_code=400,
                detail="No se puede marcar como hecho: el item no tiene fuente (ni quote ni vault).",
            )
        item.completed_at = now

    elif new_status == "cancelled":
        item.completed_at = now
        # Opcionales — no bloquean la cancelación (issue #130).
        item.failure_reason = data.failure_reason
        item.failure_category = data.failure_category

    elif new_status == "printing":
        item.started_at = now

    item.status = new_status
    await db.commit()
    await db.refresh(item)
    response = await _build_response(item, db, spool_warning=spool_warning)

    if new_status in ("done", "cancelled"):
        display = _log_display_fields(response)
        payload = {
            "piece_name": display.get("piece_name") or "",
            "printer": display.get("printer_name") or "",
            "quantity": display.get("quantity") or 1,
            "grams": float(display.get("weight_grams") or 0),
            "hours": float(display.get("print_time_hours") or 0),
            "user": current_user.username,
        }
        if new_status == "done":
            emit("queue.item_done", payload)
        else:
            payload["failure_reason"] = item.failure_reason or ""
            emit("queue.item_cancelled", payload)

    return response


@router.post(
    "/{item_id}/duplicate",
    response_model=PrintQueueItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_queue_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Clona un ítem de la cola (de cualquier estado, incluido el historial)
    como un ítem nuevo `pending` al final de la cola.

    NO copia `batch_id`/`scheduled_at` (organizativos, no tiene sentido
    heredarlos) ni `started_at`/`completed_at`/`failure_reason`/
    `failure_category` (pertenecen al ciclo de vida del original).
    `created_by` tampoco se hereda: es quien duplica (issue #131), no el
    autor del original. `spool_id` SÍ se copia (issue #134) — igual que
    `filament_id`, es parte del setup físico de impresión; si la bobina
    ya no alcanza, el consumo lo avisa como warning sin bloquear.
    """
    original = await _get_item(db, item_id)

    max_result = await db.execute(
        select(func.max(PrintQueueItem.position)).where(
            PrintQueueItem.status.in_(list(_ACTIVE_STATUSES)),
        )
    )
    max_pos = max_result.scalar() or 0

    clone = PrintQueueItem(
        quote_id=original.quote_id,
        vault_model_id=original.vault_model_id,
        print_file_snapshot_path=original.print_file_snapshot_path,
        piece_name=original.piece_name,
        printer_id=original.printer_id,
        filament_id=original.filament_id,
        spool_id=original.spool_id,
        quantity=original.quantity,
        weight_grams=original.weight_grams,
        print_time_hours=original.print_time_hours,
        project_id=original.project_id,
        status="pending",
        position=max_pos + 1,
        notes=original.notes,
        created_by=current_user.id,
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return await _build_response(clone, db)


@router.put("/{item_id}/schedule", response_model=PrintQueueItemResponse)
async def schedule_queue_item(
    item_id: int,
    data: QueueScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Programa (o quita programación de, con `scheduled_at: null`) un ítem.

    Puramente organizativo — NO dispara nada automático (CFS no habla con
    la impresora). Solo afecta el orden/aviso "atrasado" en la UI.
    """
    item = await _get_item(db, item_id)
    item.scheduled_at = data.scheduled_at
    await db.commit()
    await db.refresh(item)
    return await _build_response(item, db)


@router.put("/{item_id}/project", response_model=PrintQueueItemResponse)
async def update_queue_item_project(
    item_id: int,
    data: PrintQueueProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    (Re)asigna o quita (`project_id=null`) el proyecto de un ítem ya
    encolado. Funciona en cualquier estado (incluidos terminales) — el
    agrupamiento en proyectos es puramente organizativo.
    """
    item = await _get_item(db, item_id)
    if data.project_id is not None:
        p_result = await db.execute(select(Project).where(Project.id == data.project_id))
        if p_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    item.project_id = data.project_id
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
