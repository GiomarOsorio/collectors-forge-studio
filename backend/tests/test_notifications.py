"""
Tests para el sistema de notificaciones multi-canal (issue #137).

Cuatro bloques:
1. Dispatcher (`app/services/notifier.py`) — providers con httpx mockeado,
   retry en fallo, excepción tragada, firma HMAC de webhooks.
2. Quiet hours — cruce de medianoche incluido.
3. Templates — render de cada default con su payload de muestra, validación
   de sintaxis inválida.
4. Endpoints CRUD de `routers/notifications.py` vía HTTP con DB mockeada.
"""

import hashlib
import hmac
import json
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.notification import NotificationChannel
from app.services import notifier
from app.services.auth import get_current_user

BOGOTA = ZoneInfo("America/Bogota")


def _fake_user(role="admin"):
    u = MagicMock()
    u.id = 1
    u.username = "testadmin"
    u.role = role
    u.is_active = True
    return u


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


def _fake_db(session):
    async def _gen():
        yield session
    return _gen


def _fake_channel(channel_type="ntfy", config=None, events=None):
    c = MagicMock(spec=NotificationChannel)
    c.id = 1
    c.type = channel_type
    c.name = "Canal de prueba"
    c.config = config or {"server": "https://ntfy.sh", "topic": "cfs-test"}
    c.enabled = True
    c.events = events or ["queue.item_done"]
    c.defer_to_digest = False
    return c


class _FakeAsyncClient:
    """Reemplaza httpx.AsyncClient para no golpear red real en tests."""

    calls = []
    fail_times = 0

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, **kwargs):
        _FakeAsyncClient.calls.append({"url": url, **kwargs})
        if _FakeAsyncClient.fail_times > 0:
            _FakeAsyncClient.fail_times -= 1
            raise RuntimeError("Fallo de red simulado")
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        return resp


@pytest.fixture(autouse=True)
def _reset_fake_client():
    _FakeAsyncClient.calls = []
    _FakeAsyncClient.fail_times = 0
    yield


# ---------------------------------------------------------------------------
# 1. Providers + retry + excepción tragada
# ---------------------------------------------------------------------------

