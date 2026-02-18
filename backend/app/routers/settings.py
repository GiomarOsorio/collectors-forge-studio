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

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.models.electricity_tariff import ElectricityTariff
from app.schemas.settings import AppSettingsUpdate, AppSettingsResponse
from app.services.auth import get_current_user
from app.services.exchange_rate import get_usd_to_cop, COP_MARKUP
from app.services.tariff_scraper import get_epm_estrato4_tariff, TARIFF_MULTIPLIER

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


@router.get("/electricity-tariff")
async def get_electricity_tariff(
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

    # Guardar cada estrato en BD si no existe ya para este mes
    year = data.get("year")
    month = data.get("month")
    if year and month:
        for estrato_num_str, estrato_data in data.get("estratos", {}).items():
            estrato_num = int(estrato_num_str)
            existing = await db.execute(
                select(ElectricityTariff).where(
                    ElectricityTariff.year == year,
                    ElectricityTariff.month == month,
                    ElectricityTariff.estrato == estrato_num,
                )
            )
            if existing.scalar_one_or_none() is None:
                record = ElectricityTariff(
                    year=year,
                    month=month,
                    month_label=data["month_label"],
                    estrato=estrato_num,
                    cop_market_rate=estrato_data["cop_market_rate"],
                    cop_rate_used=estrato_data["cop_rate_used"],
                    usd_rate=estrato_data["usd_rate"],
                    usd_to_cop=data["usd_to_cop"],
                    multiplier=data["multiplier"],
                    pdf_url=data.get("pdf_url"),
                    scraped_at=datetime.utcnow(),
                )
                db.add(record)
        await db.commit()

    return {"available": True, **data}


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

    # Agrupar por (year, month)
    months: dict = {}
    for r in records:
        key = (r.year, r.month)
        if key not in months:
            months[key] = {
                "year": r.year,
                "month": r.month,
                "month_label": r.month_label,
                "multiplier": r.multiplier,
                "estratos": {},
            }
        months[key]["estratos"][str(r.estrato)] = {
            "cop_market_rate": r.cop_market_rate,
            "cop_rate_used": r.cop_rate_used,
            "usd_rate": r.usd_rate,
            "usd_to_cop": r.usd_to_cop,
        }

    return list(months.values())


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
