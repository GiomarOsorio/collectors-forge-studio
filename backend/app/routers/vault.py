"""
Router del Vault de modelos `.3mf` / `.stl` / `.gcode.3mf` para Collector's Forge Studio.

Gestiona la subida, descarga y administración de archivos almacenados
en MinIO. Cada `ModelFile` puede tener hasta dos slots: `source_file`
(`.3mf` o `.stl` editable) y `print_file` (`.gcode.3mf` laminado, con
G-code listo para impresión). Al menos uno tiene que estar presente.

Todos los endpoints requieren autenticación JWT. Las operaciones de
escritura (upload, edit, delete, replace) requieren `role='admin'`.

Endpoints:
    GET    /api/vault/                       — Listar archivos activos (paginado, búsqueda, filtro por carpeta/tags)
    GET    /api/vault/stats                  — Estadísticas de uso del almacenamiento
    POST   /api/vault/fetch-metadata         — Pre-leer metadata desde URL externa
    POST   /api/vault/upload                 — Subir source_file y/o print_file con metadata (admin)
    GET    /api/vault/folders                — Listar carpetas (árbol plano + conteo de archivos)
    POST   /api/vault/folders                — Crear carpeta (admin)
    PUT    /api/vault/folders/{id}           — Renombrar / mover carpeta (admin)
    DELETE /api/vault/folders/{id}           — Eliminar carpeta (admin; hijos suben un nivel)
    GET    /api/vault/tags                   — Listar catálogo de tags (+ conteo de uso)
    POST   /api/vault/tags                   — Crear tag (admin)
    PATCH  /api/vault/tags/{id}              — Renombrar tag (admin)
    DELETE /api/vault/tags/{id}              — Eliminar tag del catálogo (admin; no borra archivos)
    GET    /api/vault/trash                  — Listar archivos en la papelera
    POST   /api/vault/trash/{id}/restore     — Restaurar archivo de la papelera (admin)
    DELETE /api/vault/trash/{id}             — Borrado permanente (bytes MinIO + fila) (admin)
    DELETE /api/vault/trash                  — Vaciar toda la papelera (admin)
    POST   /api/vault/generate-stl-thumbnails — Generar thumbnails STL pendientes en lote (admin)
    GET    /api/vault/{id}/download/source   — Descargar el .3mf/.stl editable
    GET    /api/vault/{id}/download/print    — Descargar el .gcode.3mf laminado
    GET    /api/vault/{id}/gcode-content     — Extraer el G-code plano del plate activo (visor)
    GET    /api/vault/{id}/print-history     — Historial de impresiones del modelo + gramos/tasa de éxito
    GET    /api/vault/{id}/photos            — Listar fotos adjuntas
    POST   /api/vault/{id}/photos            — Subir hasta 5 fotos (admin)
    PATCH  /api/vault/{id}/photos/{photo_id} — Editar caption de una foto (admin)
    GET    /api/vault/{id}/photos/{photo_id} — Servir el binario de una foto
    DELETE /api/vault/{id}/photos/{photo_id} — Eliminar una foto (admin)
    PUT    /api/vault/{id}                   — Editar metadata (admin)
    POST   /api/vault/{id}/replace/source    — Reemplazar el .3mf/.stl editable (admin)
    POST   /api/vault/{id}/replace/print     — Reemplazar el .gcode.3mf laminado (admin)
    DELETE /api/vault/{id}                   — Mover a la papelera (soft-delete) (admin)
"""

import asyncio
import hashlib
import io
import json
import logging
import re
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.inventory import InventoryItem
from app.models.model_file import ModelFile, ModelFilePlate
from app.models.model_file_photo import ModelFilePhoto
from app.models.printer import Printer
from app.models.queue import PrintQueueItem
from app.models.user import User
from app.models.vault_folder import VaultFolder
from app.models.vault_tag import VaultTag, model_file_tags
from app.schemas.vault import (
    BackfillHashesResponse,
    CheckDuplicateRequest,
    CheckDuplicateResponse,
    DuplicateFileInfo,
    ModelFileListResponse,
    ModelFilePhotoCaptionUpdate,
    ModelFilePhotoResponse,
    ModelFileResponse,
    ModelFileUpdate,
    PrintHistoryEntry,
    PrintHistoryResponse,
    VaultMetadataRequest,
    VaultMetadataResponse,
    VaultStatsResponse,
    VaultZipImportResponse,
)
from app.schemas.vault_folder import (
    VaultFolderCreate,
    VaultFolderResponse,
    VaultFolderUpdate,
)
from app.schemas.vault_tag import VaultTagCreate, VaultTagResponse, VaultTagUpdate
from app.services.auth import get_admin_user, get_current_user
from app.services.slicer_parser import parse_3mf_all_plates, parse_3mf_file
from app.services.thumbnail_extractor import (
    copy_plate_to_primary,
    delete_plate_thumbnail,
    delete_thumbnail,
    extract_all_plates_pngs,
    extract_plate_png,
    save_plate_thumbnail,
    save_thumbnail,
    thumbnail_key_for_plate,
)
from app.services.formatters import IMAGE_EXT_MAP, IMAGE_MAGIC_CHECKS
from app.services.stl_thumbnail import render_stl_thumbnail
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


def _source_content_type(filename: str) -> str:
    """Content-Type MinIO del slot source según su extensión (.stl vs .3mf)."""
    return "model/stl" if _ext_ok(filename, (".stl",)) else "model/3mf"


def _sha256_hex(data: bytes) -> str:
    """SHA-256 hex digest de `data` (issue #128 — dedup por hash de contenido)."""
    return hashlib.sha256(data).hexdigest()


async def _extract_source_thumbnail_png(source_bytes: bytes, source_name: str) -> Optional[bytes]:
    """
    Extrae/genera el PNG de thumbnail para un `source_file` sin plates.

    Un `.3mf` trae el render embebido por el slicer (`extract_plate_png`,
    lectura de ZIP — rápida). Un `.stl` es solo geometría, no hay nada que
    extraer — hay que renderizarlo (`render_stl_thumbnail`, CPU-bound, se
    corre en `asyncio.to_thread` para no bloquear el event loop).
    """
    if _ext_ok(source_name, (".stl",)):
        return await asyncio.to_thread(render_stl_thumbnail, source_bytes)
    return extract_plate_png(source_bytes)


async def _get_model_file(db: AsyncSession, file_id: int) -> ModelFile:
    """
    Obtiene un ModelFile por ID; lanza 404 si no existe. Eager-load
    plates + tags. No filtra por `deleted_at` — lo usan tanto endpoints
    normales como restore/purge de la papelera.
    """
    result = await db.execute(
        select(ModelFile)
        .options(selectinload(ModelFile.plates), selectinload(ModelFile.tags))
        .where(ModelFile.id == file_id)
    )
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


