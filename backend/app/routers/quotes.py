"""
Router para el cálculo, gestión y descarga de cotizaciones de impresión 3D.

Todos los endpoints filtran automáticamente por company_id del usuario
autenticado, garantizando el aislamiento multi-tenant: cada empresa solo
ve y gestiona sus propias cotizaciones.

Endpoints disponibles bajo el prefijo /api/quotes:
- POST /calculate     - Calcula el costo sin guardar (previsualización).
- POST /              - Calcula y guarda la cotización en el historial.
- GET  /              - Lista el historial de cotizaciones de la empresa.
- GET  /{id}          - Obtiene una cotización específica de la empresa.
- PUT  /{id}          - Actualiza metadatos descriptivos de una cotización.
- DELETE /{id}        - Elimina una cotización del historial.
- GET  /{id}/pdf      - Descarga la cotización como archivo PDF.
"""

import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.inventory import InventoryItem
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.models.quote import Quote
from app.schemas.quote import QuoteCalculateRequest, QuoteManualRequest, QuoteResponse, QuoteCostBreakdown, QuoteUpdateMeta
from app.limiter import limiter
from app.services.auth import get_current_user
from app.services.calculator import calculate_cost
from app.services.pdf_generator import generate_quote_pdf
from app.services.exchange_rate import get_usd_to_cop

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


class _FakeFilament:
    """Portador de datos de filamento para cotización manual (sin BD)."""
    def __init__(self, price_per_kg):
        self.price_per_kg = price_per_kg


class _FakePrinter:
    """Portador de datos de impresora para cotización manual (sin BD)."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeSettings:
    """Portador de configuración para cotización manual con posibles sobreescrituras."""
    def __init__(self, base_settings, overrides: dict):
        for field in ("electricity_rate", "failure_rate_percent", "labor_cost_per_hour", "default_margin_percent"):
            v = overrides.get(field)
            setattr(self, field, v if v is not None else getattr(base_settings, field))


@router.post("/calculate", response_model=QuoteCostBreakdown)
@limiter.limit("60/minute")
async def calculate_quote(
    request: Request,
    data: QuoteCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calcula el costo de una impresión 3D sin guardar la cotización.

    Filtra filamento e impresora por company_id para garantizar el aislamiento.

    Returns:
        QuoteCostBreakdown: Desglose completo de costos (no persistido en BD).

    Raises:
        HTTPException 404: Si el filamento o la impresora no pertenecen a la empresa.
    """
    filament, printer, app_settings = await _get_dependencies(
        db, current_user, data.inventory_item_id, data.printer_id
    )
    cop_rate = await get_usd_to_cop()
    supplies_data = await _resolve_supplies(db, current_user, data.supplies)
    additional_filaments_data = await _resolve_additional_filaments(db, current_user, data.additional_filaments)

    return calculate_cost(
        filament=filament,
        printer=printer,
        app_settings=app_settings,
        weight_grams=data.weight_grams,
        print_time_hours=data.print_time_hours,
        preparation_time_hours=data.preparation_time_hours,
        post_processing_time_hours=data.post_processing_time_hours,
        quantity=data.quantity,
        margin_percent=data.margin_percent,
        usd_to_cop_rate=cop_rate,
        supplies=supplies_data,
        additional_filaments=additional_filaments_data,
    )