class TestProviders:
    async def test_telegram_envia_post_correcto(self):
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._send_telegram({"bot_token": "T", "chat_id": "123"}, "hola")
        assert len(_FakeAsyncClient.calls) == 1
        call = _FakeAsyncClient.calls[0]
        assert call["url"] == "https://api.telegram.org/botT/sendMessage"
        assert call["json"]["chat_id"] == "123"
        assert call["json"]["text"] == "hola"

    async def test_discord_envia_content(self):
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._send_discord({"webhook_url": "https://discord.example/hook"}, "texto")
        assert _FakeAsyncClient.calls[0]["json"] == {"content": "texto"}

    async def test_ntfy_envia_body_y_headers(self):
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._send_ntfy(
                {"server": "https://ntfy.sh", "topic": "cfs", "priority": 4, "token": "abc"},
                "aviso",
            )
        call = _FakeAsyncClient.calls[0]
        assert call["url"] == "https://ntfy.sh/cfs"
        assert call["content"] == b"aviso"
        assert call["headers"]["Priority"] == "4"
        assert call["headers"]["Authorization"] == "Bearer abc"

    async def test_webhook_firma_hmac_correcta(self):
        secret = "s3cr3t"
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._send_webhook(
                {"url": "https://example.com/hook", "secret": secret},
                "texto", "queue.item_done", {"piece_name": "X"},
            )
        call = _FakeAsyncClient.calls[0]
        sent_body = call["json"]
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            json.dumps(sent_body, sort_keys=True).encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        assert call["headers"]["X-CFS-Signature"] == expected_sig
        assert sent_body["event"] == "queue.item_done"
        assert sent_body["payload"] == {"piece_name": "X"}

    async def test_webhook_sin_secret_no_firma(self):
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._send_webhook(
                {"url": "https://example.com/hook"}, "texto", "queue.item_done", {},
            )
        assert "X-CFS-Signature" not in _FakeAsyncClient.calls[0]["headers"]

    async def test_send_with_retry_reintenta_una_vez_y_luego_funciona(self):
        _FakeAsyncClient.fail_times = 1
        channel = _fake_channel()
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient), \
             patch("app.services.notifier.asyncio.sleep", AsyncMock()):
            await notifier._send_with_retry(channel, "texto", "queue.item_done", {}, None)
        assert len(_FakeAsyncClient.calls) == 2  # falló 1x, reintentó y funcionó

    async def test_send_with_retry_falla_tras_reintento_propaga(self):
        _FakeAsyncClient.fail_times = 2
        channel = _fake_channel()
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient), \
             patch("app.services.notifier.asyncio.sleep", AsyncMock()):
            with pytest.raises(RuntimeError):
                await notifier._send_with_retry(channel, "texto", "queue.item_done", {}, None)

    async def test_dispatch_one_traga_excepcion_no_bloquea(self):
        """Criterio #3: fallo del provider no debe propagar — _dispatch_one nunca lanza."""
        channel = _fake_channel(config={"url": "no-existe"})
        channel.type = "webhook"
        db = AsyncMock()
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient), \
             patch("app.services.notifier.asyncio.sleep", AsyncMock()):
            _FakeAsyncClient.fail_times = 99
            # No debe lanzar excepción — se traga y se loguea.
            await notifier._dispatch_one(db, channel, "queue.item_done", {"piece_name": "X"}, None, quiet=False)

    async def test_emit_async_con_db_rota_no_revienta(self):
        """Non-regresión: emit() nunca puede reventar al caller ni siquiera si la sesión falla."""
        broken_session_factory = MagicMock(side_effect=RuntimeError("DB caída"))
        with patch("app.services.notifier.async_session", broken_session_factory):
            await notifier._emit_async("queue.item_done", {"piece_name": "X"})  # no debe lanzar

    async def test_send_email_sin_smtp_configurado_lanza(self):
        settings = MagicMock(smtp_host=None)
        with pytest.raises(RuntimeError, match="SMTP"):
            await notifier._send_email({"recipients": ["a@b.com"]}, "texto", "queue.item_done", settings)

    async def test_send_email_sin_destinatarios_lanza(self):
        settings = MagicMock(smtp_host="smtp.example.com")
        with pytest.raises(RuntimeError, match="destinatarios"):
            await notifier._send_email({"recipients": []}, "texto", "queue.item_done", settings)

    async def test_send_email_ok(self):
        settings = MagicMock(
            smtp_host="smtp.example.com", smtp_port=587, smtp_user="u", smtp_password="p",
            smtp_from="cfs@estudio.com", smtp_tls=True,
        )
        fake_send = AsyncMock()
        with patch("app.services.notifier.aiosmtplib.send", fake_send):
            await notifier._send_email({"recipients": ["a@b.com"]}, "texto", "queue.item_done", settings)
        assert fake_send.await_count == 1
        _, kwargs = fake_send.await_args
        assert kwargs["hostname"] == "smtp.example.com"

    async def test_dispatch_one_en_quiet_hours_con_defer_encola_digest(self):
        channel = _fake_channel()
        channel.defer_to_digest = True
        db = AsyncMock()
        template_result = MagicMock()
        template_result.scalar_one_or_none.return_value = None
        db.execute.return_value = template_result
        await notifier._dispatch_one(db, channel, "queue.item_done", notifier.SAMPLE_PAYLOADS["queue.item_done"], None, quiet=True)
        assert db.add.call_count == 1
        assert db.commit.await_count == 1

    async def test_dispatch_one_en_quiet_hours_sin_defer_no_envia_ni_encola(self):
        channel = _fake_channel()
        channel.defer_to_digest = False
        db = AsyncMock()
        template_result = MagicMock()
        template_result.scalar_one_or_none.return_value = None
        db.execute.return_value = template_result
        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._dispatch_one(db, channel, "queue.item_done", notifier.SAMPLE_PAYLOADS["queue.item_done"], None, quiet=True)
        assert db.add.call_count == 0
        assert len(_FakeAsyncClient.calls) == 0

    async def test_drain_digest_envia_resumen_y_borra_filas(self):
        channel = _fake_channel()
        item1 = MagicMock(channel_id=1, rendered_text="Evento A")
        item2 = MagicMock(channel_id=1, rendered_text="Evento B")

        db = AsyncMock()
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = [item1, item2]
        channels_result = MagicMock()
        channels_result.scalars.return_value.all.return_value = [channel]
        settings_result = MagicMock()
        settings_result.scalar_one_or_none.return_value = None
        db.execute.side_effect = [rows_result, channels_result, settings_result]

        with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
            await notifier._drain_digest(db)

        assert len(_FakeAsyncClient.calls) == 1
        assert "Evento A" in _FakeAsyncClient.calls[0]["content"].decode()
        assert db.delete.await_count == 2
        assert db.commit.await_count == 1

    async def test_drain_digest_sin_filas_no_hace_nada(self):
        db = AsyncMock()
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = []
        db.execute.return_value = rows_result
        await notifier._drain_digest(db)
        assert db.commit.await_count == 0

    async def test_check_maintenance_due_emite_y_marca_notified(self):
        schedule = MagicMock()
        schedule.task_name = "Lubricar ejes XY"
        schedule.printer = MagicMock(name="P2S")
        schedule.last_notified_at = None

        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [schedule]
        db.execute.return_value = result

        with patch("app.routers.maintenance._compute_progress", return_value=(Decimal("92.5"), "due_soon")), \
             patch("app.services.notifier.emit") as mock_emit:
            await notifier._check_maintenance_due(db)

        mock_emit.assert_called_once()
        assert mock_emit.call_args[0][0] == "maintenance.due"
        assert schedule.last_notified_at is not None
        assert db.commit.await_count == 1

    async def test_check_maintenance_due_omite_si_ok_o_notificado_reciente(self):
        schedule_ok = MagicMock(last_notified_at=None)
        schedule_reciente = MagicMock(last_notified_at=notifier.datetime.now())

        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [schedule_ok, schedule_reciente]
        db.execute.return_value = result

        with patch(
            "app.routers.maintenance._compute_progress",
            side_effect=[(Decimal("0"), "ok"), (Decimal("120"), "overdue")],
        ), patch("app.services.notifier.emit") as mock_emit:
            await notifier._check_maintenance_due(db)

        mock_emit.assert_not_called()


