"""
Router CRUD para la gestión de filamentos de impresión 3D.

Este módulo expone los endpoints HTTP para crear, leer, actualizar y eliminar
filamentos registrados en el sistema. Todos los endpoints requieren
autenticación mediante token JWT.

Endpoints disponibles bajo el prefijo /api/filaments:
- GET    /           - Lista todos los filamentos ordenados por marca y tipo.
- GET    /{id}       - Obtiene un filamento específico por su ID.
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


@router.get("/", response_model=list[FilamentResponse])
async def list_filaments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Lista todos los filamentos registrados en el sistema.

    Los resultados se ordenan alfabéticamente por marca y luego por tipo de
    material para facilitar la selección en el formulario de cotización.

    Args:
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        list[FilamentResponse]: Lista de todos los filamentos registrados.
    """
    result = await db.execute(select(Filament).order_by(Filament.brand, Filament.type))
    return result.scalars().all()


@router.get("/{filament_id}", response_model=FilamentResponse)
async def get_filament(
    filament_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Obtiene los datos de un filamento específico por su ID.

    Args:
        filament_id: Identificador numérico del filamento a consultar.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        FilamentResponse: Datos completos del filamento encontrado.

    Raises:
        HTTPException 404: Si no existe ningún filamento con el ID indicado.
    """
    result = await db.execute(select(Filament).where(Filament.id == filament_id))
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")
    return filament


@router.post("/", response_model=FilamentResponse, status_code=status.HTTP_201_CREATED)
async def create_filament(
    data: FilamentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Crea un nuevo filamento en el sistema.

    Args:
        data: Datos del filamento a crear, validados por FilamentCreate.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        FilamentResponse: Datos completos del filamento recién creado,
            incluyendo el ID asignado y las marcas de tiempo.
    """
    filament = Filament(**data.model_dump())
    db.add(filament)
    await db.commit()
    await db.refresh(filament)
    return filament


@router.put("/{filament_id}", response_model=FilamentResponse)
async def update_filament(
    filament_id: int,
    data: FilamentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Actualiza parcialmente un filamento existente.

    Solo se modifican los campos incluidos en la solicitud (exclude_unset=True),
    permitiendo actualizar, por ejemplo, únicamente el precio sin necesidad de
    re-enviar todos los demás atributos.

    Args:
        filament_id: Identificador del filamento a actualizar.
        data: Campos a actualizar con sus nuevos valores.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        FilamentResponse: Datos completos del filamento con los cambios aplicados.

    Raises:
        HTTPException 404: Si no existe ningún filamento con el ID indicado.
    """
    result = await db.execute(select(Filament).where(Filament.id == filament_id))
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")

    # Aplica solo los campos explícitamente enviados en la solicitud
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(filament, field, value)

    await db.commit()
    await db.refresh(filament)
    return filament


@router.delete("/{filament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filament(
    filament_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Elimina un filamento del sistema de forma permanente.

    Args:
        filament_id: Identificador del filamento a eliminar.
        db: Sesión de base de datos inyectada por FastAPI.
        _: Usuario autenticado (requerido para acceder al endpoint).

    Returns:
        None: Respuesta vacía con código HTTP 204 No Content.

    Raises:
        HTTPException 404: Si no existe ningún filamento con el ID indicado.
    """
    result = await db.execute(select(Filament).where(Filament.id == filament_id))
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")
    await db.delete(filament)
    await db.commit()
