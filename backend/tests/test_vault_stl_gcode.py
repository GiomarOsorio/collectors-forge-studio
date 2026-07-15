"""
Tests para soporte de `.stl` en el slot source + visor de G-code (issue #129).

Mismo patrón que test_vault_trash.py: httpx.AsyncClient con ASGITransport
y dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real. `upload_file`/`download_file` (MinIO) se
monkeypatchean en el módulo del router — no hay MinIO real en unit tests.

Cubre:
    - render_stl_thumbnail: STL válido → PNG real; STL basura → None (sin excepción)
    - Validación de extensión: .stl aceptado, .txt/.gcode.3mf-como-source rechazados
    - POST /upload con .stl → 201, genera thumbnail vía render real + upload mockeado
    - GET /{id}/gcode-content: 404 sin print_file, 200 extrae el plate activo, 413 si excede el límite
    - POST /generate-stl-thumbnails: procesa candidatos en lote
"""

import io
import struct
import zipfile
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user
from app.services.stl_thumbnail import render_stl_thumbnail
from app.routers.vault import _ext_ok, _source_content_type


def _make_binary_stl_cube() -> bytes:
    """Cubo unitario mínimo (12 triángulos) en formato STL binario."""
    vertices = [
        (-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1),
    ]
    triangles = [
        (0, 1, 2), (0, 2, 3), (4, 5, 6), (4, 6, 7),
        (0, 1, 5), (0, 5, 4), (2, 3, 7), (2, 7, 6),
        (1, 2, 6), (1, 6, 5), (0, 3, 7), (0, 7, 4),
    ]
    header = b"\0" * 80
    body = struct.pack("<I", len(triangles))
    for tri in triangles:
        body += struct.pack("<3f", 0.0, 0.0, 0.0)  # normal (sin calcular, no importa para el test)
        for idx in tri:
            body += struct.pack("<3f", *vertices[idx])
        body += struct.pack("<H", 0)
    return header + body


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


