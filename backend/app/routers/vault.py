"""
Router del Vault de modelos `.3mf` / `.gcode.3mf` para Collector's Forge Studio.

Gestiona la subida, descarga y administración de archivos almacenados
en MinIO. Cada `ModelFile` puede tener hasta dos slots: `source_file`
(`.3mf` editable) y `print_file` (`.gcode.3mf` laminado, con G-code listo
para impresión). Al menos uno tiene que estar presente.

Todos los endpoints requieren autenticación JWT. Las operaciones de
escritura (upload, edit, delete, replace) requieren `role='admin'`.

Endpoints:
    GET    /api/vault/                       — Listar archivos (paginado, búsqueda)
    GET    /api/vault/stats                  — Estadísticas de uso del almacenamiento
    POST   /api/vault/fetch-metadata         — Pre-leer metadata desde URL externa
    POST   /api/vault/upload                 — Subir source_file y/o print_file con metadata (admin)
    GET    /api/vault/{id}/download/source   — Descargar el .3mf editable
    GET    /api/vault/{id}/download/print    — Descargar el .gcode.3mf laminado
    PUT    /api/vault/{id}                   — Editar metadata (admin)
    POST   /api/vault/{id}/replace/source    — Reemplazar el .3mf editable (admin)
    POST   /api/vault/{id}/replace/print     — Reemplazar el .gcode.3mf laminado (admin)
    DELETE /api/vault/{id}                   — Eliminar archivo y objeto(s) MinIO (admin)
"""

import json
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.model_file import ModelFile
from app.models.user import User
from app.schemas.vault import (
    ModelFileListResponse,
    ModelFileResponse,
    ModelFileUpdate,
    VaultMetadataRequest,
    VaultMetadataResponse,
    VaultStatsResponse,
)
from app.services.auth import get_admin_user, get_current_user
from app.services.slicer_parser import parse_3mf_file
from app.services.thumbnail_extractor import (
    delete_thumbnail,
    extract_plate_png,
    save_thumbnail,
)
from app.services.vault_metadata import fetch_metadata
from app.services.vault_storage import delete_file, download_file, upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vault", tags=["vault"])

# Límite de upload por archivo: 1 GB (DoS-protección a nivel de app).
MAX_VAULT_UPLOAD_BYTES = 1024 * 1024 * 1024


def _ext_ok(filename: str, allowed_suffixes: tuple) -> bool:
    """True si el filename termina en alguno de los suffixes (case-insensitive)."""
    if not filename:
        return False
    lower = filename.lower()
    return any(lower.endswith(s) for s in allowed_suffixes)


