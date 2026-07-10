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


def _fake_db_with_project(project_id=1, status_="active"):
    fake_project = MagicMock()
    fake_project.id = project_id
    fake_project.name = "Proyecto de prueba"
    fake_project.client_name = None
    fake_project.status = status_
    fake_project.notes = None

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_project
        result.all.return_value = []
        session.execute.return_value = result
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