def _to_response(
    model: ModelFile, username: Optional[str], print_count: int = 0
) -> ModelFileResponse:
    # Si el modelo tiene un thumbnail en MinIO, exponemos al frontend la
    # URL del endpoint proxy que lo sirve (con `updated_at` como
    # cache-buster). Si no tiene, queda None y el frontend cae al
    # `thumbnail_url` externo (MakerWorld) o al placeholder.
    local_thumbnail_url: Optional[str] = None
    if model.thumbnail_key:
        ts = int(model.updated_at.timestamp()) if model.updated_at else 0
        local_thumbnail_url = f"/api/vault/{model.id}/thumbnail?v={ts}"
    # Plates serializados con thumbnail proxy URL (issue #68)
    ts = int(model.updated_at.timestamp()) if model.updated_at else 0
    plates_payload = []
    for p in sorted(model.plates or [], key=lambda x: x.plate_index):
        plate_thumb = None
        if p.thumbnail_key:
            plate_thumb = f"/api/vault/{model.id}/plate/{p.plate_index}/thumbnail?v={ts}"
        plates_payload.append({
            "plate_index": p.plate_index,
            "weight_g": float(p.weight_g) if p.weight_g is not None else None,
            "time_seconds": p.time_seconds,
            "filament_type": p.filament_type,
            "printer_model": p.printer_model,
            "thumbnail_url": plate_thumb,
        })
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
        tags=[t.name for t in (model.tags or [])],
        source_url=model.source_url,
        source_platform=model.source_platform,
        notes=model.notes,
        print_count=print_count,
        creator_name=model.creator_name,
        creator_url=model.creator_url,
        folder_id=model.folder_id,
        active_plate_index=model.active_plate_index,
        plates=plates_payload,
        created_at=model.created_at,
        updated_at=model.updated_at,
        deleted_at=model.deleted_at,
    )


async def _resolve_tags(db: AsyncSession, names: list) -> list:
    """
    Get-or-create de `VaultTag` para una lista de nombres. Dedup
    case-insensitive dentro de la propia lista (por `name_key`). Retorna
    los objetos ORM listos para asignar a `ModelFile.tags`.
    """
    resolved: list[VaultTag] = []
    seen_keys: set = set()
    for raw_name in names or []:
        name = (raw_name or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        result = await db.execute(select(VaultTag).where(VaultTag.name_key == key))
        tag = result.scalar_one_or_none()
        if tag is None:
            tag = VaultTag(name=name, name_key=key)
            db.add(tag)
            await db.flush()  # asigna id antes de usarlo en la relación M2M
        resolved.append(tag)
    return resolved


async def _get_folder(db: AsyncSession, folder_id: int) -> VaultFolder:
    """Obtiene una `VaultFolder` por ID; lanza 404 si no existe."""
    result = await db.execute(select(VaultFolder).where(VaultFolder.id == folder_id))
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carpeta no encontrada",
        )
    return folder


async def _assert_not_own_descendant(
    db: AsyncSession, folder_id: int, new_parent_id: Optional[int]
) -> None:
    """
    Evita mover una carpeta dentro de sí misma o de un descendiente propio
    (crearía un ciclo en el árbol). Recorre ancestros de `new_parent_id`
    hasta la raíz; si encuentra `folder_id` en el camino, rechaza.
    """
    if new_parent_id is None:
        return
    if new_parent_id == folder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una carpeta no puede ser su propio padre",
        )
    current_id = new_parent_id
    seen = set()
    while current_id is not None:
        if current_id in seen:
            break  # ciclo pre-existente defensivo; no debería pasar
        seen.add(current_id)
        result = await db.execute(
            select(VaultFolder.parent_id).where(VaultFolder.id == current_id)
        )
        row = result.first()
        if row is None:
            break
        parent_of_current = row[0]
        if parent_of_current == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes mover una carpeta dentro de su propia subcarpeta",
            )
        current_id = parent_of_current