async def _get_model_file(db: AsyncSession, file_id: int) -> ModelFile:
    """Obtiene un ModelFile por ID; lanza 404 si no existe."""
    result = await db.execute(select(ModelFile).where(ModelFile.id == file_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado",
        )
    return model


async def _get_used_bytes(db: AsyncSession) -> int:
    """
    Calcula el espacio usado (bytes) sumando source_file_size + print_file_size
    de todos los archivos, ignorando NULLs.
    """
    result = await db.execute(
        select(
            func.coalesce(func.sum(ModelFile.source_file_size), 0)
            + func.coalesce(func.sum(ModelFile.print_file_size), 0)
        )
    )
    return result.scalar() or 0


def _to_response(model: ModelFile, username: Optional[str]) -> ModelFileResponse:
    # Si el modelo tiene un thumbnail en MinIO, exponemos al frontend la
    # URL del endpoint proxy que lo sirve (con `updated_at` como
    # cache-buster). Si no tiene, queda None y el frontend cae al
    # `thumbnail_url` externo (MakerWorld) o al placeholder.
    local_thumbnail_url: Optional[str] = None
    if model.thumbnail_key:
        ts = int(model.updated_at.timestamp()) if model.updated_at else 0
        local_thumbnail_url = f"/api/vault/{model.id}/thumbnail?v={ts}"
    return ModelFileResponse(
        id=model.id,
        uploaded_by=model.uploaded_by,
        uploaded_by_username=username,
        source_file_name=model.source_file_name,
        source_file_size=model.source_file_size,
        print_file_name=model.print_file_name,
        print_file_size=model.print_file_size,
        sliced_weight_g=model.sliced_weight_g,
        sliced_time_seconds=model.sliced_time_seconds,
        sliced_printer_model=model.sliced_printer_model,
        sliced_filament_type=model.sliced_filament_type,
        is_print_ready=model.is_print_ready,
        name=model.name,
        description=model.description,
        thumbnail_url=model.thumbnail_url,
        local_thumbnail_url=local_thumbnail_url,
        tags=model.tags or [],
        source_url=model.source_url,
        source_platform=model.source_platform,
        creator_name=model.creator_name,
        creator_url=model.creator_url,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _parse_sliced_from_print_file(content: bytes) -> dict:
    """
    Parsea el header del `.gcode.3mf` (escribe a tmpfile porque
    `parse_3mf_file` consume un path). Devuelve un dict con las claves
    pre-procesadas para llenar columnas `sliced_*`.

    Si el parser no encuentra datos (modelo sin G-code laminado válido),
    retorna un dict con todos los valores en None — el upload no falla.
    """
    out = {
        "sliced_weight_g": None,
        "sliced_time_seconds": None,
        "sliced_printer_model": None,
        "sliced_filament_type": None,
    }
    try:
        with tempfile.NamedTemporaryFile(suffix=".3mf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = parse_3mf_file(tmp_path)
            if result is None:
                return out
            if result.filament_weight_g is not None:
                out["sliced_weight_g"] = Decimal(str(result.filament_weight_g))
            out["sliced_time_seconds"] = result.print_time_seconds
            out["sliced_filament_type"] = result.filament_type
            # printer_model: parse_3mf_file todavía no lo expone; queda None hasta
            # que el parser lo agregue. Es opcional para el flujo de cola.
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    except (OSError, ValueError) as exc:
        logger.warning("No se pudo parsear sliced metadata del .gcode.3mf: %s", exc)
    return out


@router.get("/", response_model=ModelFileListResponse)
async def list_vault_files(
    q: Optional[str] = Query(
        default=None,
        description="Buscar por nombre, descripción o tag (ilike, substring).",
    ),
    print_ready_only: bool = Query(
        default=False,
        description="Si True, solo retorna modelos con print_file presente",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los archivos del Vault con paginación, búsqueda y filtro
    `print_ready_only` (usado por el picker de Queue para listar solo
    modelos con `.gcode.3mf` disponibles).
    """
    base_q = select(ModelFile)

    if q:
        # Búsqueda substring case-insensitive sobre name + description + tags.
        # `tags` es JSONB; el cast a String genera la representación textual
        # `["tag1","tag2"]` sobre la que aplicamos ilike — acepta falsos
        # positivos por substring (ej. "ta" matchea "[\"tag\"]") pero es
        # suficiente para Vault de uso personal.
        pat = f"%{q}%"
        base_q = base_q.where(
            or_(
                ModelFile.name.ilike(pat),
                ModelFile.description.ilike(pat),
                cast(ModelFile.tags, String).ilike(pat),
            )
        )
    if print_ready_only:
        base_q = base_q.where(ModelFile.print_file_key.is_not(None))

    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    items_result = await db.execute(
        base_q.order_by(ModelFile.created_at.desc()).offset(offset).limit(page_size)
    )
    models = items_result.scalars().all()

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
    """Retorna el uso y cuota de almacenamiento."""
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    percent = round(used / quota * 100, 2) if quota > 0 else 0.0
    return VaultStatsResponse(used_bytes=used, quota_bytes=quota, percent=percent)


@router.post("/fetch-metadata", response_model=VaultMetadataResponse)
async def fetch_vault_metadata(
    body: VaultMetadataRequest,
    current_user: User = Depends(get_current_user),
):
    """Extrae metadata de un modelo desde su URL pública (MakerWorld, etc.)."""
    data = await fetch_metadata(body.url)
    return VaultMetadataResponse(**{k: v for k, v in data.items() if k != "source_url"})


@router.post("/upload", response_model=ModelFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_vault_file(
    metadata: str = Form(..., description="JSON con ModelFileCreate"),
    source_file: Optional[UploadFile] = File(
        default=None, description="`.3mf` editable (opcional si se sube print_file)"
    ),
    print_file: Optional[UploadFile] = File(
        default=None, description="`.gcode.3mf` laminado (opcional si se sube source_file)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube uno o ambos archivos al Vault con metadata compartida.

    Reglas:
      - Al menos uno de `source_file` o `print_file` es requerido.
      - `source_file` debe terminar en `.3mf` (NO `.gcode.3mf`).
      - `print_file` debe terminar en `.gcode.3mf`.
      - Cada archivo individual ≤ 1 GB.
      - La suma de los archivos no debe superar la cuota del Vault.
      - Si se sube `print_file`, se parsea su header y se popula `sliced_*`.
      - Thumbnail se extrae del `print_file` primero, fallback al `source_file`.

    Solo admins pueden subir archivos.
    """
    if source_file is None and print_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes subir al menos un archivo (source_file o print_file)",
        )

    # Validar extensiones. .gcode.3mf debe matchear antes que .3mf — orden importa.
    if source_file is not None:
        if not source_file.filename or _ext_ok(source_file.filename, (".gcode.3mf",)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`source_file` debe ser un .3mf editable (no .gcode.3mf)",
            )
        if not _ext_ok(source_file.filename, (".3mf",)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`source_file` debe terminar en .3mf",
            )
    if print_file is not None and not _ext_ok(print_file.filename or "", (".gcode.3mf",)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`print_file` debe terminar en .gcode.3mf",
        )

    # Parsear metadata.
    try:
        meta_dict = json.loads(metadata)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El campo 'metadata' no es JSON válido: {exc}",
        )
    name = (meta_dict.get("name") or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El campo 'name' es requerido",
        )

    # Leer ambos archivos en memoria y validar tamaños individuales.
    source_bytes = await source_file.read() if source_file else None
    print_bytes = await print_file.read() if print_file else None
    source_size = len(source_bytes) if source_bytes is not None else 0
    print_size = len(print_bytes) if print_bytes is not None else 0

    for label, size in (("source_file", source_size), ("print_file", print_size)):
        if size > MAX_VAULT_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"`{label}` supera el límite de 1 GB",
            )

    # Verificar cuota total (source + print).
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    if used + source_size + print_size > quota:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Sin espacio disponible. Cuota: {settings.VAULT_QUOTA_GB} GB",
        )

    # Subir a MinIO con claves únicas por slot.
    source_key = source_name = None
    print_key = print_name = None
    if source_file is not None:
        source_key = f"{uuid.uuid4()}-{source_file.filename.replace(' ', '_')}"
        source_name = source_file.filename
        await upload_file(source_key, source_bytes, content_type="model/3mf")
    if print_file is not None:
        print_key = f"{uuid.uuid4()}-{print_file.filename.replace(' ', '_')}"
        print_name = print_file.filename
        await upload_file(print_key, print_bytes, content_type="model/3mf")

    # Parsear sliced_* del print_file (si se subió).
    sliced = (
        _parse_sliced_from_print_file(print_bytes) if print_bytes is not None else {}
    )

    # Guardar en BD.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    model = ModelFile(
        uploaded_by=current_user.id,
        source_file_key=source_key,
        source_file_name=source_name,
        source_file_size=source_size if source_file else None,
        print_file_key=print_key,
        print_file_name=print_name,
        print_file_size=print_size if print_file else None,
        sliced_weight_g=sliced.get("sliced_weight_g"),
        sliced_time_seconds=sliced.get("sliced_time_seconds"),
        sliced_printer_model=sliced.get("sliced_printer_model"),
        sliced_filament_type=sliced.get("sliced_filament_type"),
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

    # Extraer plate-render del print_file primero (más rico en thumbnails);
    # si no, intentar source_file. Si ninguno trae, seguimos sin thumbnail.
    png = None
    if print_bytes is not None:
        png = extract_plate_png(print_bytes)
    if png is None and source_bytes is not None:
        png = extract_plate_png(source_bytes)
    if png:
        try:
            model.thumbnail_key = await save_thumbnail(model.id, png)
            await db.commit()
            await db.refresh(model)
        except Exception as exc:
            logger.warning("No se pudo guardar thumbnail de %s: %s", model.id, exc)

    return _to_response(model, current_user.username)


@router.get("/{file_id}/download/source")
async def download_source_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descarga el `.3mf` editable. 404 si el modelo no lo tiene."""
    model = await _get_model_file(db, file_id)
    if not model.source_file_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este modelo no tiene .3mf editable",
        )
    data = await download_file(model.source_file_key)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{model.source_file_name}"',
        },
    )


@router.get("/{file_id}/download/print")
async def download_print_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descarga el `.gcode.3mf` laminado. 404 si el modelo no lo tiene."""
    model = await _get_model_file(db, file_id)
    if not model.print_file_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este modelo no tiene .gcode.3mf laminado",
        )
    data = await download_file(model.print_file_key)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{model.print_file_name}"',
        },
    )


