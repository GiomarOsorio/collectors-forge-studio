"""
Router de cotizaciones de cliente para TurtleForge Cost.

Gestiona las cotizaciones manuales multi-producto orientadas al cliente.
A diferencia del historial de costos de impresión (quotes), estas cotizaciones
no almacenan el desglose técnico sino una lista de ítems con precio definido
por el usuario, nombre del cliente y fechas de vigencia.

Endpoints:
    POST   /api/client-quotes/          — Crear cotización.
    GET    /api/client-quotes/          — Listar cotizaciones de la empresa.
    GET    /api/client-quotes/{id}      — Obtener cotización por ID.
    DELETE /api/client-quotes/{id}      — Eliminar cotización.
    GET    /api/client-quotes/{id}/pdf  — Descargar PDF de la cotización.
"""

import json
import re
from datetime import timedelta
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_quote import ClientQuote
from app.models.user import User
from app.schemas.client_quote import ClientQuoteCreate, ClientQuoteResponse
from app.services.auth import get_current_user
from app.services.pdf_generator import generate_client_quote_pdf

router = APIRouter(prefix="/api/client-quotes", tags=["client-quotes"])


async def _get_company_client_quote(
    db: AsyncSession, quote_id: int, company_id
) -> ClientQuote:
    """
    Obtiene una cotización de cliente verificando que pertenezca a la empresa.

    Args:
        db:         Sesión de base de datos.
        quote_id:   ID de la cotización.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de ClientQuote si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(ClientQuote).where(
            ClientQuote.id == quote_id,
            ClientQuote.company_id == company_id,
        )
    )
    cq = result.scalar_one_or_none()
    if not cq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    return cq


@router.post("/", response_model=ClientQuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_client_quote(
    data: ClientQuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea y guarda una cotización de cliente con múltiples líneas de producto.

    Calcula el subtotal sumando (quantity × unit_price) de cada ítem.
    La fecha de vencimiento se calcula automáticamente: quote_date + expiry_days.

    Args:
        data:         Datos de la cotización incluyendo ítems y fechas.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        ClientQuoteResponse con todos los datos de la cotización creada.
    """
    expiry_date = data.quote_date + timedelta(days=data.expiry_days)

    subtotal = sum(
        Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        for item in data.items
    )

    items_json = json.dumps([
        {
            "name": item.name,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
        }
        for item in data.items
    ], ensure_ascii=False)

    cq = ClientQuote(
        company_id=current_user.company_id,
        user_id=current_user.id,
        client_name=data.client_name,
        description=data.description,
        quote_date=data.quote_date,
        expiry_days=data.expiry_days,
        expiry_date=expiry_date,
        items=items_json,
        subtotal=subtotal,
        notes=data.notes,
    )
    db.add(cq)
    await db.commit()
    await db.refresh(cq)
    return cq


@router.get("/", response_model=List[ClientQuoteResponse])
async def list_client_quotes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todas las cotizaciones de cliente de la empresa, ordenadas por fecha desc.

    Args:
        skip:         Número de registros a omitir (paginación).
        limit:        Máximo de registros a retornar (defecto 100).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de ClientQuoteResponse ordenada por created_at descendente.
    """
    result = await db.execute(
        select(ClientQuote)
        .where(ClientQuote.company_id == current_user.company_id)
        .order_by(ClientQuote.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{quote_id}", response_model=ClientQuoteResponse)
async def get_client_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene una cotización de cliente por ID.

    Args:
        quote_id:     ID de la cotización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        ClientQuoteResponse si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_company_client_quote(db, quote_id, current_user.company_id)


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una cotización de cliente por ID.

    Args:
        quote_id:     ID de la cotización a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    cq = await _get_company_client_quote(db, quote_id, current_user.company_id)
    await db.delete(cq)
    await db.commit()


@router.get("/{quote_id}/pdf")
async def download_client_quote_pdf(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera y descarga el PDF de una cotización de cliente.

    Args:
        quote_id:     ID de la cotización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Respuesta HTTP con el PDF en bytes y Content-Type application/pdf.

    Raises:
        HTTPException 404: Si no existe.
    """
    cq = await _get_company_client_quote(db, quote_id, current_user.company_id)
    pdf_bytes = generate_client_quote_pdf(cq)
    safe_client = re.sub(r"[^\w\-]", "_", cq.client_name)
    filename = f"cotizacion_COT-{cq.id:04d}_{safe_client}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
