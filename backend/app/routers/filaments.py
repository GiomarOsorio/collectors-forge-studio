"""
Router CRUD para la gestión de filamentos de impresión 3D.

Todos los endpoints filtran automáticamente por company_id del usuario
autenticado, garantizando el aislamiento multi-tenant: cada empresa solo
ve y gestiona sus propios filamentos.

Endpoints disponibles bajo el prefijo /api/filaments:
- GET    /           - Lista los filamentos de la empresa del usuario.
- GET    /{id}       - Obtiene un filamento específico de la empresa.
- POST   /           - Crea un nuevo filamento (devuelve 201 Created).
- PUT    /{id}       - Actualiza parcialmente un filamento existente.
- DELETE /{id}       - Elimina un filamento (devuelve 204 No Content).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.filament import Filament
from app.schemas.filament import FilamentCreate, FilamentUpdate, FilamentResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/filaments", tags=["filaments"])


@router.get("/", response_model=list[FilamentResponse], deprecated=True)
async def list_filaments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los filamentos de la empresa del usuario autenticado.

    Filtra por company_id para garantizar el aislamiento multi-tenant.
    Los resultados se ordenan alfabéticamente por marca y tipo.
    """
    result = await db.execute(
        select(Filament)
        .where(Filament.company_id == current_user.company_id)
        .order_by(Filament.brand, Filament.type)
    )
    return result.scalars().all()


@router.get("/{filament_id}", response_model=FilamentResponse, deprecated=True)
async def get_filament(
    filament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene un filamento específico de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Filament).where(
            Filament.id == filament_id,
            Filament.company_id == current_user.company_id,
        )
    )
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")
    return filament


@router.post("/", response_model=FilamentResponse, status_code=status.HTTP_201_CREATED, deprecated=True)
async def create_filament(
    data: FilamentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un nuevo filamento asociado a la empresa del usuario autenticado.

    El company_id se asigna automáticamente desde el usuario autenticado.
    """
    filament = Filament(**data.model_dump(), company_id=current_user.company_id)
    db.add(filament)
    await db.commit()
    await db.refresh(filament)
    return filament


@router.put("/{filament_id}", response_model=FilamentResponse, deprecated=True)
async def update_filament(
    filament_id: int,
    data: FilamentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza parcialmente un filamento de la empresa del usuario autenticado.

    Solo se modifican los campos incluidos en la solicitud (exclude_unset=True).

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Filament).where(
            Filament.id == filament_id,
            Filament.company_id == current_user.company_id,
        )
    )
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(filament, field, value)

    await db.commit()
    await db.refresh(filament)
    return filament


@router.delete("/{filament_id}", status_code=status.HTTP_204_NO_CONTENT, deprecated=True)
async def delete_filament(
    filament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina un filamento de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa del usuario.
    """
    result = await db.execute(
        select(Filament).where(
            Filament.id == filament_id,
            Filament.company_id == current_user.company_id,
        )
    )
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")
    await db.delete(filament)
    await db.commit()
