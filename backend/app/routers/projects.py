"""
Router de proyectos — agrupador de ítems de la cola de impresión.

Un `Project` agrupa varios `PrintQueueItem` (vía `project_id`) para llevar
el progreso de un encargo con varias impresiones. No afecta inventario ni
costos — es puramente organizativo.

Endpoints:
    GET    /api/projects/          — Lista proyectos con progreso agregado.
    POST   /api/projects/          — Crea un proyecto.
    GET    /api/projects/{id}      — Detalle + items de cola asociados.
    PUT    /api/projects/{id}      — Edita nombre/cliente/estado/notas/metadata.
    DELETE /api/projects/{id}      — Elimina el proyecto (items quedan sin agrupar).

Metadata (issue #136, sub-ticket 1/3):
    POST   /api/projects/{id}/cover — (admin) Sube/reemplaza la foto de portada.
    GET    /api/projects/{id}/cover — Proxy público de la foto de portada.

Vínculo a Vault (issue #136, sub-ticket 2/3):
    GET    /api/projects/{id}/files       — Archivos vinculados (vista mínima, read-only).
    POST   /api/projects/{id}/files       — Añade archivos al puente (idempotente).
    DELETE /api/projects/{id}/files/{mf_id} — Quita un archivo del puente.

Export/Import (issue #136, sub-ticket 3/3):
    GET    /api/projects/{id}/export — ZIP (manifest.json + binarios de MinIO).
    POST   /api/projects/import      — (admin) Recrea un proyecto desde ese ZIP.
"""

import io
import json
import re
import uuid
import zipfile
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings as app_config
from app.database import get_db
from app.models.client_quote import ClientQuote
from app.models.model_file import ModelFile
from app.models.project import Project, project_model_files
from app.models.queue import PrintQueueItem
from app.models.user import User
from app.routers.queue import _build_responses_bulk
from app.routers.vault import _get_used_bytes, _resolve_tags, _source_content_type
from app.schemas.project import (
    ProjectCreate,
    ProjectFilesRequest,
    ProjectLinkedFile,
    ProjectResponse,
    ProjectUpdate,
    ProjectWithProgress,
)
from app.schemas.queue import PrintQueueItemResponse
from app.services.auth import get_admin_user, get_current_user, get_operator_user
from app.services.formatters import IMAGE_EXT_MAP, IMAGE_MAGIC_CHECKS
from app.services.vault_storage import download_file, upload_file

router = APIRouter(prefix="/api/projects", tags=["projects"])

_COVER_PREFIX = "projects"
MAX_COVER_BYTES = 10 * 1024 * 1024
_COVER_MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"}


async def _get_project(db: AsyncSession, project_id: int) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


async def _resolve_client_quote(db: AsyncSession, client_quote_id: Optional[int]):
    """Resuelve el código 'COT-XXXX' + client_name de la cotización vinculada.

    Devuelve (None, None) si no hay `client_quote_id` o si la cotización
    fue borrada mientras tanto (SET NULL corre recién en el próximo save).
    """
    if client_quote_id is None:
        return None, None
    result = await db.execute(select(ClientQuote).where(ClientQuote.id == client_quote_id))
    quote = result.scalar_one_or_none()
    if quote is None:
        return None, None
    return f"COT-{quote.id:04d}", quote.client_name


def _project_to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id, name=project.name, client_name=project.client_name,
        status=project.status, notes=project.notes,
        color=project.color, external_url=project.external_url,
        client_quote_id=project.client_quote_id,
        has_cover=project.cover_photo_key is not None,
        created_at=project.created_at, updated_at=project.updated_at,
    )


