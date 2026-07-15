"""
Tests para proyectos — agrupador de la cola de impresión (/api/projects).

Mismo patrón que test_queue.py: httpx.AsyncClient con ASGITransport y
dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET / → lista vacía con usuario autenticado
    - POST / → 403 si no es admin/operator
    - POST / → 422 si falta el nombre
    - GET /{id} → 404 si el proyecto no existe
    - GET /{id}/items → 404 si el proyecto no existe
    - PUT /{id} → 404 si el proyecto no existe
    - PUT /{id} → 400 si status no es uno de los válidos
    - DELETE /{id} → 404 si el proyecto no existe
"""

import io
import json
import zipfile
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user


def _fake_user(role="operator"):
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
    u.role = role
    u.is_active = True
    return u


async def _fake_db_empty():
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    result.scalar.return_value = None
    result.all.return_value = []
    session.execute.return_value = result
    yield session


def _fake_project(project_id=1, status_="active", **overrides):
    from datetime import datetime
    p = MagicMock()
    p.id = project_id
    p.name = "Proyecto de prueba"
    p.client_name = None
    p.status = status_
    p.notes = None
    p.color = None
    p.external_url = None
    p.client_quote_id = None
    p.cover_photo_key = None
    p.created_at = datetime(2026, 1, 1)
    p.updated_at = datetime(2026, 1, 1)
    for k, v in overrides.items():
        setattr(p, k, v)
    return p


def _fake_db_with_project(project_id=1, status_="active"):
    fake_project = _fake_project(project_id, status_)

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_project
        result.all.return_value = []
        session.execute.return_value = result
        yield session

    return _gen


def _exec_result(scalar_one_or_none=None, scalars_all=None):
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    r.scalars.return_value.all.return_value = scalars_all or []
    return r


def _fake_db_sequence(*results):
    async def _gen():
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=list(results))
        yield session
    return _gen


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestProjectsAuthRequired:
    async def test_get_projects_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/")
        finally:
            _clear_overrides()
        assert r.status_code == 401


class TestProjectsList:
    async def test_get_projects_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []


