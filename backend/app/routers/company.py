"""
Router de perfil de empresa para Collector's Forge Studio.

Permite consultar y actualizar los datos de la empresa del usuario
autenticado. La actualización de datos y la subida del logo están
restringidas a administradores.

El logo se almacena en MinIO bajo la key `companies/{uuid}.png` (no en
disk local). El frontend lo consume vía el endpoint proxy
`GET /api/company/logo`, que streamea el binario desde MinIO con
caché HTTP de 24h.

Endpoints:
    GET  /api/company/       — Obtener perfil de la empresa.
    PUT  /api/company/       — Actualizar perfil (admin).
    POST /api/company/logo   — Subir logo de la empresa (admin).
    GET  /api/company/logo   — Servir el logo (binario PNG/JPEG).
"""

import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.services.auth import get_admin_user, get_current_user
from app.services.formatters import IMAGE_MAGIC_CHECKS, IMAGE_EXT_MAP
from app.services.vault_storage import delete_file, download_file, upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/company", tags=["company"])

# UUID fijo de la empresa singleton
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

#: Prefix bajo el cual se guardan los logos dentro del bucket MinIO.
_LOGO_PREFIX = "companies"

#: Map de content-type a media_type devuelto en el response del proxy.
_LOGO_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


async def _get_company(db: AsyncSession, company_id) -> Company:
    """Obtiene la empresa por ID. Lanza 404 si no existe."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )
    return company


def _company_to_response(company: Company) -> CompanyResponse:
    """
    Construye `CompanyResponse` mapeando `logo_key` (interno MinIO) al
    `logo_url` (URL proxy con cache-buster).
    """
    logo_url = None
    if company.logo_key:
        ts = int(company.updated_at.timestamp()) if company.updated_at else 0
        logo_url = f"/api/company/logo?v={ts}"
    return CompanyResponse(
        id=company.id,
        name=company.name,
        slogan=company.slogan,
        address=company.address,
        phone=company.phone,
        contact_email=company.contact_email,
        nit=company.nit,
        logo_url=logo_url,
        pdf_palette=company.pdf_palette,
        pdf_terms=company.pdf_terms,
    )


@router.get("/", response_model=CompanyResponse)
async def get_company(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna el perfil de la empresa singleton."""
    company = await _get_company(db, DEFAULT_COMPANY_ID)
    return _company_to_response(company)


@router.put("/", response_model=CompanyResponse)
async def update_company(
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Actualiza el perfil de la empresa (solo administradores)."""
    company = await _get_company(db, DEFAULT_COMPANY_ID)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return _company_to_response(company)


@router.post("/logo", response_model=CompanyResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube el logo de la empresa a MinIO (solo administradores).

    El binario se persiste como `companies/{uuid}.png` (o `.jpg`/`.webp`/
    `.gif` según el content-type). El `logo_key` queda en la BD; la URL
    pública (`/api/company/logo`) la arma el response builder.

    El logo previo se borra de MinIO (best-effort).
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

    # Extensión basada en content-type (no en file.filename) para evitar
    # path traversal o extensiones arbitrarias enviadas por el cliente.
    extension = IMAGE_EXT_MAP.get(file.content_type, ".png")
    new_key = f"{_LOGO_PREFIX}/{uuid.uuid4()}{extension}"

    # Borrar el logo anterior (best-effort) y subir el nuevo.
    old_key = company.logo_key
    await upload_file(new_key, content, content_type=file.content_type)
    company.logo_key = new_key
    await db.commit()
    await db.refresh(company)

    if old_key:
        try:
            await delete_file(old_key)
        except Exception as exc:
            logger.debug("No se pudo borrar logo viejo %s: %s", old_key, exc)

    return _company_to_response(company)


@router.get("/logo")
async def get_company_logo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streamea el binario del logo desde MinIO con caché HTTP de 24h.

    El frontend cachea el response y usa el `?v=<updated_at>` del
    `logo_url` para invalidar la caché cuando se sube un logo nuevo.
    Si la empresa no tiene logo, retorna 404.
    """
    company = await _get_company(db, DEFAULT_COMPANY_ID)
    if not company.logo_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La empresa no tiene logo cargado",
        )

    try:
        data = await download_file(company.logo_key)
    except Exception as exc:
        logger.warning("No se pudo descargar logo %s: %s", company.logo_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Logo no disponible en almacenamiento",
        ) from exc

    # Inferir media_type por la extensión de la key (es lo que usamos al subir).
    ext = "." + company.logo_key.rsplit(".", 1)[-1].lower() if "." in company.logo_key else ".png"
    media_type = _LOGO_MEDIA_TYPES.get(ext, "image/png")
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
