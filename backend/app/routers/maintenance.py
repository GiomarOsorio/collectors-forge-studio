"""
Router de mantenimiento de impresoras para Collector's Forge.

Las impresoras se gestionan en la app Cost (GET/PUT /api/printers/).
Este router solo gestiona registros de mantenimiento y el resumen del dashboard.

Al crear un registro de mantenimiento, descuenta automáticamente los ítems
de inventario vinculados (transacción atómica).

Endpoints:
    GET    /api/maintenance/logs/              — Listar registros (filtrar por printer_id).
    POST   /api/maintenance/logs/              — Crear registro + descontar inventario.
    GET    /api/maintenance/logs/{id}          — Obtener detalle del registro.
    PUT    /api/maintenance/logs/{id}          — Editar fecha, horas, tipo y descripción.
    DELETE /api/maintenance/logs/{id}          — Eliminar registro.

    GET    /api/maintenance/summary/           — Resumen por impresora (dashboard).

Recordatorios por intervalo (issue #138):
    GET    /api/maintenance/schedules/             — Listar (filtrar por printer_id), con progreso/status.
    GET    /api/maintenance/schedules/due          — Habilitados con status != ok (badges).
    POST   /api/maintenance/schedules/             — Crear (admin).
    PUT    /api/maintenance/schedules/{id}         — Editar (admin).
    DELETE /api/maintenance/schedules/{id}         — Eliminar (admin).
    POST   /api/maintenance/schedules/{id}/complete — Marcar hecho + crear log automático.

    Al crear un log manual (POST /logs/), los schedules habilitados de esa
    impresora cuyo task_name coincide (case-insensitive) con maintenance_type,
    o cuyo id esté en `schedule_ids`, se resetean en la misma transacción.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.maintenance import MaintenanceLog, MaintenanceLogItem
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.printer import Printer
from app.models.user import User
from app.schemas.maintenance import (
    MaintenanceLogCreate,
    MaintenanceLogUpdate,
    MaintenanceLogResponse,
    MaintenancePrinterSummary,
    MaintenanceLastEntry,
    MaintenanceScheduleCreate,
    MaintenanceScheduleUpdate,
    MaintenanceScheduleResponse,
)
from app.schemas.printer import PrinterResponse
from app.services.auth import get_current_user, get_operator_user, get_admin_user

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


def _now() -> datetime:
    """Hora actual UTC naive. Función module-level monkeypatcheable en tests."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Helper privado ────────────────────────────────────────────────────────────

async def _get_log(
    db: AsyncSession, log_id: int
) -> MaintenanceLog:
    """
    Obtiene un registro de mantenimiento con sus ítems e impresora.

    Args:
        db:     Sesión de base de datos.
        log_id: ID del registro.

    Returns:
        Instancia de MaintenanceLog con items y printer cargados.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(
        select(MaintenanceLog)
        .options(
            selectinload(MaintenanceLog.items),
            selectinload(MaintenanceLog.printer),
        )
        .where(MaintenanceLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de mantenimiento no encontrado",
        )
    return log


def _compute_progress(schedule: MaintenanceSchedule) -> Tuple[Decimal, str]:
    """
    Calcula el % de progreso hacia el vencimiento y el status de un schedule.

    Para `print_hours`: elapsed = printer.current_hours - last_done_hours.
    Para `days`: elapsed = días transcurridos desde last_done_at (con fracción).

    Si la impresora tiene menos horas que last_done_hours (reemplazo/reset
    del contador), elapsed se clampa a 0 en vez de dar negativo.

    Returns:
        (progress_pct, status) — status en {'ok', 'due_soon', 'overdue'}.
    """
    if schedule.interval_type == "print_hours":
        current = schedule.printer.current_hours if schedule.printer else Decimal("0")
        elapsed = Decimal(str(current)) - Decimal(str(schedule.last_done_hours))
    else:
        delta = _now() - schedule.last_done_at
        elapsed = Decimal(str(delta.total_seconds() / 86400))

    if elapsed < 0:
        elapsed = Decimal("0")

    interval = Decimal(str(schedule.interval_value))
    progress_pct = min(elapsed / interval * Decimal("100"), Decimal("999"))
    progress_pct = progress_pct.quantize(Decimal("0.1"))

    if progress_pct >= 100:
        sched_status = "overdue"
    elif progress_pct >= 80:
        sched_status = "due_soon"
    else:
        sched_status = "ok"

    return progress_pct, sched_status


def _schedule_to_response(schedule: MaintenanceSchedule) -> MaintenanceScheduleResponse:
    """Construye MaintenanceScheduleResponse con progreso/status calculados."""
    progress_pct, sched_status = _compute_progress(schedule)
    return MaintenanceScheduleResponse(
        id=schedule.id,
        printer_id=schedule.printer_id,
        printer_name=schedule.printer.name if schedule.printer else None,
        task_name=schedule.task_name,
        description=schedule.description,
        interval_type=schedule.interval_type,
        interval_value=schedule.interval_value,
        last_done_at=schedule.last_done_at,
        last_done_hours=schedule.last_done_hours,
        enabled=schedule.enabled,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
        progress_pct=progress_pct,
        status=sched_status,
    )


async def _get_schedule(db: AsyncSession, schedule_id: int) -> MaintenanceSchedule:
    """Obtiene un schedule con su impresora cargada, o 404."""
    result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.printer))
        .where(MaintenanceSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recordatorio de mantenimiento no encontrado",
        )
    return schedule


async def _get_company_printer(
    db: AsyncSession, printer_id: int
) -> Printer:
    """
    Obtiene una impresora por ID.

    Args:
        db:         Sesión de base de datos.
        printer_id: ID de la impresora.

    Returns:
        Instancia de Printer.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(
        select(Printer).where(Printer.id == printer_id)
    )
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impresora no encontrada",
        )
    return printer