@router.get("/", response_model=List[ProjectWithProgress])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los proyectos con el conteo de items de cola por estado."""
    projects_result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = projects_result.scalars().all()

    counts_result = await db.execute(
        select(PrintQueueItem.project_id, PrintQueueItem.status, func.count())
        .where(PrintQueueItem.project_id.is_not(None))
        .group_by(PrintQueueItem.project_id, PrintQueueItem.status)
    )
    counts: dict = {}
    for project_id, item_status, count in counts_result.all():
        counts.setdefault(project_id, {}).__setitem__(item_status, count)

    quote_ids = {p.client_quote_id for p in projects if p.client_quote_id is not None}
    quotes_by_id = {}
    if quote_ids:
        quotes_result = await db.execute(select(ClientQuote).where(ClientQuote.id.in_(quote_ids)))
        quotes_by_id = {q.id: q for q in quotes_result.scalars().all()}

    responses = []
    for p in projects:
        by_status = counts.get(p.id, {})
        quote = quotes_by_id.get(p.client_quote_id) if p.client_quote_id else None
        responses.append(
            ProjectWithProgress(
                id=p.id, name=p.name, client_name=p.client_name, status=p.status,
                notes=p.notes, color=p.color, external_url=p.external_url,
                client_quote_id=p.client_quote_id, has_cover=p.cover_photo_key is not None,
                created_at=p.created_at, updated_at=p.updated_at,
                pending_count=by_status.get("pending", 0),
                printing_count=by_status.get("printing", 0),
                done_count=by_status.get("done", 0),
                cancelled_count=by_status.get("cancelled", 0),
                total_items=sum(by_status.values()),
                client_quote_code=f"COT-{quote.id:04d}" if quote else None,
                client_quote_client_name=quote.client_name if quote else None,
            )
        )
    return responses


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Crea un proyecto nuevo (status inicial 'active')."""
    if body.client_quote_id is not None:
        exists = await db.execute(select(ClientQuote.id).where(ClientQuote.id == body.client_quote_id))
        if exists.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Cotización de cliente no encontrada")

    project = Project(
        name=body.name.strip(),
        client_name=(body.client_name or "").strip() or None,
        notes=body.notes,
        color=body.color,
        external_url=body.external_url,
        client_quote_id=body.client_quote_id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.get("/{project_id}", response_model=ProjectWithProgress)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detalle de un proyecto con su conteo de items por estado."""
    project = await _get_project(db, project_id)
    counts_result = await db.execute(
        select(PrintQueueItem.status, func.count())
        .where(PrintQueueItem.project_id == project_id)
        .group_by(PrintQueueItem.status)
    )
    by_status = {s: c for s, c in counts_result.all()}
    quote_code, quote_client_name = await _resolve_client_quote(db, project.client_quote_id)
    return ProjectWithProgress(
        id=project.id, name=project.name, client_name=project.client_name,
        status=project.status, notes=project.notes,
        color=project.color, external_url=project.external_url,
        client_quote_id=project.client_quote_id, has_cover=project.cover_photo_key is not None,
        created_at=project.created_at, updated_at=project.updated_at,
        pending_count=by_status.get("pending", 0),
        printing_count=by_status.get("printing", 0),
        done_count=by_status.get("done", 0),
        cancelled_count=by_status.get("cancelled", 0),
        total_items=sum(by_status.values()),
        client_quote_code=quote_code,
        client_quote_client_name=quote_client_name,
    )


@router.get("/{project_id}/items", response_model=List[PrintQueueItemResponse])
async def list_project_items(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los ítems de cola (cualquier estado) asociados al proyecto."""
    await _get_project(db, project_id)  # 404 si no existe
    result = await db.execute(
        select(PrintQueueItem)
        .where(PrintQueueItem.project_id == project_id)
        .order_by(PrintQueueItem.position.asc())
    )
    items = result.scalars().all()
    return await _build_responses_bulk(items, db)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Edita nombre, cliente, estado, notas y/o metadata del proyecto."""
    project = await _get_project(db, project_id)
    update_data = body.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in ("active", "completed", "archived"):
        raise HTTPException(
            status_code=400,
            detail="status debe ser 'active', 'completed' o 'archived'",
        )
    if "client_quote_id" in update_data and update_data["client_quote_id"] is not None:
        exists = await db.execute(
            select(ClientQuote.id).where(ClientQuote.id == update_data["client_quote_id"])
        )
        if exists.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Cotización de cliente no encontrada")
    for field, value in update_data.items():
        setattr(project, field, value)
    project.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Elimina el proyecto. Los items de cola quedan sin agrupar (project_id=NULL)."""
    project = await _get_project(db, project_id)
    await db.delete(project)
    await db.commit()


# ─── Foto de portada (issue #136) ──────────────────────────────────────────

@router.post("/{project_id}/cover", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def upload_project_cover(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Sube/reemplaza la foto de portada del proyecto. Un solo archivo por
    proyecto (a diferencia de las fotos de modelo de #130, que son una
    colección) — mismo patrón de key que `ModelFile.thumbnail_key`:
    `projects/{id}/cover.{ext}`.
    """
    project = await _get_project(db, project_id)

    allowed_content_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_content_types:
        raise HTTPException(400, detail=f"Tipo de archivo no permitido: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_COVER_BYTES:
        raise HTTPException(413, detail="La imagen supera el límite de 10 MB")

    check = IMAGE_MAGIC_CHECKS.get(file.content_type)
    if not content or (check and not check(content)):
        raise HTTPException(400, detail="El archivo no es una imagen válida")

    extension = IMAGE_EXT_MAP.get(file.content_type, ".jpg")
    key = f"{_COVER_PREFIX}/{project_id}/cover{extension}"
    await upload_file(key, content, content_type=file.content_type)

    project.cover_photo_key = key
    project.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.get("/{project_id}/cover")
async def get_project_cover(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Sirve el binario de la foto de portada desde MinIO. Endpoint
    **público** (sin JWT) — mismo razonamiento que el thumbnail de Vault:
    los `<img>` tags no pueden enviar el header Authorization.
    """
    project = await _get_project(db, project_id)
    if not project.cover_photo_key:
        raise HTTPException(status_code=404, detail="Este proyecto no tiene foto de portada")
    try:
        data = await download_file(project.cover_photo_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404, detail="Foto de portada no disponible en almacenamiento"
        ) from exc

    ext = "." + project.cover_photo_key.rsplit(".", 1)[-1].lower() if "." in project.cover_photo_key else ".jpg"
    media_type = _COVER_MEDIA_TYPES.get(ext, "image/jpeg")
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})


# ─── Vínculo a Vault (issue #136, sub-ticket 2/3) ──────────────────────────

def _model_file_to_linked(model: ModelFile) -> ProjectLinkedFile:
    local_thumbnail_url = None
    if model.thumbnail_key:
        ts = model.updated_at.timestamp() if model.updated_at else 0
        local_thumbnail_url = f"/api/vault/{model.id}/thumbnail?v={ts}"
    return ProjectLinkedFile(
        id=model.id, name=model.name,
        local_thumbnail_url=local_thumbnail_url,
        is_print_ready=model.is_print_ready,
    )


@router.get("/{project_id}/files", response_model=List[ProjectLinkedFile])
async def list_project_files(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archivos de Vault vinculados al proyecto (vista mínima, read-only)."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.files))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return [_model_file_to_linked(f) for f in project.files]


@router.post("/{project_id}/files", response_model=List[ProjectLinkedFile])
async def add_project_files(
    project_id: int,
    body: ProjectFilesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Añade archivos al puente — idempotente (si ya estaba vinculado, se
    ignora sin error). 404 con los ids de `model_file_ids` que no
    existen en Vault.
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.files))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    files_result = await db.execute(
        select(ModelFile).where(ModelFile.id.in_(body.model_file_ids))
    )
    found = {f.id: f for f in files_result.scalars().all()}
    missing = [mf_id for mf_id in body.model_file_ids if mf_id not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Archivo(s) no encontrado(s) en Vault: {missing}")

    existing_ids = {f.id for f in project.files}
    for mf_id in body.model_file_ids:
        if mf_id not in existing_ids:
            project.files.append(found[mf_id])

    await db.commit()
    await db.refresh(project, attribute_names=["files"])
    return [_model_file_to_linked(f) for f in project.files]


@router.delete("/{project_id}/files/{model_file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_file(
    project_id: int,
    model_file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Quita un archivo del puente. No borra el `ModelFile` de Vault."""
    await db.execute(
        project_model_files.delete().where(
            project_model_files.c.project_id == project_id,
            project_model_files.c.model_file_id == model_file_id,
        )
    )
    await db.commit()


# ─── Export / Import (issue #136, sub-ticket 3/3) ──────────────────────────

MAX_IMPORT_ZIP_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB, límite del doc local


def _slugify(name: str) -> str:
    """ASCII-only, minúsculas, guiones — para el filename del ZIP exportado."""
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return slug or "proyecto"


@router.get("/{project_id}/export")
async def export_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exporta el proyecto a un ZIP: `manifest.json` (metadata del proyecto +
    de cada archivo vinculado) y los binarios de MinIO bajo
    `files/<idx>/source_<nombre>` / `files/<idx>/print_<nombre>`.

    NO exporta `cover_photo_key` ni `client_quote_id` (datos locales de
    esta instancia, sin sentido al reimportar en otro lado).
    """
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.files).selectinload(ModelFile.tags))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    manifest = {
        "version": 1,
        "project": {
            "name": project.name,
            "description": project.notes,
            "color": project.color,
            "external_url": project.external_url,
        },
        "files": [],
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, f in enumerate(project.files):
            entry = {
                "name": f.name,
                "description": f.description,
                "notes": f.notes,
                "tags": [t.name for t in f.tags],
                "source_file_name": None,
                "print_file_name": None,
            }
            if f.source_file_key:
                try:
                    data = await download_file(f.source_file_key)
                    zf.writestr(f"files/{idx}/source_{f.source_file_name}", data)
                    entry["source_file_name"] = f.source_file_name
                except Exception:
                    pass  # archivo ya no está en MinIO — se omite del export, no bloquea el resto
            if f.print_file_key:
                try:
                    data = await download_file(f.print_file_key)
                    zf.writestr(f"files/{idx}/print_{f.print_file_name}", data)
                    entry["print_file_name"] = f.print_file_name
                except Exception:
                    pass
            manifest["files"].append(entry)
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    zip_bytes = buf.getvalue()
    filename = f"project-{project.id}-{_slugify(project.name)}.zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Length": str(len(zip_bytes)),
        },
    )


