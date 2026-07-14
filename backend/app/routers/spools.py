"""
Router de bobinas individuales de filamento (issue #134).

Endpoints bajo el prefijo /api/inventory/spools:
    GET    /            — Lista con filtros (inventory_item_id, status, material, q).
    POST   /            — Alta masiva (1-100 bobinas idénticas).
    PUT    /{id}        — Editar (peso manual, stops, efecto, notas, status).
    DELETE /{id}        — (admin) solo si ningún item de la cola 'printing' la referencia.
    GET    /low-stock   — Agregado de gramos restantes por tipo de filamento vs. umbral.
    POST   /labels      — Etiquetas PDF con QR (issue #135).

El consumo automático al marcar un `PrintQueueItem` como 'done' vive en
`routers/queue.py` (`_deduct_vault_item`) — ver docstring de `Spool` para
la regla completa de sincronía con el stock agregado.
"""

import io
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_config
from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.queue import PrintQueueItem
from app.models.settings import AppSettings
from app.models.spool import Spool
from app.models.user import User
from app.schemas.spool import (
    SpoolCreate,
    SpoolLabelsRequest,
    SpoolLowStockEntry,
    SpoolResponse,
    SpoolUpdate,
)
from app.services.auth import get_admin_user, get_current_user, get_operator_user
from app.services.label_renderer import LabelData, render_labels

router = APIRouter(prefix="/api/inventory/spools", tags=["inventory-spools"])


def _spool_to_response(spool: Spool, item: InventoryItem) -> SpoolResponse:
    effective_cost_per_kg: Optional[Decimal] = None
    if spool.cost is not None and spool.initial_weight_g:
        effective_cost_per_kg = spool.cost / (spool.initial_weight_g / Decimal("1000"))
    elif item.price_per_kg is not None:
        effective_cost_per_kg = item.price_per_kg

    return SpoolResponse(
        id=spool.id,
        inventory_item_id=spool.inventory_item_id,
        label_code=spool.label_code,
        initial_weight_g=spool.initial_weight_g,
        remaining_weight_g=spool.remaining_weight_g,
        percent_remaining=spool.percent_remaining,
        cost=spool.cost,
        effective_cost_per_kg=effective_cost_per_kg,
        extra_colors=spool.extra_colors,
        visual_effect=spool.visual_effect,
        status=spool.status,
        opened_at=spool.opened_at,
        finished_at=spool.finished_at,
        notes=spool.notes,
        created_at=spool.created_at,
        updated_at=spool.updated_at,
        inventory_item_name=item.name,
        color_hex=item.color_hex,
        color_name=item.color_name,
        filament_type=item.filament_type,
        filament_brand=item.filament_brand,
        filament_subtype=item.filament_subtype,
    )


@router.get("/", response_model=List[SpoolResponse])
async def list_spools(
    inventory_item_id: Optional[int] = None,
    status_csv: Optional[str] = Query(default=None, alias="status"),
    material: Optional[str] = None,
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista bobinas con datos del ítem padre embebidos, más recientes primero."""
    query = select(Spool).join(InventoryItem, Spool.inventory_item_id == InventoryItem.id)

    conditions = []
    if inventory_item_id is not None:
        conditions.append(Spool.inventory_item_id == inventory_item_id)
    if status_csv:
        statuses = [s.strip() for s in status_csv.split(",") if s.strip()]
        if statuses:
            conditions.append(Spool.status.in_(statuses))
    if material:
        conditions.append(InventoryItem.filament_type.ilike(f"%{material}%"))
    if q:
        conditions.append(
            or_(InventoryItem.name.ilike(f"%{q}%"), Spool.label_code.ilike(f"%{q}%"))
        )
    if conditions:
        query = query.where(*conditions)
    query = query.order_by(Spool.created_at.desc())

    result = await db.execute(query)
    spools = result.scalars().all()
    if not spools:
        return []

    item_ids = {s.inventory_item_id for s in spools}
    items_result = await db.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))
    items_by_id = {i.id: i for i in items_result.scalars().all()}

    return [
        _spool_to_response(s, items_by_id[s.inventory_item_id])
        for s in spools
        if s.inventory_item_id in items_by_id
    ]


@router.get("/low-stock", response_model=List[SpoolLowStockEntry])
async def get_spools_low_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suma `remaining_weight_g` de bobinas activas por `filament_type` vs. el umbral configurado."""
    settings_result = await db.execute(select(AppSettings).limit(1))
    settings = settings_result.scalar_one_or_none()
    threshold = settings.spool_low_stock_threshold_g if settings else Decimal("200")

    result = await db.execute(
        select(
            InventoryItem.filament_type,
            func.sum(Spool.remaining_weight_g).label("total_remaining"),
        )
        .join(InventoryItem, Spool.inventory_item_id == InventoryItem.id)
        .where(Spool.status == "active")
        .group_by(InventoryItem.filament_type)
    )
    rows = result.all()
    return [
        SpoolLowStockEntry(
            filament_type=row.filament_type or "Sin tipo",
            total_remaining_g=row.total_remaining or Decimal("0"),
            threshold_g=threshold,
            below=(row.total_remaining or Decimal("0")) < threshold,
        )
        for row in rows
    ]


@router.post("/", response_model=List[SpoolResponse], status_code=status.HTTP_201_CREATED)
async def create_spools(
    data: SpoolCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Alta masiva de `count` bobinas idénticas. `label_code` se asigna
    post-flush (`SP-{id:04d}`) — antes del flush cada una recibe un
    placeholder único (UUID) para no violar la UNIQUE constraint mientras
    los ids reales todavía no existen.
    """
    item_result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == data.inventory_item_id).with_for_update()
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Ítem de inventario no encontrado")

    initial_weight = data.initial_weight_g
    if initial_weight is None:
        initial_weight = item.weight_per_roll or Decimal("1000")

    extra_colors_dict = data.extra_colors.model_dump() if data.extra_colors else None

    created: List[Spool] = []
    for _ in range(data.count):
        spool = Spool(
            inventory_item_id=item.id,
            label_code=uuid.uuid4().hex[:12],
            initial_weight_g=initial_weight,
            remaining_weight_g=initial_weight,
            cost=data.cost,
            extra_colors=extra_colors_dict,
            visual_effect=data.visual_effect,
            notes=data.notes,
        )
        db.add(spool)
        created.append(spool)

    await db.flush()  # asigna ids reales sin commitear
    for spool in created:
        spool.label_code = f"SP-{spool.id:04d}"

    if data.add_to_stock:
        item.quantity = (item.quantity or Decimal("0")) + (initial_weight * data.count)

    await db.commit()
    for spool in created:
        await db.refresh(spool)

    return [_spool_to_response(s, item) for s in created]


@router.put("/{spool_id}", response_model=SpoolResponse)
async def update_spool(
    spool_id: int,
    data: SpoolUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Edita una bobina — peso restante manual ("pesé la bobina: 340g"),
    stops/efecto visual, notas o status. NO toca `InventoryItem.quantity`
    del padre (edición manual, no consumo — ver docstring de `Spool`).
    """
    result = await db.execute(select(Spool).where(Spool.id == spool_id))
    spool = result.scalar_one_or_none()
    if spool is None:
        raise HTTPException(status_code=404, detail="Bobina no encontrada")

    update_data = data.model_dump(exclude_unset=True, exclude={"extra_colors"})
    for field, value in update_data.items():
        setattr(spool, field, value)
    if "extra_colors" in data.model_fields_set:
        spool.extra_colors = data.extra_colors.model_dump() if data.extra_colors else None

    if spool.status == "finished" and spool.finished_at is None:
        spool.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)

    item_result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == spool.inventory_item_id)
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Ítem de inventario padre no encontrado")

    await db.commit()
    await db.refresh(spool)
    return _spool_to_response(spool, item)


