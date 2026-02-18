"""
Router para el cálculo, gestión y descarga de cotizaciones de impresión 3D.

Este módulo expone los endpoints HTTP para todo el flujo de cotización:
desde el cálculo previo sin guardar (preview), pasando por la creación y
almacenamiento en el historial, hasta la consulta, eliminación y descarga
del PDF de una cotización guardada.

Todos los endpoints filtran por el usuario autenticado, por lo que cada
usuario solo puede ver y gestionar sus propias cotizaciones.

Endpoints disponibles bajo el prefijo /api/quotes:
- POST /calculate     - Calcula el costo sin guardar (previsualización).
- POST /              - Calcula y guarda la cotización en el historial.
- GET  /              - Lista el historial de cotizaciones del usuario.
- GET  /{id}          - Obtiene una cotización específica por su ID.
- DELETE /{id}        - Elimina una cotización del historial.
- GET  /{id}/pdf      - Descarga la cotización como archivo PDF.
"""

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
    """
    Calcula el costo de una impresión 3D sin guardar la cotización.

    Endpoint de previsualización que permite al usuario ver el desglose de
    costos antes de decidir si desea guardar la cotización en el historial.
    No persiste ningún dato en la base de datos.

    Args:
        data: Parámetros de la cotización (filamento, impresora, peso, tiempo, etc.).
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado que realiza la solicitud.

    Returns:
        QuoteCostBreakdown: Desglose completo de costos por componente sin ID
            ni marca de tiempo (no está guardado en base de datos).

    Raises:
        HTTPException 404: Si el filamento o la impresora indicados no existen.
    """
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
    """
    Calcula el costo de una impresión 3D y guarda la cotización en el historial.

    Ejecuta el mismo motor de cálculo que /calculate pero además persiste el
    resultado en la base de datos, asociándolo al usuario autenticado.

    Args:
        data: Parámetros de la cotización (filamento, impresora, peso, tiempo, etc.).
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado propietario de la cotización.

    Returns:
        QuoteResponse: Datos completos de la cotización guardada, incluyendo ID
            y marca de tiempo de creación.

    Raises:
        HTTPException 404: Si el filamento o la impresora indicados no existen.
    """
    filament, printer, app_settings = await _get_dependencies(
        db, current_user.id, data.filament_id, data.printer_id
    )

    # Ejecuta el motor de cálculo para obtener el desglose de costos
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

    # Construye el objeto Quote con los parámetros de entrada y los costos calculados
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
    """
    Lista el historial de cotizaciones del usuario autenticado.

    Los resultados se ordenan de más reciente a más antiguo para mostrar
    primero las cotizaciones más recientes en la interfaz.

    Args:
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado cuyas cotizaciones se listan.

    Returns:
        list[QuoteResponse]: Lista de cotizaciones del usuario ordenadas
            por fecha de creación descendente.
    """
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
    """
    Obtiene una cotización específica del historial del usuario autenticado.

    Solo devuelve la cotización si pertenece al usuario autenticado,
    evitando que un usuario acceda a cotizaciones de otro.

    Args:
        quote_id: Identificador numérico de la cotización a consultar.
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado propietario de la cotización.

    Returns:
        QuoteResponse: Datos completos de la cotización encontrada.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece al usuario.
    """
    quote = await _get_user_quote(db, quote_id, current_user.id)
    return quote


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una cotización del historial del usuario autenticado.

    Solo elimina la cotización si pertenece al usuario autenticado.

    Args:
        quote_id: Identificador de la cotización a eliminar.
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado propietario de la cotización.

    Returns:
        None: Respuesta vacía con código HTTP 204 No Content.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece al usuario.
    """
    quote = await _get_user_quote(db, quote_id, current_user.id)
    await db.delete(quote)
    await db.commit()


@router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera y descarga la cotización como un archivo PDF.

    Recupera la cotización junto con los datos del filamento e impresora
    asociados, genera el documento PDF y lo devuelve como archivo adjunto
    para descarga directa desde el navegador.

    Args:
        quote_id: Identificador de la cotización a exportar como PDF.
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario autenticado propietario de la cotización.

    Returns:
        Response: Archivo PDF como respuesta HTTP con Content-Type
            'application/pdf' y header Content-Disposition para descarga.

    Raises:
        HTTPException 404: Si la cotización no existe o no pertenece al usuario.
    """
    quote = await _get_user_quote(db, quote_id, current_user.id)

    # Obtener filamento e impresora asociados a la cotización para el PDF
    filament_result = await db.execute(
        select(Filament).where(Filament.id == quote.filament_id)
    )
    filament = filament_result.scalar_one()
    printer_result = await db.execute(
        select(Printer).where(Printer.id == quote.printer_id)
    )
    printer = printer_result.scalar_one()

    pdf_bytes = generate_quote_pdf(quote, filament, printer)
    # Nombre de archivo con espacios reemplazados por guiones bajos y el ID al final
    filename = f"cotizacion_{quote.piece_name.replace(' ', '_')}_{quote.id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _get_dependencies(
    db: AsyncSession, user_id: int, filament_id: int, printer_id: int
):
    """
    Función auxiliar que recupera y valida las dependencias de una cotización.

    Carga el filamento, la impresora y la configuración del usuario necesarios
    para ejecutar el motor de cálculo. Si la configuración del usuario no existe,
    la crea con valores por defecto.

    Args:
        db: Sesión de base de datos activa.
        user_id: Identificador del usuario que realiza la cotización.
        filament_id: Identificador del filamento a utilizar.
        printer_id: Identificador de la impresora a utilizar.

    Returns:
        tuple[Filament, Printer, AppSettings]: Tupla con las tres dependencias
            listas para pasar al motor de cálculo.

    Raises:
        HTTPException 404: Si el filamento indicado no existe en la base de datos.
        HTTPException 404: Si la impresora indicada no existe en la base de datos.
    """
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

    # Cargar configuración del usuario; crearla con defaults si aún no existe
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
    """
    Función auxiliar que recupera una cotización validando la propiedad del usuario.

    Garantiza que el usuario solo pueda acceder a sus propias cotizaciones
    filtrando simultáneamente por ID de cotización y por ID de usuario.

    Args:
        db: Sesión de base de datos activa.
        quote_id: Identificador de la cotización a recuperar.
        user_id: Identificador del usuario propietario esperado.

    Returns:
        Quote: Instancia ORM de la cotización encontrada.

    Raises:
        HTTPException 404: Si no existe una cotización con ese ID que pertenezca
            al usuario indicado (incluye el caso en que la cotización existe pero
            pertenece a otro usuario).
    """
    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.user_id == user_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote
