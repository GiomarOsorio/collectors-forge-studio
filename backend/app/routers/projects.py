"""
Router de proyectos — agrupador de ítems de la cola de impresión.

Un `Project` agrupa varios `PrintQueueItem` (vía `project_id`) para llevar
el progreso de un encargo con varias impresiones. No afecta inventario ni
costos — es puramente organizativo.

Endpoints:
    GET    /api/projects/          — Lista proyectos con progreso agregado.
    POST   /api/projects/          — Crea un proyecto.
    GET    /api/projects/{id}      — Detalle + items de cola asociados.
    PUT    /api/projects/{id}      — Edita nombre/cliente/estado/notas.
    DELETE /api/projects/{id}      — Elimina el proyecto (items quedan sin agrupar).
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.queue import PrintQueueItem
from app.models.user import User
from app.routers.queue import _build_responses_bulk
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectWithProgress,
)
from app.schemas.queue import PrintQueueItemResponse
from app.services.auth import get_current_user, get_operator_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


async def _get_project(db: AsyncSession, project_id: int) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


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

    responses = []
    for p in projects:
        by_status = counts.get(p.id, {})
        responses.append(
            ProjectWithProgress(
                id=p.id, name=p.name, client_name=p.client_name, status=p.status,
                notes=p.notes, created_at=p.created_at, updated_at=p.updated_at,
                pending_count=by_status.get("pending", 0),
                printing_count=by_status.get("printing", 0),
                done_count=by_status.get("done", 0),
                cancelled_count=by_status.get("cancelled", 0),
                total_items=sum(by_status.values()),
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
    project = Project(
        name=body.name.strip(),
        client_name=(body.client_name or "").strip() or None,
        notes=body.notes,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


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
    return ProjectWithProgress(
        id=project.id, name=project.name, client_name=project.client_name,
        status=project.status, notes=project.notes,
        created_at=project.created_at, updated_at=project.updated_at,
        pending_count=by_status.get("pending", 0),
        printing_count=by_status.get("printing", 0),
        done_count=by_status.get("done", 0),
        cancelled_count=by_status.get("cancelled", 0),
        total_items=sum(by_status.values()),
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
    """Edita nombre, cliente, estado y/o notas del proyecto."""
    project = await _get_project(db, project_id)
    update_data = body.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in ("active", "completed", "archived"):
        raise HTTPException(
            status_code=400,
            detail="status debe ser 'active', 'completed' o 'archived'",
        )
    for field, value in update_data.items():
        setattr(project, field, value)
    project.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(project)
    return project


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
