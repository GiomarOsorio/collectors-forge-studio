"""
Tests para el catálogo de tags del Vault (/api/vault/tags).

Mismo patrón que test_vault_folders.py: httpx.AsyncClient con ASGITransport
y dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET /tags → lista vacía con usuario autenticado
    - POST /tags → 403 si no es admin
    - POST /tags → 422 si el nombre es solo espacios
    - POST /tags → 409 si ya existe un tag con ese nombre (case-insensitive)
    - PATCH /tags/{id} → 404 si el tag no existe
    - DELETE /tags/{id} → 404 si el tag no existe
    - DELETE /tags/{id} → 403 si no es admin
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


def _fake_db_with_tag(tag_id=3, name="PLA", name_key="pla"):
    fake_tag = MagicMock()
    fake_tag.id = tag_id
    fake_tag.name = name
    fake_tag.name_key = name_key

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_tag
        result.scalar.return_value = 0
        session.execute.return_value = result
        yield session

    return _gen


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestVaultTagsAuthRequired:
    async def test_get_tags_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/tags")
        finally:
            _clear_overrides()
        assert r.status_code == 401


class TestVaultTagsList:
    async def test_get_tags_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/tags")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []


class TestVaultTagsCreate:
    async def test_post_tag_sin_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/tags", json={"name": "PLA"})
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_post_tag_nombre_solo_espacios_retorna_422(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/tags", json={"name": "   "})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_post_tag_duplicado_retorna_409(self):
        _set_overrides({
            get_db: _fake_db_with_tag(name="PLA", name_key="pla"),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/tags", json={"name": "pla"})
        finally:
            _clear_overrides()
        assert r.status_code == 409


class TestVaultTagsUpdate:
    async def test_patch_tag_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.patch("/api/vault/tags/999", json={"name": "PETG"})
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestVaultTagsDelete:
    async def test_delete_tag_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/tags/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_tag_sin_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/tags/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403
