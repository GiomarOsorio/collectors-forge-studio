"""
Tests para la papelera del Vault (/api/vault/trash y DELETE /api/vault/{id}).

Mismo patrón que test_vault_folders.py: httpx.AsyncClient con ASGITransport
y dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET /trash → lista vacía con usuario autenticado
    - DELETE /{id} → 404 si el archivo no existe (soft-delete, no purga)
    - POST /trash/{id}/restore → 404 si el archivo no existe
    - POST /trash/{id}/restore → 400 si el archivo no está en la papelera
    - DELETE /trash/{id} → 400 si el archivo no está en la papelera (no se puede purgar directo)
    - DELETE /trash/{id} → 403 si no es admin
    - DELETE /trash → 204 vaciar papelera vacía (sin items, no debe fallar)
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


def _fake_db_with_active_file(file_id=7):
    """Archivo existente pero NO en la papelera (deleted_at=None)."""
    fake_file = MagicMock()
    fake_file.id = file_id
    fake_file.deleted_at = None
    fake_file.source_file_key = None
    fake_file.print_file_key = None
    fake_file.plates = []
    fake_file.tags = []
    fake_file.uploaded_by = None

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_file
        session.execute.return_value = result
        yield session

    return _gen


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestVaultTrashAuthRequired:
    async def test_get_trash_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/trash")
        finally:
            _clear_overrides()
        assert r.status_code == 401


class TestVaultTrashList:
    async def test_get_trash_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/vault/trash")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["items"] == []


class TestVaultSoftDelete:
    async def test_delete_archivo_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestVaultTrashRestore:
    async def test_restore_archivo_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/trash/999/restore")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_restore_archivo_no_esta_en_papelera_retorna_400(self):
        _set_overrides({
            get_db: _fake_db_with_active_file(),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/vault/trash/7/restore")
        finally:
            _clear_overrides()
        assert r.status_code == 400


class TestVaultTrashPurge:
    async def test_purge_archivo_no_esta_en_papelera_retorna_400(self):
        """No se puede borrar permanente un archivo activo directo — debe estar en la papelera primero."""
        _set_overrides({
            get_db: _fake_db_with_active_file(),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/trash/7")
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_purge_sin_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/trash/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_vaciar_papelera_vacia_no_falla(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/vault/trash")
        finally:
            _clear_overrides()
        assert r.status_code == 204