@router.post("/calculate/manual", response_model=QuoteCostBreakdown)
@limiter.limit("60/minute")
async def calculate_quote_manual(
    request: Request,
    data: QuoteManualRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calcula el costo de una impresión 3D sin filamento/impresora registrados.

    Permite obtener un desglose completo de costos proporcionando todos los
    parámetros directamente (precio/kg, watts, vida útil, etc.), sin necesidad
    de tener filamentos o impresoras pre-registrados en el catálogo.

    Los campos electricity_rate, failure_rate_percent y labor_cost_per_hour son
    opcionales: si se omiten, se usan los valores guardados en la configuración
    de la empresa del usuario autenticado.

    Returns:
        QuoteCostBreakdown: Desglose completo de costos (no se guarda en BD).
    """
    # Cargar configuración de la empresa para obtener defaults
    settings_result = await db.execute(
        select(AppSettings).where(AppSettings.company_id == current_user.company_id)
    )
    app_settings = settings_result.scalar_one_or_none()
    if not app_settings:
        app_settings = AppSettings(
            user_id=current_user.id,
            company_id=current_user.company_id,
        )
        db.add(app_settings)
        await db.commit()
        await db.refresh(app_settings)

    # Construir objetos portadores con los datos proporcionados en la solicitud
    fake_filament = _FakeFilament(price_per_kg=data.price_per_kg)
    fake_printer = _FakePrinter(
        power_consumption_watts=data.power_consumption_watts,
        purchase_price=data.purchase_price,
        estimated_lifespan_hours=data.estimated_lifespan_hours,
        nozzle_price=data.nozzle_price,
        nozzle_lifespan_hours=data.nozzle_lifespan_hours,
        buildplate_price=data.buildplate_price,
        buildplate_lifespan_hours=data.buildplate_lifespan_hours,
        other_maintenance_per_hour=data.other_maintenance_per_hour,
    )
    fake_settings = _FakeSettings(
        base_settings=app_settings,
        overrides={
            "electricity_rate": data.electricity_rate,
            "failure_rate_percent": data.failure_rate_percent,
            "labor_cost_per_hour": data.labor_cost_per_hour,
        },
    )

    cop_rate = await get_usd_to_cop()

    return calculate_cost(
        filament=fake_filament,
        printer=fake_printer,
        app_settings=fake_settings,
        weight_grams=data.weight_grams,
        print_time_hours=data.print_time_hours,
        preparation_time_hours=data.preparation_time_hours,
        post_processing_time_hours=data.post_processing_time_hours,
        quantity=data.quantity,
        margin_percent=data.margin_percent,
        usd_to_cop_rate=cop_rate,
    )


@router.post("/", response_model=QuoteResponse)
@limiter.limit("60/minute")
async def create_quote(
    request: Request,
    data: QuoteCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calcula y guarda la cotización en el historial de la empresa.

    El company_id se asigna automáticamente desde el usuario autenticado.

    Raises:
        HTTPException 404: Si el filamento o la impresora no pertenecen a la empresa.
    """
    filament, printer, app_settings = await _get_dependencies(
        db, current_user, data.inventory_item_id, data.printer_id
    )

    # Reutilizar la tasa enviada por el frontend (la misma que vio el usuario)
    # para evitar discrepancias si la tasa cambia entre "Calcular" y "Guardar".
    cop_rate = data.usd_to_cop_rate if data.usd_to_cop_rate else await get_usd_to_cop()
    supplies_data = await _resolve_supplies(db, current_user, data.supplies)
    additional_filaments_data = await _resolve_additional_filaments(db, current_user, data.additional_filaments)

    breakdown = calculate_cost(
        filament=filament,
        printer=printer,
        app_settings=app_settings,
        weight_grams=data.weight_grams,
        print_time_hours=data.print_time_hours,
        preparation_time_hours=data.preparation_time_hours,
        post_processing_time_hours=data.post_processing_time_hours,
        quantity=data.quantity,
        margin_percent=data.margin_percent,
        usd_to_cop_rate=cop_rate,
        supplies=supplies_data,
        additional_filaments=additional_filaments_data,
    )

    quote = Quote(
        user_id=current_user.id,
        company_id=current_user.company_id,
        piece_name=data.piece_name,
        description=data.description,
        client_name=data.client_name,
        filament_id=None,
        inventory_item_id=data.inventory_item_id,
        printer_id=data.printer_id,
        weight_grams=data.weight_grams,
        print_time_hours=data.print_time_hours,
        preparation_time_hours=data.preparation_time_hours,
        post_processing_time_hours=data.post_processing_time_hours,
        quantity=data.quantity,
        material_cost=breakdown.material_cost,
        electricity_cost=breakdown.electricity_cost,
        depreciation_cost=breakdown.depreciation_cost,
        maintenance_cost=breakdown.maintenance_cost,
        labor_cost=breakdown.labor_cost,
        failure_cost=breakdown.failure_cost,
        subtotal=breakdown.subtotal,
        margin_percent=breakdown.margin_percent,
        margin_amount=breakdown.margin_amount,
        total_per_unit=breakdown.total_per_unit,
        total_price=breakdown.total_price,
        usd_to_cop_rate=breakdown.usd_to_cop_rate,
        total_per_unit_cop=breakdown.total_per_unit_cop,
        total_price_cop=breakdown.total_price_cop,
        supplies_cost=breakdown.supplies_cost,
        supplies_detail=[
            {k: float(v) if isinstance(v, Decimal) else v for k, v in item.items()}
            for item in breakdown.supplies_detail
        ],
        additional_filaments_detail=[
            {
                "filament_id": af["filament_id"],
                "name": af["name"],
                "weight_grams": float(af["weight_grams"]),
                "material_cost": round(float(af["weight_grams"]) * float(af["price_per_kg"]) / 1000, 4),
            }
            for af in (additional_filaments_data or [])
        ],
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.get("/", response_model=list[QuoteResponse])
async def list_quotes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista el historial de cotizaciones de la empresa del usuario autenticado.

    Filtra por company_id para garantizar el aislamiento multi-tenant.
    Los resultados se ordenan de más reciente a más antiguo.

    Args:
        skip:  Número de registros a omitir (paginación).
        limit: Máximo de registros a retornar (defecto 100).
    """
    result = await db.execute(
        select(Quote)
        .where(Quote.company_id == current_user.company_id)
        .order_by(Quote.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene una cotización específica de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    quote = await _get_company_quote(db, quote_id, current_user.company_id)
    return quote


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote_meta(
    quote_id: int,
    data: QuoteUpdateMeta,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza los metadatos descriptivos de una cotización guardada.

    Solo modifica piece_name, description, client_name y notes.
    Los valores de costo calculados permanecen sin cambios.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    quote = await _get_company_quote(db, quote_id, current_user.company_id)
    quote.piece_name = data.piece_name
    quote.description = data.description
    quote.client_name = data.client_name
    quote.notes = data.notes
    await db.commit()
    await db.refresh(quote)
    return quote


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una cotización de la empresa del usuario autenticado.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    quote = await _get_company_quote(db, quote_id, current_user.company_id)
    await db.delete(quote)
    await db.commit()


@router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera y descarga la cotización como PDF orientado al cliente.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece a la empresa.
    """
    quote = await _get_company_quote(db, quote_id, current_user.company_id)

    pdf_bytes = generate_quote_pdf(quote)
    safe_name = re.sub(r"[^\w\-]", "_", quote.piece_name)
    filename = f"cotizacion_{safe_name}_{quote.id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _get_dependencies(
    db: AsyncSession, current_user: User, inventory_item_id: int, printer_id: int
):
    """
    Recupera y valida las dependencias de una cotización filtrando por company_id.

    Carga el ítem de inventario (filamento), la impresora y la configuración de la
    empresa necesarios para ejecutar el motor de cálculo. Si la configuración de
    la empresa no existe, la crea con valores por defecto.

    Raises:
        HTTPException 404: Si el filamento no existe en el inventario de la empresa.
        HTTPException 404: Si la impresora no pertenece a la empresa del usuario.
    """
    inv_result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == inventory_item_id,
            InventoryItem.company_id == current_user.company_id,
            InventoryItem.category == "Filamento",
        )
    )
    filament = inv_result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado en inventario")

    printer_result = await db.execute(
        select(Printer).where(
            Printer.id == printer_id,
            Printer.company_id == current_user.company_id,
        )
    )
    printer = printer_result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")

    settings_result = await db.execute(
        select(AppSettings).where(AppSettings.company_id == current_user.company_id)
    )
    app_settings = settings_result.scalar_one_or_none()
    if not app_settings:
        app_settings = AppSettings(
            user_id=current_user.id,
            company_id=current_user.company_id,
        )
        db.add(app_settings)
        await db.commit()
        await db.refresh(app_settings)

    return filament, printer, app_settings


