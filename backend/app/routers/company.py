"""
Router de perfil de empresa para TurtleForge Cost.

Permite consultar y actualizar los datos de la empresa del usuario
autenticado. La actualización de datos y la subida del logo están
restringidas a administradores.

Endpoints:
    GET  /api/company/       — Obtener perfil de la empresa.
    PUT  /api/company/       — Actualizar perfil (admin).
    POST /api/company/logo   — Subir logo de la empresa (admin).
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.services.auth import get_admin_user, get_current_user
from app.services.formatters import IMAGE_MAGIC_CHECKS, IMAGE_EXT_MAP

router = APIRouter(prefix="/api/company", tags=["company"])

# UUID fijo de la empresa singleton
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# Directorio donde se guardan los logos de empresa
COMPANY_LOGO_DIR = Path("/app/static/companies")
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


async def _get_company(db: AsyncSession, company_id) -> Company:
    """
    Obtiene la empresa por ID.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )
    return company


@router.get("/", response_model=CompanyResponse)
async def get_company(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna el perfil de la empresa singleton.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        CompanyResponse con los datos actuales de la empresa.
    """
    return await _get_company(db, DEFAULT_COMPANY_ID)


@router.put("/", response_model=CompanyResponse)
async def update_company(
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Actualiza el perfil de la empresa (solo administradores).

    Solo actualiza los campos enviados (exclude_unset=True).

    Args:
        data:         Campos a actualizar.
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        CompanyResponse con los datos actualizados.
    """
    company = await _get_company(db, DEFAULT_COMPANY_ID)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return company


@router.post("/logo", response_model=CompanyResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube el logo de la empresa (solo administradores).

    Guarda el archivo en /app/static/companies/ con un UUID como nombre.
    Actualiza el campo logo_url de la empresa.

    Args:
        file:         Imagen enviada como multipart/form-data.
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        CompanyResponse con el logo_url actualizado.

    Raises:
        HTTPException 400: Si el tipo de archivo no es una imagen permitida.
        HTTPException 413: Si la imagen supera 10 MB.
    """
    allowed_content_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido: {file.content_type}. Use JPEG, PNG, WebP o GIF.",
        )

    company = await _get_company(db, DEFAULT_COMPANY_ID)

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagen demasiado grande (máx. 10 MB)",
        )

    check = IMAGE_MAGIC_CHECKS.get(file.content_type)
    if not content or (check and not check(content)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del archivo no corresponde a una imagen válida.",
        )

    COMPANY_LOGO_DIR.mkdir(parents=True, exist_ok=True)

    # Usar extensión basada en content-type (no en file.filename) para evitar
    # path traversal o extensiones arbitrarias enviadas por el cliente
    extension = IMAGE_EXT_MAP.get(file.content_type, ".png")
    filename = f"{uuid.uuid4()}{extension}"
    file_path = COMPANY_LOGO_DIR / filename
    file_path.write_bytes(content)

    logo_url = f"/static/companies/{filename}"
    company.logo_url = logo_url
    await db.commit()
    await db.refresh(company)

    return company
