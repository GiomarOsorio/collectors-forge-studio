"""
Dispatcher de notificaciones multi-canal (issue #137).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 — solo
el concepto de dispatcher multi-provider con templates y quiet hours; la
implementación es propia de CFS (asyncio en memoria, no Celery).

Uso desde un router, INLINE tras el commit de la operación que originó el
evento (nunca antes — el evento debe reflejar el estado ya persistido):

    from app.services.notifier import emit
    ...
    await db.commit()
    await db.refresh(item)
    emit("queue.item_done", {"piece_name": ..., "printer": ..., ...})

`emit()` es fire-and-forget: crea un `asyncio.Task` y retorna de inmediato.
Nunca puede reventar al llamador — toda excepción se traga y se loguea.
"""

import asyncio
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.notification import (
    NotificationChannel, NotificationDigestQueue, NotificationTemplate,
)
from app.models.settings import AppSettings

try:
    from liquid import Environment as LiquidEnvironment
    _LIQUID_AVAILABLE = True
except ImportError:
    _LIQUID_AVAILABLE = False

try:
    import aiosmtplib
    from email.message import EmailMessage
    _AIOSMTPLIB_AVAILABLE = True
except ImportError:
    _AIOSMTPLIB_AVAILABLE = False

logger = logging.getLogger(__name__)

BOGOTA = ZoneInfo("America/Bogota")

# ─── Matriz de eventos + templates default ─────────────────────────────────

DEFAULT_TEMPLATES = {
    "queue.item_done": (
        "✅ {{ piece_name }} terminó de imprimirse en {{ printer }} "
        "(x{{ quantity }}, {{ grams }}g, {{ hours }}h). Usuario: {{ user }}."
    ),
    "queue.item_cancelled": (
        "❌ {{ piece_name }} fue cancelado en {{ printer }}."
        "{% if failure_reason %} Razón: {{ failure_reason }}.{% endif %}"
    ),
    "inventory.low_stock": (
        "⚠️ Stock bajo: {{ item_name }} — quedan {{ quantity }}{{ unit }} "
        "(mínimo configurado: {{ min_quantity }}{{ unit }})."
    ),
    "inventory.spool_low": (
        "⚠️ Bobinas bajas de {{ spool_code }}: quedan {{ remaining_g }}g en total."
    ),
    "maintenance.due": (
        "🔧 Mantenimiento pendiente en {{ printer }}: {{ task_name }} "
        "({{ progress_pct }}% del intervalo)."
    ),
    "purchase_order.status_changed": (
        "📦 Orden de compra {{ po_code }} cambió a estado '{{ status }}'"
        "{% if supplier %} (proveedor: {{ supplier }}){% endif %}."
    ),
    "client_quote.created": (
        "🧾 Nueva cotización {{ quote_code }} para {{ client_name }} — total {{ total }}."
    ),
}

# Payloads de muestra para preview/validación de templates y para el botón "Probar".
SAMPLE_PAYLOADS = {
    "queue.item_done": {
        "piece_name": "Figura de ejemplo", "printer": "P2S #1",
        "quantity": 2, "grams": 45.5, "hours": 3.2, "user": "admin",
    },
    "queue.item_cancelled": {
        "piece_name": "Figura de ejemplo", "printer": "P2S #1",
        "failure_reason": "Despegue de cama",
    },
    "inventory.low_stock": {
        "item_name": "PLA Negro 1kg", "quantity": 150, "min_quantity": 200, "unit": "g",
    },
    "inventory.spool_low": {"spool_code": "PETG Blanco", "remaining_g": 180},
    "maintenance.due": {"printer": "P2S #1", "task_name": "Lubricar ejes XY", "progress_pct": 92.5},
    "purchase_order.status_changed": {"po_code": "OC-0012", "status": "llegado", "supplier": "Proveedor X"},
    "client_quote.created": {"quote_code": "COT-0042", "client_name": "Ana Gómez", "total": "$ 350.000"},
}


# ─── Quiet hours ────────────────────────────────────────────────────────────

def _in_quiet_hours(settings: Optional[AppSettings]) -> bool:
    """True si `now` (America/Bogota) cae dentro del rango quiet hours configurado."""
    if not settings or not settings.quiet_hours_start or not settings.quiet_hours_end:
        return False
    now_hhmm = datetime.now(BOGOTA).strftime("%H:%M")
    start, end = settings.quiet_hours_start, settings.quiet_hours_end
    if start <= end:
        return start <= now_hhmm < end
    # Rango que cruza medianoche, ej. 22:00–07:00
    return now_hhmm >= start or now_hhmm < end


# ─── Templates ──────────────────────────────────────────────────────────────

