"""
Router para la gestión del catálogo de insumos adicionales.

Expone los endpoints CRUD para los insumos (argollas, switches, imanes, etc.)
que se pueden asociar a cotizaciones en la calculadora.

Endpoints disponibles bajo el prefijo /api/supplies:
- GET  /       - Lista todos los insumos del catálogo.
- POST /        - Crea un nuevo insumo.
- PUT  /{id}   - Actualiza un insumo existente.
- DELETE /{id} - Elimina un insumo del catálogo.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.supply import Supply
from app.schemas.supply import SupplyCreate, SupplyUpdate, SupplyResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/supplies", tags=["supplies"])


@router.get("/", response_model=list[SupplyResponse])
async def list_supplies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los insumos del catálogo ordenados por nombre."""
    result = await db.execute(select(Supply).order_by(Supply.name))
    return result.scalars().all()


@router.post("/", response_model=SupplyResponse, status_code=201)
async def create_supply(
    data: SupplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea un nuevo insumo en el catálogo."""
    supply = Supply(**data.model_dump())
    db.add(supply)
    await db.commit()
    await db.refresh(supply)
    return supply


@router.put("/{supply_id}", response_model=SupplyResponse)
async def update_supply(
    supply_id: int,
    data: SupplyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualiza parcialmente un insumo existente."""
    result = await db.execute(select(Supply).where(Supply.id == supply_id))
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supply, field, value)
    await db.commit()
    await db.refresh(supply)
    return supply


@router.delete("/{supply_id}", status_code=204)
async def delete_supply(
    supply_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina un insumo del catálogo."""
    result = await db.execute(select(Supply).where(Supply.id == supply_id))
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    await db.delete(supply)
    await db.commit()