# ─── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/logs/", response_model=List[MaintenanceLogResponse])
async def list_logs(
    printer_id: Optional[int] = Query(None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los registros de mantenimiento de la empresa.

    Si se proporciona printer_id, filtra por esa impresora.

    Args:
        printer_id:   ID de impresora para filtrar (opcional).
        skip:         Registros a omitir (paginación).
        limit:        Máximo de registros a retornar (default 100, máx. 500).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de MaintenanceLogResponse ordenada por fecha descendente.
    """
    query = (
        select(MaintenanceLog)
        .options(
            selectinload(MaintenanceLog.items),
            selectinload(MaintenanceLog.printer),
        )
    )
    if printer_id is not None:
        query = query.where(MaintenanceLog.printer_id == printer_id)
    query = query.order_by(MaintenanceLog.performed_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/logs/", response_model=MaintenanceLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    data: MaintenanceLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Crea un registro de mantenimiento y descuenta ítems del inventario.

    Operación atómica: si algún ítem de inventario vinculado no tiene
    stock suficiente, se rechaza toda la operación con 400.

    Lógica:
    1. Verificar que la impresora pertenece a la empresa.
    2. Crear el MaintenanceLog.
    3. Para cada ítem: crear MaintenanceLogItem; si tiene inventory_item_id,
       buscar el InventoryItem del mismo company_id y descontar quantity.
       Si stock < 0 → raise 400. Si stock < min_quantity → needs_purchase=True.
    4. Commit todo en una sola transacción.

    Args:
        data:         Datos del registro con lista de ítems.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        MaintenanceLogResponse con ítems e impresora.

    Raises:
        HTTPException 404: Si la impresora no existe.
        HTTPException 400: Si stock insuficiente para algún ítem.
    """
    # Verificar que la impresora existe
    printer = await _get_company_printer(db, data.printer_id)

    # Determinar fecha de realización
    performed_at = data.performed_at
    if performed_at is None:
        performed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        performed_at = performed_at.replace(tzinfo=None)

    # Crear el registro principal
    log = MaintenanceLog(
        printer_id=data.printer_id,
        hours_at_maintenance=data.hours_at_maintenance,
        maintenance_type=data.maintenance_type,
        description=data.description,
        performed_at=performed_at,
    )
    db.add(log)
    await db.flush()  # obtener log.id sin commitear

    # Crear ítems y descontar inventario
    for item_data in data.items:
        log_item = MaintenanceLogItem(
            log_id=log.id,
            inventory_item_id=item_data.inventory_item_id,
            name=item_data.name,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            notes=item_data.notes,
        )
        db.add(log_item)

        # Descontar del inventario si está vinculado
        if item_data.inventory_item_id is not None:
            inv_result = await db.execute(
                select(InventoryItem).where(
                    InventoryItem.id == item_data.inventory_item_id,
                ).with_for_update()
            )
            inv_item = inv_result.scalar_one_or_none()
            if inv_item:
                new_quantity = inv_item.quantity - Decimal(str(item_data.quantity))
                if new_quantity < Decimal("0"):
                    await db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuficiente para '{inv_item.name}' "
                               f"(disponible: {inv_item.quantity}, requerido: {item_data.quantity})",
                    )
                inv_item.quantity = new_quantity
                if inv_item.min_quantity is not None and inv_item.quantity < inv_item.min_quantity:
                    inv_item.needs_purchase = True

    # Resetear schedules: auto-match por task_name (case-insensitive) +
    # los explícitamente indicados en schedule_ids. Misma transacción.
    schedules_result = await db.execute(
        select(MaintenanceSchedule).where(
            MaintenanceSchedule.printer_id == data.printer_id,
            MaintenanceSchedule.enabled.is_(True),
        )
    )
    candidate_schedules = schedules_result.scalars().all()
    matched_ids: List[int] = []
    reset_at = _now()
    for sched in candidate_schedules:
        auto_match = sched.task_name.strip().lower() == data.maintenance_type.strip().lower()
        explicit_match = sched.id in data.schedule_ids
        if auto_match or explicit_match:
            sched.last_done_at = reset_at
            sched.last_done_hours = printer.current_hours
            matched_ids.append(sched.id)

    await db.commit()

    # Recargar con relaciones
    log_response = MaintenanceLogResponse.model_validate(await _get_log(db, log.id))
    log_response.matched_schedules = matched_ids
    return log_response


@router.get("/logs/{log_id}", response_model=MaintenanceLogResponse)
async def get_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene el detalle de un registro de mantenimiento.

    Args:
        log_id:       ID del registro.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        MaintenanceLogResponse con ítems e impresora.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_log(db, log_id)


@router.put("/logs/{log_id}", response_model=MaintenanceLogResponse)
async def update_log(
    log_id: int,
    data: MaintenanceLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Edita los campos no-inventario de un registro de mantenimiento.

    No modifica la impresora ni los ítems (estos ya descontaron inventario).
    Campos editables: performed_at, hours_at_maintenance, maintenance_type, description.

    Args:
        log_id:       ID del registro.
        data:         Campos a actualizar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        MaintenanceLogResponse actualizado.

    Raises:
        HTTPException 404: Si el registro no existe.
    """
    log = await _get_log(db, log_id)
    log.performed_at = data.performed_at.replace(tzinfo=None)
    log.hours_at_maintenance = data.hours_at_maintenance
    log.maintenance_type = data.maintenance_type
    log.description = data.description
    await db.commit()
    return await _get_log(db, log_id)


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Elimina un registro de mantenimiento y sus ítems (cascade).

    Nota: NO restaura el stock de inventario al eliminar el registro.

    Args:
        log_id:       ID del registro.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    log = await _get_log(db, log_id)
    await db.delete(log)
    await db.commit()


# ─── Summary / Dashboard ───────────────────────────────────────────────────────

@router.get("/summary/", response_model=List[MaintenancePrinterSummary])
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna el resumen de mantenimiento por impresora (dashboard).

    Para cada impresora de la empresa agrupa los logs por tipo de
    mantenimiento y retorna el más reciente de cada tipo junto con
    las horas transcurridas desde ese mantenimiento.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de MaintenancePrinterSummary con last_per_type por impresora.
    """
    # Cargar todas las impresoras
    printers_result = await db.execute(
        select(Printer).order_by(Printer.name)
    )
    printers = printers_result.scalars().all()

    if not printers:
        return []

    printer_ids = [p.id for p in printers]

    # Cargar todos los logs de esas impresoras
    logs_result = await db.execute(
        select(MaintenanceLog)
        .where(
            MaintenanceLog.printer_id.in_(printer_ids),
        )
        .order_by(MaintenanceLog.performed_at.desc())
    )
    logs = logs_result.scalars().all()

    # Indexar logs por printer_id
    logs_by_printer: dict = {}
    for log in logs:
        logs_by_printer.setdefault(log.printer_id, []).append(log)

    summaries = []
    for printer in printers:
        printer_logs = logs_by_printer.get(printer.id, [])

        # Para cada tipo, tomar el log más reciente (ya están ordenados desc)
        last_per_type: dict = {}
        for log in printer_logs:
            if log.maintenance_type not in last_per_type:
                hours_since = None
                if printer.current_hours is not None:
                    hours_since = float(printer.current_hours) - float(log.hours_at_maintenance)
                    if hours_since < 0:
                        hours_since = 0.0

                last_per_type[log.maintenance_type] = MaintenanceLastEntry(
                    log_id=log.id,
                    performed_at=log.performed_at,
                    hours_at_maintenance=log.hours_at_maintenance,
                    hours_since=hours_since,
                )

        summaries.append(MaintenancePrinterSummary(
            printer=PrinterResponse.model_validate(printer),
            last_per_type=last_per_type,
        ))

    return summaries


# ─── Schedules (recordatorios por intervalo, issue #138) ──────────────────────

@router.get("/schedules/", response_model=List[MaintenanceScheduleResponse])
async def list_schedules(
    printer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista recordatorios de mantenimiento con progreso/status calculados."""
    query = select(MaintenanceSchedule).options(selectinload(MaintenanceSchedule.printer))
    if printer_id is not None:
        query = query.where(MaintenanceSchedule.printer_id == printer_id)
    query = query.order_by(MaintenanceSchedule.printer_id, MaintenanceSchedule.task_name)
    result = await db.execute(query)
    schedules = result.scalars().all()
    return [_schedule_to_response(s) for s in schedules]


@router.get("/schedules/due", response_model=List[MaintenanceScheduleResponse])
async def list_schedules_due(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista global de recordatorios habilitados que no están 'ok' (due_soon u
    overdue), para badges de sidebar/home. Nota: al ser calculado, no hay
    filtro SQL directo por status — se filtra tras computar el progreso.
    """
    result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.printer))
        .where(MaintenanceSchedule.enabled.is_(True))
    )
    schedules = result.scalars().all()
    responses = [_schedule_to_response(s) for s in schedules]
    return [r for r in responses if r.status != "ok"]