def render_template(body: str, payload: dict) -> str:
    """Renderiza un template Liquid con el payload de un evento. Puede lanzar excepción."""
    if not _LIQUID_AVAILABLE:
        raise RuntimeError("python-liquid no está instalado")
    env = LiquidEnvironment()
    tpl = env.from_string(body)
    return tpl.render(**payload)


def validate_template(body: str, event: str) -> dict:
    """
    Valida sintaxis y renderizado de un template contra el payload de
    muestra del evento. Usado por PUT /templates/{event} y por el preview.
    """
    sample = SAMPLE_PAYLOADS.get(event, {})
    try:
        rendered = render_template(body, sample)
        return {"ok": True, "rendered": rendered, "error": None}
    except Exception as exc:
        return {"ok": False, "rendered": None, "error": str(exc)}


async def _render_for_event(db, event: str, payload: dict) -> str:
    result = await db.execute(
        select(NotificationTemplate).where(NotificationTemplate.event == event)
    )
    row = result.scalar_one_or_none()
    body = row.body if row else DEFAULT_TEMPLATES.get(event, "{{ event }}")
    return render_template(body, {**payload, "event": event})


# ─── Providers ──────────────────────────────────────────────────────────────

async def _send_telegram(config: dict, text: str) -> None:
    url = f"https://api.telegram.org/bot{config['bot_token']}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json={
            "chat_id": config["chat_id"], "text": text, "parse_mode": "HTML",
        })
        resp.raise_for_status()


async def _send_discord(config: dict, text: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(config["webhook_url"], json={"content": text})
        resp.raise_for_status()


async def _send_ntfy(config: dict, text: str) -> None:
    server = (config.get("server") or "https://ntfy.sh").rstrip("/")
    url = f"{server}/{config['topic']}"
    headers = {}
    if config.get("priority"):
        headers["Priority"] = str(config["priority"])
    if config.get("token"):
        headers["Authorization"] = f"Bearer {config['token']}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, content=text.encode("utf-8"), headers=headers)
        resp.raise_for_status()


async def _send_email(config: dict, text: str, event: str, settings: Optional[AppSettings]) -> None:
    if not _AIOSMTPLIB_AVAILABLE:
        raise RuntimeError("aiosmtplib no está instalado")
    if not settings or not settings.smtp_host:
        raise RuntimeError("SMTP no está configurado (Settings → Notificaciones)")
    recipients = config.get("recipients") or []
    if not recipients:
        raise RuntimeError("Canal email sin destinatarios configurados")

    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user or "cfs@localhost"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = f"CFS — {event}"
    msg.set_content(text)

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port or 587,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=bool(settings.smtp_tls),
        timeout=10,
    )


async def _send_webhook(config: dict, text: str, event: str, payload: dict) -> None:
    body = {"event": event, "payload": payload, "timestamp": datetime.now(timezone.utc).isoformat()}
    headers = {}
    secret = config.get("secret")
    if secret:
        import json
        raw = json.dumps(body, sort_keys=True).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
        headers["X-CFS-Signature"] = signature
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(config["url"], json=body, headers=headers)
        resp.raise_for_status()


_PROVIDERS = {
    "telegram": lambda config, text, event, payload, settings: _send_telegram(config, text),
    "discord": lambda config, text, event, payload, settings: _send_discord(config, text),
    "ntfy": lambda config, text, event, payload, settings: _send_ntfy(config, text),
    "email": lambda config, text, event, payload, settings: _send_email(config, text, event, settings),
    "webhook": lambda config, text, event, payload, settings: _send_webhook(config, text, event, payload),
}


async def _send(channel: NotificationChannel, text: str, event: str, payload: dict, settings: Optional[AppSettings]) -> None:
    provider = _PROVIDERS.get(channel.type)
    if provider is None:
        raise RuntimeError(f"Tipo de canal desconocido: {channel.type}")
    await provider(channel.config or {}, text, event, payload, settings)


async def _send_with_retry(channel: NotificationChannel, text: str, event: str, payload: dict, settings: Optional[AppSettings]) -> None:
    """Un reintento con backoff de 5s. Excepción final se propaga al caller (que la loguea)."""
    try:
        await _send(channel, text, event, payload, settings)
    except Exception:
        await asyncio.sleep(5)
        await _send(channel, text, event, payload, settings)


async def test_channel(channel: NotificationChannel, db) -> dict:
    """Envía un mensaje de prueba real de forma síncrona (para feedback inmediato en la UI)."""
    settings_result = await db.execute(select(AppSettings).limit(1))
    settings = settings_result.scalar_one_or_none()
    try:
        await _send(channel, "Mensaje de prueba de CFS 🔧", "test", {}, settings)
        return {"ok": True, "error": None}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ─── Dispatch principal ─────────────────────────────────────────────────────