@router.delete("/{spool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spool(
    spool_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Elimina una bobina. Bloqueado si algún item de la cola 'printing' la referencia."""
    result = await db.execute(select(Spool).where(Spool.id == spool_id))
    spool = result.scalar_one_or_none()
    if spool is None:
        raise HTTPException(status_code=404, detail="Bobina no encontrada")

    printing_result = await db.execute(
        select(PrintQueueItem).where(
            PrintQueueItem.spool_id == spool_id,
            PrintQueueItem.status == "printing",
        )
    )
    if printing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar: hay un ítem de la cola imprimiendo con esta bobina",
        )

    await db.delete(spool)
    await db.commit()


# ─── Etiquetas PDF con QR (issue #135) ─────────────────────────────────────

def _resolve_deeplink_base(request: Request) -> str:
    """
    Dónde debe apuntar el QR. Prioriza `PUBLIC_URL` (settings) para que un
    escaneo desde el teléfono llegue a la URL pública real y no a una
    dirección interna detrás del Cloudflare Tunnel; cae al scheme+host del
    propio request cuando no está configurado (suficiente en dev).
    """
    public_url = (app_config.PUBLIC_URL or "").strip().rstrip("/")
    if public_url:
        return public_url
    return f"{request.url.scheme}://{request.url.netloc}"


def _spool_to_label_data(spool: Spool, item: InventoryItem, deeplink_base: str) -> LabelData:
    """
    Mapea Spool + su InventoryItem padre a `LabelData`. A diferencia de
    bambuddy (que pinta `spool_id` numérico), CFS usa `label_code`
    (ej. "SP-0042") — más legible y ya es el identificador que el resto
    de la UI muestra para una bobina.
    """
    name = item.color_name or item.filament_type or item.name
    extra_colors = None
    if spool.extra_colors:
        extra_colors = spool.extra_colors.get("stops") or None
    return LabelData(
        label_code=spool.label_code,
        name=name,
        material=item.filament_type or "",
        brand=item.filament_brand,
        subtype=item.filament_subtype,
        rgba=(item.color_hex or "").lstrip("#") or None,
        extra_colors=extra_colors,
        storage_location=item.location,
        deeplink_url=f"{deeplink_base}/inventory/spools?spool={spool.id}",
    )


@router.post("/labels")
async def print_spool_labels(
    data: SpoolLabelsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera un PDF de etiquetas (con QR deep-link) para las bobinas pedidas.

    Preserva el ORDEN de `spool_ids` en el PDF resultante — para que una
    hoja Avery coincida con el orden en que el usuario las seleccionó en
    pantalla. 404 si algún id no existe, listando los faltantes.
    """
    result = await db.execute(select(Spool).where(Spool.id.in_(data.spool_ids)))
    spools = result.scalars().all()

    found_ids = {s.id for s in spools}
    missing = [sid for sid in data.spool_ids if sid not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Bobina(s) no encontrada(s): {missing}")

    ordered = sorted(spools, key=lambda s: data.spool_ids.index(s.id))

    item_ids = {s.inventory_item_id for s in ordered}
    items_result = await db.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))
    items_by_id = {i.id: i for i in items_result.scalars().all()}

    deeplink_base = _resolve_deeplink_base(request)
    label_data = [
        _spool_to_label_data(s, items_by_id[s.inventory_item_id], deeplink_base)
        for s in ordered
        if s.inventory_item_id in items_by_id
    ]

    pdf = render_labels(data.template, label_data, monochrome=data.monochrome)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=cfs-labels-{data.template}.pdf",
            "Content-Length": str(len(pdf)),
            "Cache-Control": "no-store",
        },
    )
