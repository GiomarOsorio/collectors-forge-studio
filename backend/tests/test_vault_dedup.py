"""
Tests para la detección de duplicados por hash SHA-256 (issue #128).

Tres bloques:
1. `_sha256_hex` — pura.
2. `POST /vault/check-duplicate` — hit/miss vía HTTP con DB mockeada.
3. `POST /vault/backfill-hashes` — batch por lotes con MinIO mockeado.
"""

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.routers.vault import _sha256_hex
from app.services.auth import get_admin_user, get_current_user


def _fake_user(role="operator"):
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
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


class TestSha256Hex:
    def test_hash_correcto(self):
        assert _sha256_hex(b"hola") == hashlib.sha256(b"hola").hexdigest()

    def test_hash_distinto_para_contenido_distinto(self):
        assert _sha256_hex(b"a") != _sha256_hex(b"b")


class TestCheckDuplicateEndpoint:
    async def test_sin_match_devuelve_duplicate_false(self):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result

        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/check-duplicate", json={"sha256": "a" * 64},
                )
            assert resp.status_code == 200
            assert resp.json() == {"duplicate": False, "file": None}
        finally:
            _clear_overrides()

    async def test_con_match_devuelve_archivo_existente(self):
        existing = MagicMock(id=42)
        existing.name = "Figura ya subida"
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing
        db.execute.return_value = result

        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/check-duplicate", json={"sha256": "b" * 64},
                )
            assert resp.status_code == 200
            body = resp.json()
            assert body["duplicate"] is True
            assert body["file"] == {"id": 42, "name": "Figura ya subida"}
        finally:
            _clear_overrides()

    async def test_sha256_con_longitud_invalida_422(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/vault/check-duplicate", json={"sha256": "muy-corto"})
            assert resp.status_code == 422
        finally:
            _clear_overrides()


class TestBackfillHashesEndpoint:
    async def test_no_admin_rechazado_403(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_current_user: lambda: _fake_user("operator")})
        app.dependency_overrides.pop(get_admin_user, None)
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/vault/backfill-hashes")
            assert resp.status_code in (401, 403)
        finally:
            _clear_overrides()

    async def test_procesa_lote_y_calcula_hash_de_ambos_slots(self):
        model_source_only = MagicMock(
            id=1, source_file_key="key-a", source_file_hash=None,
            print_file_key=None, print_file_hash=None,
        )
        model_both_slots = MagicMock(
            id=2, source_file_key="key-b", source_file_hash=None,
            print_file_key="key-c", print_file_hash=None,
        )

        db = AsyncMock()
        batch_result = MagicMock()
        batch_result.scalars.return_value.all.return_value = [model_source_only, model_both_slots]
        remaining_result = MagicMock()
        remaining_result.scalar.return_value = 3
        db.execute.side_effect = [batch_result, remaining_result]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user("admin")})
        try:
            with patch("app.routers.vault.download_file", AsyncMock(return_value=b"contenido-fake")):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/vault/backfill-hashes")
            assert resp.status_code == 200
            body = resp.json()
            assert body == {"processed": 2, "remaining": 3}

            expected_hash = hashlib.sha256(b"contenido-fake").hexdigest()
            assert model_source_only.source_file_hash == expected_hash
            assert model_both_slots.source_file_hash == expected_hash
            assert model_both_slots.print_file_hash == expected_hash
        finally:
            _clear_overrides()

    async def test_sin_pendientes_procesa_0_y_remaining_0(self):
        db = AsyncMock()
        batch_result = MagicMock()
        batch_result.scalars.return_value.all.return_value = []
        remaining_result = MagicMock()
        remaining_result.scalar.return_value = 0
        db.execute.side_effect = [batch_result, remaining_result]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user("admin")})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/vault/backfill-hashes")
            assert resp.status_code == 200
            assert resp.json() == {"processed": 0, "remaining": 0}
        finally:
            _clear_overrides()

    async def test_falla_de_minio_en_un_archivo_no_bloquea_el_lote(self):
        model = MagicMock(id=9, source_file_key="key-x", source_file_hash=None, print_file_key=None, print_file_hash=None)
        db = AsyncMock()
        batch_result = MagicMock()
        batch_result.scalars.return_value.all.return_value = [model]
        remaining_result = MagicMock()
        remaining_result.scalar.return_value = 0
        db.execute.side_effect = [batch_result, remaining_result]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user("admin")})
        try:
            with patch("app.routers.vault.download_file", AsyncMock(side_effect=Exception("MinIO caído"))):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post("/api/vault/backfill-hashes")
            assert resp.status_code == 200
            assert resp.json()["processed"] == 1
            assert model.source_file_hash is None  # no se pudo calcular, pero no reventó el endpoint
        finally:
            _clear_overrides()


class TestUploadComputesHash:
    """El upload/replace/ZIP-import ya escriben el hash — smoke test de la función usada."""

    def test_sha256_hex_es_determinista(self):
        content = b"mismo-contenido-3mf"
        assert _sha256_hex(content) == _sha256_hex(content)