async def _dispatch_one(db, channel: NotificationChannel, event: str, payload: dict, settings: Optional[AppSettings], quiet: bool) -> None:
    try:
        text = await _render_for_event(db, event, payload)
    except Exception as exc:
        logger.error("Render de template falló (canal=%s, evento=%s): %s", channel.id, event, exc)
        return

    if quiet:
        if channel.defer_to_digest:
            db.add(NotificationDigestQueue(channel_id=channel.id, event=event, rendered_text=text))
            await db.commit()
        return

    try:
        await _send_with_retry(channel, text, event, payload, settings)
    except Exception as exc:
        logger.warning("Notificación falló (canal=%s, evento=%s) tras reintento: %s", channel.id, event, exc)


async def _emit_async(event: str, payload: dict) -> None:
    try:
        async with async_session() as db:
            settings_result = await db.execute(select(AppSettings).limit(1))
            settings = settings_result.scalar_one_or_none()
            quiet = _in_quiet_hours(settings)
            result = await db.execute(
                select(NotificationChannel).where(NotificationChannel.enabled.is_(True))
            )
            for channel in result.scalars().all():
                if event in (channel.events or []):
                    await _dispatch_one(db, channel, event, payload, settings, quiet)
    except Exception:
        logger.exception("emit() falló al procesar evento %s", event)


def emit(event: str, payload: dict) -> None:
    """
    Dispara un evento de notificación de forma fire-and-forget.

    Nunca bloquea ni puede reventar al llamador. Si no hay un event loop
    corriendo (ej. contexto síncrono en tests), es un no-op silencioso.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        logger.debug("emit(%s) omitido: no hay event loop corriendo", event)
        return
    asyncio.create_task(_emit_async(event, payload))


# ─── Digest diario ──────────────────────────────────────────────────────────

async def _drain_digest(db) -> None:
    result = await db.execute(select(NotificationDigestQueue))
    rows = result.scalars().all()
    if not rows:
        return

    by_channel: dict = {}
    for row in rows:
        by_channel.setdefault(row.channel_id, []).append(row)

    channels_result = await db.execute(
        select(NotificationChannel).where(NotificationChannel.id.in_(by_channel.keys()))
    )
    channels_by_id = {c.id: c for c in channels_result.scalars().all()}
    settings_result = await db.execute(select(AppSettings).limit(1))
    settings = settings_result.scalar_one_or_none()

    for channel_id, items in by_channel.items():
        channel = channels_by_id.get(channel_id)
        if channel is not None and channel.enabled:
            digest_text = "Resumen diario de notificaciones CFS:\n\n" + "\n".join(
                f"- {item.rendered_text}" for item in items
            )
            try:
                await _send_with_retry(channel, digest_text, "digest", {}, settings)
            except Exception:
                logger.warning("Digest falló para canal=%s tras reintento", channel_id)
        for item in items:
            await db.delete(item)
    await db.commit()


def _seconds_until_next_hour() -> float:
    now = datetime.now(timezone.utc)
    next_hour = (now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
    return max(1.0, (next_hour - now).total_seconds())


async def digest_loop() -> None:
    """Tarea de fondo: cada hora en punto, si coincide con `digest_hour`, drena la cola."""
    while True:
        try:
            await asyncio.sleep(_seconds_until_next_hour())
            async with async_session() as db:
                settings_result = await db.execute(select(AppSettings).limit(1))
                settings = settings_result.scalar_one_or_none()
                if not settings or settings.digest_hour is None:
                    continue
                if datetime.now(BOGOTA).hour != settings.digest_hour:
                    continue
                await _drain_digest(db)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("digest_loop falló")


# ─── Chequeo periódico de mantenimiento vencido ─────────────────────────────

async def _check_maintenance_due(db) -> None:
    # Import local para evitar acoplar el arranque del módulo al router de
    # mantenimiento (misma técnica de reuso de helper privado usada en #136).
    from app.models.maintenance_schedule import MaintenanceSchedule
    from app.routers.maintenance import _compute_progress

    result = await db.execute(
        select(MaintenanceSchedule)
        .options(selectinload(MaintenanceSchedule.printer))
        .where(MaintenanceSchedule.enabled.is_(True))
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for schedule in result.scalars().all():
        progress_pct, sched_status = _compute_progress(schedule)
        if sched_status == "ok":
            continue
        if schedule.last_notified_at is not None and (now - schedule.last_notified_at) < timedelta(days=7):
            continue
        emit("maintenance.due", {
            "printer": schedule.printer.name if schedule.printer else "",
            "task_name": schedule.task_name,
            "progress_pct": float(progress_pct),
        })
        schedule.last_notified_at = now
    await db.commit()


async def maintenance_due_loop() -> None:
    """Tarea de fondo: revisa cada hora si hay recordatorios vencidos sin notificar."""
    while True:
        try:
            await asyncio.sleep(3600)
            async with async_session() as db:
                await _check_maintenance_due(db)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("maintenance_due_loop falló")
