"""
Tests para el router de cola de impresión (/api/queue).

Usa httpx.AsyncClient con ASGITransport y dependency_overrides para
sustituir la BD y el usuario autenticado. No requiere PostgreSQL real.

Cubre:
    - 401 sin autenticación
    - GET / → lista vacía con usuario autenticado
    - GET /history → lista vacía
    - POST / → 404 si la cotización no existe (mock devuelve None)
    - PUT /{id}/status → estado inválido retorna 400
    - PUT /{id}/status → ítem no encontrado retorna 404
    - DELETE /{id} → ítem no encontrado retorna 404
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
    session.execute.return_value = result
    yield session


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Sin autenticación → 401
# ---------------------------------------------------------------------------

class TestQueueAuthRequired:
    """Los endpoints de /api/queue requieren autenticación."""

    async def test_get_queue_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_get_history_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/history")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_post_queue_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/", json={"quote_id": 1})
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 2. Con autenticación → respuestas esperadas
# ---------------------------------------------------------------------------

class TestQueueAuthenticated:
    """Endpoints con usuario autenticado y BD mock vacía."""

    async def test_get_queue_retorna_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_get_history_retorna_lista_vacia(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/history")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_post_queue_cotizacion_no_encontrada_retorna_404(self):
        """Si la cotización no existe en la BD, debe devolver 404."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/", json={"quote_id": 999})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_post_queue_sin_quote_id_retorna_422(self):
        """El campo quote_id es obligatorio."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_put_status_item_no_encontrado_retorna_404(self):
        """Si el ítem no existe, PUT /status debe devolver 404."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/999/status", json={"status": "printing"})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_put_status_invalido_retorna_400(self):
        """Un status desconocido debe devolver 400 antes de buscar el ítem."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/status", json={"status": "volando"})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_delete_item_no_encontrado_retorna_404(self):
        """Si el ítem no existe, DELETE debe devolver 404."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/queue/999")
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 3. Validación de estado inválido antes de buscar el ítem
# ---------------------------------------------------------------------------

class TestQueueStatusValidation:
    """Verifica que la validación de status ocurre antes de la consulta a BD."""

    @pytest.mark.parametrize("invalid_status", ["pending", "done_already", "", "DONE"])
    async def test_status_invalido_retorna_400(self, invalid_status):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/status", json={"status": invalid_status})
        finally:
            _clear_overrides()
        # 'pending' no es un destino válido; 'done_already', '', 'DONE' tampoco
        assert r.status_code == 400
