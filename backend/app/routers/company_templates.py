"""
Router de templates de cotización Liquid para TurtleForge Cost.

Permite a cada empresa gestionar sus plantillas personalizadas de PDF de
cotización escritas en sintaxis Liquid. Incluye validación de sintaxis y
renderizado de preview antes de guardar.

Endpoints:
    GET    /api/company/templates/           — Listar templates de la empresa.
    POST   /api/company/templates/           — Crear nuevo template.
    GET    /api/company/templates/{id}       — Obtener template por ID.
    PUT    /api/company/templates/{id}       — Actualizar template.
    DELETE /api/company/templates/{id}       — Eliminar template.
    POST   /api/company/templates/{id}/set-default — Marcar como default.
    POST   /api/company/templates/validate   — Validar template Liquid.
    GET    /api/company/templates/{id}/preview — PDF de muestra (bytes).
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.company_template import CompanyTemplate
from app.models.user import User
from app.schemas.company_template import (
    CompanyTemplateCreate,
    CompanyTemplateResponse,
    CompanyTemplateUpdate,
    TemplateValidateRequest,
    TemplateValidateResponse,
)
from app.services.auth import get_admin_user, get_current_user
from app.services.liquid_pdf import DEFAULT_COT_TEMPLATE, validate_template

router = APIRouter(prefix="/api/company/templates", tags=["company-templates"])


async def _get_template(db: AsyncSession, template_id: int) -> CompanyTemplate:
    """
    Obtiene un template por ID.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(
        select(CompanyTemplate).where(
            CompanyTemplate.id == template_id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template no encontrado")
    return tpl


@router.get("/", response_model=List[CompanyTemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todos los templates de cotización de la empresa, ordenados por fecha desc.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Lista de CompanyTemplateResponse.
    """
    result = await db.execute(
        select(CompanyTemplate)
        .order_by(CompanyTemplate.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=CompanyTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: CompanyTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Crea un nuevo template de cotización (solo administradores).

    Si is_default=True, desactiva el default previo del mismo tipo.

    Args:
        data:         Datos del template incluyendo nombre, tipo y contenido Liquid.
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        CompanyTemplateResponse con el template creado.
    """
    if data.is_default:
        await _clear_default(db, data.template_type)

    tpl = CompanyTemplate(
        name=data.name,
        description=data.description,
        template_type=data.template_type,
        content=data.content,
        is_default=data.is_default,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.get("/default-template", response_model=None)
async def get_default_template_content(
    current_user: User = Depends(get_current_user),
):
    """
    Retorna el contenido del template Liquid por defecto del sistema.

    Útil para pre-cargar el editor al crear un nuevo template.

    Args:
        current_user: Usuario autenticado.

    Returns:
        JSON con la clave 'content' conteniendo el template Liquid por defecto.
    """
    return {"content": DEFAULT_COT_TEMPLATE}


@router.get("/{template_id}", response_model=CompanyTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene un template de cotización por ID.

    Args:
        template_id:  ID del template.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        CompanyTemplateResponse si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_template(db, template_id)


@router.put("/{template_id}", response_model=CompanyTemplateResponse)
async def update_template(
    template_id: int,
    data: CompanyTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Actualiza un template de cotización (solo administradores).

    Si se cambia is_default a True, desactiva el default previo del mismo tipo.

    Args:
        template_id:  ID del template.
        data:         Campos a actualizar (todos opcionales).
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        CompanyTemplateResponse actualizado.

    Raises:
        HTTPException 404: Si no existe.
    """
    tpl = await _get_template(db, template_id)

    update_data = data.model_dump(exclude_unset=True)

    # Si se activa is_default, limpiar el default previo del mismo tipo
    if update_data.get("is_default"):
        tipo = update_data.get("template_type", tpl.template_type)
        await _clear_default(db, tipo, exclude_id=template_id)

    for field, value in update_data.items():
        setattr(tpl, field, value)

    tpl.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Elimina un template de cotización (solo administradores).

    Args:
        template_id:  ID del template a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    tpl = await _get_template(db, template_id)
    await db.delete(tpl)
    await db.commit()


@router.post("/{template_id}/set-default", response_model=CompanyTemplateResponse)
async def set_default_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Marca un template como default para su tipo (desactiva el anterior).

    Solo puede haber un template default por tipo por empresa.

    Args:
        template_id:  ID del template a marcar como default.
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        CompanyTemplateResponse con is_default=True.

    Raises:
        HTTPException 404: Si no existe.
    """
    tpl = await _get_template(db, template_id)
    await _clear_default(db, tpl.template_type, exclude_id=template_id)
    tpl.is_default = True
    tpl.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.post("/validate", response_model=TemplateValidateResponse)
async def validate_liquid_template(
    data: TemplateValidateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Valida un template Liquid: comprueba sintaxis y capacidad de renderizar a PDF.

    Args:
        data:         Contenido del template y tipo.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        TemplateValidateResponse con ok, errors, warnings y preview_pdf_b64.
    """
    company_result = await db.execute(
        select(Company).where(Company.id == current_user.company_id)
    )
    company = company_result.scalar_one_or_none()

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(validate_template, data.content, company),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        return TemplateValidateResponse(
            ok=False,
            errors=["Tiempo de validación agotado (máx. 30 s). Simplifica el template."],
            warnings=[],
        )
    return TemplateValidateResponse(**result)


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera y descarga un PDF de muestra usando el template indicado.

    Args:
        template_id:  ID del template a previsualizar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        Respuesta HTTP con el PDF en bytes y Content-Type application/pdf.

    Raises:
        HTTPException 404: Si el template no existe.
        HTTPException 500: Si la generación del PDF falla.
    """
    tpl = await _get_template(db, template_id)

    DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
    company_result = await db.execute(
        select(Company).where(Company.id == DEFAULT_COMPANY_ID)
    )
    company = company_result.scalar_one_or_none()

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(validate_template, tpl.content, company),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Tiempo de renderizado agotado (máx. 30 s). Simplifica el template.",
        )
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar template: {'; '.join(result['errors'])}",
        )

    import base64
    pdf_bytes = base64.b64decode(result["preview_pdf_b64"])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview_{template_id}.pdf"'},
    )


# ── Helpers internos ───────────────────────────────────────────────────────────

async def _clear_default(
    db: AsyncSession, template_type: str, exclude_id: int = None
) -> None:
    """
    Desactiva el flag is_default de todos los templates del tipo indicado.

    Args:
        db:            Sesión de base de datos.
        template_type: Tipo de template ('cot' | 'all').
        exclude_id:    ID a excluir (el que se está marcando como default).
    """
    q = select(CompanyTemplate).where(
        CompanyTemplate.template_type == template_type,
        CompanyTemplate.is_default == True,
    )
    if exclude_id is not None:
        q = q.where(CompanyTemplate.id != exclude_id)
    result = await db.execute(q)
    for t in result.scalars().all():
        t.is_default = False
    await db.flush()
