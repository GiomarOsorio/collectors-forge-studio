"""
Tests para la integración MakerWorld + Bambu Cloud (issue #139).

Tres bloques:
1. `services/bambu_cloud.py` — login/verify-code/TOTP/Cloudflare challenge,
   con httpx.AsyncClient mockeado (nunca llama la API real).
2. `services/makerworld_import.py` — parseo de URL, cliente de diseño/
   descarga (SSRF guard), orquestación `import_instance` (nuevo + dedupe).
3. `routers/makerworld.py` — endpoints vía HTTP con DB mockeada.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.bambu_cloud_auth import BambuCloudAuth
from app.models.model_file import ModelFile
from app.services.auth import get_current_user
from app.services import bambu_cloud
from app.services import makerworld_import as mw


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


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None, text="", headers=None, content=b""):
        self.status_code = status_code
        self._json = json_data
        self.text = text
        self.headers = headers or {}
        self.content = content or (text.encode() if text else b"")
        self.cookies = {}

    def json(self):
        if self._json is None:
            raise ValueError("no json")
        return self._json


class _FakeStreamResponse:
    def __init__(self, status_code=200, chunks=None):
        self.status_code = status_code
        self._chunks = chunks or [b"3MF-BYTES"]

    async def aiter_bytes(self):
        for c in self._chunks:
            yield c

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeAsyncClient:
    """httpx.AsyncClient falso — respuestas configurables por URL."""

    def __init__(self, get_responses=None, post_responses=None, stream_response=None):
        self._get_responses = get_responses or {}
        self._post_responses = post_responses or []
        self._stream_response = stream_response
        self.calls = []

    async def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        for key, resp in self._get_responses.items():
            if key in url:
                return resp
        return _FakeResponse(status_code=404, json_data={"error": "not mocked"})

    async def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if self._post_responses:
            return self._post_responses.pop(0)
        return _FakeResponse(status_code=500)

    def stream(self, method, url, **kwargs):
        self.calls.append(("STREAM", url, kwargs))
        return self._stream_response

    async def aclose(self):
        pass


# ---------------------------------------------------------------------------
# 1. bambu_cloud.py
# ---------------------------------------------------------------------------

class TestBambuCloudService:
    async def test_login_direct_success(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, {"accessToken": "tok123", "refreshToken": "ref456"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.login_request("a@b.com", "pw")
        assert result["success"] is True
        assert svc.access_token == "tok123"

    async def test_login_needs_email_verification(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, {"loginType": "verifyCode"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.login_request("a@b.com", "pw")
        assert result["needs_verification"] is True
        assert result["verification_type"] == "email"

    async def test_login_needs_totp(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, {"loginType": "tfa", "tfaKey": "key-xyz"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.login_request("a@b.com", "pw")
        assert result["needs_verification"] is True
        assert result["verification_type"] == "totp"
        assert result["tfa_key"] == "key-xyz"

    async def test_verify_code_success(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, {"accessToken": "tok999"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.verify_code("a@b.com", "123456")
        assert result["success"] is True
        assert svc.access_token == "tok999"

    async def test_verify_totp_success(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, {"accessToken": "totp-tok"}, text='{"accessToken": "totp-tok"}'),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.verify_totp("tfa-key", "654321")
        assert result["success"] is True
        assert svc.access_token == "totp-tok"

    async def test_login_cloudflare_challenge_detected(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(200, text="Just a moment...<title>Cloudflare</title>"),
        ])
        client._post_responses[0]._json = None
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.login_request("a@b.com", "pw")
        assert result["success"] is False
        assert "Cloudflare" in result["message"] or "bloqueando" in result["message"]

    def test_is_authenticated_reflects_expiry(self):
        svc = bambu_cloud.BambuCloudService(client=_FakeAsyncClient())
        assert svc.is_authenticated is False
        svc.set_token("tok")
        assert svc.is_authenticated is True

    async def test_login_credenciales_invalidas(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(400, {"message": "Credenciales inválidas"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.login_request("a@b.com", "wrong")
        assert result["success"] is False
        assert "Credenciales" in result["message"]

    async def test_verify_code_falla(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(400, {"message": "Código inválido"}),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.verify_code("a@b.com", "000000")
        assert result["success"] is False
        assert result["message"] == "Código inválido"

    async def test_verify_totp_empty_response(self):
        client = _FakeAsyncClient(post_responses=[_FakeResponse(200, text="")])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.verify_totp("key", "111111")
        assert result["success"] is False
        assert "vacía" in result["message"]

    async def test_verify_totp_session_expired_message(self):
        client = _FakeAsyncClient(post_responses=[
            _FakeResponse(400, {"message": "Session expired, try again"}, text='{"message": "Session expired, try again"}'),
        ])
        svc = bambu_cloud.BambuCloudService(client=client)
        result = await svc.verify_totp("key", "111111")
        assert result["success"] is False
        assert "expiró" in result["message"]

    def test_detect_cloudflare_challenge_cf_mitigated_header(self):
        resp = _FakeResponse(403, headers={"cf-mitigated": "1"})
        assert bambu_cloud._detect_cloudflare_challenge(resp) is not None

    def test_detect_cloudflare_challenge_none_for_normal_error(self):
        resp = _FakeResponse(400, json_data={"message": "bad request"})
        assert bambu_cloud._detect_cloudflare_challenge(resp) is None


# ---------------------------------------------------------------------------
# 2. makerworld_import.py
# ---------------------------------------------------------------------------

class TestParseUrl:
    def test_parse_url_variants(self):
        assert mw.parse_makerworld_url("https://makerworld.com/en/models/1400373") == 1400373
        assert mw.parse_makerworld_url("makerworld.com/models/42-slug") == 42

    def test_parse_url_rejects_other_hosts(self):
        with pytest.raises(mw.MakerWorldUrlError):
            mw.parse_makerworld_url("https://printables.com/models/1")

    def test_parse_url_rejects_missing_model_segment(self):
        with pytest.raises(mw.MakerWorldUrlError):
            mw.parse_makerworld_url("https://makerworld.com/en/collections/5")


class TestMakerWorldClient:
    async def test_get_design_ok(self):
        client = _FakeAsyncClient(get_responses={
            "/design/123": _FakeResponse(200, {"title": "Modelo X", "modelId": "US2bb73"}),
        })
        c = mw.MakerWorldClient(client=client)
        data = await c.get_design(123)
        assert data["title"] == "Modelo X"

    async def test_get_design_401_raises_auth_error(self):
        client = _FakeAsyncClient(get_responses={"/design/123": _FakeResponse(401, {"error": "no"})})
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldAuthError):
            await c.get_design(123)

    async def test_get_design_404_raises_not_found(self):
        client = _FakeAsyncClient(get_responses={"/design/999": _FakeResponse(404, {})})
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldNotFoundError):
            await c.get_design(999)

    async def test_profile_download_requires_auth_token(self):
        c = mw.MakerWorldClient(client=_FakeAsyncClient())
        with pytest.raises(mw.MakerWorldAuthError):
            await c.get_profile_download(1, "US2bb73")

    async def test_profile_download_ok(self):
        client = _FakeAsyncClient(get_responses={
            "/iot-service/api/user/profile/55": _FakeResponse(200, {"url": "https://makerworld.bblmw.com/x.3mf"}),
        })
        c = mw.MakerWorldClient(client=client, auth_token="tok")
        data = await c.get_profile_download(55, "US2bb73")
        # Igualdad exacta (no startswith) — evita el patrón que CodeQL
        # marca como "incomplete URL substring sanitization"; acá es
        # además irrelevante para seguridad real: es una aserción sobre
        # datos de un mock, no una validación de URL antes de un request.
        assert data["url"] == "https://makerworld.bblmw.com/x.3mf"

    async def test_download_3mf_rejects_non_allowed_host(self):
        c = mw.MakerWorldClient(client=_FakeAsyncClient())
        with pytest.raises(mw.MakerWorldUrlError):
            await c.download_3mf("https://evil.example.com/x.3mf")

    async def test_download_3mf_ok(self):
        client = _FakeAsyncClient(stream_response=_FakeStreamResponse(200, [b"PK\x03\x04fake3mf"]))
        c = mw.MakerWorldClient(client=client)
        data, filename = await c.download_3mf("https://makerworld.bblmw.com/path/model.3mf?sig=abc")
        assert data == b"PK\x03\x04fake3mf"
        assert filename == "model.3mf"

    async def test_fetch_thumbnail_rejects_non_cdn_host(self):
        c = mw.MakerWorldClient(client=_FakeAsyncClient())
        with pytest.raises(mw.MakerWorldUrlError):
            await c.fetch_thumbnail("https://evil.example.com/x.png")

    async def test_get_design_403_raises_forbidden(self):
        client = _FakeAsyncClient(get_responses={"/design/1": _FakeResponse(403, {})})
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldForbiddenError):
            await c.get_design(1)

    async def test_get_design_429_raises_unavailable(self):
        client = _FakeAsyncClient(get_responses={"/design/1": _FakeResponse(429, {})})
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldUnavailableError):
            await c.get_design(1)

    async def test_get_design_500_raises_unavailable(self):
        client = _FakeAsyncClient(get_responses={"/design/1": _FakeResponse(500, {})})
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldUnavailableError):
            await c.get_design(1)

    async def test_download_3mf_non_200_raises(self):
        client = _FakeAsyncClient(stream_response=_FakeStreamResponse(500, [b""]))
        c = mw.MakerWorldClient(client=client)
        with pytest.raises(mw.MakerWorldUnavailableError):
            await c.download_3mf("https://makerworld.bblmw.com/x.3mf")

    async def test_profile_download_403_raises_forbidden(self):
        client = _FakeAsyncClient(get_responses={"/iot-service/api/user/profile/1": _FakeResponse(403, {})})
        c = mw.MakerWorldClient(client=client, auth_token="tok")
        with pytest.raises(mw.MakerWorldForbiddenError):
            await c.get_profile_download(1, "US1")

    async def test_profile_download_404_raises_not_found(self):
        client = _FakeAsyncClient(get_responses={"/iot-service/api/user/profile/1": _FakeResponse(404, {})})
        c = mw.MakerWorldClient(client=client, auth_token="tok")
        with pytest.raises(mw.MakerWorldNotFoundError):
            await c.get_profile_download(1, "US1")


class TestImportInstance:
    async def test_dedupe_returns_existing_without_downloading(self):
        existing_model = MagicMock(spec=ModelFile)
        existing_model.id = 42

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing_model
        db.execute.return_value = result

        client = mw.MakerWorldClient(client=_FakeAsyncClient(get_responses={
            "/design/123": _FakeResponse(200, {"title": "X", "modelId": "US2bb73", "instances": [{"profileId": 55}]}),
        }))

        model, was_existing = await mw.import_instance(db, client, 123, 55, folder_id=None, uploaded_by=1)

        assert was_existing is True
        assert model.id == 42
        # Solo se consultó el diseño (para modelId) + la dedupe query — nunca se llamó a descarga.
        assert not any(c[1].startswith("https://api.bambulab.com/v1/iot-service") for c in client._client.calls)

    async def test_import_new_downloads_and_persists(self):
        db = AsyncMock()

        dedupe_result = MagicMock()
        dedupe_result.scalar_one_or_none.return_value = None  # no existe aún

        folder_result = MagicMock()
        folder_result.scalar_one_or_none.return_value = MagicMock(id=7)

        db.execute.side_effect = [dedupe_result, folder_result]

        async def fake_refresh(obj):
            obj.id = 99
            obj.plates = []

        db.refresh.side_effect = fake_refresh

        fake_client = _FakeAsyncClient(
            get_responses={
                "/design/123": _FakeResponse(200, {
                    "title": "Figura genial", "modelId": "US2bb73",
                    "instances": [{"profileId": 55}],
                }),
                "/iot-service/api/user/profile/55": _FakeResponse(200, {
                    "url": "https://makerworld.bblmw.com/x/model.3mf", "name": "model.3mf",
                }),
            },
            stream_response=_FakeStreamResponse(200, [b"PK\x03\x04fakebytes"]),
        )
        client = mw.MakerWorldClient(client=fake_client, auth_token="tok")

        with patch("app.services.makerworld_import.upload_file", AsyncMock()) as mock_upload, \
             patch("app.services.makerworld_import._persist_plates_from_print_file", AsyncMock()), \
             patch("app.services.makerworld_import._extract_source_thumbnail_png", AsyncMock(return_value=None)):
            model, was_existing = await mw.import_instance(db, client, 123, None, folder_id=None, uploaded_by=1)

        assert was_existing is False
        assert model.name == "Figura genial"
        assert model.source_url == "https://makerworld.com/models/123#profileId-55"
        assert model.source_platform == "makerworld"
        mock_upload.assert_called_once()
        # db.add se llamó para ModelFile + MakerworldImport
        assert db.add.call_count == 2


# ---------------------------------------------------------------------------
# 3. Endpoints
# ---------------------------------------------------------------------------

class TestAuthEndpoints:
    async def test_auth_status_not_configured(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/makerworld/auth/status")
            assert resp.status_code == 200
            assert resp.json()["configured"] is False
        finally:
            _clear_overrides()

    async def test_auth_status_configured_masks_email(self):
        db = AsyncMock()
        auth = MagicMock(spec=BambuCloudAuth)
        auth.access_token = "tok"
        auth.email = "giomar@example.com"
        auth.token_expires_at = None
        result = MagicMock()
        result.scalar_one_or_none.return_value = auth
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/makerworld/auth/status")
            body = resp.json()
            assert body["configured"] is True
            assert body["email_masked"] == "g***@example.com"
        finally:
            _clear_overrides()

    async def test_import_sin_credenciales_devuelve_409(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/makerworld/import", json={"design_id": 123})
            assert resp.status_code == 409
        finally:
            _clear_overrides()

    async def test_import_no_admin_rechazado_403(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/makerworld/import", json={"design_id": 123})
            assert resp.status_code == 403
        finally:
            _clear_overrides()


class TestResolveEndpoint:
    async def test_resolve_url_invalida_400(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/makerworld/resolve", json={"url": "https://printables.com/x/1"})
            assert resp.status_code == 400
        finally:
            _clear_overrides()


class TestRecentEndpoint:
    async def test_recent_lista_vacia(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/makerworld/recent")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear_overrides()


class TestLoginVerifyLogout:
    async def test_login_direct_success_guarda_tokens(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        fake_cloud = AsyncMock()
        fake_cloud.login_request.return_value = {"success": True, "message": "Login exitoso"}
        fake_cloud.access_token = "tok-abc"
        fake_cloud.refresh_token = None
        fake_cloud.token_expiry = None
        try:
            with patch("app.routers.makerworld.BambuCloudService", return_value=fake_cloud):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/auth/login", json={"email": "a@b.com", "password": "pw"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"
            assert db.add.call_count == 1
        finally:
            _clear_overrides()

    async def test_login_needs_verify_code(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        fake_cloud = AsyncMock()
        fake_cloud.login_request.return_value = {
            "success": False, "needs_verification": True,
            "verification_type": "email", "message": "Código enviado",
        }
        fake_cloud.access_token = None
        try:
            with patch("app.routers.makerworld.BambuCloudService", return_value=fake_cloud):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/auth/login", json={"email": "a@b.com", "password": "pw"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "verify_code"
        finally:
            _clear_overrides()

    async def test_login_failure_401(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        fake_cloud = AsyncMock()
        fake_cloud.login_request.return_value = {"success": False, "needs_verification": False, "message": "Credenciales inválidas"}
        fake_cloud.access_token = None
        try:
            with patch("app.routers.makerworld.BambuCloudService", return_value=fake_cloud):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/auth/login", json={"email": "a@b.com", "password": "pw"})
            assert resp.status_code == 401
        finally:
            _clear_overrides()

    async def test_verify_code_completa_login(self):
        db = AsyncMock()
        auth = MagicMock(spec=BambuCloudAuth)
        auth.email = "a@b.com"
        result = MagicMock()
        result.scalar_one_or_none.return_value = auth
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        fake_cloud = AsyncMock()
        fake_cloud.verify_code.return_value = {"success": True, "message": "Login exitoso"}
        fake_cloud.access_token = "tok-xyz"
        fake_cloud.refresh_token = None
        fake_cloud.token_expiry = None
        try:
            with patch("app.routers.makerworld.BambuCloudService", return_value=fake_cloud):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/auth/verify", json={"code": "123456"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"
        finally:
            _clear_overrides()

    async def test_logout_borra_tokens(self):
        db = AsyncMock()
        auth = MagicMock(spec=BambuCloudAuth)
        result = MagicMock()
        result.scalar_one_or_none.return_value = auth
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete("/api/makerworld/auth")
            assert resp.status_code == 204
            assert db.delete.await_count == 1
        finally:
            _clear_overrides()


class TestImportEndpointSuccess:
    async def test_import_ok(self):
        db = AsyncMock()
        auth = MagicMock(spec=BambuCloudAuth)
        auth.access_token = "tok"
        result = MagicMock()
        result.scalar_one_or_none.return_value = auth
        db.execute.return_value = result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})
        fake_model = MagicMock(id=5, folder_id=3)
        fake_model.name = "Figura"
        try:
            with patch("app.routers.makerworld.import_instance", AsyncMock(return_value=(fake_model, False))):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/import", json={"design_id": 123, "profile_id": 55})
            assert resp.status_code == 200
            body = resp.json()
            assert body["model_file_id"] == 5
            assert body["was_existing"] is False
        finally:
            _clear_overrides()

    async def test_import_all_ok(self):
        db = AsyncMock()
        auth = MagicMock(spec=BambuCloudAuth)
        auth.access_token = "tok"
        auth_result = MagicMock()
        auth_result.scalar_one_or_none.return_value = auth
        db.execute.return_value = auth_result
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("admin")})

        fake_client_instance = AsyncMock()
        fake_client_instance.get_design_instances.return_value = {"hits": [{"profileId": 1}, {"profileId": 2}]}
        fake_client_instance.close = AsyncMock()

        fake_model = MagicMock(id=9)
        try:
            with patch("app.routers.makerworld.MakerWorldClient", return_value=fake_client_instance), \
                 patch("app.routers.makerworld.import_instance", AsyncMock(return_value=(fake_model, False))), \
                 patch("app.routers.makerworld.asyncio.sleep", AsyncMock()):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/import-all", json={"design_id": 123})
            assert resp.status_code == 200
            body = resp.json()
            assert len(body["imported"]) == 2
            assert len(body["failed"]) == 0
        finally:
            _clear_overrides()


class TestResolveSuccessAndThumbnail:
    async def test_resolve_ok(self):
        db = AsyncMock()
        no_auth = MagicMock()
        no_auth.scalar_one_or_none.return_value = None
        empty_imports = MagicMock()
        empty_imports.all.return_value = []
        db.execute.side_effect = [no_auth, empty_imports]
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})

        fake_client_instance = AsyncMock()
        fake_client_instance.get_design.return_value = {
            "title": "Modelo genial", "coverUrl": "https://makerworld.bblmw.com/cover.jpg",
            "designCreator": {"name": "Autora X"},
        }
        fake_client_instance.get_design_instances.return_value = {"hits": [{"id": 1, "profileId": 55, "title": "0.2mm", "cover": "https://makerworld.bblmw.com/x.jpg"}]}
        fake_client_instance.close = AsyncMock()
        try:
            with patch("app.routers.makerworld.MakerWorldClient", return_value=fake_client_instance):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/makerworld/resolve", json={"url": "https://makerworld.com/models/123"})
            assert resp.status_code == 200
            body = resp.json()
            assert body["title"] == "Modelo genial"
            assert body["author"] == "Autora X"
            assert len(body["instances"]) == 1
        finally:
            _clear_overrides()

    async def test_thumbnail_proxy_ok(self):
        _set_overrides({get_current_user: lambda: _fake_user("operator")})
        fake_client_instance = AsyncMock()
        fake_client_instance.fetch_thumbnail.return_value = (b"\x89PNG", "image/png")
        fake_client_instance.close = AsyncMock()
        try:
            with patch("app.routers.makerworld.MakerWorldClient", return_value=fake_client_instance):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.get("/api/makerworld/thumbnail", params={"url": "https://makerworld.bblmw.com/x.png"})
            assert resp.status_code == 200
            assert resp.content == b"\x89PNG"
        finally:
            _clear_overrides()

    async def test_thumbnail_proxy_host_no_permitido_400(self):
        _set_overrides({get_current_user: lambda: _fake_user("operator")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/makerworld/thumbnail", params={"url": "https://evil.example.com/x.png"})
            assert resp.status_code == 400
        finally:
            _clear_overrides()