def _fake_model_file(**kwargs):
    """
    Fake `ModelFile` completo — cubre TODOS los campos que `_to_response`
    lee (ver routers/vault.py:_to_response). Un campo faltante rompe la
    validación Pydantic con un MagicMock genérico en su lugar.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    m = MagicMock()
    m.id = kwargs.get("id", 1)
    m.uploaded_by = kwargs.get("uploaded_by", 1)
    m.source_file_key = kwargs.get("source_file_key")
    m.source_file_name = kwargs.get("source_file_name")
    m.source_file_size = kwargs.get("source_file_size")
    m.print_file_key = kwargs.get("print_file_key")
    m.print_file_name = kwargs.get("print_file_name")
    m.print_file_size = kwargs.get("print_file_size")
    m.sliced_weight_g = kwargs.get("sliced_weight_g")
    m.sliced_time_seconds = kwargs.get("sliced_time_seconds")
    m.sliced_printer_model = kwargs.get("sliced_printer_model")
    m.sliced_filament_type = kwargs.get("sliced_filament_type")
    m.is_print_ready = kwargs.get("is_print_ready", False)
    m.name = kwargs.get("name", "Test STL")
    m.description = kwargs.get("description")
    m.thumbnail_url = kwargs.get("thumbnail_url")
    m.thumbnail_key = kwargs.get("thumbnail_key")
    m.tags = kwargs.get("tags", [])
    m.source_url = kwargs.get("source_url")
    m.source_platform = kwargs.get("source_platform")
    m.notes = kwargs.get("notes")
    m.creator_name = kwargs.get("creator_name")
    m.creator_url = kwargs.get("creator_url")
    m.folder_id = kwargs.get("folder_id")
    m.active_plate_index = kwargs.get("active_plate_index", 0)
    m.plates = kwargs.get("plates", [])
    m.created_at = kwargs.get("created_at", now)
    m.updated_at = kwargs.get("updated_at", now)
    m.deleted_at = kwargs.get("deleted_at")
    return m


# ─── render_stl_thumbnail (unit, sin mocks — matplotlib/numpy-stl reales) ──


class TestRenderStlThumbnail:
    def test_stl_valido_genera_png(self):
        stl_bytes = _make_binary_stl_cube()
        png = render_stl_thumbnail(stl_bytes)
        assert png is not None
        assert png[:8] == b"\x89PNG\r\n\x1a\n"  # magic number PNG

    def test_stl_basura_retorna_none_sin_excepcion(self):
        png = render_stl_thumbnail(b"esto no es un stl valido, son puros bytes basura")
        assert png is None

    def test_stl_vacio_retorna_none(self):
        png = render_stl_thumbnail(b"")
        assert png is None


# ─── Validación de extensión ────────────────────────────────────────────────


class TestExtensionHelpers:
    def test_ext_ok_acepta_stl(self):
        assert _ext_ok("modelo.stl", (".3mf", ".stl")) is True
        assert _ext_ok("MODELO.STL", (".3mf", ".stl")) is True  # case-insensitive

    def test_ext_ok_rechaza_gcode_3mf_como_stl(self):
        assert _ext_ok("modelo.gcode.3mf", (".gcode.3mf",)) is True
        assert _ext_ok("modelo.stl", (".gcode.3mf",)) is False

    def test_source_content_type_stl_vs_3mf(self):
        assert _source_content_type("modelo.stl") == "model/stl"
        assert _source_content_type("modelo.3mf") == "model/3mf"


async def _fake_db_empty():
    """DB dummy — nunca se toca porque la validación de extensión rechaza
    el upload antes de que el endpoint ejecute ningún `db.execute`. Debe
    ser un generador async real (no un `AsyncMock()` suelto): FastAPI
    resuelve la dependencia `Depends(get_db)` para armar los argumentos
    del endpoint ANTES de correr su cuerpo, sin importar si el código
    llega a usarla — un override que no respeta la forma de generador
    rompe esa resolución (visto en CI: producía 422 en vez del 400 real)."""
    session = AsyncMock()
    yield session


class TestUploadValidation:
    async def test_source_txt_rechazado_400(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/upload",
                    data={"metadata": '{"name": "x"}'},
                    files={"source_file": ("modelo.txt", b"contenido", "text/plain")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400
        assert "stl" in r.json()["detail"].lower()

    async def test_source_gcode_3mf_sigue_rechazado_400(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/upload",
                    data={"metadata": '{"name": "x"}'},
                    files={"source_file": ("modelo.gcode.3mf", b"contenido", "model/3mf")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400


class TestUploadStlHappyPath:
    async def test_upload_stl_genera_thumbnail_real(self):
        stl_bytes = _make_binary_stl_cube()
        fake_model = _fake_model_file(
            source_file_name="cubo.stl",
            source_file_size=len(stl_bytes),
            name="Cubo de prueba",
        )

        async def _fake_db_gen():
            session = AsyncMock()
            quota_result = MagicMock()
            quota_result.scalar.return_value = 0
            refetch_result = MagicMock()
            refetch_result.scalar_one.return_value = fake_model
            session.execute = AsyncMock(side_effect=[quota_result, refetch_result, refetch_result])
            yield session

        _set_overrides({get_db: _fake_db_gen, get_current_user: lambda: _fake_user()})
        try:
            # `save_thumbnail` vive en app.services.thumbnail_extractor y
            # tiene su PROPIO `upload_file` importado (`from ... import
            # upload_file`) — un binding independiente del de vault.py.
            # Patchear solo el de vault.py deja ese segundo call site
            # pegándole a MinIO real (detectado en CI: ConnectionError
            # silencioso, atrapado por el except del endpoint).
            with patch("app.routers.vault.upload_file", new=AsyncMock()) as mock_upload, \
                 patch("app.services.thumbnail_extractor.upload_file", new=AsyncMock()) as mock_upload_thumb:
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post(
                        "/api/vault/upload",
                        data={"metadata": '{"name": "Cubo de prueba"}'},
                        files={"source_file": ("cubo.stl", stl_bytes, "model/stl")},
                    )
        finally:
            _clear_overrides()

        assert r.status_code == 201
        body = r.json()
        assert body["source_file_name"] == "cubo.stl"
        # El .stl en sí se subió (vault.py) y el thumbnail PNG (render
        # real) se subió por separado (thumbnail_extractor.save_thumbnail).
        assert mock_upload.await_count >= 1
        assert mock_upload_thumb.await_count >= 1
        # fake_model.thumbnail_key fue seteado por el endpoint tras el render.
        assert fake_model.thumbnail_key is not None


# ─── GET /{id}/gcode-content ─────────────────────────────────────────────────


def _make_gcode_3mf_zip(gcode_text: str, plate_number: int = 1) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(f"Metadata/plate_{plate_number}.gcode", gcode_text)
    return buf.getvalue()


def _fake_db_with_file(fake_file):
    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_file
        session.execute = AsyncMock(return_value=result)
        yield session

    return _gen


class TestGcodeContent:
    async def test_sin_print_file_404(self):
        fake_file = _fake_model_file(print_file_key=None)
        _set_overrides({
            get_db: _fake_db_with_file(fake_file),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/1/gcode-content")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_extrae_gcode_del_plate_activo(self):
        gcode = "; generated by OrcaSlicer\nG28\nG1 X10 Y10\n"
        zip_bytes = _make_gcode_3mf_zip(gcode, plate_number=1)
        fake_file = _fake_model_file(
            print_file_key="some-key.gcode.3mf", active_plate_index=0,
        )
        _set_overrides({
            get_db: _fake_db_with_file(fake_file),
            get_current_user: lambda: _fake_user(),
        })
        try:
            with patch("app.routers.vault.download_file", new=AsyncMock(return_value=zip_bytes)):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.get("/api/vault/1/gcode-content")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.text == gcode

    async def test_413_si_supera_limite(self):
        gcode = "G1 X10 Y10\n" * 100
        zip_bytes = _make_gcode_3mf_zip(gcode, plate_number=1)
        fake_file = _fake_model_file(print_file_key="some-key.gcode.3mf", active_plate_index=0)
        _set_overrides({
            get_db: _fake_db_with_file(fake_file),
            get_current_user: lambda: _fake_user(),
        })
        try:
            with patch("app.routers.vault.download_file", new=AsyncMock(return_value=zip_bytes)), \
                 patch("app.routers.vault._MAX_GCODE_CONTENT_BYTES", 10):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.get("/api/vault/1/gcode-content")
        finally:
            _clear_overrides()
        assert r.status_code == 413

    async def test_zip_corrupto_422(self):
        fake_file = _fake_model_file(print_file_key="some-key.gcode.3mf")
        _set_overrides({
            get_db: _fake_db_with_file(fake_file),
            get_current_user: lambda: _fake_user(),
        })
        try:
            with patch("app.routers.vault.download_file", new=AsyncMock(return_value=b"no es un zip")):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.get("/api/vault/1/gcode-content")
        finally:
            _clear_overrides()
        assert r.status_code == 422


# ─── POST /generate-stl-thumbnails ───────────────────────────────────────────


class TestGenerateStlThumbnailsBatch:
    async def test_procesa_candidatos_stl_sin_thumbnail(self):
        stl_bytes = _make_binary_stl_cube()
        candidate = _fake_model_file(
            source_file_key="key-1", source_file_name="pieza.stl", thumbnail_key=None,
        )

        async def _fake_db_gen():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = [candidate]
            session.execute = AsyncMock(return_value=result)
            yield session

        _set_overrides({get_db: _fake_db_gen, get_current_user: lambda: _fake_user()})
        try:
            # Mismo motivo que en TestUploadStlHappyPath: save_thumbnail usa
            # su propio `upload_file` importado en thumbnail_extractor.py.
            with patch("app.routers.vault.download_file", new=AsyncMock(return_value=stl_bytes)), \
                 patch("app.routers.vault.upload_file", new=AsyncMock()), \
                 patch("app.services.thumbnail_extractor.upload_file", new=AsyncMock()):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/vault/generate-stl-thumbnails")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        body = r.json()
        assert body["processed"] == 1
        assert body["remaining"] == 0
        assert candidate.thumbnail_key is not None

    async def test_sin_candidatos_no_falla(self):
        async def _fake_db_gen():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            session.execute = AsyncMock(return_value=result)
            yield session

        _set_overrides({get_db: _fake_db_gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/generate-stl-thumbnails")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == {"processed": 0, "remaining": 0}