class TestProjectsCreate:
    async def test_post_project_sin_operator_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="viewer"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/", json={"name": "Encargo X"})
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_post_project_sin_nombre_retorna_422(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422


class TestProjectsGet:
    async def test_get_project_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_get_project_items_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/999/items")
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestProjectsUpdate:
    async def test_put_project_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/projects/999", json={"name": "X"})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_put_project_status_invalido_retorna_400(self):
        _set_overrides({
            get_db: _fake_db_with_project(project_id=1),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/projects/1", json={"status": "volando"})
        finally:
            _clear_overrides()
        assert r.status_code == 400


class TestProjectsDelete:
    async def test_delete_project_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/projects/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_project_sin_operator_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="viewer"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/projects/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Metadata (issue #136, sub-ticket 1/3): color, external_url, client_quote_id,
# cover_photo_key
# ---------------------------------------------------------------------------

def _fake_db_create_with_refresh(quote_exists=None):
    """
    Simula `db.refresh()` poblando los defaults que en producción asigna
    SQLAlchemy/Postgres al insertar de verdad (created_at/updated_at) —
    ninguno se aplica sin una sesión real. Mismo patrón que
    `_fake_db_bulk_create` de test_spools.py.
    """
    from datetime import datetime, timezone

    async def _gen():
        session = AsyncMock()
        session.execute.return_value = _exec_result(scalar_one_or_none=quote_exists)

        async def _refresh(obj):
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if getattr(obj, "id", None) is None:
                obj.id = 1
            if getattr(obj, "status", None) is None:
                obj.status = "active"
            if getattr(obj, "created_at", None) is None:
                obj.created_at = now
            if getattr(obj, "updated_at", None) is None:
                obj.updated_at = now

        session.refresh = _refresh
        yield session

    return _gen


class TestProjectMetadataCreate:
    async def test_crea_con_color_external_url_y_sin_cotizacion(self):
        _set_overrides({
            get_db: _fake_db_create_with_refresh(),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/", json={
                    "name": "Encargo X",
                    "color": "#F59E0B",
                    "external_url": "https://makerworld.com/models/123",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert body["color"] == "#F59E0B"
        assert body["external_url"] == "https://makerworld.com/models/123"
        assert body["has_cover"] is False

    async def test_color_invalido_retorna_422(self):
        _set_overrides({
            get_db: _fake_db_create_with_refresh(),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/", json={"name": "Encargo X", "color": "rojo"})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_client_quote_id_inexistente_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_create_with_refresh(quote_exists=None),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/", json={"name": "Encargo X", "client_quote_id": 999})
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestProjectCover:
    async def test_upload_cover_tipo_no_permitido_retorna_400(self):
        _set_overrides({
            get_db: _fake_db_with_project(project_id=1),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/1/cover",
                    files={"file": ("cover.txt", b"no es una imagen", "text/plain")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_upload_cover_no_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_with_project(project_id=1),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/1/cover",
                    files={"file": ("cover.png", b"fake", "image/png")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_get_cover_sin_cover_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_with_project(project_id=1),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/1/cover")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_get_cover_proyecto_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/999/cover")
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Vínculo a Vault (issue #136, sub-ticket 2/3)
# ---------------------------------------------------------------------------

def _fake_model_file(file_id, name="Figura.3mf", thumbnail_key=None):
    from datetime import datetime
    f = MagicMock()
    f.id = file_id
    f.name = name
    f.thumbnail_key = thumbnail_key
    f.updated_at = datetime(2026, 1, 1)
    f.is_print_ready = True
    return f


class TestProjectFiles:
    async def test_get_files_proyecto_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_sequence(_exec_result(scalar_one_or_none=None)),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/999/files")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_get_files_lista_los_archivos_vinculados(self):
        project = _fake_project(project_id=1)
        project.files = [_fake_model_file(10, thumbnail_key="thumbnails/10.png"), _fake_model_file(11)]
        _set_overrides({
            get_db: _fake_db_sequence(_exec_result(scalar_one_or_none=project)),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/1/files")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 2
        assert body[0]["id"] == 10
        assert body[0]["local_thumbnail_url"] is not None
        assert body[1]["local_thumbnail_url"] is None

    async def test_post_files_agrega_idempotente(self):
        project = _fake_project(project_id=1)
        project.files = [_fake_model_file(10)]  # ya vinculado
        db = AsyncMock()

        async def _refresh(obj, attribute_names=None):
            return None
        db.refresh = _refresh
        db.execute = AsyncMock(side_effect=[
            _exec_result(scalar_one_or_none=project),
            _exec_result(scalars_all=[_fake_model_file(10), _fake_model_file(11)]),
        ])

        async def _gen():
            yield db

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user(role="operator")})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/1/files", json={"model_file_ids": [10, 11]})
        finally:
            _clear_overrides()
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()]
        assert ids == [10, 11]  # sin duplicar el 10 que ya estaba

    async def test_post_files_ids_faltantes_retorna_404(self):
        project = _fake_project(project_id=1)
        project.files = []
        _set_overrides({
            get_db: _fake_db_sequence(
                _exec_result(scalar_one_or_none=project),
                _exec_result(scalars_all=[]),
            ),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/projects/1/files", json={"model_file_ids": [999]})
        finally:
            _clear_overrides()
        assert r.status_code == 404
        assert "999" in r.json()["detail"]

    async def test_delete_file_no_operator_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="viewer"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/projects/1/files/10")
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_delete_file_ok(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/projects/1/files/10")
        finally:
            _clear_overrides()
        assert r.status_code == 204


# ---------------------------------------------------------------------------
# Export / Import (issue #136, sub-ticket 3/3)
# ---------------------------------------------------------------------------


def _make_zip(manifest, files=None):
    """Construye un ZIP real en memoria: manifest.json + binarios dados."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("manifest.json", json.dumps(manifest))
        for path, data in (files or {}).items():
            zf.writestr(path, data)
    return buf.getvalue()


class TestProjectExport:
    async def test_export_proyecto_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_sequence(_exec_result(scalar_one_or_none=None)),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/999/export")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_export_genera_zip_con_manifest_y_archivos(self, monkeypatch):
        project = _fake_project(project_id=1, name="Encargo X")
        tag = MagicMock()
        tag.name = "Halloween"
        mf = MagicMock()
        mf.name = "Calabaza"
        mf.description = None
        mf.notes = "frágil"
        mf.tags = [tag]
        mf.source_file_key = "src-key"
        mf.source_file_name = "calabaza.3mf"
        mf.print_file_key = None
        mf.print_file_name = None
        project.files = [mf]

        async def _fake_download(key):
            assert key == "src-key"
            return b"contenido-3mf"

        monkeypatch.setattr("app.routers.projects.download_file", _fake_download)
        _set_overrides({
            get_db: _fake_db_sequence(_exec_result(scalar_one_or_none=project)),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/projects/1/export")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        manifest = json.loads(zf.read("manifest.json"))
        assert manifest["version"] == 1
        assert manifest["project"]["name"] == "Encargo X"
        assert manifest["files"][0]["source_file_name"] == "calabaza.3mf"
        assert manifest["files"][0]["tags"] == ["Halloween"]
        assert zf.read("files/0/source_calabaza.3mf") == b"contenido-3mf"


class TestProjectImport:
    async def test_zip_invalido_retorna_400(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", b"no-es-un-zip", "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_sin_manifest_retorna_400(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("otra_cosa.txt", "x")
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", buf.getvalue(), "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_version_no_soportada_retorna_400(self):
        zip_bytes = _make_zip({"version": 2, "project": {"name": "X"}, "files": []})
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", zip_bytes, "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_no_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", b"x", "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_import_exitoso_recrea_proyecto_y_archivo(self, monkeypatch):
        manifest = {
            "version": 1,
            "project": {"name": "Encargo Importado", "description": "notas", "color": "#F59E0B", "external_url": None},
            "files": [{
                "name": "Calabaza", "description": None, "notes": None, "tags": ["Halloween"],
                "source_file_name": "calabaza.3mf", "print_file_name": None,
            }],
        }
        zip_bytes = _make_zip(manifest, {"files/0/source_calabaza.3mf": b"contenido"})

        monkeypatch.setattr("app.routers.projects._get_used_bytes", AsyncMock(return_value=0))
        monkeypatch.setattr("app.routers.projects._resolve_tags", AsyncMock(return_value=[]))
        monkeypatch.setattr("app.routers.projects.upload_file", AsyncMock(return_value=None))

        from datetime import datetime, timezone as tz

        added = []
        counter = {"next": 42}

        session = AsyncMock()
        name_check = _exec_result(scalar_one_or_none=None)
        counts_result = _exec_result(scalars_all=[])
        session.execute = AsyncMock(side_effect=[name_check, counts_result])
        session.add = MagicMock(side_effect=lambda obj: added.append(obj))

        async def _flush():
            for obj in added:
                if getattr(obj, "id", None) is None:
                    obj.id = counter["next"]
                    counter["next"] += 1
                if getattr(obj, "status", None) is None:
                    obj.status = "active"
                now = datetime.now(tz.utc).replace(tzinfo=None)
                if getattr(obj, "created_at", None) is None:
                    obj.created_at = now
                if getattr(obj, "updated_at", None) is None:
                    obj.updated_at = now

        session.flush = _flush

        async def _gen():
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user(role="admin")})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", zip_bytes, "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert r.json()["name"] == "Encargo Importado"

    async def test_quota_excedida_retorna_507(self, monkeypatch):
        manifest = {
            "version": 1, "project": {"name": "X"},
            "files": [{"name": "F", "source_file_name": "f.3mf", "print_file_name": None, "tags": []}],
        }
        zip_bytes = _make_zip(manifest, {"files/0/source_f.3mf": b"x" * 1000})
        monkeypatch.setattr("app.routers.projects._get_used_bytes", AsyncMock(return_value=10**15))
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/projects/import",
                    files={"file": ("x.zip", zip_bytes, "application/zip")},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 507
