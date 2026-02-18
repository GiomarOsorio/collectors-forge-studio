"""
Router CRUD para la gestión de impresoras 3D.

Este módulo expone los endpoints HTTP para crear, leer, actualizar y eliminar
impresoras registradas en el sistema. Todos los endpoints requieren
autenticación mediante token JWT.

Endpoints disponibles bajo el prefijo /api/printers:
- GET    /           - Lista todas las impresoras ordenadas por nombre.
- GET    /{id}       - Obtiene una impresora específica por su ID.
- POST   /           - Registra una nueva impresora (devuelve 201 Created).
- PUT    /{id}       - Actualiza parcialmente una impresora existente.
- DELETE /{id}       - Elimina una impresora (devuelve 204 No Content).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.printer import Printer
from app.schemas.printer import PrinterCreate, PrinterUpdate, PrinterResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/printers", tags=["printers"])


@router.get("/", response_model=list[PrinterResponse])
async def list_printers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Lista todas las impresoras registradas en el sistema.

    Los resultados se ordenan alfabéticamente por nombre para facilitar la
    selección en el formulario de cotización.

    Args:
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        list[PrinterResponse]: Lista de todas las impresoras registradas.
    """
    result = await db.execute(select(Printer).order_by(Printer.name))
    return result.scalars().all()


@router.get("/{printer_id}", response_model=PrinterResponse)
async def get_printer(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Obtiene los datos de una impresora específica por su ID.

    Args:
        printer_id: Identificador numérico de la impresora a consultar.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        PrinterResponse: Datos completos de la impresora encontrada.

    Raises:
        HTTPException 404: Si no existe ninguna impresora con el ID indicado.
    """
    result = await db.execute(select(Printer).where(Printer.id == printer_id))
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    return printer


@router.post("/", response_model=PrinterResponse, status_code=status.HTTP_201_CREATED)
async def create_printer(
    data: PrinterCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Registra una nueva impresora 3D en el sistema.

    Args:
        data: Datos de la impresora a registrar, validados por PrinterCreate.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        PrinterResponse: Datos completos de la impresora recién registrada,
            incluyendo el ID asignado y las marcas de tiempo.
    """
    printer = Printer(**data.model_dump())
    db.add(printer)
    await db.commit()
    await db.refresh(printer)
    return printer


@router.put("/{printer_id}", response_model=PrinterResponse)
async def update_printer(
    printer_id: int,
    data: PrinterUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Actualiza parcialmente una impresora existente.

    Solo se modifican los campos incluidos en la solicitud (exclude_unset=True),
    lo que permite actualizar únicamente, por ejemplo, las horas de uso
    acumuladas sin re-enviar todos los demás parámetros técnicos.

    Args:
        printer_id: Identificador de la impresora a actualizar.
        data: Campos a actualizar con sus nuevos valores.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        PrinterResponse: Datos completos de la impresora con los cambios aplicados.

    Raises:
        HTTPException 404: Si no existe ninguna impresora con el ID indicado.
    """
    result = await db.execute(select(Printer).where(Printer.id == printer_id))
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")

    # Aplica solo los campos explícitamente enviados en la solicitud
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(printer, field, value)

    await db.commit()
    await db.refresh(printer)
    return printer


@router.delete("/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printer(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Elimina una impresora del sistema de forma permanente.

    Args:
        printer_id: Identificador de la impresora a eliminar.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        None: Respuesta vacía con código HTTP 204 No Content.

    Raises:
        HTTPException 404: Si no existe ninguna impresora con el ID indicado.
    """
    result = await db.execute(select(Printer).where(Printer.id == printer_id))
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    await db.delete(printer)
    await db.commit()