async def _get_company_quote(db: AsyncSession, quote_id: int, company_id) -> Quote:
    """
    Recupera una cotización por ID filtrando por company_id.

    Raises:
        HTTPException 404: Si no existe una cotización con ese ID en la empresa.
    """
    result = await db.execute(
        select(Quote).where(
            Quote.id == quote_id,
            Quote.company_id == company_id,
        )
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote


async def _resolve_supplies(db: AsyncSession, current_user: User, supply_items) -> list:
    """
    Carga insumos desde el inventario filtrando por company_id del usuario.

    Usa una sola query con WHERE id IN (...) en lugar de N queries individuales.
    Lanza HTTPException 400 si algún ID no existe o no pertenece a la empresa.
    El precio se toma de price_per_unit si está definido; si no, de unit_cost.
    """
    if not supply_items:
        return []

    ids = [item.inventory_item_id for item in supply_items]
    r = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id.in_(ids),
            InventoryItem.company_id == current_user.company_id,
        )
    )
    inv_map = {inv.id: inv for inv in r.scalars().all()}

    # Verificar que todos los IDs solicitados existen en la empresa
    faltantes = [i for i in ids if i not in inv_map]
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Insumos no encontrados en el inventario: {faltantes}",
        )

    result = []
    for item in supply_items:
        inv = inv_map[item.inventory_item_id]
        price = inv.price_per_unit if inv.price_per_unit is not None else inv.unit_cost
        result.append({
            "supply_id": inv.id,
            "name": inv.name,
            "unit": inv.unit,
            "price_per_unit": price,
            "quantity": item.quantity,
        })
    return result


async def _resolve_additional_filaments(db: AsyncSession, current_user: User, filament_items) -> list:
    """
    Carga filamentos adicionales desde el inventario filtrando por company_id.

    Usa una sola query con WHERE id IN (...) en lugar de N queries individuales.
    Lanza HTTPException 400 si algún ID no existe o no pertenece a la empresa.
    El nombre se construye a partir de filament_brand, filament_type y filament_color;
    si no hay datos específicos, se usa el nombre genérico del ítem.
    """
    if not filament_items:
        return []

    ids = [item.inventory_item_id for item in filament_items]
    r = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id.in_(ids),
            InventoryItem.company_id == current_user.company_id,
        )
    )
    inv_map = {inv.id: inv for inv in r.scalars().all()}

    faltantes = [i for i in ids if i not in inv_map]
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Filamentos adicionales no encontrados en el inventario: {faltantes}",
        )

    result = []
    for item in filament_items:
        inv = inv_map[item.inventory_item_id]
        if not inv.price_per_kg:
            raise HTTPException(
                status_code=400,
                detail=f"El ítem '{inv.name}' no tiene precio por kg definido.",
            )
        name = " ".join(filter(None, [inv.filament_brand, inv.filament_type, inv.filament_color])) or inv.name
        result.append({
            "filament_id": inv.id,
            "name": name,
            "price_per_kg": inv.price_per_kg,
            "weight_grams": item.weight_grams,
        })
    return result
