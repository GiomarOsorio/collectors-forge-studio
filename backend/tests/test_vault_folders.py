"""
Tests para las carpetas del Vault (/api/vault/folders).

Mismo patrón que test_queue.py: httpx.AsyncClient con ASGITransport y
dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET /folders → lista vacía con usuario autenticado
    - POST /folders → 403 si no es admin
    - POST /folders → 422 si el nombre es solo espacios (issue del code review)
    - POST /folders → 404 si el parent_id no existe
    - PUT /folders/{id} → 404 si la carpeta no existe
    - PUT /folders/{id} → 400 si se intenta mover una carpeta dentro de sí misma
    - DELETE /folders/{id} → 404 si la carpeta no existe
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
    """Sesión de BD que devuelve listas vacías y None en scalar_one_or_none."""
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    result.scalar.return_value = None
    result.all.return_value = []
    session.execute.return_value = result
    yield session


def _fake_db_with_folder(folder_id=5, parent_id=None):
    """Sesión de BD donde toda query de carpeta devuelve la misma carpeta fake."""
    fake_folder = MagicMock()
    fake_folder.id = folder_id
    fake_folder.name = "Carpeta existente"
    fake_folder.parent_id = parent_id

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_folder
        session.execute.return_value = result
        yield session

    return _gen


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestVaultFoldersAuthRequired:
    async def test_get_folders_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/folders")
        finally:
            _clear_overrides()
        assert r.status_code == 401


class TestVaultFoldersList:
    async def test_get_folders_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/folders")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []


class TestVaultFoldersCreate:
    async def test_post_folder_sin_admin_retorna_403(self):
        """Crear carpeta requiere admin — un operator no puede."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/folders", json={"name": "Nueva"})
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_post_folder_nombre_solo_espacios_retorna_422(self):
        """
        Un nombre de solo espacios debe rechazarse (422), no guardarse
        vacío tras el .strip() del backend — ver code review.
        """
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/folders", json={"name": "   "})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_post_folder_parent_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/vault/folders", json={"name": "Sub", "parent_id": 999}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestVaultFoldersUpdate:
    async def test_put_folder_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/vault/folders/999", json={"name": "X"})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_put_folder_mover_dentro_de_si_misma_retorna_400(self):
        """parent_id == el propio id de la carpeta debe rechazarse."""
        _set_overrides({
            get_db: _fake_db_with_folder(folder_id=5),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/vault/folders/5", json={"parent_id": 5})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_put_folder_nombre_solo_espacios_retorna_422(self):
        _set_overrides({
            get_db: _fake_db_with_folder(folder_id=5),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/vault/folders/5", json={"name": "  "})
        finally:
            _clear_overrides()
        assert r.status_code == 422


class TestVaultFoldersDelete:
    async def test_delete_folder_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/folders/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_folder_sin_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/folders/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403