# ---------------------------------------------------------------------------
# 2. Quiet hours
# ---------------------------------------------------------------------------

class TestQuietHours:
    def test_sin_configurar_nunca_es_quiet(self):
        settings = MagicMock(quiet_hours_start=None, quiet_hours_end=None)
        assert notifier._in_quiet_hours(settings) is False

    def test_rango_normal_dentro(self):
        settings = MagicMock(quiet_hours_start="08:00", quiet_hours_end="18:00")
        fixed_now = datetime(2026, 7, 14, 12, 0, tzinfo=BOGOTA)
        with patch("app.services.notifier.datetime") as mock_dt:
            mock_dt.now.return_value = fixed_now
            assert notifier._in_quiet_hours(settings) is True

    def test_rango_cruza_medianoche_dentro(self):
        """22:00–07:00: las 23:30 SÍ están en quiet hours."""
        settings = MagicMock(quiet_hours_start="22:00", quiet_hours_end="07:00")
        fixed_now = datetime(2026, 7, 14, 23, 30, tzinfo=BOGOTA)
        with patch("app.services.notifier.datetime") as mock_dt:
            mock_dt.now.return_value = fixed_now
            assert notifier._in_quiet_hours(settings) is True

    def test_rango_cruza_medianoche_fuera(self):
        """22:00–07:00: las 12:00 NO están en quiet hours."""
        settings = MagicMock(quiet_hours_start="22:00", quiet_hours_end="07:00")
        fixed_now = datetime(2026, 7, 14, 12, 0, tzinfo=BOGOTA)
        with patch("app.services.notifier.datetime") as mock_dt:
            mock_dt.now.return_value = fixed_now
            assert notifier._in_quiet_hours(settings) is False


# ---------------------------------------------------------------------------
# 3. Templates
# ---------------------------------------------------------------------------

class TestTemplates:
    @pytest.mark.parametrize("event", list(notifier.DEFAULT_TEMPLATES.keys()))
    def test_default_renderiza_con_payload_de_muestra(self, event):
        body = notifier.DEFAULT_TEMPLATES[event]
        sample = notifier.SAMPLE_PAYLOADS[event]
        rendered = notifier.render_template(body, sample)
        assert rendered  # no vacío, no excepción

    def test_validate_template_sintaxis_invalida(self):
        result = notifier.validate_template("{{ unclosed", "queue.item_done")
        assert result["ok"] is False
        assert result["error"]

    def test_validate_template_ok(self):
        result = notifier.validate_template("{{ piece_name }}", "queue.item_done")
        assert result["ok"] is True
        assert result["rendered"] == "Figura de ejemplo"


# ---------------------------------------------------------------------------
# 4. Endpoints CRUD
# ---------------------------------------------------------------------------