@router.get("/{file_id}/thumbnail")
async def get_vault_thumbnail(
    file_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Sirve el PNG plate-render extraído del `.3mf` / `.gcode.3mf`.

    Endpoint **público** (sin JWT) porque los `<img>` tags del browser no
    pueden enviar el header `Authorization`. El binario no es sensible
    (es un render del modelo, equivalente a un avatar). El cache-buster
    `?v=<updated_at>` del frontend invalida la caché tras un reemplazo.

    Descarga el objeto desde MinIO (key `thumbnails/{file_id}.png`) y lo
    streamea con `Cache-Control: public, max-age=86400`.

    Si el modelo no tiene `thumbnail_key` o el objeto ya no está en
    MinIO, retorna 404 — el frontend cae al `thumbnail_url` externo
    (MakerWorld) o al placeholder.
    """
    model = await _get_model_file(db, file_id)
    if not model.thumbnail_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este modelo no tiene plate-render extraído",
        )
    try:
        data = await download_file(model.thumbnail_key)
    except Exception as exc:
        logger.warning("No se pudo descargar thumbnail %s: %s", model.thumbnail_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail no disponible en almacenamiento",
        ) from exc
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{file_id}", response_model=ModelFileResponse)
async def get_vault_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene un solo `ModelFile` por ID. Usado por el editor del Vault."""
    model = await _get_model_file(db, file_id)
    username = None
    if model.uploaded_by:
        u_result = await db.execute(
            select(User.username).where(User.id == model.uploaded_by)
        )
        username = u_result.scalar_one_or_none()
    return _to_response(model, username)


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

    username = None
    if model.uploaded_by:
        u_result = await db.execute(
            select(User.username).where(User.id == model.uploaded_by)
        )
        username = u_result.scalar_one_or_none()

    return _to_response(model, username)


async def _replace_slot(
    db: AsyncSession,
    model: ModelFile,
    file: UploadFile,
    slot: str,  # 'source' | 'print'
    current_user: User,
) -> ModelFile:
    """
    Reemplaza el archivo del slot indicado conservando metadatos.
    Llamado desde los dos endpoints específicos /replace/source y /replace/print.
    """
    expected_suffix = ".3mf" if slot == "source" else ".gcode.3mf"
    if not file.filename or not _ext_ok(file.filename, (expected_suffix,)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo del slot `{slot}` debe terminar en {expected_suffix}",
        )

    # Para source extra validar que no sea .gcode.3mf (que también termina en .3mf).
    if slot == "source" and _ext_ok(file.filename, (".gcode.3mf",)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`source_file` debe ser .3mf editable, no .gcode.3mf",
        )

    content = await file.read()
    new_size = len(content)
    if new_size > MAX_VAULT_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 1 GB",
        )

    # Verificar cuota descontando el tamaño del archivo actual del mismo slot.
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    current_slot_size = (
        model.source_file_size if slot == "source" else model.print_file_size
    ) or 0
    if used - current_slot_size + new_size > quota:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Sin espacio disponible. Cuota: {settings.VAULT_QUOTA_GB} GB",
        )

    # Subir nuevo archivo con clave fresca; conservar el viejo para borrarlo
    # solo después de confirmar la BD.
    old_key = model.source_file_key if slot == "source" else model.print_file_key
    new_key = f"{uuid.uuid4()}-{file.filename.replace(' ', '_')}"
    await upload_file(new_key, content, content_type="model/3mf")

    if slot == "source":
        model.source_file_key = new_key
        model.source_file_name = file.filename
        model.source_file_size = new_size
    else:
        model.print_file_key = new_key
        model.print_file_name = file.filename
        model.print_file_size = new_size
        # Re-parsear sliced_* del nuevo print_file.
        sliced = _parse_sliced_from_print_file(content)
        model.sliced_weight_g = sliced.get("sliced_weight_g")
        model.sliced_time_seconds = sliced.get("sliced_time_seconds")
        model.sliced_printer_model = sliced.get("sliced_printer_model")
        model.sliced_filament_type = sliced.get("sliced_filament_type")

    model.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Re-extraer thumbnail si este slot puede aportar uno mejor.
    png = extract_plate_png(content)
    if png:
        await delete_thumbnail(model.id)
        try:
            model.thumbnail_key = await save_thumbnail(model.id, png)
        except Exception as exc:
            logger.warning("No se pudo guardar thumbnail de %s: %s", model.id, exc)
            model.thumbnail_key = None

    await db.commit()
    await db.refresh(model)

    if old_key:
        await delete_file(old_key)

    return model


@router.post("/{file_id}/replace/source", response_model=ModelFileResponse)
async def replace_source_file(
    file_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reemplaza el `.3mf` editable conservando metadatos. Solo admins."""
    model = await _get_model_file(db, file_id)
    model = await _replace_slot(db, model, file, "source", current_user)
    username = None
    if model.uploaded_by:
        u_result = await db.execute(
            select(User.username).where(User.id == model.uploaded_by)
        )
        username = u_result.scalar_one_or_none()
    return _to_response(model, username)


@router.post("/{file_id}/replace/print", response_model=ModelFileResponse)
async def replace_print_file(
    file_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reemplaza el `.gcode.3mf` laminado conservando metadatos. Solo admins."""
    model = await _get_model_file(db, file_id)
    model = await _replace_slot(db, model, file, "print", current_user)
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
    Elimina el archivo del Vault: borra ambos objetos en MinIO (si existen)
    y el registro en BD. Solo admins.
    """
    model = await _get_model_file(db, file_id)

    if model.source_file_key:
        await delete_file(model.source_file_key)
    if model.print_file_key:
        await delete_file(model.print_file_key)

    await db.delete(model)
    await db.commit()
    await delete_thumbnail(model.id)