@router.post("/schedules/", response_model=MaintenanceScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: MaintenanceScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Crea un recordatorio de mantenimiento.

    Baseline: last_done_at=ahora, last_done_hours=horas actuales de la
    impresora — el progreso arranca en 0% (ver docstring de MaintenanceSchedule).
    """
    printer = await _get_company_printer(db, data.printer_id)
    now = _now()
    schedule = MaintenanceSchedule(
        printer_id=data.printer_id,
        task_name=data.task_name,
        description=data.description,
        interval_type=data.interval_type,
        interval_value=data.interval_value,
        last_done_at=now,
        last_done_hours=printer.current_hours,
    )
    db.add(schedule)
    await db.commit()
    schedule = await _get_schedule(db, schedule.id)
    return _schedule_to_response(schedule)


@router.put("/schedules/{schedule_id}", response_model=MaintenanceScheduleResponse)
async def update_schedule(
    schedule_id: int,
    data: MaintenanceScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Edita campos de un recordatorio (no reasigna la impresora)."""
    schedule = await _get_schedule(db, schedule_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)
    await db.commit()
    schedule = await _get_schedule(db, schedule_id)
    return _schedule_to_response(schedule)


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Elimina un recordatorio de mantenimiento."""
    schedule = await _get_schedule(db, schedule_id)
    await db.delete(schedule)
    await db.commit()


@router.post("/schedules/{schedule_id}/complete", response_model=MaintenanceScheduleResponse)
async def complete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Marca un recordatorio como completado directamente (sin pasar por el
    form de log manual): resetea last_done_at/last_done_hours y crea un
    MaintenanceLog mínimo automático para no perder trazabilidad.
    """
    schedule = await _get_schedule(db, schedule_id)
    now = _now()
    current_hours = schedule.printer.current_hours

    log = MaintenanceLog(
        printer_id=schedule.printer_id,
        hours_at_maintenance=current_hours,
        maintenance_type=schedule.task_name,
        description="Completado desde recordatorio",
        performed_at=now,
    )
    db.add(log)

    schedule.last_done_at = now
    schedule.last_done_hours = current_hours
    await db.commit()
    schedule = await _get_schedule(db, schedule_id)
    return _schedule_to_response(schedule)
