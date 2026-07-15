"""
Tests para el import de ZIP al Vault (issue #127).

Tres bloques:
1. `_classify_zip_entry` — pura, sin DB.
2. `_get_or_create_folder_path` / `_build_model_file_from_zip_entry` —
   helpers async con DB mockeada, aislados de HTTP.
3. `POST /api/vault/upload-zip` — endpoint vía HTTP: guards (extensión,
   zip corrupto, límites de entries/tamaño, 403 no-admin) + happy path con
   estructura anidada + entry no soportada ignorada (helpers internos
   patcheados para no depender de la cadena completa de mocks de DB).
"""

import io
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.model_file import ModelFile
from app.models.vault_folder import VaultFolder
from app.routers.vault import (
    MAX_ZIP_ENTRIES,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    _build_model_file_from_zip_entry,
    _classify_zip_entry,
    _get_or_create_folder_path,
)
from app.services.auth import get_admin_user, get_current_user


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


def _make_zip(entries: dict) -> bytes:
    """`entries` = {"path/en/el/zip.ext": b"contenido"}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 1. _classify_zip_entry
# ---------------------------------------------------------------------------

class TestClassifyZipEntry:
    def test_gcode_3mf_es_print(self):
        assert _classify_zip_entry("modelo.gcode.3mf") == "print"

    def test_3mf_es_source(self):
        assert _classify_zip_entry("modelo.3mf") == "source"

    def test_stl_es_source(self):
        assert _classify_zip_entry("modelo.stl") == "source"

    def test_extension_no_soportada_es_none(self):
        assert _classify_zip_entry("readme.txt") is None

    def test_case_insensitive(self):
        assert _classify_zip_entry("MODELO.GCODE.3MF") == "print"

    def test_gcode_3mf_no_matchea_como_source(self):
        # .gcode.3mf termina en .3mf también — debe ganar la clasificación 'print'.
        assert _classify_zip_entry("carpeta/pieza.gcode.3mf") == "print"


# ---------------------------------------------------------------------------
# 2. Helpers async con DB mockeada
# ---------------------------------------------------------------------------

class TestGetOrCreateFolderPath:
    async def test_parts_vacio_retorna_base_folder_id(self):
        db = AsyncMock()
        result = await _get_or_create_folder_path(db, 5, (), {})
        assert result == 5
        db.execute.assert_not_called()

    async def test_crea_carpeta_si_no_existe(self):
        db = AsyncMock()
        query_result = MagicMock()
        query_result.scalar_one_or_none.return_value = None
        db.execute.return_value = query_result

        async def fake_flush():
            db.add.call_args[0][0].id = 42
        db.flush.side_effect = fake_flush

        cache = {}
        folder_id = await _get_or_create_folder_path(db, None, ("Sub",), cache)
        assert folder_id == 42
        assert cache[("Sub",)] == 42
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, VaultFolder)
        assert added.name == "Sub"
        assert added.parent_id is None

    async def test_reusa_carpeta_existente(self):
        db = AsyncMock()
        existing = MagicMock(id=7)
        query_result = MagicMock()
        query_result.scalar_one_or_none.return_value = existing
        db.execute.return_value = query_result

        folder_id = await _get_or_create_folder_path(db, None, ("Existe",), {})
        assert folder_id == 7
        db.add.assert_not_called()

    async def test_cache_evita_segunda_query(self):
        db = AsyncMock()
        cache = {("A",): 1}
        folder_id = await _get_or_create_folder_path(db, None, ("A",), cache)
        assert folder_id == 1
        db.execute.assert_not_called()

    async def test_anida_recursivamente(self):
        db = AsyncMock()
        counter = iter([10, 11])

        async def fake_flush():
            db.add.call_args[0][0].id = next(counter)
        db.flush.side_effect = fake_flush

        no_existe = MagicMock()
        no_existe.scalar_one_or_none.return_value = None
        db.execute.return_value = no_existe

        cache = {}
        folder_id = await _get_or_create_folder_path(db, None, ("A", "B"), cache)
        assert folder_id == 11
        assert cache[("A",)] == 10
        assert cache[("A", "B")] == 11
        assert db.add.call_count == 2
        # La segunda carpeta ("B") debe colgar de la primera ("A"), no de la raíz.
        second_call_folder = db.add.call_args_list[1][0][0]
        assert second_call_folder.parent_id == 10


class TestBuildModelFileFromZipEntry:
    async def test_entry_print_puebla_slot_print(self):
        db = AsyncMock()
        current_user = _fake_user()

        async def fake_refresh(obj):
            obj.id = 99
            obj.plates = []
        db.refresh.side_effect = fake_refresh

        with patch("app.routers.vault.upload_file", AsyncMock()) as mock_upload, \
             patch("app.routers.vault._parse_sliced_from_print_file", return_value={
                 "sliced_weight_g": 12.5, "sliced_time_seconds": 3600,
                 "sliced_printer_model": "P2S", "sliced_filament_type": "PLA",
             }), \
             patch("app.routers.vault._persist_plates_from_print_file", AsyncMock()):
            model = await _build_model_file_from_zip_entry(
                db, current_user, 3, "carpeta/pieza.gcode.3mf", b"fake-gcode-3mf", "print",
            )

        mock_upload.assert_called_once()
        assert model.print_file_name == "pieza.gcode.3mf"
        assert model.print_file_size == len(b"fake-gcode-3mf")
        assert model.name == "pieza"
        assert model.folder_id == 3
        assert model.sliced_weight_g == 12.5
        assert model.source_file_key is None

    async def test_entry_source_puebla_slot_source_y_thumbnail(self):
        db = AsyncMock()
        current_user = _fake_user()

        async def fake_refresh(obj):
            obj.id = 100
            obj.plates = []
        db.refresh.side_effect = fake_refresh

        with patch("app.routers.vault.upload_file", AsyncMock()), \
             patch("app.routers.vault._extract_source_thumbnail_png", AsyncMock(return_value=b"\x89PNG")), \
             patch("app.routers.vault.save_thumbnail", AsyncMock(return_value="thumb-key")):
            model = await _build_model_file_from_zip_entry(
                db, current_user, None, "modelo.3mf", b"fake-3mf-bytes", "source",
            )

        assert model.source_file_name == "modelo.3mf"
        assert model.name == "modelo"
        assert model.thumbnail_key == "thumb-key"
        assert model.print_file_key is None

    async def test_entry_source_stl_sin_plates_intenta_thumbnail(self):
        db = AsyncMock()
        current_user = _fake_user()

        async def fake_refresh(obj):
            obj.id = 101
            obj.plates = []
        db.refresh.side_effect = fake_refresh

        with patch("app.routers.vault.upload_file", AsyncMock()), \
             patch("app.routers.vault._extract_source_thumbnail_png", AsyncMock(return_value=None)) as mock_extract, \
             patch("app.routers.vault.save_thumbnail", AsyncMock()) as mock_save:
            await _build_model_file_from_zip_entry(
                db, current_user, None, "figura.stl", b"fake-stl-bytes", "source",
            )

        mock_extract.assert_called_once()
        mock_save.assert_not_called()


# ---------------------------------------------------------------------------
# 3. Endpoint POST /api/vault/upload-zip
# ---------------------------------------------------------------------------

class TestUploadZipEndpoint:
    async def test_rechaza_extension_no_zip(self):
        _set_overrides({get_db: _fake_db(AsyncMock()), get_admin_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/upload-zip",
                    files={"file": ("modelo.3mf", b"no es un zip", "application/octet-stream")},
                )
            assert resp.status_code == 400
        finally:
            _clear_overrides()

    async def test_rechaza_zip_corrupto(self):
        _set_overrides({get_db: _fake_db(AsyncMock()), get_admin_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/upload-zip",
                    files={"file": ("import.zip", b"esto no es un zip valido", "application/zip")},
                )
            assert resp.status_code == 400
        finally:
            _clear_overrides()

    async def test_rechaza_demasiadas_entries(self):
        zip_bytes = _make_zip({f"f{i}.3mf": b"x" for i in range(MAX_ZIP_ENTRIES + 1)})
        _set_overrides({get_db: _fake_db(AsyncMock()), get_admin_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/upload-zip",
                    files={"file": ("import.zip", zip_bytes, "application/zip")},
                )
            assert resp.status_code == 400
            assert "entries" in resp.json()["detail"]
        finally:
            _clear_overrides()

    async def test_rechaza_zip_bomb_por_tamano_descomprimido(self):
        zip_bytes = _make_zip({"modelo.3mf": b"x"})
        _set_overrides({get_db: _fake_db(AsyncMock()), get_admin_user: lambda: _fake_user()})
        try:
            transport = ASGITransport(app=app)
            with patch("app.routers.vault.MAX_ZIP_UNCOMPRESSED_BYTES", 0):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post(
                        "/api/vault/upload-zip",
                        files={"file": ("import.zip", zip_bytes, "application/zip")},
                    )
            assert resp.status_code == 400
            assert "descomprimido" in resp.json()["detail"]
        finally:
            _clear_overrides()

    async def test_no_admin_rechazado_403(self):
        _set_overrides({get_db: _fake_db(AsyncMock()), get_current_user: lambda: _fake_user("operator")})
        app.dependency_overrides.pop(get_admin_user, None)
        try:
            zip_bytes = _make_zip({"modelo.3mf": b"x"})
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/vault/upload-zip",
                    files={"file": ("import.zip", zip_bytes, "application/zip")},
                )
            assert resp.status_code == 401 or resp.status_code == 403
        finally:
            _clear_overrides()

    async def test_happy_path_estructura_anidada_e_ignora_no_soportado(self):
        zip_bytes = _make_zip({
            "raiz.3mf": b"a" * 10,
            "carpetaA/carpetaB/pieza.gcode.3mf": b"b" * 10,
            "carpetaA/readme.txt": b"ignorado",
        })

        db = AsyncMock()
        used_bytes_result = MagicMock()
        used_bytes_result.scalar.return_value = 0
        db.execute.return_value = used_bytes_result

        fake_models = [MagicMock(id=1), MagicMock(id=2)]

        async def fake_get_or_create(db_, base_folder_id, parts, cache):
            # Fake simplificado (no recursivo) — la recursión real ya está
            # cubierta por TestGetOrCreateFolderPath; acá solo interesa que
            # el endpoint agregue bien folders_created/files_created/skipped.
            if not parts:
                return base_folder_id
            if parts not in cache:
                cache[parts] = len(cache) + 100
            return cache[parts]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user()})
        try:
            with patch("app.routers.vault._get_used_bytes", AsyncMock(return_value=0)), \
                 patch("app.routers.vault._get_or_create_folder_path", side_effect=fake_get_or_create), \
                 patch("app.routers.vault._build_model_file_from_zip_entry", AsyncMock(side_effect=fake_models)):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post(
                        "/api/vault/upload-zip",
                        data={"create_folder": "false"},
                        files={"file": ("import.zip", zip_bytes, "application/zip")},
                    )
            assert resp.status_code == 201
            body = resp.json()
            assert body["files_created"] == 2
            assert body["skipped_entries"] == 1
            # 1 con el fake simplificado (no recursivo) de arriba — solo
            # valida que el endpoint refleje lo que acumuló en folder_cache.
            assert body["folders_created"] == 1
        finally:
            _clear_overrides()

    async def test_sin_espacio_devuelve_507(self):
        zip_bytes = _make_zip({"modelo.3mf": b"x" * 1000})
        _set_overrides({get_db: _fake_db(AsyncMock()), get_admin_user: lambda: _fake_user()})
        try:
            with patch("app.routers.vault._get_used_bytes", AsyncMock(return_value=10**15)):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.post(
                        "/api/vault/upload-zip",
                        files={"file": ("import.zip", zip_bytes, "application/zip")},
                    )
            assert resp.status_code == 507
        finally:
            _clear_overrides()
