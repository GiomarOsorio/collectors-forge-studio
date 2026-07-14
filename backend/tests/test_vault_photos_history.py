"""
Tests para fotos, notas, historial de impresiones y print_count del Vault
(issue #130).

Mismo patrón que test_vault_trash.py: httpx.AsyncClient con ASGITransport
y dependency_overrides para sustituir la BD y el usuario autenticado.
`upload_file`/`download_file`/`delete_file` se monkeypatchean en el
namespace de `app.routers.vault` (llamadas directas ahí, sin indirección
cruzada de módulo — a diferencia del bug de #129, acá no hay una segunda
copia importada en otro módulo).

Cubre:
    - Fotos: 400 tipo no permitido, 413 tamaño excedido, 400 más de 5 por
      request, 201 subida válida (MinIO mockeado), 404 foto inexistente,
      204 delete, PATCH caption
    - print-history: 404 modelo inexistente, agregados (gramos totales +
      tasa de éxito) correctos con datos conocidos
    - print_count en el listado (GET /) agregado sin N+1
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user


def _fake_user(role="admin"):
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


def _fake_model_file(model_id=1):
    m = MagicMock()
    m.id = model_id
    m.deleted_at = None
    m.source_file_key = "some-key.3mf"
    m.print_file_key = None
    m.plates = []
    m.tags = []
    return m


def _fake_photo(photo_id=1, model_file_id=1, minio_key="photos/1/abc.png", caption=None):
    p = MagicMock()
    p.id = photo_id
    p.model_file_id = model_file_id
    p.minio_key = minio_key
    p.caption = caption
    return p


# ─── Upload de fotos ─────────────────────────────────────────────────────────


def _tiny_png_bytes() -> bytes:
    # 1x1 PNG real — pasa el magic-byte check de IMAGE_MAGIC_CHECKS.
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a4944415478da6360000002000155020102980700"
        "000000049454e44ae426082"
    )


def _fake_db_with_model(model):
    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = model
        session.execute = AsyncMock(return_value=result)
        yield session

    return _gen


class TestUploadVaultPhotos:
    async def test_tipo_no_permitido_400(self):
        model = _fake_model_file()
        _set_overrides({get_db: _fake_db_with_model(model), get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/1/photos",
                    files={"files": ("nota.txt", b"hola", "text/plain")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_mas_de_5_fotos_400(self):
        model = _fake_model_file()
        _set_overrides({get_db: _fake_db_with_model(model), get_current_user: lambda: _fake_user()})
        png = _tiny_png_bytes()
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/1/photos",
                    files=[("files", (f"foto{i}.png", png, "image/png")) for i in range(6)],
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_tamano_excedido_413(self):
        model = _fake_model_file()
        _set_overrides({get_db: _fake_db_with_model(model), get_current_user: lambda: _fake_user()})
        oversized = b"\x89PNG\r\n\x1a\n" + b"0" * (10 * 1024 * 1024 + 1)
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/1/photos",
                    files={"files": ("grande.png", oversized, "image/png")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 413

    async def test_contenido_no_coincide_con_content_type_400(self):
        """Magic bytes no coinciden con el content-type declarado — spoofing."""
        model = _fake_model_file()
        _set_overrides({get_db: _fake_db_with_model(model), get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/1/photos",
                    files={"files": ("falsa.png", b"esto no es un png", "image/png")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_upload_valido_201(self):
        model = _fake_model_file()
        _set_overrides({get_db: _fake_db_with_model(model), get_current_user: lambda: _fake_user()})
        png = _tiny_png_bytes()
        try:
            with patch("app.routers.vault.upload_file", new=AsyncMock()) as mock_upload:
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post(
                        "/api/vault/1/photos",
                        files={"files": ("foto.png", png, "image/png")},
                    )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert mock_upload.await_count == 1
        body = r.json()
        assert len(body) == 1
        assert body[0]["photo_url"].startswith("/api/vault/1/photos/")


class TestVaultPhotoDetail:
    async def test_foto_inexistente_404(self):
        _set_overrides({get_db: _fake_db_with_model(None), get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/1/photos/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_editar_caption(self):
        photo = _fake_photo(caption=None)
        _set_overrides({get_db: _fake_db_with_model(photo), get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.patch(
                    "/api/vault/1/photos/1", json={"caption": "Fallo de adhesión capa 40"}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert photo.caption == "Fallo de adhesión capa 40"
        assert r.json()["caption"] == "Fallo de adhesión capa 40"

    async def test_delete_foto_204(self):
        photo = _fake_photo()
        _set_overrides({get_db: _fake_db_with_model(photo), get_current_user: lambda: _fake_user()})
        try:
            with patch("app.routers.vault.delete_file", new=AsyncMock()) as mock_delete:
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.delete("/api/vault/1/photos/1")
        finally:
            _clear_overrides()
        assert r.status_code == 204
        mock_delete.assert_awaited_once_with(photo.minio_key)


# ─── print-history ───────────────────────────────────────────────────────────


def _fake_queue_item(
    id, status, quantity=1, weight_grams=None, failure_reason=None, failure_category=None
):
    i = MagicMock()
    i.id = id
    i.status = status
    i.quantity = quantity
    i.piece_name = f"Pieza {id}"
    i.printer_id = None
    i.filament_id = None
    i.weight_grams = weight_grams
    i.print_time_hours = None
    i.failure_reason = failure_reason
    i.failure_category = failure_category
    from datetime import datetime, timezone
    i.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    i.completed_at = None
    return i


class TestPrintHistory:
    async def test_modelo_inexistente_404(self):
        _set_overrides({get_db: _fake_db_with_model(None), get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/1/print-history")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_agregados_gramos_y_tasa_exito(self):
        from decimal import Decimal

        model = _fake_model_file()
        items = [
            _fake_queue_item(1, "done", quantity=1, weight_grams=Decimal("100")),
            _fake_queue_item(2, "done", quantity=2, weight_grams=Decimal("50")),
            _fake_queue_item(
                3, "cancelled", quantity=1, weight_grams=Decimal("10"),
                failure_reason="Se atascó", failure_category="clog",
            ),
        ]

        async def _gen():
            session = AsyncMock()
            model_result = MagicMock()
            model_result.scalar_one_or_none.return_value = model
            items_result = MagicMock()
            items_result.scalars.return_value.all.return_value = items
            empty_result = MagicMock()
            empty_result.scalars.return_value.all.return_value = []
            # _get_model_file, luego items, luego printers (vacío), luego filaments (vacío)
            session.execute = AsyncMock(
                side_effect=[model_result, items_result, empty_result, empty_result]
            )
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/1/print-history")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        body = r.json()
        assert len(body["items"]) == 3
        # 100*1 + 50*2 + 10*1 = 210
        assert body["total_grams"] == 210.0
        # 2 done de 3 terminales (done+cancelled) = 66.67%
        assert round(body["success_rate_pct"], 2) == 66.67
        cancelled_entry = next(e for e in body["items"] if e["id"] == 3)
        assert cancelled_entry["failure_reason"] == "Se atascó"
        assert cancelled_entry["failure_category"] == "clog"


# ─── print_count en el listado ───────────────────────────────────────────────


class TestPrintCountInListing:
    async def test_listado_incluye_print_count_agregado(self):
        model = _fake_model_file(model_id=7)
        model.uploaded_by = None
        model.name = "Modelo con historial"
        model.source_file_name = "m.3mf"
        model.print_file_name = None
        model.source_file_size = 100
        model.print_file_size = None
        model.sliced_weight_g = None
        model.sliced_time_seconds = None
        model.sliced_printer_model = None
        model.sliced_filament_type = None
        model.is_print_ready = False
        model.description = None
        model.thumbnail_url = None
        model.thumbnail_key = None
        model.source_url = None
        model.source_platform = None
        model.notes = None
        model.creator_name = None
        model.creator_url = None
        model.folder_id = None
        model.active_plate_index = 0
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        model.created_at = now
        model.updated_at = now
        model.deleted_at = None

        async def _gen():
            session = AsyncMock()
            count_result = MagicMock()
            count_result.scalar.return_value = 1
            items_result = MagicMock()
            items_result.scalars.return_value.all.return_value = [model]
            printcount_result = MagicMock()
            printcount_result.all.return_value = [(7, 3)]  # vault_model_id=7 -> 3 prints
            # model.uploaded_by=None => uploader_ids vacío => el query de
            # usernames se SALTA (if uploader_ids: ...) — solo 3 execute
            # reales: count, items, print_count agregado.
            session.execute = AsyncMock(
                side_effect=[count_result, items_result, printcount_result]
            )
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        body = r.json()
        assert body["items"][0]["print_count"] == 3
