"""
Router del Vault de modelos .3mf para Collector's Forge Studio.

Gestiona la subida, descarga y administración de archivos .3mf almacenados
en MinIO. Todos los endpoints requieren autenticación JWT y filtran por
company_id (multi-tenant). Las operaciones de escritura (upload, edit,
delete) requieren is_admin=True.

Endpoints:
    GET    /api/vault/               — Listar archivos (paginado, búsqueda)
    GET    /api/vault/stats          — Estadísticas de uso del almacenamiento
    POST   /api/vault/fetch-metadata — Pre-leer metadata desde URL externa
    POST   /api/vault/upload         — Subir archivo .3mf con metadata (admin)
    GET    /api/vault/{id}/download  — URL pre-firmada de descarga
    PUT    /api/vault/{id}           — Editar metadata (admin)
    DELETE /api/vault/{id}           — Eliminar archivo y objeto MinIO (admin)
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.model_file import ModelFile
from app.models.user import User
from app.schemas.vault import (
    ModelFileListResponse,
    ModelFileResponse,
    ModelFileUpdate,
    VaultDownloadResponse,
    VaultMetadataRequest,
    VaultMetadataResponse,
    VaultStatsResponse,
)
from app.services.auth import get_admin_user, get_current_user
from app.services.vault_metadata import fetch_metadata
from app.services.vault_storage import delete_file, download_file, upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vault", tags=["vault"])

# Límite de upload: 1 GB (protección DoS a nivel de aplicación)
MAX_VAULT_UPLOAD_BYTES = 1024 * 1024 * 1024


async def _get_model_file(db: AsyncSession, file_id: int) -> ModelFile:
    """
    Obtiene un ModelFile por ID.

    Raises:
        HTTPException 404: Si no existe.
    """
    result = await db.execute(
        select(ModelFile).where(
            ModelFile.id == file_id,
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado",
        )
    return model


async def _get_used_bytes(db: AsyncSession) -> int:
    """Calcula el espacio usado (bytes) sumando file_size de todos los archivos."""
    result = await db.execute(
        select(func.coalesce(func.sum(ModelFile.file_size), 0))
    )
    return result.scalar() or 0


def _to_response(model: ModelFile, username: Optional[str]) -> ModelFileResponse:
    return ModelFileResponse(
        id=model.id,
        company_id=str(model.company_id),
        uploaded_by=model.uploaded_by,
        uploaded_by_username=username,
        file_name=model.file_name,
        file_size=model.file_size,
        name=model.name,
        description=model.description,
        thumbnail_url=model.thumbnail_url,
        tags=model.tags or [],
        source_url=model.source_url,
        source_platform=model.source_platform,
        creator_name=model.creator_name,
        creator_url=model.creator_url,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


@router.get("/", response_model=ModelFileListResponse)
async def list_vault_files(
    q: Optional[str] = Query(default=None, description="Buscar por nombre"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los archivos del Vault de la empresa, con paginación y búsqueda opcional.
    """
    base_q = select(ModelFile)

    if q:
        base_q = base_q.where(ModelFile.name.ilike(f"%{q}%"))

    count_result = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    items_result = await db.execute(
        base_q.order_by(ModelFile.created_at.desc()).offset(offset).limit(page_size)
    )
    models = items_result.scalars().all()

    # Obtener usernames de los uploaders
    uploader_ids = {m.uploaded_by for m in models if m.uploaded_by is not None}
    usernames: dict = {}
    if uploader_ids:
        users_result = await db.execute(
            select(User.id, User.username).where(User.id.in_(uploader_ids))
        )
        usernames = {row.id: row.username for row in users_result}

    return ModelFileListResponse(
        items=[_to_response(m, usernames.get(m.uploaded_by)) for m in models],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=VaultStatsResponse)
async def get_vault_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna el uso y cuota de almacenamiento para la empresa del usuario."""
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    percent = round(used / quota * 100, 2) if quota > 0 else 0.0
    return VaultStatsResponse(used_bytes=used, quota_bytes=quota, percent=percent)


@router.post("/fetch-metadata", response_model=VaultMetadataResponse)
async def fetch_vault_metadata(
    body: VaultMetadataRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Extrae metadata de un modelo desde su URL pública (MakerWorld, Printables, OG).
    Requiere autenticación pero no requiere ser admin.
    """
    data = await fetch_metadata(body.url)
    return VaultMetadataResponse(**{k: v for k, v in data.items() if k != "source_url"})


