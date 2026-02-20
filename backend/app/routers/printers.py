"""
Router CRUD para la gestión de impresoras 3D.

Todos los endpoints filtran automáticamente por company_id del usuario
autenticado, garantizando el aislamiento multi-tenant: cada empresa solo
ve y gestiona sus propias impresoras.

Endpoints disponibles bajo el prefijo /api/printers:
- GET    /           - Lista las impresoras de la empresa del usuario.
- GET    /{id}       - Obtiene una impresora específica de la empresa.
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
    current_user: User = Depends(get_current_user),
):
    """
    Lista las impresoras de la empresa del usuario autenticado.

    Filtra por company_id para garantizar el aislamiento multi-tenant.
    Los resultados se ordenan alfabéticamente por nombre.
    """
    result = await db.execute(
        select(Printer)
        .where(Printer.company_id == current_user.company_id)
        .order_by(Printer.name)
    )
    return result.scalars().all()


@router.get("/{printer_id}", response_model=PrinterResponse)
async def get_printer(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene una impresora específica de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Printer).where(
            Printer.id == printer_id,
            Printer.company_id == current_user.company_id,
        )
    )
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    return printer


@router.post("/", response_model=PrinterResponse, status_code=status.HTTP_201_CREATED)
async def create_printer(
    data: PrinterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registra una nueva impresora asociada a la empresa del usuario autenticado.

    El company_id se asigna automáticamente desde el usuario autenticado.
    """
    printer = Printer(**data.model_dump(), company_id=current_user.company_id)
    db.add(printer)
    await db.commit()
    await db.refresh(printer)
    return printer


@router.put("/{printer_id}", response_model=PrinterResponse)
async def update_printer(
    printer_id: int,
    data: PrinterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza parcialmente una impresora de la empresa del usuario autenticado.

    Solo se modifican los campos incluidos en la solicitud (exclude_unset=True).

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Printer).where(
            Printer.id == printer_id,
            Printer.company_id == current_user.company_id,
        )
    )
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(printer, field, value)

    await db.commit()
    await db.refresh(printer)
    return printer


@router.delete("/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printer(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una impresora de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Printer).where(
            Printer.id == printer_id,
            Printer.company_id == current_user.company_id,
        )
    )
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    await db.delete(printer)
    await db.commit()