class TestChannelEndpoints:
    async def test_crear_canal_ntfy_valido_201(self):
        db = AsyncMock()

        async def _refresh(obj):
            obj.id = 1
            obj.created_at = datetime(2026, 7, 14)
            obj.updated_at = datetime(2026, 7, 14)

        db.refresh.side_effect = _refresh
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/notifications/channels", json={
                    "type": "ntfy",
                    "name": "Mi ntfy",
                    "config": {"server": "https://ntfy.sh", "topic": "cfs"},
                    "events": ["queue.item_done"],
                })
            assert resp.status_code == 201
            body = resp.json()
            assert body["type"] == "ntfy"
            assert body["config"]["topic"] == "cfs"
        finally:
            _clear_overrides()

    async def test_crear_canal_config_invalida_422(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/notifications/channels", json={
                    "type": "telegram",
                    "name": "Falta token",
                    "config": {"chat_id": "123"},  # falta bot_token
                    "events": [],
                })
            assert resp.status_code == 422
        finally:
            _clear_overrides()

    async def test_crear_canal_evento_desconocido_422(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/notifications/channels", json={
                    "type": "discord",
                    "name": "X",
                    "config": {"webhook_url": "https://discord.example/hook"},
                    "events": ["evento.inventado"],
                })
            assert resp.status_code == 422
        finally:
            _clear_overrides()

    async def test_no_admin_rechazado_403(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/notifications/channels")
            assert resp.status_code == 403
        finally:
            _clear_overrides()

    async def test_test_channel_endpoint_ok(self):
        channel = _fake_channel()
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = channel
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/notifications/channels/1/test")
            assert resp.status_code == 200
            assert resp.json()["ok"] is True
        finally:
            _clear_overrides()

    async def test_test_channel_endpoint_error_no_bloquea(self):
        channel = _fake_channel(config={"bot_token": "T", "chat_id": "1"})
        channel.type = "telegram"
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = channel
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            with patch("app.services.notifier.httpx.AsyncClient", _FakeAsyncClient):
                _FakeAsyncClient.fail_times = 99
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/notifications/channels/1/test")
            assert resp.status_code == 200
            assert resp.json()["ok"] is False
        finally:
            _clear_overrides()

    async def test_get_template_default_cuando_no_hay_fila(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/notifications/templates/queue.item_done")
            assert resp.status_code == 200
            body = resp.json()
            assert body["is_default"] is True
            assert body["body"] == notifier.DEFAULT_TEMPLATES["queue.item_done"]
        finally:
            _clear_overrides()

    async def test_put_template_invalido_400(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.put(
                    "/api/notifications/templates/queue.item_done", json={"body": "{{ unclosed"},
                )
            assert resp.status_code == 400
        finally:
            _clear_overrides()

    async def test_preview_template_con_evento_desconocido_404(self):
        _set_overrides({get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/templates/evento.inventado/preview", json={"body": "x"},
                )
            assert resp.status_code == 404
        finally:
            _clear_overrides()

    async def test_preview_template_ok(self):
        _set_overrides({get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/templates/queue.item_done/preview",
                    json={"body": "{{ piece_name }}"},
                )
            assert resp.status_code == 200
            body = resp.json()
            assert body["ok"] is True
            assert body["rendered"] == "Figura de ejemplo"
        finally:
            _clear_overrides()

    async def test_list_events(self):
        _set_overrides({get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/notifications/events")
            assert resp.status_code == 200
            assert "queue.item_done" in resp.json()
        finally:
            _clear_overrides()

    async def test_list_channels(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/notifications/channels")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear_overrides()

    async def test_update_channel_ok(self):
        channel = _fake_channel()
        channel.type = "ntfy"
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = channel
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.put("/api/notifications/channels/1", json={
                    "enabled": False,
                    "config": {"server": "https://ntfy.sh", "topic": "otro"},
                })
            assert resp.status_code == 200
            assert channel.enabled is False
            assert channel.config["topic"] == "otro"
        finally:
            _clear_overrides()

    async def test_update_channel_no_encontrado_404(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.put("/api/notifications/channels/999", json={"enabled": False})
            assert resp.status_code == 404
        finally:
            _clear_overrides()

    async def test_delete_channel_ok(self):
        channel = _fake_channel()
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = channel
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete("/api/notifications/channels/1")
            assert resp.status_code == 204
            assert db.delete.await_count == 1
        finally:
            _clear_overrides()
