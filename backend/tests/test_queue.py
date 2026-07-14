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


# ---------------------------------------------------------------------------
# 3b. failure_reason / failure_category al cancelar (issue #130)
# ---------------------------------------------------------------------------

def _fake_db_pending_item_no_source(item_id=1):
    """
    Item 'pending' sin quote_id/vault_model_id/piece_name — la transición a
    'cancelled' es válida y `_build_response` no dispara queries extra
    (ambos snapshots quedan None).
    """
    fake_item = MagicMock()
    fake_item.id = item_id
    fake_item.status = "pending"
    fake_item.quote_id = None
    fake_item.vault_model_id = None
    fake_item.project_id = None
    fake_item.piece_name = None
    fake_item.printer_id = None
    fake_item.position = 0
    fake_item.started_at = None
    fake_item.completed_at = None
    fake_item.notes = None
    fake_item.failure_reason = None
    fake_item.failure_category = None
    fake_item.batch_id = None
    fake_item.scheduled_at = None

    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = fake_item
        session.execute.return_value = result
        yield session

    return _gen, fake_item


class TestQueueCancelFailureReason:
    async def test_cancelar_con_motivo_lo_guarda(self):
        db_gen, fake_item = _fake_db_pending_item_no_source()
        _set_overrides({get_db: db_gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/1/status",
                    json={
                        "status": "cancelled",
                        "failure_reason": "Se despegó de la cama en capa 40",
                        "failure_category": "adhesion",
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert fake_item.failure_reason == "Se despegó de la cama en capa 40"
        assert fake_item.failure_category == "adhesion"
        body = r.json()
        assert body["failure_reason"] == "Se despegó de la cama en capa 40"
        assert body["failure_category"] == "adhesion"

    async def test_cancelar_sin_motivo_no_bloquea(self):
        """failure_reason/category son opcionales — cancelar sin ellos sigue 200."""
        db_gen, fake_item = _fake_db_pending_item_no_source()
        _set_overrides({get_db: db_gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/status", json={"status": "cancelled"})
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert fake_item.failure_reason is None
        assert fake_item.failure_category is None

    async def test_failure_category_invalida_retorna_422(self):
        """failure_category solo acepta las 6 categorías fijas."""
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/1/status",
                    json={"status": "cancelled", "failure_category": "not_a_real_category"},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 4. Asignación de proyecto (PUT /{id}/project)
# ---------------------------------------------------------------------------

def _fake_db_item_found_project_missing(item_id=1):
    """
    Primera query (_get_item) devuelve un item fake; la segunda (buscar el
    Project) devuelve None — simula "item existe, proyecto no".
    """
    fake_item = MagicMock()
    fake_item.id = item_id
    fake_item.project_id = None

    async def _gen():
        session = AsyncMock()
        result_item = MagicMock()
        result_item.scalar_one_or_none.return_value = fake_item
        result_missing = MagicMock()
        result_missing.scalar_one_or_none.return_value = None
        session.execute.side_effect = [result_item, result_missing]
        yield session

    return _gen


class TestQueueProjectAssignment:
    """Cubre PUT /api/queue/{id}/project — (re)asignar proyecto a un item."""

    async def test_assign_project_item_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/999/project", json={"project_id": 1})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_assign_project_proyecto_no_encontrado_retorna_404(self):
        """Item existe pero el project_id dado no corresponde a ningún proyecto."""
        _set_overrides({
            get_db: _fake_db_item_found_project_missing(),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/project", json={"project_id": 999})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_assign_project_sin_token_retorna_401(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/project", json={"project_id": 1})
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 5. project_id opcional al crear un item (POST / y POST /from-vault)
# ---------------------------------------------------------------------------

def _fake_db_quote_found_project_missing():
    """Quote existe (POST /); el project_id dado no corresponde a nada."""
    fake_quote = MagicMock()
    fake_quote.id = 1

    async def _gen():
        session = AsyncMock()
        result_quote = MagicMock()
        result_quote.scalar_one_or_none.return_value = fake_quote
        result_missing = MagicMock()
        result_missing.scalar_one_or_none.return_value = None
        session.execute.side_effect = [result_quote, result_missing]
        yield session

    return _gen


def _fake_db_vault_model_and_printer_found_project_missing():
    """Modelo del Vault + impresora existen (POST /from-vault); proyecto no."""
    fake_model = MagicMock()
    fake_model.id = 1
    fake_model.print_file_key = "some-key.gcode.3mf"
    fake_model.sliced_time_seconds = None
    fake_model.sliced_weight_g = None
    fake_model.name = "Modelo de prueba"

    fake_printer = MagicMock()
    fake_printer.id = 1

    async def _gen():
        session = AsyncMock()
        result_model = MagicMock()
        result_model.scalar_one_or_none.return_value = fake_model
        result_printer = MagicMock()
        result_printer.scalar_one_or_none.return_value = fake_printer
        result_missing = MagicMock()
        result_missing.scalar_one_or_none.return_value = None
        session.execute.side_effect = [result_model, result_printer, result_missing]
        yield session

    return _gen


class TestQueueCreateWithProject:
    """POST / y POST /from-vault validan project_id si viene en el body."""

    async def test_post_queue_project_id_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_quote_found_project_missing(),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/queue/", json={"quote_id": 1, "project_id": 999}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_post_queue_from_vault_project_id_no_encontrado_retorna_404(self):
        _set_overrides({
            get_db: _fake_db_vault_model_and_printer_found_project_missing(),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/queue/from-vault",
                    json={
                        "vault_model_id": 1,
                        "printer_id": 1,
                        "quantity": 1,
                        "project_id": 999,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404
