"""
Router para la gestión de la configuración de la aplicación por usuario.

Este módulo expone los endpoints HTTP para consultar y actualizar los
parámetros globales que influyen en todos los cálculos de cotización del
usuario autenticado: tarifa eléctrica, tasa de fallos, costo de mano de
obra, margen de ganancia por defecto y moneda.

Si el usuario aún no tiene configuración (por ejemplo, si fue creado
directamente en la base de datos sin pasar por el registro), ambos
endpoints crean automáticamente un registro con valores por defecto.

Endpoints disponibles bajo el prefijo /api/settings:
- GET /  - Obtiene la configuración actual del usuario autenticado.
- PUT /  - Actualiza parcialmente la configuración del usuario autenticado.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.schemas.settings import AppSettingsUpdate, AppSettingsResponse
from app.services.auth import get_current_user
from app.services.exchange_rate import get_usd_to_cop, COP_MARKUP

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=AppSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene la configuración de la aplicación del usuario autenticado.

    Si el usuario no tiene configuración previa (caso poco frecuente), crea
    automáticamente un registro con los valores por defecto y lo devuelve.

    Args:
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado extraído del token JWT.

    Returns:
        AppSettingsResponse: Configuración actual del usuario con todos sus
            parámetros económicos (tarifa eléctrica, margen, moneda, etc.).
    """
    result = await db.execute(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        # Crear configuración por defecto si no existe para este usuario
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
    """
    Actualiza parcialmente la configuración de la aplicación del usuario autenticado.

    Solo se modifican los campos incluidos en la solicitud. Si el usuario aún
    no tiene configuración, se crea primero con valores por defecto y luego
    se aplican los cambios solicitados.

    Args:
        data: Campos de configuración a actualizar con sus nuevos valores.
            Los campos no incluidos mantienen sus valores actuales.
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado extraído del token JWT.

    Returns:
        AppSettingsResponse: Configuración actualizada del usuario con todos
            sus parámetros reflejando los cambios aplicados.
    """
    result = await db.execute(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        # Crear configuración base si no existe antes de aplicar los cambios
        settings = AppSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    # Aplica solo los campos explícitamente enviados en la solicitud
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/exchange-rate")
async def get_exchange_rate(
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve la tasa de cambio USD → COP actualmente en uso.

    Incluye la tasa de mercado, el markup aplicado y la tasa final
    que se usa en todos los cálculos de cotización.

    Returns:
        dict: Tasa de mercado, markup y tasa final usada en cálculos.
    """
    rate_with_markup = await get_usd_to_cop()
    market_rate = round(rate_with_markup - COP_MARKUP, 2)
    return {
        "market_rate": market_rate,
        "markup": COP_MARKUP,
        "rate_used": rate_with_markup,
        "description": f"1 USD = {rate_with_markup:,.0f} COP (mercado {market_rate:,.0f} + {COP_MARKUP:.0f} markup)",
    }
