"""
Modelos ORM para el sistema de notificaciones multi-canal (issue #137).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 — solo
el concepto de canal multi-provider + templates + digest; el modelo de datos
es propio de CFS (canal único de estudio, sin notificaciones per-user).

Define:
    NotificationChannel:     Canal configurado (telegram/discord/ntfy/email/webhook).
    NotificationTemplate:    Plantilla Liquid personalizada por evento (opcional).
    NotificationDigestQueue: Cola de eventos suprimidos en quiet hours, drenada
                              por el digest diario.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NotificationChannel(Base):
    """
    Canal de notificación configurado por el estudio.

    **Secrets en texto plano**: `config` (JSONB) guarda tokens/URLs/credenciales
    sin cifrar. CFS no tiene patrón de cifrado en reposo hoy y la base de datos
    es privada del estudio (no expuesta) — decisión consciente, no silenciosa,
    documentada aquí y en el issue #137. Si esto cambia, requiere migrar este
    campo a un esquema cifrado (ej. Fernet con clave en `SECRET_KEY`).

    Atributos:
        id:              PK autoincremental.
        type:             'telegram' | 'discord' | 'ntfy' | 'email' | 'webhook'.
        name:             Nombre descriptivo asignado por el usuario.
        config:           JSONB con los campos específicos del tipo (ver
                           `app/services/notifier.py` para el shape exacto
                           de cada provider).
        enabled:          Si el canal está activo.
        events:           JSONB lista de strings, eventos suscritos
                           (ver `NotificationEvent` en schemas/notification.py).
        defer_to_digest:  Si True, los eventos en quiet hours se encolan en
                           `notification_digest_queue` en vez de descartarse.
        created_at/updated_at: Timestamps UTC.
    """

    __tablename__ = "notification_channels"
    __table_args__ = (
        CheckConstraint(
            "type IN ('telegram', 'discord', 'ntfy', 'email', 'webhook')",
            name="ck_notification_channels_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    events: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    defer_to_digest: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class NotificationTemplate(Base):
    """
    Plantilla Liquid personalizada para un evento de notificación.

    Si no existe una fila para un evento, el dispatcher usa el template
    default hardcoded en `app/services/notifier.py` (`DEFAULT_TEMPLATES`).

    Atributos:
        id:      PK autoincremental.
        event:   Nombre del evento (único), ej. "queue.item_done".
        body:    Código Liquid del template.
        updated_at: Timestamp UTC de la última edición.
    """

    __tablename__ = "notification_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class NotificationDigestQueue(Base):
    """
    Cola de eventos suprimidos durante quiet hours, pendientes de digest.

    El loop de digest diario (`app/services/notifier.py::digest_loop`) drena
    estas filas por canal a la hora configurada (`AppSettings.digest_hour`) y
    las elimina tras enviarlas.

    Atributos:
        id:             PK autoincremental.
        channel_id:      FK a notification_channels.id (CASCADE).
        event:           Nombre del evento.
        rendered_text:   Texto ya renderizado (Liquid resuelto en el momento
                          del evento, no en el momento del digest).
        created_at:      Timestamp UTC de cuándo se generó el evento original.
    """

    __tablename__ = "notification_digest_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notification_channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    rendered_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
