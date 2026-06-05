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

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.models.electricity_tariff import ElectricityTariff
from app.schemas.settings import AppSettingsUpdate, AppSettingsResponse
from app.limiter import limiter
from app.services.auth import get_admin_user, get_current_user
from app.services.exchange_rate import get_usd_to_cop, COP_MARKUP, get_cache_timestamp
from app.services.tariff_scraper import get_epm_estrato4_tariff, persist_tariffs

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=AppSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene la configuración singleton de la aplicación.

    Lectura abierta a cualquier usuario autenticado porque la calculadora
    de costos requiere estos parámetros (tarifa, margen, etc). La escritura
    sigue restringida a admin en `PUT /api/settings/`.

    Si no existe configuración, la crea con valores por defecto.

    Args:
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado.

    Returns:
        AppSettingsResponse con todos los parámetros económicos.
    """
    result = await db.execute(select(AppSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = AppSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.put("/", response_model=AppSettingsResponse)
async def update_settings(
    data: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Actualiza parcialmente la configuración singleton (solo admins).

    Args:
        data: Campos de configuración a actualizar.
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario admin autenticado.

    Returns:
        AppSettingsResponse con los parámetros actualizados.
    """
    result = await db.execute(select(AppSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
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


@router.get("/electricity-tariff")
@limiter.limit("10/minute")
async def get_electricity_tariff(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve la tarifa EPM del mes actual (todos los estratos) y la guarda en BD.

    Descarga y parsea el PDF oficial de EPM, aplica el multiplicador ×2,
    convierte a USD/kWh y persiste los 6 estratos en la tabla electricity_tariffs.
    Se cachea en memoria 24 horas para evitar descargas repetidas.

    Returns:
        dict con todos los estratos, tasa de cambio, mes y valores en USD/kWh.
    """
    data = await get_epm_estrato4_tariff()
    if not data:
        return {"available": False, "message": "No se pudo obtener la tarifa EPM en este momento"}

    # Persistencia idempotente delegada al servicio (usa UNIQUE constraint)
    await persist_tariffs(db, data)
    return {"available": True, **data}


@router.post("/electricity-tariff/refresh")
@limiter.limit("3/minute")
async def refresh_electricity_tariff(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Fuerza un re-scrape inmediato de la tarifa EPM, ignorando el caché de 24h.

    Solo admins. Rate-limited a 3/min para evitar saturar el portal EPM.

    Returns:
        dict con los datos actualizados o mensaje de error.
    """
    data = await get_epm_estrato4_tariff(force=True)
    if not data:
        return {"available": False, "message": "No se pudo obtener la tarifa EPM en este momento"}

    inserted = await persist_tariffs(db, data)
    return {"available": True, "new_records": inserted, **data}


@router.get("/electricity-tariffs")
async def list_electricity_tariffs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el historial completo de tarifas EPM guardadas en BD.

    Agrupa los datos por mes (year, month) para facilitar la construcción
    del dropdown de meses en el frontend. Cada mes contiene las tarifas
    de todos los estratos disponibles.

    Returns:
        list: Lista de meses ordenados de más reciente a más antiguo,
              cada uno con su dict de estratos.
    """
    result = await db.execute(
        select(ElectricityTariff).order_by(
            ElectricityTariff.year.desc(),
            ElectricityTariff.month.desc(),
            ElectricityTariff.estrato,
        )
    )
    records = result.scalars().all()

    # Agrupar por (year, month). `scraped_at` por mes = max scrape de cualquier estrato.
    months: dict = {}
    for r in records:
        key = (r.year, r.month)
        if key not in months:
            months[key] = {
                "year": r.year,
                "month": r.month,
                "month_label": r.month_label,
                "multiplier": r.multiplier,
                "scraped_at": r.scraped_at.isoformat() if r.scraped_at else None,
                "estratos": {},
            }
        else:
            # Mantener el scraped_at más reciente del mes
            if r.scraped_at and (
                months[key]["scraped_at"] is None
                or r.scraped_at.isoformat() > months[key]["scraped_at"]
            ):
                months[key]["scraped_at"] = r.scraped_at.isoformat()
        months[key]["estratos"][str(r.estrato)] = {
            "cop_market_rate": r.cop_market_rate,
            "cop_rate_used": r.cop_rate_used,
            "usd_rate": r.usd_rate,
            "usd_to_cop": r.usd_to_cop,
        }

    return list(months.values())


@router.get("/exchange-rate")
@limiter.limit("10/minute")
async def get_exchange_rate(
    request: Request,
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
    cached_at = get_cache_timestamp()
    return {
        "market_rate": market_rate,
        "markup": COP_MARKUP,
        "rate_used": rate_with_markup,
        "cached_at": cached_at,
        "description": f"1 USD = {rate_with_markup:,.0f} COP (mercado {market_rate:,.0f} + {COP_MARKUP:.0f} markup)",
    }
