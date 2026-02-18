from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.schemas.settings import AppSettingsUpdate, AppSettingsResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=AppSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        # Crear settings por defecto si no existen
        settings = AppSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.put("/", response_model=AppSettingsResponse)
async def update_settings(
    data: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = AppSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings
