from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.models.quote import Quote
from app.schemas.quote import QuoteCalculateRequest, QuoteResponse, QuoteCostBreakdown
from app.services.auth import get_current_user
from app.services.calculator import calculate_cost
from app.services.pdf_generator import generate_quote_pdf

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


@router.post("/calculate", response_model=QuoteCostBreakdown)
async def calculate_quote(
    data: QuoteCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calcula el costo sin guardar (preview)."""
    filament, printer, app_settings = await _get_dependencies(
        db, current_user.id, data.filament_id, data.printer_id
    )

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
    )


@router.post("/", response_model=QuoteResponse)
async def create_quote(
    data: QuoteCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calcula y guarda la cotización."""
    filament, printer, app_settings = await _get_dependencies(
        db, current_user.id, data.filament_id, data.printer_id
    )

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
    )

    quote = Quote(
        user_id=current_user.id,
        piece_name=data.piece_name,
        description=data.description,
        client_name=data.client_name,
        filament_id=data.filament_id,
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
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.get("/", response_model=list[QuoteResponse])
async def list_quotes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Quote)
        .where(Quote.user_id == current_user.id)
        .order_by(Quote.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = await _get_user_quote(db, quote_id, current_user.id)
    return quote


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = await _get_user_quote(db, quote_id, current_user.id)
    await db.delete(quote)
    await db.commit()


@router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = await _get_user_quote(db, quote_id, current_user.id)

    # Obtener filamento e impresora
    filament_result = await db.execute(
        select(Filament).where(Filament.id == quote.filament_id)
    )
    filament = filament_result.scalar_one()
    printer_result = await db.execute(
        select(Printer).where(Printer.id == quote.printer_id)
    )
    printer = printer_result.scalar_one()

    pdf_bytes = generate_quote_pdf(quote, filament, printer)
    filename = f"cotizacion_{quote.piece_name.replace(' ', '_')}_{quote.id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _get_dependencies(
    db: AsyncSession, user_id: int, filament_id: int, printer_id: int
):
    filament_result = await db.execute(
        select(Filament).where(Filament.id == filament_id)
    )
    filament = filament_result.scalar_one_or_none()
    if not filament:
        raise HTTPException(status_code=404, detail="Filamento no encontrado")

    printer_result = await db.execute(
        select(Printer).where(Printer.id == printer_id)
    )
    printer = printer_result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")

    settings_result = await db.execute(
        select(AppSettings).where(AppSettings.user_id == user_id)
    )
    app_settings = settings_result.scalar_one_or_none()
    if not app_settings:
        app_settings = AppSettings(user_id=user_id)
        db.add(app_settings)
        await db.commit()
        await db.refresh(app_settings)

    return filament, printer, app_settings


async def _get_user_quote(db: AsyncSession, quote_id: int, user_id: int) -> Quote:
    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.user_id == user_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote
