"""
Router de perfiles de impresión (slicer) de filamento.

Un `FilamentProfile` guarda parámetros de slicer (temperaturas, velocidad,
retracción, flow, fan) asociados a un `InventoryItem` de categoría
"Filamento" — 1:1, referencia informativa, no afecta ningún cálculo de
costo. Mismo nivel de permisos que editar el propio ítem de inventario
(`get_operator_user`), ya que se edita desde el mismo formulario.

Endpoints:
    GET    /api/filament-profiles/{inventory_item_id}  — Obtener perfil (404 si no existe)
    PUT    /api/filament-profiles/{inventory_item_id}  — Crear o actualizar (upsert)
    DELETE /api/filament-profiles/{inventory_item_id}  — Eliminar perfil
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.filament_profile import FilamentProfile
from app.models.inventory import InventoryItem
from app.models.user import User
from app.schemas.filament_profile import FilamentProfileResponse, FilamentProfileUpsert
from app.services.auth import get_current_user, get_operator_user

router = APIRouter(prefix="/api/filament-profiles", tags=["filament-profiles"])


async def _get_inventory_item(db: AsyncSession, inventory_item_id: int) -> InventoryItem:
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == inventory_item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ítem de inventario no encontrado",
        )
    return item


async def _get_profile(db: AsyncSession, inventory_item_id: int) -> FilamentProfile:
    result = await db.execute(
        select(FilamentProfile).where(FilamentProfile.inventory_item_id == inventory_item_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este filamento no tiene perfil de impresión guardado",
        )
    return profile


@router.get("/{inventory_item_id}", response_model=FilamentProfileResponse)
async def get_filament_profile(
    inventory_item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene el perfil de slicer de un filamento. 404 si no tiene uno guardado."""
    return await _get_profile(db, inventory_item_id)


@router.put("/{inventory_item_id}", response_model=FilamentProfileResponse)
async def upsert_filament_profile(
    inventory_item_id: int,
    body: FilamentProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Crea el perfil si no existe, o actualiza el existente (upsert)."""
    await _get_inventory_item(db, inventory_item_id)  # 404 si el filamento no existe

    result = await db.execute(
        select(FilamentProfile).where(FilamentProfile.inventory_item_id == inventory_item_id)
    )
    profile = result.scalar_one_or_none()

    data = body.model_dump()
    if profile is None:
        profile = FilamentProfile(inventory_item_id=inventory_item_id, **data)
        db.add(profile)
    else:
        for field, value in data.items():
            setattr(profile, field, value)
        profile.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{inventory_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filament_profile(
    inventory_item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Elimina el perfil de slicer de un filamento."""
    profile = await _get_profile(db, inventory_item_id)
    await db.delete(profile)
    await db.commit()
