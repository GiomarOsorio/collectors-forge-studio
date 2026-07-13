"""
Tests para perfiles de impresión (slicer) de filamento (/api/filament-profiles).

Mismo patrón que test_queue.py: httpx.AsyncClient con ASGITransport y
dependency_overrides para sustituir la BD y el usuario autenticado. No
requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET /{id} → 404 si el filamento no tiene perfil guardado
    - PUT /{id} → 403 si no es admin/operator
    - PUT /{id} → 404 si el ítem de inventario no existe
    - PUT /{id} → 422 si un valor sale de rango (fan_speed_percent > 100)
    - DELETE /{id} → 404 si no hay perfil guardado
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
    session.execute.return_value = result
    yield session


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestFilamentProfilesAuthRequired:
    async def test_get_profile_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/filament-profiles/1")
        finally:
            _clear_overrides()
        assert r.status_code == 401


class TestFilamentProfilesGet:
    async def test_get_profile_no_encontrado_retorna_404(self):
        """404 cuando el filamento no tiene perfil de slicer guardado todavía."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/filament-profiles/1")
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestFilamentProfilesUpsert:
    async def test_put_profile_sin_operator_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="viewer"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/filament-profiles/1", json={"nozzle_temp_min": 200})
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_put_profile_item_no_encontrado_retorna_404(self):
        """404 si el inventory_item_id no corresponde a ningún filamento."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/filament-profiles/999", json={"nozzle_temp_min": 200})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {"fan_speed_percent": 150},  # > 100
            {"nozzle_temp_min": -10},  # < 0
            {"flow_ratio": 0},  # debe ser > 0
            {"k_value": -0.01},  # k_value no puede ser negativo
            {"k_value": 100},  # > 99 (fuera del rango razonable de K-factor)
        ],
    )
    async def test_put_profile_valor_fuera_de_rango_retorna_422(self, payload):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/filament-profiles/1", json=payload)
        finally:
            _clear_overrides()
        assert r.status_code == 422


class TestFilamentProfilesDelete:
    async def test_delete_profile_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/filament-profiles/1")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_profile_sin_operator_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(role="viewer"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/filament-profiles/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403
