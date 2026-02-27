"""
Router de mantenimiento de impresoras para TurtleForge.

Gestiona el registro de mantenimientos realizados sobre impresoras 3D.
Al crear un registro de mantenimiento, descuenta automáticamente los ítems
de inventario vinculados (transacción atómica).

Endpoints:
    GET    /api/maintenance/printers/          — Listar impresoras.
    POST   /api/maintenance/printers/          — Crear impresora.
    PUT    /api/maintenance/printers/{id}      — Actualizar impresora (incl. horas).
    DELETE /api/maintenance/printers/{id}      — Eliminar impresora (cascade logs).

    GET    /api/maintenance/logs/              — Listar registros (filtrar por printer_id).
    POST   /api/maintenance/logs/              — Crear registro + descontar inventario.
    GET    /api/maintenance/logs/{id}          — Obtener detalle del registro.
    DELETE /api/maintenance/logs/{id}          — Eliminar registro.

    GET    /api/maintenance/summary/           — Resumen por impresora (dashboard).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.maintenance import MaintenancePrinter, MaintenanceLog, MaintenanceLogItem
from app.models.user import User
from app.schemas.maintenance import (
    MaintenancePrinterCreate,
    MaintenancePrinterUpdate,
    MaintenancePrinterResponse,
    MaintenanceLogCreate,
    MaintenanceLogResponse,
    MaintenancePrinterSummary,
    MaintenanceLastEntry,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


# ─── Helpers privados ──────────────────────────────────────────────────────────

async def _get_printer(
    db: AsyncSession, printer_id: int, company_id
) -> MaintenancePrinter:
    """
    Obtiene una impresora de mantenimiento verificando que pertenezca a la empresa.

    Args:
        db:         Sesión de base de datos.
        printer_id: ID de la impresora.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de MaintenancePrinter.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(MaintenancePrinter).where(
            MaintenancePrinter.id == printer_id,
            MaintenancePrinter.company_id == company_id,
        )
    )
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impresora de mantenimiento no encontrada",
        )
    return printer


async def _get_log(
    db: AsyncSession, log_id: int, company_id
) -> MaintenanceLog:
    """
    Obtiene un registro de mantenimiento con sus ítems e impresora.

    Args:
        db:         Sesión de base de datos.
        log_id:     ID del registro.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de MaintenanceLog con items y printer cargados.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(MaintenanceLog)
        .options(
            selectinload(MaintenanceLog.items),
            selectinload(MaintenanceLog.printer),
        )
        .where(
            MaintenanceLog.id == log_id,
            MaintenanceLog.company_id == company_id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de mantenimiento no encontrado",
        )
    return log


# ─── Printers ──────────────────────────────────────────────────────────────────

@router.get("/printers/", response_model=List[MaintenancePrinterResponse])
async def list_printers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista las impresoras registradas en el módulo de mantenimiento.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de MaintenancePrinterResponse ordenada por nombre.
    """
    result = await db.execute(
        select(MaintenancePrinter)
        .where(MaintenancePrinter.company_id == current_user.company_id)
        .order_by(MaintenancePrinter.name)
    )
    return result.scalars().all()


@router.post("/printers/", response_model=MaintenancePrinterResponse, status_code=status.HTTP_201_CREATED)
async def create_printer(
    data: MaintenancePrinterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva impresora en el módulo de mantenimiento.

    Args:
        data:         Datos de la impresora.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        MaintenancePrinterResponse con los datos creados.
    """
    printer = MaintenancePrinter(
        company_id=current_user.company_id,
        name=data.name,
        model=data.model,
        current_hours=data.current_hours,
        notes=data.notes,
    )
    db.add(printer)
    await db.commit()
    await db.refresh(printer)
    return printer


@router.put("/printers/{printer_id}", response_model=MaintenancePrinterResponse)
async def update_printer(
    printer_id: int,
    data: MaintenancePrinterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza una impresora de mantenimiento.

    Solo actualiza los campos enviados (exclude_unset). Permite actualizar
    las horas actuales (current_hours) enviando solo ese campo.

    Args:
        printer_id:   ID de la impresora a actualizar.
        data:         Campos a actualizar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        MaintenancePrinterResponse actualizada.

    Raises:
        HTTPException 404: Si no existe.
    """
    printer = await _get_printer(db, printer_id, current_user.company_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(printer, field, value)
    await db.commit()
    await db.refresh(printer)
    return printer


@router.delete("/printers/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printer(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una impresora y todos sus registros de mantenimiento (cascade).

    Args:
        printer_id:   ID de la impresora.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    printer = await _get_printer(db, printer_id, current_user.company_id)
    await db.delete(printer)
    await db.commit()


# ─── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/logs/", response_model=List[MaintenanceLogResponse])
async def list_logs(
    printer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los registros de mantenimiento de la empresa.

    Si se proporciona printer_id, filtra por esa impresora.

    Args:
        printer_id:   ID de impresora para filtrar (opcional).
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
        .where(MaintenanceLog.company_id == current_user.company_id)
    )
    if printer_id is not None:
        query = query.where(MaintenanceLog.printer_id == printer_id)
    query = query.order_by(MaintenanceLog.performed_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/logs/", response_model=MaintenanceLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    data: MaintenanceLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    # Verificar que la impresora pertenece a la empresa
    await _get_printer(db, data.printer_id, current_user.company_id)

    # Determinar fecha de realización
    performed_at = data.performed_at
    if performed_at is None:
        performed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        performed_at = performed_at.replace(tzinfo=None)

    # Crear el registro principal
    log = MaintenanceLog(
        company_id=current_user.company_id,
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
                    InventoryItem.company_id == current_user.company_id,
                )
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
                if inv_item.quantity < inv_item.min_quantity:
                    inv_item.needs_purchase = True

    await db.commit()

    # Recargar con relaciones
    return await _get_log(db, log.id, current_user.company_id)


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
    return await _get_log(db, log_id, current_user.company_id)


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    log = await _get_log(db, log_id, current_user.company_id)
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
    company_id = current_user.company_id

    # Cargar todas las impresoras
    printers_result = await db.execute(
        select(MaintenancePrinter)
        .where(MaintenancePrinter.company_id == company_id)
        .order_by(MaintenancePrinter.name)
    )
    printers = printers_result.scalars().all()

    if not printers:
        return []

    printer_ids = [p.id for p in printers]

    # Cargar todos los logs de esas impresoras (sin ítems para eficiencia)
    logs_result = await db.execute(
        select(MaintenanceLog)
        .where(
            MaintenanceLog.company_id == company_id,
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

        # Para cada tipo, tomar el log más reciente (los logs ya están ordenados desc)
        last_per_type: dict = {}
        for log in printer_logs:
            if log.maintenance_type not in last_per_type:
                # Calcular horas desde el último mantenimiento
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
            printer=MaintenancePrinterResponse(
                id=printer.id,
                name=printer.name,
                model=printer.model,
                current_hours=printer.current_hours,
                notes=printer.notes,
                created_at=printer.created_at,
            ),
            last_per_type=last_per_type,
        ))

    return summaries
