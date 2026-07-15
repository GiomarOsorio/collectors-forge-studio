"""
Esquemas Pydantic para el sistema de notificaciones multi-canal (issue #137).

Config por tipo de canal (discriminado por `type` en el request; el response
siempre expone `config` como dict libre):
    telegram: {bot_token, chat_id}
    discord:  {webhook_url}
    ntfy:     {server, topic, priority?, token?}
    email:    {recipients: [str, ...]}
    webhook:  {url, secret?}
"""

from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

ChannelType = Literal["telegram", "discord", "ntfy", "email", "webhook"]

NOTIFICATION_EVENTS = [
    "queue.item_done",
    "queue.item_cancelled",
    "inventory.low_stock",
    "inventory.spool_low",
    "maintenance.due",
    "purchase_order.status_changed",
    "client_quote.created",
]


class TelegramConfig(BaseModel):
    bot_token: str
    chat_id: str


class DiscordConfig(BaseModel):
    webhook_url: str


class NtfyConfig(BaseModel):
    server: str = "https://ntfy.sh"
    topic: str
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    token: Optional[str] = None


class EmailChannelConfig(BaseModel):
    recipients: List[str] = Field(default_factory=list)


class WebhookConfig(BaseModel):
    url: str
    secret: Optional[str] = None


_CONFIG_BY_TYPE = {
    "telegram": TelegramConfig,
    "discord": DiscordConfig,
    "ntfy": NtfyConfig,
    "email": EmailChannelConfig,
    "webhook": WebhookConfig,
}


def _validate_events(events: List[str]) -> List[str]:
    invalid = [e for e in events if e not in NOTIFICATION_EVENTS]
    if invalid:
        raise ValueError(f"Eventos desconocidos: {invalid}")
    return events


class NotificationChannelCreate(BaseModel):
    type: ChannelType
    name: str = Field(min_length=1, max_length=100)
    config: dict
    enabled: bool = True
    events: List[str] = Field(default_factory=list)
    defer_to_digest: bool = False

    @field_validator("events")
    @classmethod
    def _check_events(cls, v):
        return _validate_events(v)

    @field_validator("config")
    @classmethod
    def _check_config(cls, v, info):
        channel_type = info.data.get("type")
        schema_cls = _CONFIG_BY_TYPE.get(channel_type)
        if schema_cls is None:
            raise ValueError(f"Tipo de canal desconocido: {channel_type}")
        # Valida la forma del config según el tipo; retorna el dict validado.
        return schema_cls.model_validate(v).model_dump()


class NotificationChannelUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    config: Optional[dict] = None
    enabled: Optional[bool] = None
    events: Optional[List[str]] = None
    defer_to_digest: Optional[bool] = None

    @field_validator("events")
    @classmethod
    def _check_events(cls, v):
        if v is None:
            return v
        return _validate_events(v)


class NotificationChannelResponse(BaseModel):
    id: int
    type: ChannelType
    name: str
    config: dict
    enabled: bool
    events: List[str]
    defer_to_digest: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChannelTestResponse(BaseModel):
    ok: bool
    error: Optional[str] = None


class NotificationTemplateResponse(BaseModel):
    event: str
    body: str
    is_default: bool

    model_config = {"from_attributes": True}


class NotificationTemplateUpdate(BaseModel):
    body: str = Field(min_length=1)


class TemplatePreviewRequest(BaseModel):
    body: str = Field(min_length=1)


class TemplatePreviewResponse(BaseModel):
    ok: bool
    rendered: Optional[str] = None
    error: Optional[str] = None
