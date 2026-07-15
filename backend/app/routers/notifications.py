"""
Router de notificaciones multi-canal para Collector's Forge Studio (issue #137).

Todo el módulo es admin-only: notificaciones es una configuración de
infraestructura del estudio, no un dato operativo de uso diario.

Endpoints:
    GET/POST/PUT/DELETE /api/notifications/channels          — CRUD de canales.
    POST   /api/notifications/channels/{id}/test              — Envía mensaje de prueba real.
    GET/PUT /api/notifications/templates/{event}               — Template Liquid por evento.
    POST   /api/notifications/templates/{event}/preview        — Preview con datos dummy.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import NotificationChannel, NotificationTemplate
from app.models.user import User
from app.schemas.notification import (
    NOTIFICATION_EVENTS,
    ChannelTestResponse,
    NotificationChannelCreate,
    NotificationChannelResponse,
    NotificationChannelUpdate,
    NotificationTemplateResponse,
    NotificationTemplateUpdate,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    _CONFIG_BY_TYPE,
)
from app.services.auth import get_admin_user
from app.services.notifier import DEFAULT_TEMPLATES, test_channel, validate_template

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def _get_channel(db: AsyncSession, channel_id: int) -> NotificationChannel:
    result = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    return channel


@router.get("/events", response_model=List[str])
async def list_events(current_user: User = Depends(get_admin_user)):
    """Lista la matriz de eventos disponibles para suscribir canales."""
    return NOTIFICATION_EVENTS


@router.get("/channels", response_model=List[NotificationChannelResponse])
async def list_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(NotificationChannel).order_by(NotificationChannel.created_at.desc()))
    return result.scalars().all()


@router.post("/channels", response_model=NotificationChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    data: NotificationChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    channel = NotificationChannel(
        type=data.type, name=data.name, config=data.config,
        enabled=data.enabled, events=data.events, defer_to_digest=data.defer_to_digest,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return channel


@router.put("/channels/{channel_id}", response_model=NotificationChannelResponse)
async def update_channel(
    channel_id: int,
    data: NotificationChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    channel = await _get_channel(db, channel_id)
    updates = data.model_dump(exclude_unset=True)
    if "config" in updates and updates["config"] is not None:
        schema_cls = _CONFIG_BY_TYPE.get(channel.type)
        if schema_cls is not None:
            updates["config"] = schema_cls.model_validate(updates["config"]).model_dump()
    for field, value in updates.items():
        setattr(channel, field, value)
    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    channel = await _get_channel(db, channel_id)
    await db.delete(channel)
    await db.commit()


@router.post("/channels/{channel_id}/test", response_model=ChannelTestResponse)
async def test_channel_endpoint(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    channel = await _get_channel(db, channel_id)
    return await test_channel(channel, db)


@router.get("/templates/{event}", response_model=NotificationTemplateResponse)
async def get_template(
    event: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    if event not in NOTIFICATION_EVENTS:
        raise HTTPException(status_code=404, detail="Evento desconocido")
    result = await db.execute(select(NotificationTemplate).where(NotificationTemplate.event == event))
    row = result.scalar_one_or_none()
    if row is not None:
        return NotificationTemplateResponse(event=event, body=row.body, is_default=False)
    return NotificationTemplateResponse(event=event, body=DEFAULT_TEMPLATES.get(event, ""), is_default=True)


@router.put("/templates/{event}", response_model=NotificationTemplateResponse)
async def update_template(
    event: str,
    data: NotificationTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    if event not in NOTIFICATION_EVENTS:
        raise HTTPException(status_code=404, detail="Evento desconocido")
    validation = validate_template(data.body, event)
    if not validation["ok"]:
        raise HTTPException(status_code=400, detail=f"Template inválido: {validation['error']}")

    result = await db.execute(select(NotificationTemplate).where(NotificationTemplate.event == event))
    row = result.scalar_one_or_none()
    if row is None:
        row = NotificationTemplate(event=event, body=data.body)
        db.add(row)
    else:
        row.body = data.body
    await db.commit()
    await db.refresh(row)
    return NotificationTemplateResponse(event=event, body=row.body, is_default=False)


@router.post("/templates/{event}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    event: str,
    data: TemplatePreviewRequest,
    current_user: User = Depends(get_admin_user),
):
    if event not in NOTIFICATION_EVENTS:
        raise HTTPException(status_code=404, detail="Evento desconocido")
    result = validate_template(data.body, event)
    return TemplatePreviewResponse(**result)