@router.post("/import", response_model=ProjectWithProgress, status_code=status.HTTP_201_CREATED)
async def import_project(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Recrea un proyecto desde un ZIP exportado con `GET /{id}/export`.

    Si ya existe un proyecto con el mismo nombre, el importado se crea
    con sufijo " (importado)" — nunca sobreescribe uno existente. Los
    archivos se re-suben a MinIO con keys nuevas (no reusa las del
    proyecto original, que puede ser de otra instancia).
    """
    content = await file.read()
    if len(content) > MAX_IMPORT_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="El ZIP supera el límite de 2 GB")

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="El archivo no es un ZIP válido")

    try:
        manifest = json.loads(zf.read("manifest.json"))
    except KeyError:
        raise HTTPException(status_code=400, detail="El ZIP no contiene manifest.json")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="manifest.json no es JSON válido")

    if manifest.get("version") != 1:
        raise HTTPException(
            status_code=400,
            detail=f"Versión de manifest no soportada: {manifest.get('version')!r}",
        )

    file_entries = manifest.get("files") or []
    total_new_bytes = 0
    for idx, entry in enumerate(file_entries):
        for prefix, name_key in (("source", "source_file_name"), ("print", "print_file_name")):
            fname = entry.get(name_key)
            if fname:
                try:
                    total_new_bytes += len(zf.read(f"files/{idx}/{prefix}_{fname}"))
                except KeyError:
                    pass
    used = await _get_used_bytes(db)
    quota = app_config.VAULT_QUOTA_GB * 1024 * 1024 * 1024
    if used + total_new_bytes > quota:
        raise HTTPException(
            status_code=507,
            detail=f"Sin espacio disponible en el Vault. Cuota: {app_config.VAULT_QUOTA_GB} GB",
        )

    proj_data = manifest.get("project") or {}
    name = (proj_data.get("name") or "Proyecto importado").strip() or "Proyecto importado"
    existing = await db.execute(select(Project.id).where(Project.name == name))
    if existing.scalar_one_or_none() is not None:
        name = f"{name} (importado)"

    project = Project(
        name=name,
        notes=proj_data.get("description"),
        color=proj_data.get("color"),
        external_url=proj_data.get("external_url"),
    )
    db.add(project)
    await db.flush()  # id sin commitear, para poder poblar project.files

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for idx, entry in enumerate(file_entries):
        source_key = source_name = None
        print_key = print_name = None
        source_size = print_size = None

        if entry.get("source_file_name"):
            try:
                data = zf.read(f"files/{idx}/source_{entry['source_file_name']}")
                source_name = entry["source_file_name"]
                source_key = f"{uuid.uuid4()}-{source_name.replace(' ', '_')}"
                await upload_file(source_key, data, content_type=_source_content_type(source_name))
                source_size = len(data)
            except KeyError:
                pass
        if entry.get("print_file_name"):
            try:
                data = zf.read(f"files/{idx}/print_{entry['print_file_name']}")
                print_name = entry["print_file_name"]
                print_key = f"{uuid.uuid4()}-{print_name.replace(' ', '_')}"
                await upload_file(print_key, data, content_type="model/3mf")
                print_size = len(data)
            except KeyError:
                pass

        if source_key is None and print_key is None:
            continue  # entrada del manifest sin binarios recuperables — se omite

        resolved_tags = await _resolve_tags(db, entry.get("tags") or [])
        model = ModelFile(
            uploaded_by=current_user.id,
            source_file_key=source_key, source_file_name=source_name, source_file_size=source_size,
            print_file_key=print_key, print_file_name=print_name, print_file_size=print_size,
            name=entry.get("name") or source_name or print_name or "Modelo importado",
            description=entry.get("description"),
            notes=entry.get("notes"),
            tags=resolved_tags,
            created_at=now, updated_at=now,
        )
        db.add(model)
        await db.flush()
        project.files.append(model)

    await db.commit()

    counts_result = await db.execute(
        select(PrintQueueItem.status, func.count())
        .where(PrintQueueItem.project_id == project.id)
        .group_by(PrintQueueItem.status)
    )
    by_status = {s: c for s, c in counts_result.all()}
    return ProjectWithProgress(
        id=project.id, name=project.name, client_name=project.client_name,
        status=project.status, notes=project.notes,
        color=project.color, external_url=project.external_url,
        client_quote_id=project.client_quote_id, has_cover=project.cover_photo_key is not None,
        created_at=project.created_at, updated_at=project.updated_at,
        pending_count=by_status.get("pending", 0),
        printing_count=by_status.get("printing", 0),
        done_count=by_status.get("done", 0),
        cancelled_count=by_status.get("cancelled", 0),
        total_items=0,
        client_quote_code=None,
        client_quote_client_name=None,
    )