@router.post("/upload", response_model=ModelFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_vault_file(
    file: UploadFile = File(...),
    metadata: str = Form(..., description="JSON con ModelFileCreate"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube un archivo .3mf al Vault con sus metadatos.

    El campo 'metadata' debe ser un JSON string con los campos de ModelFileCreate.
    Solo admins pueden subir archivos.

    Verifica la cuota antes de subir.
    """
    # Validar extensión
    if not file.filename or not file.filename.lower().endswith(".3mf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos .3mf",
        )

    # Parsear metadata
    try:
        meta_dict = json.loads(metadata)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El campo 'metadata' no es JSON válido: {exc}",
        )

    name = meta_dict.get("name", "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El campo 'name' es requerido",
        )

    # Leer archivo completo en memoria y validar tamaño
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_VAULT_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 1 GB",
        )

    # Verificar cuota
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    if used + file_size > quota:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Sin espacio disponible. Cuota: {settings.VAULT_QUOTA_GB} GB",
        )

    # Generar clave única en MinIO
    file_uuid = str(uuid.uuid4())
    safe_name = file.filename.replace(" ", "_")
    file_key = f"{file_uuid}-{safe_name}"

    # Subir a MinIO
    await upload_file(file_key, content, content_type="model/3mf")

    # Guardar en base de datos
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    model = ModelFile(
        uploaded_by=current_user.id,
        file_key=file_key,
        file_name=file.filename,
        file_size=file_size,
        name=name,
        description=meta_dict.get("description"),
        thumbnail_url=meta_dict.get("thumbnail_url"),
        tags=meta_dict.get("tags") or [],
        source_url=meta_dict.get("source_url"),
        source_platform=meta_dict.get("source_platform"),
        creator_name=meta_dict.get("creator_name"),
        creator_url=meta_dict.get("creator_url"),
        created_at=now,
        updated_at=now,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)

    return _to_response(model, current_user.username)


@router.get("/{file_id}/download")
async def download_vault_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Descarga el archivo desde MinIO a través del backend (proxy).

    MinIO permanece en la red interna; el cliente solo interactúa con el backend autenticado.
    """
    model = await _get_model_file(db, file_id)
    data = await download_file(model.file_key)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{model.file_name}"'},
    )


@router.put("/{file_id}", response_model=ModelFileResponse)
async def update_vault_file(
    file_id: int,
    body: ModelFileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Actualiza los metadatos de un archivo del Vault. Solo admins."""
    model = await _get_model_file(db, file_id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)

    model.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(model)

    # Obtener username del uploader
    username = None
    if model.uploaded_by:
        u_result = await db.execute(
            select(User.username).where(User.id == model.uploaded_by)
        )
        username = u_result.scalar_one_or_none()

    return _to_response(model, username)


@router.post("/{file_id}/replace", response_model=ModelFileResponse)
async def replace_vault_file(
    file_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Reemplaza el archivo .3mf de un modelo existente conservando sus metadatos.

    Sube el nuevo archivo a MinIO con una clave fresca, actualiza la DB y
    elimina el archivo anterior. Solo admins.
    """
    if not file.filename or not file.filename.lower().endswith(".3mf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos .3mf",
        )

    model = await _get_model_file(db, file_id)

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_VAULT_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 1 GB",
        )

    # Verificar cuota descontando el tamaño del archivo actual
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    if used - model.file_size + file_size > quota:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Sin espacio disponible. Cuota: {settings.VAULT_QUOTA_GB} GB",
        )

    # Subir nuevo archivo con clave única
    old_key = model.file_key
    file_uuid = str(uuid.uuid4())
    safe_name = file.filename.replace(" ", "_")
    new_key = f"{file_uuid}-{safe_name}"

    await upload_file(new_key, content, content_type="model/3mf")

    # Actualizar DB antes de borrar el archivo viejo
    model.file_key = new_key
    model.file_name = file.filename
    model.file_size = file_size
    model.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(model)

    # Eliminar archivo anterior (después de confirmar la DB)
    await delete_file(old_key)

    username = None
    if model.uploaded_by:
        u_result = await db.execute(
            select(User.username).where(User.id == model.uploaded_by)
        )
        username = u_result.scalar_one_or_none()

    return _to_response(model, username)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Elimina el archivo del Vault: borra el objeto en MinIO y el registro en DB.
    Solo admins.
    """
    model = await _get_model_file(db, file_id)

    # Borrar de MinIO primero (si falla no borramos la DB)
    await delete_file(model.file_key)

    await db.delete(model)
    await db.commit()
