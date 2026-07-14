"""
Servicio de agregación para el dashboard de Stats (issue #132).

Resuelve, para cada `PrintQueueItem` en estado 'done'/'cancelled' dentro de
un rango de fechas, los mismos datos que `_deduct_inventory_and_update_printer`
/ `_deduct_vault_item` (routers/queue.py) usan para descontar inventario y
sumar horas — pero en modo lectura, sin tocar la BD. Se replica la
multiplicación por `quantity` de ambos caminos para que "gramos consumidos"
en Stats coincida exactamente con lo que de verdad se descontó del
inventario (no con `Quote.material_cost`, que es el costo de UN plato, sin
multiplicar por `quantity` — ver docstring de `_deduct_inventory_and_update_printer`).

Bucketing de series temporales en zona horaria América/Bogotá: los
timestamps (`completed_at`) se guardan naive-UTC; se convierten a Bogotá
antes de truncar a día/semana/mes, para que un print completado a las
23:30 hora local (04:30 UTC del día siguiente) caiga en el día local
correcto.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryItem
from app.models.printer import Printer
from app.models.quote import Quote
from app.models.queue import PrintQueueItem
from app.models.settings import AppSettings
from app.models.user import User
from app.routers.queue import _BOGOTA_TZ

_D1000 = Decimal("1000")


@dataclass
class _ResolvedItem:
    """Vista normalizada de un `PrintQueueItem` para agregación de stats."""
    status: str
    completed_at: datetime
    printer_id: Optional[int]
    user_id: Optional[int]
    failure_category: Optional[str]
    hours: Decimal = Decimal("0")
    # (inventory_item_id, grams) — solo poblado para items 'done'.
    weight_entries: List[Tuple[int, Decimal]] = field(default_factory=list)


async def _collect_resolved_items(
    db: AsyncSession, start_utc: Optional[datetime], end_utc: Optional[datetime]
) -> List[_ResolvedItem]:
    """Query + resolución de items done/cancelled en el rango dado."""
    query = select(PrintQueueItem).where(PrintQueueItem.status.in_(["done", "cancelled"]))
    if start_utc is not None:
        query = query.where(PrintQueueItem.completed_at >= start_utc)
    if end_utc is not None:
        query = query.where(PrintQueueItem.completed_at < end_utc)
    result = await db.execute(query)
    items = result.scalars().all()

    quote_ids = {i.quote_id for i in items if i.quote_id is not None}
    quotes: Dict[int, Quote] = {}
    if quote_ids:
        q_result = await db.execute(select(Quote).where(Quote.id.in_(quote_ids)))
        quotes = {q.id: q for q in q_result.scalars().all()}

    resolved: List[_ResolvedItem] = []
    for item in items:
        if item.completed_at is None:
            continue
        is_done = item.status == "done"
        if item.quote_id is not None and item.quote_id in quotes:
            quote = quotes[item.quote_id]
            multiplier = Decimal(str(int(quote.quantity or 1)))
            printer_id = quote.printer_id
            hours = (
                Decimal(str(quote.print_time_hours)) * multiplier
                if is_done and quote.print_time_hours is not None
                else Decimal("0")
            )
            weight_entries: List[Tuple[int, Decimal]] = []
            if is_done:
                if quote.inventory_item_id is not None and quote.weight_grams is not None:
                    weight_entries.append(
                        (quote.inventory_item_id, Decimal(str(quote.weight_grams)) * multiplier)
                    )
                for af in (quote.additional_filaments_detail or []):
                    fid = af.get("filament_id")
                    grams = af.get("weight_grams")
                    if fid is not None and grams is not None:
                        weight_entries.append((int(fid), Decimal(str(grams)) * multiplier))
        else:
            printer_id = item.printer_id
            multiplier = Decimal(str(item.quantity)) if item.quantity is not None else Decimal("1")
            hours = (
                Decimal(str(item.print_time_hours)) * multiplier
                if is_done and item.print_time_hours is not None
                else Decimal("0")
            )
            weight_entries = []
            if is_done and item.filament_id is not None and item.weight_grams is not None:
                weight_entries = [(item.filament_id, Decimal(str(item.weight_grams)) * multiplier)]

        resolved.append(_ResolvedItem(
            status=item.status,
            completed_at=item.completed_at,
            printer_id=printer_id,
            user_id=item.created_by,
            failure_category=item.failure_category,
            hours=hours,
            weight_entries=weight_entries,
        ))
    return resolved


async def _batch_lookups(db: AsyncSession, resolved: List[_ResolvedItem]):
    """Batch-fetch de Printer/User/InventoryItem/AppSettings referenciados."""
    printer_ids = {r.printer_id for r in resolved if r.printer_id is not None}
    user_ids = {r.user_id for r in resolved if r.user_id is not None}
    inv_ids = {iid for r in resolved for iid, _ in r.weight_entries}

    printers: Dict[int, Printer] = {}
    if printer_ids:
        res = await db.execute(select(Printer).where(Printer.id.in_(printer_ids)))
        printers = {p.id: p for p in res.scalars().all()}

    users: Dict[int, User] = {}
    if user_ids:
        res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: u for u in res.scalars().all()}

    inventory_items: Dict[int, InventoryItem] = {}
    if inv_ids:
        res = await db.execute(select(InventoryItem).where(InventoryItem.id.in_(inv_ids)))
        inventory_items = {i.id: i for i in res.scalars().all()}

    settings_result = await db.execute(select(AppSettings).limit(1))
    app_settings = settings_result.scalar_one_or_none()

    return printers, users, inventory_items, app_settings


def _bucket_key(completed_at: datetime, bucket: str) -> date:
    """Trunca `completed_at` (naive UTC) al bucket day/week/month en Bogotá."""
    local_dt = completed_at.replace(tzinfo=timezone.utc).astimezone(_BOGOTA_TZ)
    local_date = local_dt.date()
    if bucket == "day":
        return local_date
    if bucket == "week":
        return local_date - timedelta(days=local_date.weekday())
    if bucket == "month":
        return local_date.replace(day=1)
    raise ValueError(f"bucket inválido: {bucket}")


async def get_overview(
    db: AsyncSession, start_utc: Optional[datetime], end_utc: Optional[datetime]
) -> dict:
    """Calcula el resumen agregado (overview) para el rango dado."""
    resolved = await _collect_resolved_items(db, start_utc, end_utc)
    printers, users, inventory_items, app_settings = await _batch_lookups(db, resolved)

    prints_done = sum(1 for r in resolved if r.status == "done")
    prints_cancelled = sum(1 for r in resolved if r.status == "cancelled")
    total = prints_done + prints_cancelled
    success_rate_pct = (
        (Decimal(prints_done) / Decimal(total) * Decimal("100")).quantize(Decimal("0.01"))
        if total > 0 else Decimal("0.00")
    )

    total_hours = sum((r.hours for r in resolved), Decimal("0"))

    grams_by_type: Dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    cost_by_type: Dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    material_cost_cop = Decimal("0")
    for r in resolved:
        for inv_id, grams in r.weight_entries:
            inv = inventory_items.get(inv_id)
            ftype = inv.filament_type if (inv and inv.filament_type) else "Sin tipo"
            grams_by_type[ftype] += grams
            if inv is not None and inv.price_per_kg is not None:
                cost = grams / _D1000 * Decimal(str(inv.price_per_kg))
                cost_by_type[ftype] += cost
                material_cost_cop += cost

    electricity_cost_cop = Decimal("0")
    hours_by_printer: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    prints_by_printer: Dict[int, int] = defaultdict(int)
    for r in resolved:
        if r.status == "done" and r.printer_id is not None:
            prints_by_printer[r.printer_id] += 1
            hours_by_printer[r.printer_id] += r.hours
            printer = printers.get(r.printer_id)
            if printer is not None and app_settings is not None:
                kwh = printer.power_consumption_watts / _D1000 * r.hours
                electricity_cost_cop += kwh * Decimal(str(app_settings.electricity_rate))

    by_printer = [
        {
            "printer_id": pid,
            "printer_name": printers[pid].name if pid in printers else f"Impresora #{pid}",
            "prints": prints_by_printer[pid],
            "hours": hours_by_printer[pid],
        }
        for pid in prints_by_printer
    ]
    by_printer.sort(key=lambda e: e["prints"], reverse=True)

    prints_by_user: Dict[Optional[int], int] = defaultdict(int)
    for r in resolved:
        prints_by_user[r.user_id] += 1
    by_user = [
        {
            "user_id": uid,
            "username": users[uid].username if uid is not None and uid in users else "Sin usuario",
            "prints": count,
        }
        for uid, count in prints_by_user.items()
    ]
    by_user.sort(key=lambda e: e["prints"], reverse=True)

    failures_by_category: Dict[str, int] = defaultdict(int)
    for r in resolved:
        if r.status == "cancelled":
            failures_by_category[r.failure_category or "Sin categoría"] += 1
    failure_breakdown = [
        {"category": cat, "count": count} for cat, count in failures_by_category.items()
    ]
    failure_breakdown.sort(key=lambda e: e["count"], reverse=True)

    grams_by_filament_type = [
        {"filament_type": ftype, "grams": grams, "cost_cop": cost_by_type[ftype]}
        for ftype, grams in grams_by_type.items()
    ]
    grams_by_filament_type.sort(key=lambda e: e["grams"], reverse=True)

    return {
        "prints_done": prints_done,
        "prints_cancelled": prints_cancelled,
        "success_rate_pct": success_rate_pct,
        "total_hours": total_hours,
        "grams_by_filament_type": grams_by_filament_type,
        "by_printer": by_printer,
        "by_user": by_user,
        "failure_breakdown": failure_breakdown,
        "material_cost_cop": material_cost_cop,
        "electricity_cost_cop": electricity_cost_cop,
    }


async def get_trends(
    db: AsyncSession,
    start_utc: Optional[datetime],
    end_utc: Optional[datetime],
    bucket: str,
) -> dict:
    """Calcula la serie temporal de prints/gramos agrupada por bucket."""
    resolved = await _collect_resolved_items(db, start_utc, end_utc)

    done_by_bucket: Dict[date, int] = defaultdict(int)
    cancelled_by_bucket: Dict[date, int] = defaultdict(int)
    grams_by_bucket: Dict[date, Decimal] = defaultdict(lambda: Decimal("0"))

    for r in resolved:
        key = _bucket_key(r.completed_at, bucket)
        if r.status == "done":
            done_by_bucket[key] += 1
            grams_by_bucket[key] += sum((g for _, g in r.weight_entries), Decimal("0"))
        else:
            cancelled_by_bucket[key] += 1

    all_keys = sorted(set(done_by_bucket) | set(cancelled_by_bucket))
    series = [
        {
            "bucket_start": key.isoformat(),
            "prints_done": done_by_bucket.get(key, 0),
            "prints_cancelled": cancelled_by_bucket.get(key, 0),
            "grams": grams_by_bucket.get(key, Decimal("0")),
        }
        for key in all_keys
    ]
    return {"bucket": bucket, "series": series}