def _parse_all_plates_from_bytes(content: bytes) -> list:
    """
    Parsea TODOS los plates del `.gcode.3mf`. Retorna lista de PlateResult
    (vacía si no hay plates o el archivo no es válido). Issue #68.
    """
    try:
        with tempfile.NamedTemporaryFile(suffix=".3mf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            return parse_3mf_all_plates(tmp_path) or []
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    except (OSError, ValueError) as exc:
        logger.warning("No se pudo parsear plates del .gcode.3mf: %s", exc)
        return []


def _sync_active_plate_cache(model: ModelFile, active: Optional[ModelFilePlate]) -> None:
    """
    Sincroniza los campos cache `sliced_*` + `thumbnail_key` del ModelFile
    desde un ModelFilePlate. Issue #68 — queue/calc leen `sliced_*`
    directamente, así que mantener el cache evita queries extra.

    Issue #71: si el plate no tiene un dato (None) pero el cache YA tiene
    un valor (ej. fallback del link), NO lo sobrescribimos con None.
    Esto preserva fallback metadata cuando el parser falla pero el link
    sí los provee.
    """
    if active is None:
        return
    if active.weight_g is not None:
        model.sliced_weight_g = active.weight_g
    if active.time_seconds is not None:
        model.sliced_time_seconds = active.time_seconds
    if active.filament_type is not None:
        model.sliced_filament_type = active.filament_type
    if active.printer_model is not None:
        model.sliced_printer_model = active.printer_model


async def _persist_plates_from_print_file(
    db: AsyncSession,
    model: ModelFile,
    print_bytes: bytes,
) -> None:
    """
    Extrae todos los plates de un `.gcode.3mf` y los persiste como
    `ModelFilePlate` rows. Sube cada thumbnail a MinIO bajo
    `thumbnails/{id}_plate{idx}.png`. Sincroniza `sliced_*` + thumbnail
    principal del ModelFile desde el plate activo (default 0).

    Idempotente: borra plates anteriores del modelo antes de crear los
    nuevos (caso edit/replace).

    Issue #68.
    """
    # Limpiar plates anteriores + thumbnails de MinIO
    if model.plates:
        for old in model.plates:
            await delete_plate_thumbnail(model.id, old.plate_index)
        model.plates.clear()
        await db.flush()

    plates = _parse_all_plates_from_bytes(print_bytes)
    pngs = extract_all_plates_pngs(print_bytes)

    if not plates and not pngs:
        # No multi-plate detectado; el caller hará fallback al flujo legacy.
        return

    # Si solo hay thumbnails (sin parser plates), crear 1 plate por thumb
    if not plates:
        for idx in sorted(pngs.keys()):
            model.plates.append(
                ModelFilePlate(plate_index=idx)
            )
    else:
        for pr in plates:
            # parse_3mf_all_plates devuelve plate_number 1-based
            idx = max(0, (pr.plate_number or 1) - 1)
            model.plates.append(
                ModelFilePlate(
                    plate_index=idx,
                    weight_g=Decimal(str(pr.filament_weight_g)) if pr.filament_weight_g is not None else None,
                    time_seconds=pr.print_time_seconds,
                    filament_type=pr.filament_type,
                    printer_model=None,
                )
            )

    await db.flush()  # asigna IDs a los plates nuevos

    # Subir cada thumbnail a MinIO
    for plate in model.plates:
        png = pngs.get(plate.plate_index)
        if png:
            try:
                plate.thumbnail_key = await save_plate_thumbnail(
                    model.id, plate.plate_index, png
                )
            except Exception as exc:
                logger.warning(
                    "No se pudo subir thumbnail plate %s del modelo %s: %s",
                    plate.plate_index, model.id, exc,
                )

    # Sincronizar cache desde plate activo
    model.active_plate_index = 0
    active = next((p for p in model.plates if p.plate_index == 0), None)
    if active is None and model.plates:
        active = model.plates[0]
        model.active_plate_index = active.plate_index
    _sync_active_plate_cache(model, active)

    # Replicar thumbnail del plate activo al slot principal
    if active and active.plate_index in pngs:
        try:
            model.thumbnail_key = await copy_plate_to_primary(
                model.id, pngs[active.plate_index]
            )
        except Exception as exc:
            logger.warning("No se pudo replicar thumbnail principal: %s", exc)


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
    folder_id: Optional[int] = Query(
        default=None,
        description="Filtra por carpeta. Omitido = no filtra por carpeta.",
    ),
    root_only: bool = Query(
        default=False,
        description="Si True (y folder_id no se envía), solo retorna archivos sin carpeta (raíz).",
    ),
    tag_ids: Optional[str] = Query(
        default=None,
        description="IDs de tags separados por coma. AND entre todos (el archivo debe tener TODOS).",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los archivos ACTIVOS del Vault (excluye los que están en la
    papelera) con paginación, búsqueda y filtro `print_ready_only` (usado
    por el picker de Queue para listar solo modelos con `.gcode.3mf`
    disponibles). `folder_id` filtra por carpeta específica; `root_only`
    (sin `folder_id`) filtra solo archivos sin carpeta asignada.
    `tag_ids` filtra por tags con semántica AND (debe tener todos los
    tags dados, no solo alguno).
    """
    base_q = (
        select(ModelFile)
        .options(selectinload(ModelFile.plates), selectinload(ModelFile.tags))
        .where(ModelFile.deleted_at.is_(None))
    )

    if folder_id is not None:
        base_q = base_q.where(ModelFile.folder_id == folder_id)
    elif root_only:
        base_q = base_q.where(ModelFile.folder_id.is_(None))

    if tag_ids:
        try:
            parsed_tag_ids = [int(t) for t in tag_ids.split(",") if t.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="tag_ids debe ser una lista de enteros separados por coma",
            )
        for tid in parsed_tag_ids:
            base_q = base_q.where(ModelFile.tags.any(VaultTag.id == tid))

    if q:
        # Búsqueda substring case-insensitive sobre name + description +
        # nombre de tag (vía EXISTS sobre la relación M2M).
        pat = f"%{q}%"
        base_q = base_q.where(
            or_(
                ModelFile.name.ilike(pat),
                ModelFile.description.ilike(pat),
                ModelFile.tags.any(VaultTag.name.ilike(pat)),
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

    # Badge "N impresiones" (issue #130) — un solo query agregado con
    # GROUP BY para todos los modelos de esta página, no un COUNT por fila.
    model_ids = [m.id for m in models]
    print_counts: dict = {}
    if model_ids:
        pc_result = await db.execute(
            select(PrintQueueItem.vault_model_id, func.count())
            .where(
                PrintQueueItem.vault_model_id.in_(model_ids),
                PrintQueueItem.status.in_(("done", "cancelled", "printing")),
            )
            .group_by(PrintQueueItem.vault_model_id)
        )
        print_counts = {row[0]: row[1] for row in pc_result.all()}

    return ModelFileListResponse(
        items=[
            _to_response(m, usernames.get(m.uploaded_by), print_counts.get(m.id, 0))
            for m in models
        ],
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


@router.get("/folders", response_model=list[VaultFolderResponse])
async def list_vault_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todas las carpetas del Vault (plana, con `parent_id`) más el
    conteo de archivos directos (no recursivo) de cada una. El frontend
    arma el árbol a partir de `parent_id`.
    """
    folders_result = await db.execute(select(VaultFolder).order_by(VaultFolder.name))
    folders = folders_result.scalars().all()

    counts_result = await db.execute(
        select(ModelFile.folder_id, func.count())
        .where(ModelFile.folder_id.is_not(None), ModelFile.deleted_at.is_(None))
        .group_by(ModelFile.folder_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [
        VaultFolderResponse(
            id=f.id,
            name=f.name,
            parent_id=f.parent_id,
            file_count=counts.get(f.id, 0),
            created_at=f.created_at,
            updated_at=f.updated_at,
        )
        for f in folders
    ]


@router.post("/folders", response_model=VaultFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_vault_folder(
    body: VaultFolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Crea una carpeta nueva. Solo admins."""
    if body.parent_id is not None:
        await _get_folder(db, body.parent_id)  # 404 si el padre no existe
    folder = VaultFolder(name=body.name.strip(), parent_id=body.parent_id)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return VaultFolderResponse(
        id=folder.id, name=folder.name, parent_id=folder.parent_id,
        file_count=0, created_at=folder.created_at, updated_at=folder.updated_at,
    )


@router.put("/folders/{folder_id}", response_model=VaultFolderResponse)
async def update_vault_folder(
    folder_id: int,
    body: VaultFolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Renombra y/o mueve (cambia `parent_id`) una carpeta. Solo admins."""
    folder = await _get_folder(db, folder_id)

    if body.name is not None:
        folder.name = body.name.strip()

    # `move_to_root=True` es la única forma de poner parent_id=NULL — un
    # `parent_id` ausente del body no debe tocar nada (patrón consistente
    # con el resto del PUT de Vault, que usa exclude_unset).
    if body.move_to_root:
        folder.parent_id = None
    elif body.parent_id is not None:
        await _get_folder(db, body.parent_id)  # 404 si el nuevo padre no existe
        await _assert_not_own_descendant(db, folder_id, body.parent_id)
        folder.parent_id = body.parent_id

    folder.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(folder)

    count_result = await db.execute(
        select(func.count()).select_from(ModelFile).where(
            ModelFile.folder_id == folder.id, ModelFile.deleted_at.is_(None)
        )
    )
    return VaultFolderResponse(
        id=folder.id, name=folder.name, parent_id=folder.parent_id,
        file_count=count_result.scalar() or 0,
        created_at=folder.created_at, updated_at=folder.updated_at,
    )


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Elimina una carpeta. Solo admins.

    Los archivos directamente dentro quedan en la raíz (`folder_id=NULL`,
    vía `ondelete=SET NULL`). Las subcarpetas se eliminan en cascada
    (`ondelete=CASCADE`) — el frontend advierte de esto antes de confirmar.
    """
    folder = await _get_folder(db, folder_id)
    await db.delete(folder)
    await db.commit()


# ─── Tags ───────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=list[VaultTagResponse])
async def list_vault_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista el catálogo de tags con el conteo de archivos activos que usan cada uno."""
    tags_result = await db.execute(select(VaultTag).order_by(VaultTag.name))
    tags = tags_result.scalars().all()

    counts_result = await db.execute(
        select(model_file_tags.c.tag_id, func.count())
        .select_from(model_file_tags)
        .join(ModelFile, ModelFile.id == model_file_tags.c.model_file_id)
        .where(ModelFile.deleted_at.is_(None))
        .group_by(model_file_tags.c.tag_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [
        VaultTagResponse(id=t.id, name=t.name, file_count=counts.get(t.id, 0), created_at=t.created_at)
        for t in tags
    ]


@router.post("/tags", response_model=VaultTagResponse, status_code=status.HTTP_201_CREATED)
async def create_vault_tag(
    body: VaultTagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Crea un tag nuevo en el catálogo. Solo admins."""
    name = body.name.strip()
    key = name.lower()
    existing = await db.execute(select(VaultTag).where(VaultTag.name_key == key))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un tag con ese nombre",
        )
    tag = VaultTag(name=name, name_key=key)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return VaultTagResponse(id=tag.id, name=tag.name, file_count=0, created_at=tag.created_at)


@router.patch("/tags/{tag_id}", response_model=VaultTagResponse)
async def rename_vault_tag(
    tag_id: int,
    body: VaultTagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Renombra un tag existente (aplica a todos los archivos que lo usan). Solo admins."""
    result = await db.execute(select(VaultTag).where(VaultTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag no encontrado")

    name = body.name.strip()
    key = name.lower()
    if key != tag.name_key:
        dup = await db.execute(
            select(VaultTag).where(VaultTag.name_key == key, VaultTag.id != tag_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un tag con ese nombre",
            )
    tag.name = name
    tag.name_key = key
    await db.commit()
    await db.refresh(tag)

    count_result = await db.execute(
        select(func.count())
        .select_from(model_file_tags)
        .join(ModelFile, ModelFile.id == model_file_tags.c.model_file_id)
        .where(model_file_tags.c.tag_id == tag_id, ModelFile.deleted_at.is_(None))
    )
    return VaultTagResponse(
        id=tag.id, name=tag.name, file_count=count_result.scalar() or 0, created_at=tag.created_at
    )


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Elimina un tag del catálogo. Solo admins.

    Borra solo las asociaciones (cascade en `model_file_tags`) — los
    archivos que lo tenían asignado no se tocan, solo pierden esa etiqueta.
    """
    result = await db.execute(select(VaultTag).where(VaultTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag no encontrado")
    await db.delete(tag)
    await db.commit()


# ─── Papelera ───────────────────────────────────────────────────────────────

@router.get("/trash", response_model=ModelFileListResponse)
async def list_vault_trash(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los archivos en la papelera, más recientemente eliminados primero."""
    base_q = (
        select(ModelFile)
        .options(selectinload(ModelFile.plates), selectinload(ModelFile.tags))
        .where(ModelFile.deleted_at.is_not(None))
    )

    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar() or 0

    offset = (page - 1) * page_size
    items_result = await db.execute(
        base_q.order_by(ModelFile.deleted_at.desc()).offset(offset).limit(page_size)
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


@router.post("/trash/{file_id}/restore", response_model=ModelFileResponse)
async def restore_vault_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Restaura un archivo de la papelera. Solo admins."""
    model = await _get_model_file(db, file_id)
    if model.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este archivo no está en la papelera",
        )
    model.deleted_at = None
    model.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(model)

    username = None
    if model.uploaded_by:
        u_result = await db.execute(select(User.username).where(User.id == model.uploaded_by))
        username = u_result.scalar_one_or_none()
    return _to_response(model, username)


@router.delete("/trash/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def purge_vault_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Borrado permanente: elimina los objetos en MinIO (fuente, laminado,
    thumbnails) y la fila en BD. Solo admins. Solo se puede purgar un
    archivo que ya está en la papelera — evita un borrado permanente
    accidental de un archivo activo vía este endpoint.
    """
    model = await _get_model_file(db, file_id)
    if model.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este archivo no está en la papelera — muévelo a la papelera primero",
        )

    if model.source_file_key:
        await delete_file(model.source_file_key)
    if model.print_file_key:
        await delete_file(model.print_file_key)

    await db.delete(model)
    await db.commit()
    await delete_thumbnail(model.id)


@router.delete("/trash", status_code=status.HTTP_204_NO_CONTENT)
async def empty_vault_trash(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Vacía toda la papelera — borrado permanente de todos los archivos en ella. Solo admins."""
    result = await db.execute(
        select(ModelFile).where(ModelFile.deleted_at.is_not(None))
    )
    models = result.scalars().all()

    for model in models:
        if model.source_file_key:
            await delete_file(model.source_file_key)
        if model.print_file_key:
            await delete_file(model.print_file_key)
        await db.delete(model)
    await db.commit()

    for model in models:
        await delete_thumbnail(model.id)


#: Cuántos STL sin thumbnail se procesan por llamada — el render es
#: CPU-bound (matplotlib), no queremos bloquear el worker con cientos de
#: renders en un solo request.
_STL_THUMBNAIL_BATCH_SIZE = 10


@router.post("/generate-stl-thumbnails")
async def generate_stl_thumbnails(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Genera en lote los thumbnails pendientes de archivos `.stl` activos
    sin `thumbnail_key` (backfill para modelos subidos antes de que este
    endpoint existiera, o cuyo render falló en el momento del upload).

    Procesa hasta `_STL_THUMBNAIL_BATCH_SIZE` por llamada — el frontend
    puede invocarlo repetidamente hasta que `remaining` sea 0. Solo admins.
    """
    result = await db.execute(
        select(ModelFile).where(
            ModelFile.deleted_at.is_(None),
            ModelFile.thumbnail_key.is_(None),
            ModelFile.source_file_key.is_not(None),
        )
    )
    candidates = [
        m
        for m in result.scalars().all()
        if m.source_file_name and _ext_ok(m.source_file_name, (".stl",))
    ]
    batch = candidates[:_STL_THUMBNAIL_BATCH_SIZE]

    processed = 0
    for model in batch:
        try:
            stl_bytes = await download_file(model.source_file_key)
            png = await asyncio.to_thread(render_stl_thumbnail, stl_bytes)
            if png:
                model.thumbnail_key = await save_thumbnail(model.id, png)
                processed += 1
        except Exception as exc:
            logger.warning(
                "No se pudo generar thumbnail STL en lote para %s: %s", model.id, exc
            )

    await db.commit()
    return {"processed": processed, "remaining": max(len(candidates) - len(batch), 0)}


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
      - `source_file` debe terminar en `.3mf` o `.stl` (NO `.gcode.3mf`).
      - `print_file` debe terminar en `.gcode.3mf`.
      - Cada archivo individual ≤ 1 GB.
      - La suma de los archivos no debe superar la cuota del Vault.
      - Si se sube `print_file`, se parsea su header y se popula `sliced_*`.
      - Thumbnail se extrae del `print_file` primero, fallback al `source_file`
        (render 3D offline si el source es `.stl`).

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
                detail="`source_file` debe ser un .3mf o .stl editable (no .gcode.3mf)",
            )
        if not _ext_ok(source_file.filename, (".3mf", ".stl")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`source_file` debe terminar en .3mf o .stl",
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

    folder_id = meta_dict.get("folder_id")
    if folder_id is not None:
        await _get_folder(db, folder_id)  # 404 si la carpeta no existe

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

    # Subir a MinIO con claves únicas por slot. Hash SHA-256 (issue #128)
    # de los bytes ya en memoria, antes de subir — mismo criterio para
    # ambos slots.
    source_key = source_name = source_hash = None
    print_key = print_name = print_hash = None
    if source_file is not None:
        source_key = f"{uuid.uuid4()}-{source_file.filename.replace(' ', '_')}"
        source_name = source_file.filename
        source_hash = _sha256_hex(source_bytes)
        await upload_file(source_key, source_bytes, content_type=_source_content_type(source_name))
    if print_file is not None:
        print_key = f"{uuid.uuid4()}-{print_file.filename.replace(' ', '_')}"
        print_name = print_file.filename
        print_hash = _sha256_hex(print_bytes)
        await upload_file(print_key, print_bytes, content_type="model/3mf")

    # Parsear sliced_* del print_file (si se subió).
    sliced = (
        _parse_sliced_from_print_file(print_bytes) if print_bytes is not None else {}
    )

    # Issue #71 — fallback al link cuando el parser local del .gcode.3mf
    # no encuentra weight/time/filament_type. Si el user dio meta con esos
    # campos (probable que vinieron de /fetch-metadata del frontend), los
    # usamos como respaldo en los `sliced_*` cache.
    meta_weight = meta_dict.get("weight_g")
    meta_time = meta_dict.get("time_seconds")
    meta_filament = meta_dict.get("filament_type")
    sliced_weight = sliced.get("sliced_weight_g") or (
        Decimal(str(meta_weight)) if meta_weight else None
    )
    sliced_time = sliced.get("sliced_time_seconds") or (
        int(meta_time) if meta_time else None
    )
    sliced_filament = sliced.get("sliced_filament_type") or meta_filament

    # Resolver tags (get-or-create) ANTES de construir el modelo — la
    # relación M2M necesita los VaultTag ya con id asignado.
    resolved_tags = await _resolve_tags(db, meta_dict.get("tags") or [])

    # Guardar en BD.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    model = ModelFile(
        uploaded_by=current_user.id,
        source_file_key=source_key,
        source_file_name=source_name,
        source_file_size=source_size if source_file else None,
        source_file_hash=source_hash,
        print_file_key=print_key,
        print_file_name=print_name,
        print_file_size=print_size if print_file else None,
        print_file_hash=print_hash,
        sliced_weight_g=sliced_weight,
        sliced_time_seconds=sliced_time,
        sliced_printer_model=sliced.get("sliced_printer_model"),
        sliced_filament_type=sliced_filament,
        name=name,
        description=meta_dict.get("description"),
        thumbnail_url=meta_dict.get("thumbnail_url"),
        tags=resolved_tags,
        source_url=meta_dict.get("source_url"),
        source_platform=meta_dict.get("source_platform"),
        creator_name=meta_dict.get("creator_name"),
        creator_url=meta_dict.get("creator_url"),
        folder_id=folder_id,
        created_at=now,
        updated_at=now,
    )
    db.add(model)
    await db.commit()
    # Re-fetch con selectinload para evitar lazy load en async session (MissingGreenlet).
    result = await db.execute(
        select(ModelFile).options(selectinload(ModelFile.plates)).where(ModelFile.id == model.id)
    )
    model = result.scalar_one()

    # Issue #68 — persistir TODOS los plates del print_file. Sincroniza
    # `sliced_*` + `thumbnail_key` desde el plate activo (default 0) y
    # sube cada thumbnail individual a MinIO.
    if print_bytes is not None:
        try:
            await _persist_plates_from_print_file(db, model, print_bytes)
        except Exception as exc:
            logger.warning("No se pudieron persistir plates de %s: %s", model.id, exc)

    # Fallback legacy: si no hay plates pero hay source con thumbnail,
    # extraemos (.3mf) o renderizamos (.stl) uno para el thumbnail principal.
    if not model.plates and source_bytes is not None:
        png = await _extract_source_thumbnail_png(source_bytes, source_name)
        if png:
            try:
                model.thumbnail_key = await save_thumbnail(model.id, png)
            except Exception as exc:
                logger.warning("No se pudo guardar thumbnail source de %s: %s", model.id, exc)

    await db.commit()
    result = await db.execute(
        select(ModelFile).options(selectinload(ModelFile.plates)).where(ModelFile.id == model.id)
    )
    model = result.scalar_one()
    return _to_response(model, current_user.username)


# ─── Import de ZIP con estructura de carpetas (issue #127) ────────────────

MAX_ZIP_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024  # 4 GB — protección zip-bomb
MAX_ZIP_ENTRIES = 500

_ZIP_PRINT_SUFFIXES = (".gcode.3mf",)
_ZIP_SOURCE_SUFFIXES = (".3mf", ".stl")


def _classify_zip_entry(filename: str) -> Optional[str]:
    """
    'print' | 'source' | None (no soportado, se ignora en silencio).

    `.gcode.3mf` se chequea ANTES que `.3mf` — mismo orden que `_ext_ok` en
    el upload normal, si no `.gcode.3mf` matchearía como source primero.
    """
    if _ext_ok(filename, _ZIP_PRINT_SUFFIXES):
        return "print"
    if _ext_ok(filename, _ZIP_SOURCE_SUFFIXES):
        return "source"
    return None


async def _build_model_file_from_zip_entry(
    db: AsyncSession,
    current_user: User,
    folder_id: Optional[int],
    entry_name: str,
    content: bytes,
    kind: str,
) -> ModelFile:
    """
    Construye y persiste un `ModelFile` a partir de UN archivo extraído del
    ZIP — a diferencia del upload normal (que puede traer source+print
    juntos en un mismo `ModelFile`), cada entry del ZIP es un archivo suelto
    y se convierte en su propio `ModelFile` con un solo slot poblado.

    Pasa por el mismo camino que `POST /upload` para ese slot: parseo de
    header gcode + plates (print) o extracción/render de thumbnail (source).
    """
    base_filename = Path(entry_name).name
    display_name = Path(base_filename).stem
    if kind == "print" and display_name.lower().endswith(".gcode"):
        display_name = display_name[: -len(".gcode")]
    display_name = display_name or base_filename

    key = f"{uuid.uuid4()}-{base_filename.replace(' ', '_')}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    model = ModelFile(
        uploaded_by=current_user.id,
        folder_id=folder_id,
        name=display_name,
        created_at=now,
        updated_at=now,
    )

    if kind == "print":
        await upload_file(key, content, content_type="model/3mf")
        model.print_file_key = key
        model.print_file_name = base_filename
        model.print_file_size = len(content)
        model.print_file_hash = _sha256_hex(content)
        sliced = _parse_sliced_from_print_file(content)
        model.sliced_weight_g = sliced.get("sliced_weight_g")
        model.sliced_time_seconds = sliced.get("sliced_time_seconds")
        model.sliced_printer_model = sliced.get("sliced_printer_model")
        model.sliced_filament_type = sliced.get("sliced_filament_type")
    else:
        await upload_file(key, content, content_type=_source_content_type(base_filename))
        model.source_file_key = key
        model.source_file_name = base_filename
        model.source_file_size = len(content)
        model.source_file_hash = _sha256_hex(content)

    db.add(model)
    await db.commit()
    await db.refresh(model)

    if kind == "print":
        try:
            await _persist_plates_from_print_file(db, model, content)
        except Exception as exc:
            logger.warning("No se pudieron persistir plates del ZIP (%s): %s", entry_name, exc)
    else:
        png = await _extract_source_thumbnail_png(content, base_filename)
        if png:
            try:
                model.thumbnail_key = await save_thumbnail(model.id, png)
            except Exception as exc:
                logger.warning("No se pudo guardar thumbnail del ZIP (%s): %s", entry_name, exc)

    await db.commit()
    return model


async def _get_or_create_folder_path(
    db: AsyncSession,
    base_folder_id: Optional[int],
    parts: tuple,
    cache: dict,
) -> Optional[int]:
    """
    Resuelve (creando si hace falta) la cadena de `VaultFolder` para `parts`
    (segmentos de subcarpeta dentro del ZIP), bajo `base_folder_id`.

    `cache` — `{parts_prefix: folder_id}` — evita crear la misma carpeta dos
    veces cuando varios archivos del ZIP comparten directorio (o un prefijo
    de directorios), y evita un roundtrip a DB por archivo.
    """
    if not parts:
        return base_folder_id
    if parts in cache:
        return cache[parts]

    parent_id = await _get_or_create_folder_path(db, base_folder_id, parts[:-1], cache)
    name = parts[-1]

    result = await db.execute(
        select(VaultFolder).where(VaultFolder.parent_id == parent_id, VaultFolder.name == name)
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        folder = VaultFolder(name=name, parent_id=parent_id)
        db.add(folder)
        await db.flush()
    cache[parts] = folder.id
    return folder.id


@router.post("/upload-zip", response_model=VaultZipImportResponse, status_code=status.HTTP_201_CREATED)
async def upload_vault_zip(
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(default=None),
    create_folder: bool = Form(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube un `.zip` y extrae su contenido al Vault, replicando la estructura
    de subcarpetas como `VaultFolder`s.

    Reglas:
      - Solo se procesan entries `.3mf`, `.stl` y `.gcode.3mf` — el resto se
        ignora en silencio (no rompe el import de los demás archivos).
      - `create_folder=true` crea una carpeta nueva con el nombre del ZIP
        (sin extensión) bajo `folder_id`, y todo el contenido cuelga de ahí.
        `create_folder=false` (default) usa `folder_id` directo como raíz
        (`null` = raíz del Vault).
      - Protección zip-bomb: se rechaza si el tamaño descomprimido total
        supera 4 GB o si hay más de 500 entries. Paths con `..` se ignoran.

    Solo admins.
    """
    if not _ext_ok(file.filename or "", (".zip",)):
        raise HTTPException(status_code=400, detail="El archivo debe ser un .zip")

    zip_bytes = await file.read()
    if len(zip_bytes) > MAX_VAULT_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="El ZIP supera el límite de 1 GB")

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="El archivo no es un ZIP válido")

    infolist = zf.infolist()
    if len(infolist) > MAX_ZIP_ENTRIES:
        raise HTTPException(
            status_code=400, detail=f"El ZIP tiene demasiadas entries ({len(infolist)} > {MAX_ZIP_ENTRIES})"
        )
    total_uncompressed = sum(zi.file_size for zi in infolist)
    if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"El ZIP descomprimido supera el límite ({total_uncompressed // (1024*1024)} MB > "
                   f"{MAX_ZIP_UNCOMPRESSED_BYTES // (1024*1024)} MB)",
        )

    if folder_id is not None:
        await _get_folder(db, folder_id)  # 404 si no existe

    root_folder_id = folder_id
    if create_folder:
        zip_display_name = Path(file.filename).stem if file.filename else "Import"
        root_folder = VaultFolder(name=zip_display_name, parent_id=folder_id)
        db.add(root_folder)
        await db.flush()
        root_folder_id = root_folder.id

    # Cuota: suma solo de los entries soportados que realmente vamos a
    # guardar (los ignorados no cuentan) — chequeo previo, fail-fast antes
    # de escribir nada a MinIO.
    supported_entries = [
        (zi, _classify_zip_entry(zi.filename))
        for zi in infolist
        if not zi.is_dir() and ".." not in Path(zi.filename).parts
    ]
    accepted_size = sum(zi.file_size for zi, kind in supported_entries if kind is not None)
    used = await _get_used_bytes(db)
    quota = settings.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    if used + accepted_size > quota:
        raise HTTPException(
            status_code=507, detail=f"Sin espacio disponible. Cuota: {settings.VAULT_QUOTA_GB} GB",
        )

    folder_cache: dict = {}
    files_created = 0
    skipped_entries = 0

    for zinfo, kind in supported_entries:
        if kind is None:
            skipped_entries += 1
            continue

        path = Path(zinfo.filename)
        dir_parts = path.parts[:-1]
        target_folder_id = await _get_or_create_folder_path(db, root_folder_id, dir_parts, folder_cache)

        content = zf.read(zinfo)
        await _build_model_file_from_zip_entry(
            db, current_user, target_folder_id, zinfo.filename, content, kind,
        )
        files_created += 1

    return VaultZipImportResponse(
        folders_created=len(folder_cache) + (1 if create_folder else 0),
        files_created=files_created,
        skipped_entries=skipped_entries,
        root_folder_id=root_folder_id,
    )


# ─── Detección de duplicados por hash (issue #128) ─────────────────────────

BACKFILL_HASHES_BATCH_SIZE = 20


@router.post("/check-duplicate", response_model=CheckDuplicateResponse)
async def check_duplicate(
    data: CheckDuplicateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chequea si `sha256` (calculado client-side sobre el `File`, antes de
    subir) ya existe en algún archivo del Vault no borrado — en cualquiera
    de los dos slots.

    El frontend usa esto para avisar "Ya existe como X" ANTES de mandar el
    archivo completo al servidor — evita subir potencialmente cientos de MB
    solo para descubrir que es un duplicado.
    """
    sha = data.sha256.lower()
    result = await db.execute(
        select(ModelFile)
        .where(
            ModelFile.deleted_at.is_(None),
            or_(ModelFile.source_file_hash == sha, ModelFile.print_file_hash == sha),
        )
        .limit(1)
    )
    match = result.scalar_one_or_none()
    if match is None:
        return CheckDuplicateResponse(duplicate=False)
    return CheckDuplicateResponse(duplicate=True, file=DuplicateFileInfo(id=match.id, name=match.name))


@router.post("/backfill-hashes", response_model=BackfillHashesResponse)
async def backfill_hashes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Calcula el hash SHA-256 de archivos ya existentes que no lo tienen
    (subidos antes de que existiera esta columna) — en lotes de
    `BACKFILL_HASHES_BATCH_SIZE`, para no bloquear el request descargando
    potencialmente cientos de archivos de MinIO de una sola vez.

    La UI puede llamarlo repetido hasta que `remaining` llegue a 0.
    """
    result = await db.execute(
        select(ModelFile)
        .where(
            ModelFile.deleted_at.is_(None),
            or_(
                (ModelFile.source_file_key.is_not(None)) & (ModelFile.source_file_hash.is_(None)),
                (ModelFile.print_file_key.is_not(None)) & (ModelFile.print_file_hash.is_(None)),
            ),
        )
        .limit(BACKFILL_HASHES_BATCH_SIZE)
    )
    batch = result.scalars().all()

    for model in batch:
        if model.source_file_key and not model.source_file_hash:
            try:
                content = await download_file(model.source_file_key)
                model.source_file_hash = _sha256_hex(content)
            except Exception as exc:
                logger.warning("Backfill hash falló (source, model=%s): %s", model.id, exc)
        if model.print_file_key and not model.print_file_hash:
            try:
                content = await download_file(model.print_file_key)
                model.print_file_hash = _sha256_hex(content)
            except Exception as exc:
                logger.warning("Backfill hash falló (print, model=%s): %s", model.id, exc)
    await db.commit()

    remaining_result = await db.execute(
        select(func.count(ModelFile.id)).where(
            ModelFile.deleted_at.is_(None),
            or_(
                (ModelFile.source_file_key.is_not(None)) & (ModelFile.source_file_hash.is_(None)),
                (ModelFile.print_file_key.is_not(None)) & (ModelFile.print_file_hash.is_(None)),
            ),
        )
    )
    remaining = remaining_result.scalar() or 0

    return BackfillHashesResponse(processed=len(batch), remaining=remaining)


@router.get("/{file_id}/download/source")
async def download_source_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descarga el `.3mf`/`.stl` editable. 404 si el modelo no lo tiene."""
    model = await _get_model_file(db, file_id)
    if not model.source_file_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este modelo no tiene .3mf/.stl editable",
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


#: Límite del G-code servido al visor — una impresión gigante puede pesar
#: cientos de MB; el visor del navegador (gcode-preview) no puede ni debe
#: procesar eso.
_MAX_GCODE_CONTENT_BYTES = 80 * 1024 * 1024

#: Patrón de nombre de plate dentro del ZIP `.gcode.3mf` (1-based).
_PLATE_GCODE_RE = re.compile(r"^Metadata/plate_(\d+)\.gcode$")


@router.get("/{file_id}/gcode-content")
async def get_gcode_content(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Extrae el G-code plano del plate activo de un `.gcode.3mf` para el
    visor 3D del frontend (`gcode-preview`).

    El `.gcode.3mf` es un ZIP; el G-code vive en `Metadata/plate_{N}.gcode`
    (N = `active_plate_index` + 1, mismo offset 1-based que los
    thumbnails). Si ese plate específico no está (edge case improbable),
    cae al primer `plate_*.gcode` disponible en el ZIP.

    413 si el G-code extraído supera 80 MB. 404 si el modelo no tiene
    `print_file` o el ZIP no contiene ningún G-code.
    """
    model = await _get_model_file(db, file_id)
    if not model.print_file_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este modelo no tiene .gcode.3mf laminado",
        )

    zip_bytes = await download_file(model.print_file_key)
    gcode_name = f"Metadata/plate_{model.active_plate_index + 1}.gcode"

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            namelist = zf.namelist()
            if gcode_name not in namelist:
                candidates = sorted(n for n in namelist if _PLATE_GCODE_RE.match(n))
                if not candidates:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="El .gcode.3mf no contiene G-code extraíble",
                    )
                gcode_name = candidates[0]

            info = zf.getinfo(gcode_name)
            if info.file_size > _MAX_GCODE_CONTENT_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="El G-code supera 80 MB — demasiado grande para el visor",
                )
            gcode_bytes = zf.read(gcode_name)
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El .gcode.3mf está corrupto o no es un ZIP válido",
        )

    return Response(content=gcode_bytes, media_type="text/plain")


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


@router.get("/{file_id}/plate/{plate_index}/thumbnail")
async def get_vault_plate_thumbnail(
    file_id: int,
    plate_index: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Sirve el PNG de un plate específico (issue #68). Endpoint PÚBLICO
    (mismo razonamiento que `/thumbnail`: <img> no envía Authorization).

    Path: `thumbnails/{file_id}_plate{plate_index}.png` en MinIO.
    """
    model = await _get_model_file(db, file_id)
    plate = next(
        (p for p in model.plates or [] if p.plate_index == plate_index),
        None,
    )
    if plate is None or not plate.thumbnail_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plate {plate_index} sin thumbnail",
        )
    try:
        data = await download_file(plate.thumbnail_key)
    except Exception as exc:
        logger.warning("No se pudo descargar plate thumbnail %s: %s", plate.thumbnail_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plate thumbnail no disponible",
        ) from exc
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ─── Historial de impresiones por modelo (issue #130) ───────────────────────


@router.get("/{file_id}/print-history", response_model=PrintHistoryResponse)
async def get_vault_print_history(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Historial de impresiones de un modelo del Vault: todas las filas
    `done` / `cancelled` / `printing` de la cola que lo referencian, más
    recientes primero, con gramos totales y tasa de éxito agregados
    (`done` / (`done` + `cancelled`) — `printing` no cuenta para la tasa,
    aún no terminó).
    """
    await _get_model_file(db, file_id)  # 404 si el modelo no existe

    items_result = await db.execute(
        select(PrintQueueItem)
        .where(
            PrintQueueItem.vault_model_id == file_id,
            PrintQueueItem.status.in_(("done", "cancelled", "printing")),
        )
        .order_by(PrintQueueItem.created_at.desc())
    )
    items = items_result.scalars().all()

    printer_ids = {i.printer_id for i in items if i.printer_id is not None}
    printers_by_id: dict = {}
    if printer_ids:
        p_result = await db.execute(select(Printer).where(Printer.id.in_(printer_ids)))
        printers_by_id = {p.id: p for p in p_result.scalars().all()}

    filament_ids = {i.filament_id for i in items if i.filament_id is not None}
    filaments_by_id: dict = {}
    if filament_ids:
        f_result = await db.execute(
            select(InventoryItem).where(InventoryItem.id.in_(filament_ids))
        )
        filaments_by_id = {f.id: f for f in f_result.scalars().all()}

    entries = []
    total_grams = Decimal("0")
    done_count = 0
    terminal_count = 0
    for i in items:
        printer = printers_by_id.get(i.printer_id) if i.printer_id else None
        fil = filaments_by_id.get(i.filament_id) if i.filament_id else None
        qty = i.quantity or 1
        if i.weight_grams is not None:
            total_grams += i.weight_grams * qty
        if i.status in ("done", "cancelled"):
            terminal_count += 1
            if i.status == "done":
                done_count += 1
        entries.append(
            PrintHistoryEntry(
                id=i.id,
                status=i.status,
                quantity=qty,
                piece_name=i.piece_name,
                printer_name=printer.name if printer else None,
                filament_name=fil.name if fil else None,
                weight_grams=i.weight_grams,
                print_time_hours=i.print_time_hours,
                failure_reason=i.failure_reason,
                failure_category=i.failure_category,
                created_at=i.created_at,
                completed_at=i.completed_at,
            )
        )

    success_rate = (done_count / terminal_count * 100) if terminal_count else None
    return PrintHistoryResponse(
        items=entries,
        total_grams=float(total_grams),
        success_rate_pct=success_rate,
    )


# ─── Fotos por modelo (issue #130) ───────────────────────────────────────────

#: Mismo límite que printed_items.py — 10 MB por foto.
MAX_PHOTO_BYTES = 10 * 1024 * 1024
#: Tope de fotos por request — evita requests multipart gigantes.
MAX_PHOTOS_PER_REQUEST = 5
#: Prefix bajo el cual se guardan las fotos en el bucket MinIO.
_PHOTO_PREFIX = "photos"
#: Map de extensión a media_type devuelto al servir la foto.
_PHOTO_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _photo_to_response(photo: ModelFilePhoto) -> ModelFilePhotoResponse:
    return ModelFilePhotoResponse(
        id=photo.id,
        caption=photo.caption,
        photo_url=f"/api/vault/{photo.model_file_id}/photos/{photo.id}",
        created_at=photo.created_at,
    )


async def _get_photo(db: AsyncSession, file_id: int, photo_id: int) -> ModelFilePhoto:
    result = await db.execute(
        select(ModelFilePhoto).where(
            ModelFilePhoto.id == photo_id, ModelFilePhoto.model_file_id == file_id
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    return photo


@router.get("/{file_id}/photos", response_model=List[ModelFilePhotoResponse])
async def list_vault_photos(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista las fotos adjuntas a un modelo, más recientes primero."""
    await _get_model_file(db, file_id)
    result = await db.execute(
        select(ModelFilePhoto)
        .where(ModelFilePhoto.model_file_id == file_id)
        .order_by(ModelFilePhoto.created_at.desc())
    )
    return [_photo_to_response(p) for p in result.scalars().all()]


@router.post(
    "/{file_id}/photos",
    response_model=List[ModelFilePhotoResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upload_vault_photos(
    file_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube hasta `MAX_PHOTOS_PER_REQUEST` fotos para un modelo. Cada una se
    guarda como fila independiente (aditivo — no reemplaza fotos previas).
    Mismo criterio de validación que `printed_items.py`: content-type
    declarado + magic bytes reales (evita spoofing de MIME), 10 MB máx.
    """
    await _get_model_file(db, file_id)  # 404 si el modelo no existe

    if len(files) > MAX_PHOTOS_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo {MAX_PHOTOS_PER_REQUEST} fotos por request",
        )

    allowed_content_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    created: list = []
    for file in files:
        if file.content_type not in allowed_content_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de archivo no permitido: {file.content_type}. "
                       f"Use JPEG, PNG, WebP o GIF.",
            )
        content = await file.read()
        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"'{file.filename}' supera el límite de 10 MB",
            )
        check = IMAGE_MAGIC_CHECKS.get(file.content_type)
        if not content or (check and not check(content)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{file.filename}' no es una imagen válida.",
            )

        extension = IMAGE_EXT_MAP.get(file.content_type, ".jpg")
        key = f"{_PHOTO_PREFIX}/{file_id}/{uuid.uuid4()}{extension}"
        await upload_file(key, content, content_type=file.content_type)

        photo = ModelFilePhoto(model_file_id=file_id, minio_key=key)
        db.add(photo)
        created.append(photo)

    await db.commit()
    for photo in created:
        await db.refresh(photo)
    return [_photo_to_response(p) for p in created]


@router.patch("/{file_id}/photos/{photo_id}", response_model=ModelFilePhotoResponse)
async def update_vault_photo_caption(
    file_id: int,
    photo_id: int,
    data: ModelFilePhotoCaptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Edita el caption de una foto ya subida."""
    photo = await _get_photo(db, file_id, photo_id)
    photo.caption = data.caption
    await db.commit()
    await db.refresh(photo)
    return _photo_to_response(photo)


@router.get("/{file_id}/photos/{photo_id}")
async def get_vault_photo(
    file_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Sirve el binario de la foto desde MinIO. Endpoint **público** (mismo
    razonamiento que el thumbnail: los `<img>` tags no pueden enviar el
    header `Authorization`).
    """
    photo = await _get_photo(db, file_id, photo_id)
    try:
        data = await download_file(photo.minio_key)
    except Exception as exc:
        logger.warning("No se pudo descargar foto %s: %s", photo.minio_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foto no disponible en almacenamiento",
        ) from exc

    ext = "." + photo.minio_key.rsplit(".", 1)[-1].lower() if "." in photo.minio_key else ".jpg"
    media_type = _PHOTO_MEDIA_TYPES.get(ext, "image/jpeg")
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.delete("/{file_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_photo(
    file_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Elimina una foto (BD + objeto MinIO)."""
    photo = await _get_photo(db, file_id, photo_id)
    await db.delete(photo)
    await db.commit()
    try:
        await delete_file(photo.minio_key)
    except Exception as exc:
        logger.debug("No se pudo borrar foto %s de MinIO: %s", photo.minio_key, exc)


@router.patch("/{file_id}/active-plate", response_model=ModelFileResponse)
async def set_active_plate(
    file_id: int,
    plate_index: int = Query(..., ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cambia el plate activo del modelo (issue #68).

    - Actualiza `ModelFile.active_plate_index`.
    - Sincroniza `sliced_*` cache desde el plate elegido (queue/calc
      leen estos campos directamente).
    - Replica el thumbnail del plate activo al slot principal
      (`thumbnails/{id}.png`) para que el endpoint legacy y el cache
      de `<img>` apunten al nuevo render.
    """
    model = await _get_model_file(db, file_id)
    plate = next(
        (p for p in model.plates or [] if p.plate_index == plate_index),
        None,
    )
    if plate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plate {plate_index} no existe para este modelo",
        )
    model.active_plate_index = plate_index
    _sync_active_plate_cache(model, plate)
    # Replicar thumbnail del plate activo al slot principal
    if plate.thumbnail_key:
        try:
            png = await download_file(plate.thumbnail_key)
            model.thumbnail_key = await copy_plate_to_primary(model.id, png)
        except Exception as exc:
            logger.warning("No se pudo replicar thumbnail al cambiar active plate: %s", exc)
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
    if update_data.get("folder_id") is not None:
        await _get_folder(db, update_data["folder_id"])  # 404 si no existe
    # `tags` no es una columna directa desde el JSONB→relacional — se
    # resuelve aparte (get-or-create + reemplaza la relación M2M completa).
    tag_names = update_data.pop("tags", None)
    for field, value in update_data.items():
        setattr(model, field, value)
    if tag_names is not None:
        model.tags = await _resolve_tags(db, tag_names)

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
    expected_suffixes = (".3mf", ".stl") if slot == "source" else (".gcode.3mf",)
    if not file.filename or not _ext_ok(file.filename, expected_suffixes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo del slot `{slot}` debe terminar en {' o '.join(expected_suffixes)}",
        )

    # Para source extra validar que no sea .gcode.3mf (que también termina en .3mf).
    if slot == "source" and _ext_ok(file.filename, (".gcode.3mf",)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`source_file` debe ser .3mf o .stl editable, no .gcode.3mf",
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
    upload_content_type = _source_content_type(file.filename) if slot == "source" else "model/3mf"
    await upload_file(new_key, content, content_type=upload_content_type)

    if slot == "source":
        model.source_file_key = new_key
        model.source_file_name = file.filename
        model.source_file_size = new_size
        model.source_file_hash = _sha256_hex(content)
    else:
        model.print_file_key = new_key
        model.print_file_name = file.filename
        model.print_file_size = new_size
        model.print_file_hash = _sha256_hex(content)
        # Re-persistir TODOS los plates desde el nuevo print_file (issue
        # #68). `_persist_plates_from_print_file` borra los plates
        # anteriores + thumbnails + sincroniza sliced_* + thumbnail
        # principal desde plate 0.
        try:
            await _persist_plates_from_print_file(db, model, content)
        except Exception as exc:
            logger.warning("No se pudo re-persistir plates de %s: %s", model.id, exc)

    model.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Si fue replace de source y no había plates ya, intentar thumbnail
    # fallback desde el source. (En print el flow de plates ya cubre).
    if slot == "source" and not model.plates:
        png = await _extract_source_thumbnail_png(content, file.filename)
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
    Mueve el archivo del Vault a la papelera (soft-delete). Solo admins.

    No borra bytes de MinIO ni la fila — eso solo pasa en el borrado
    permanente (`DELETE /api/vault/trash/{id}`), una vez ya está acá.
    """
    model = await _get_model_file(db, file_id)
    model.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
