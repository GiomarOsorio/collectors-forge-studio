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
    result = await db.execute(select(Filament).order_by(Filament.brand, Filament.type))
    return result.scalars().all()


@router.get("/{filament_id}", response_model=FilamentResponse)
async def get_filament(
    filament_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
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
    result = await db.execute(select(Filament).where(Filament.id == filament_id))
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")

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
    result = await db.execute(select(Filament).where(Filament.id == filament_id))
    filament = result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")
    await db.delete(filament)
    await db.commit()
