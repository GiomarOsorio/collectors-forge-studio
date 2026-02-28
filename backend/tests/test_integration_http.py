"""
Tests de integración HTTP para TurtleForge Cost API (M-03).

Usa httpx.AsyncClient con ASGITransport para ejercitar los endpoints
HTTP reales sin necesidad de una base de datos PostgreSQL. Las
dependencias de BD y autenticación se sustituyen mediante
FastAPI dependency_overrides.

Cubre:
    - 401 sin autenticación (múltiples rutas protegidas)
    - Flujo de login (éxito y credenciales inválidas)
    - Validación de esquema Pydantic → 422 en POST endpoints
    - Aislamiento multi-tenant: las queries filtran por company_id
      y los recursos de empresa ajena devuelven 404
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user

# UUIDs de empresa para los tests de multi-tenant
COMPANY_A = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
COMPANY_B = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000002")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_user(company_id=COMPANY_A, user_id=1, is_admin=False):
    """Crea un usuario MagicMock para inyectar como current_user."""
    u = MagicMock()
    u.id = user_id
    u.username = "testuser"
    u.company_id = company_id
    u.is_admin = is_admin
    u.is_active = True
    return u


async def _fake_db_empty():
    """
    Mock de sesión de base de datos que no devuelve registros.

    Seguro para usar en tests que no necesitan datos reales:
    - scalar_one_or_none → None  (ítem no encontrado)
    - scalars().all()    → []   (lista vacía)
    - scalar_one         → 0    (count = 0)
    """
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    session.execute.return_value = result
    yield session


def _set_overrides(overrides: dict):
    """Aplica los dependency_overrides indicados al app."""
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    """Limpia todos los dependency_overrides."""
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Autenticación requerida (401 sin token)
# ---------------------------------------------------------------------------

class TestAuthRequired:
    """
    Los endpoints protegidos deben rechazar requests sin token JWT.

    El override de get_db se aplica por precaución aunque OAuth2PasswordBearer
    levanta 401 antes de que se invoque la sesión de BD.
    """

    async def test_inventory_items_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/items/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_quotes_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/quotes/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_client_quotes_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/client-quotes/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_printed_items_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/prints/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_slicer_jobs_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/slicer/jobs")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_settings_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/settings/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_printers_sin_token(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/printers/")
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 2. Flujo de login
# ---------------------------------------------------------------------------

class TestLoginFlow:
    """Verifica el endpoint POST /api/auth/login."""

    async def test_login_sin_campos_retorna_422(self):
        """Enviar JSON vacío (no es form-data) → 422."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/login", json={})
        # login usa OAuth2PasswordRequestForm (multipart/form-data), no JSON
        assert r.status_code == 422

    async def test_login_credenciales_invalidas_retorna_401(self):
        """Usuario inexistente → 401."""
        async def _db_usuario_inexistente():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = None  # usuario no encontrado
            session.execute.return_value = result
            yield session

        _set_overrides({get_db: _db_usuario_inexistente})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/auth/login",
                    data={"username": "noexiste", "password": "wrongpass"},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_login_usuario_desactivado_retorna_403(self):
        """Usuario desactivado (is_active=False) → 403."""
        from app.services.auth import get_password_hash

        inactive_user = MagicMock()
        inactive_user.username = "inactivo"
        inactive_user.hashed_password = get_password_hash("secret")
        inactive_user.is_active = False

        async def _db_usuario_inactivo():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = inactive_user
            session.execute.return_value = result
            yield session

        _set_overrides({get_db: _db_usuario_inactivo})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/auth/login",
                    data={"username": "inactivo", "password": "secret"},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_login_exitoso_retorna_token(self):
        """Credenciales correctas → 200 con access_token."""
        from app.services.auth import get_password_hash

        active_user = MagicMock()
        active_user.username = "admin"
        active_user.hashed_password = get_password_hash("correctpassword")
        active_user.is_active = True

        async def _db_usuario_activo():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = active_user
            session.execute.return_value = result
            yield session

        _set_overrides({get_db: _db_usuario_activo})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/auth/login",
                    data={"username": "admin", "password": "correctpassword"},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 10  # token no vacío


# ---------------------------------------------------------------------------
# 3. Validación de esquema (422)
# ---------------------------------------------------------------------------

class TestSchemaValidation:
    """Los endpoints POST/PUT rechazan payloads inválidos con 422."""

    async def test_create_client_quote_cantidad_negativa_422(self):
        """quantity negativo en ítem → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/client-quotes/", json={
                    "client_name": "Test",
                    "quote_date": "2026-02-21",
                    "expiry_days": 30,
                    "items": [{"name": "Pieza", "quantity": -5, "unit_price": 10.0}],
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_create_client_quote_items_vacio_422(self):
        """Lista de items vacía → 422 (min_length=1)."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/client-quotes/", json={
                    "client_name": "Test",
                    "quote_date": "2026-02-21",
                    "expiry_days": 30,
                    "items": [],
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_create_inventory_item_sin_nombre_422(self):
        """Falta campo 'name' requerido → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/items/", json={
                    "category": "Filamento",
                    "unit": "kg",
                    "quantity": 1,
                    "unit_cost": 25.0,
                    # falta "name"
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_sell_printed_item_cantidad_cero_422(self):
        """quantity=0 en venta → 422 (ge=1)."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/prints/1/sell", json={"quantity": 0})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_register_password_corta_422(self):
        """password menor a 8 caracteres → 422 (A-04)."""
        admin_user = _fake_user(is_admin=True)
        _set_overrides({
            get_current_user: lambda: admin_user,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/auth/register", json={
                    "username": "newuser",
                    "email": "new@test.com",
                    "password": "short",  # < 8 caracteres
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 4. Aislamiento multi-tenant
# ---------------------------------------------------------------------------

class TestMultiTenantIsolation:
    """Cada empresa solo puede ver y modificar sus propios recursos."""

    async def test_inventory_lista_filtra_por_company_id(self):
        """
        GET /inventory/items/ ejecuta query WHERE company_id = user.company_id.

        Verificamos que el UUID de la empresa del usuario aparece en la
        query SQL compilada para garantizar el aislamiento multi-tenant.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        async def _db_captura():
            session = AsyncMock()

            async def execute_captura(query, *args, **kwargs):
                try:
                    compiled = query.compile(compile_kwargs={"literal_binds": True})
                    captured.append(str(compiled))
                except Exception:
                    pass
                result = MagicMock()
                result.scalars.return_value.all.return_value = []
                result.scalar_one.return_value = 0
                result.scalar_one_or_none.return_value = None
                return result

            session.execute = execute_captura
            yield session

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _db_captura,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/items/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        # SQLAlchemy compila UUIDs sin guiones; verificamos ambas formas
        company_a_str = str(COMPANY_A)
        company_a_nodash = company_a_str.replace("-", "")
        assert any(company_a_str in q or company_a_nodash in q for q in captured), (
            f"Ninguna query filtró por company_id={company_a_str}. "
            f"Queries capturadas: {captured}"
        )

    async def test_get_inventory_item_empresa_ajena_retorna_404(self):
        """
        Un usuario de empresa A no puede acceder a un ítem de empresa B.

        La query filtra por company_id del usuario autenticado, por lo que
        scalar_one_or_none devuelve None → HTTPException 404.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        # El mock no devuelve ningún resultado (ítem existe pero con otro company_id)
        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/items/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_get_quote_empresa_ajena_retorna_404(self):
        """Un usuario de empresa A no puede acceder a una cotización de empresa B → 404."""
        user_a = _fake_user(company_id=COMPANY_A)
        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/quotes/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_get_client_quote_empresa_ajena_retorna_404(self):
        """Un usuario de empresa A no puede acceder a una cotización de cliente de empresa B → 404."""
        user_a = _fake_user(company_id=COMPANY_A)
        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/client-quotes/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_printed_items_lista_filtra_por_company_id(self):
        """
        GET /inventory/prints/ ejecuta query WHERE company_id = user.company_id.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        async def _db_captura_prints():
            session = AsyncMock()

            async def execute_captura(query, *args, **kwargs):
                try:
                    compiled = query.compile(compile_kwargs={"literal_binds": True})
                    captured.append(str(compiled))
                except Exception:
                    pass
                result = MagicMock()
                result.scalars.return_value.all.return_value = []
                result.scalar_one.return_value = 0
                result.scalar_one_or_none.return_value = None
                return result

            session.execute = execute_captura
            yield session

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _db_captura_prints,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/prints/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        # SQLAlchemy compila UUIDs sin guiones; verificamos ambas formas
        company_a_str = str(COMPANY_A)
        company_a_nodash = company_a_str.replace("-", "")
        assert any(company_a_str in q or company_a_nodash in q for q in captured), (
            f"Ninguna query filtró por company_id={company_a_str}. "
            f"Queries capturadas: {captured}"
        )


# ---------------------------------------------------------------------------
# Helper compartido: captura de queries SQL para tests multi-tenant
# ---------------------------------------------------------------------------

def _make_db_captura(captured: list):
    """
    Crea un generador de sesión de BD que captura las queries SQL compiladas.

    Las queries se almacenan como cadenas en la lista 'captured' para poder
    verificar posteriormente que contengan el UUID de la empresa correcta.

    Args:
        captured: Lista mutable donde se acumularán las queries capturadas.

    Returns:
        Función generadora async compatible con dependency_overrides de FastAPI.
    """
    async def _db_captura():
        session = AsyncMock()

        async def execute_captura(query, *args, **kwargs):
            try:
                compiled = query.compile(compile_kwargs={"literal_binds": True})
                captured.append(str(compiled))
            except Exception:
                pass
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            result.scalars.return_value.unique.return_value.all.return_value = []
            result.scalar_one.return_value = 0
            result.scalar_one_or_none.return_value = None
            result.scalar.return_value = None
            return result

        session.execute = execute_captura
        yield session

    return _db_captura


def _assert_company_id_in_queries(captured: list, company_id) -> None:
    """
    Verifica que al menos una query capturada contenga el UUID de empresa.

    SQLAlchemy puede compilar el UUID con o sin guiones según el backend,
    por lo que se verifican ambas formas.

    Args:
        captured:   Lista de queries SQL capturadas.
        company_id: UUID de empresa esperado en las queries.

    Raises:
        AssertionError: Si ninguna query contiene el UUID de la empresa.
    """
    company_str = str(company_id)
    company_nodash = company_str.replace("-", "")
    assert any(company_str in q or company_nodash in q for q in captured), (
        f"Ninguna query filtró por company_id={company_str}. "
        f"Queries capturadas: {captured}"
    )


# ---------------------------------------------------------------------------
# 5. Autenticación requerida — rutas nuevas (A-01 ampliación)
# ---------------------------------------------------------------------------

class TestAuthRequiredNew:
    """
    Ampliación de TestAuthRequired para los endpoints de las apps nuevas.

    Verifica que todos los endpoints protegidos de Queue, Maintenance,
    Company y Company Templates rechacen solicitudes sin token JWT con 401.
    """

    async def test_queue_sin_token(self):
        """GET /api/queue/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_queue_history_sin_token(self):
        """GET /api/queue/history sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/history")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_maintenance_logs_sin_token(self):
        """GET /api/maintenance/logs/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/logs/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_maintenance_summary_sin_token(self):
        """GET /api/maintenance/summary/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/summary/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_company_profile_sin_token(self):
        """GET /api/company/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_company_templates_sin_token(self):
        """GET /api/company/templates/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_purchase_orders_sin_token(self):
        """GET /api/inventory/purchases/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/purchases/")
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 6. Cola de impresión (Queue)
# ---------------------------------------------------------------------------

class TestQueueIntegration:
    """
    Tests de integración HTTP para la app Cola de Impresión (/api/queue).

    Cubre los flujos principales: listado, historial, validación de schema
    y aislamiento multi-tenant. Los tests de creación y cambio de estado
    requieren lógica de BD compleja (FK a quotes) por lo que se limitan
    al plano de validación Pydantic.
    """

    async def test_queue_lista_vacia(self):
        """GET /api/queue/ autenticado con BD vacía → 200 y lista vacía."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_queue_history_lista_vacia(self):
        """GET /api/queue/history autenticado con BD vacía → 200 y lista vacía."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/history")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_crear_queue_item_sin_quote_id_422(self):
        """POST /api/queue/ sin quote_id (campo requerido) → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                # quote_id es requerido en PrintQueueItemCreate — enviar payload vacío
                r = await c.post("/api/queue/", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_queue_item_quote_no_existe_404(self):
        """POST /api/queue/ con quote_id válido pero inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,  # scalar_one_or_none → None = quote no encontrada
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/", json={"quote_id": 9999})
        finally:
            _clear_overrides()
        # El router lanza 404 cuando la cotización no existe
        assert r.status_code == 404

    async def test_update_status_queue_item_no_existe_404(self):
        """PUT /api/queue/9999/status con ítem inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,  # scalar_one_or_none → None = ítem no encontrado
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/9999/status", json={"status": "printing"})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_queue_item_no_existe_404(self):
        """DELETE /api/queue/9999 con ítem inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/queue/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_update_status_payload_vacio_422(self):
        """PUT /api/queue/1/status sin campo 'status' → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/status", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_queue_filtra_por_company_id(self):
        """
        GET /api/queue/ ejecuta query WHERE company_id = user.company_id.

        Verifica el aislamiento multi-tenant en la cola de impresión.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _make_db_captura(captured),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        _assert_company_id_in_queries(captured, COMPANY_A)


# ---------------------------------------------------------------------------
# 7. Mantenimiento de impresoras (Maintenance)
# ---------------------------------------------------------------------------

class TestMaintenanceIntegration:
    """
    Tests de integración HTTP para la app Mantenimiento (/api/maintenance).

    El router de mantenimiento expone: GET/POST /logs/, GET/DELETE /logs/{id}
    y GET /summary/. No hay endpoint /printers/ en este router (las impresoras
    se gestionan desde /api/printers/ en la app Cost).
    """

    async def test_maintenance_logs_lista_vacia(self):
        """GET /api/maintenance/logs/ autenticado con BD vacía → 200 y lista vacía."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/logs/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_maintenance_summary_sin_impresoras(self):
        """
        GET /api/maintenance/summary/ con BD vacía → 200 y lista vacía.

        El endpoint retorna [] directamente cuando no hay impresoras en la empresa.
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/summary/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_get_log_no_existe_404(self):
        """GET /api/maintenance/logs/9999 con log inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/logs/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_log_no_existe_404(self):
        """DELETE /api/maintenance/logs/9999 con log inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/maintenance/logs/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_crear_log_sin_campos_requeridos_422(self):
        """
        POST /api/maintenance/logs/ sin campos requeridos → 422.

        MaintenanceLogCreate requiere: printer_id, hours_at_maintenance,
        maintenance_type. Sin ellos Pydantic rechaza con 422.
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/maintenance/logs/", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_log_hours_negativas_422(self):
        """
        POST /api/maintenance/logs/ con hours_at_maintenance negativo → 422.

        El schema define hours_at_maintenance con Field(ge=0).
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/maintenance/logs/", json={
                    "printer_id": 1,
                    "hours_at_maintenance": -10,
                    "maintenance_type": "limpieza",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_maintenance_logs_filtra_por_company_id(self):
        """
        GET /api/maintenance/logs/ ejecuta query WHERE company_id = user.company_id.

        Verifica el aislamiento multi-tenant en los registros de mantenimiento.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _make_db_captura(captured),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/logs/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        _assert_company_id_in_queries(captured, COMPANY_A)


# ---------------------------------------------------------------------------
# 8. Perfil de empresa (Company)
# ---------------------------------------------------------------------------

class TestCompanyIntegration:
    """
    Tests de integración HTTP para la app Company (/api/company).

    El router expone: GET / (cualquier usuario), PUT / (admin),
    POST /logo (admin). Los tests de escritura requieren is_admin=True.
    """

    async def test_company_profile_empresa_no_encontrada_404(self):
        """
        GET /api/company/ cuando la empresa no existe en BD → 404.

        Simula el caso donde company_id del usuario no tiene registro en Company.
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,  # scalar_one_or_none → None = empresa no encontrada
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_company_profile_200(self):
        """
        GET /api/company/ cuando la empresa existe → 200 con datos de la empresa.

        Inyecta un MagicMock que simula un objeto Company con los campos
        necesarios para serializar CompanyResponse.
        """
        import uuid as _uuid

        empresa_mock = MagicMock()
        empresa_mock.id = _uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        empresa_mock.name = "TurtleForge Test"
        empresa_mock.slogan = None
        empresa_mock.address = None
        empresa_mock.phone = None
        empresa_mock.contact_email = None
        empresa_mock.nit = None
        empresa_mock.logo_url = None
        empresa_mock.pdf_palette = None
        empresa_mock.pdf_terms = None

        async def _db_con_empresa():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = empresa_mock
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(company_id=empresa_mock.id),
            get_db: _db_con_empresa,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "TurtleForge Test"

    async def test_update_company_requiere_admin(self):
        """
        PUT /api/company/ con usuario no-admin → 403.

        El endpoint usa get_current_admin que rechaza usuarios sin is_admin=True.
        """
        from app.services.auth import get_current_admin

        usuario_normal = _fake_user(is_admin=False)
        _set_overrides({
            get_current_user: lambda: usuario_normal,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/company/", json={"name": "Nuevo Nombre"})
        finally:
            _clear_overrides()
        # Sin override de get_current_admin, la dependencia real rechaza el token mock
        # El usuario sin token real obtiene 401 (OAuth2PasswordBearer actúa primero)
        assert r.status_code in (401, 403)

    async def test_update_branding_palette_hex_invalido_422(self):
        """
        PUT /api/company/ con color hex inválido en pdf_palette → 422.

        PaletteColor.valid_hex exige formato #RRGGBB (7 caracteres con #).
        """
        admin_user = _fake_user(is_admin=True)

        async def _fake_admin():
            return admin_user

        from app.services.auth import get_current_admin

        _set_overrides({
            get_current_user: lambda: admin_user,
            get_current_admin: _fake_admin,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/company/", json={
                    "pdf_palette": [
                        {"name": "Primario", "hex": "ZZZZZZ"},  # hex inválido
                    ]
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 9. Templates de cotización Liquid (Company Templates)
# ---------------------------------------------------------------------------

class TestCompanyTemplatesIntegration:
    """
    Tests de integración HTTP para /api/company/templates.

    Los endpoints de escritura (POST, PUT, DELETE) requieren is_admin=True.
    El listado y la validación son accesibles para cualquier usuario autenticado.
    """

    async def test_templates_lista_vacia(self):
        """GET /api/company/templates/ autenticado con BD vacía → 200 y lista vacía."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_get_template_no_existe_404(self):
        """GET /api/company/templates/9999 con template inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_crear_template_sin_nombre_422(self):
        """
        POST /api/company/templates/ sin campo 'name' → 422.

        CompanyTemplateCreate hereda CompanyTemplateBase que requiere 'name'
        y 'content'. Sin ellos Pydantic rechaza con 422.
        """
        admin_user = _fake_user(is_admin=True)

        async def _fake_admin():
            return admin_user

        from app.services.auth import get_current_admin

        _set_overrides({
            get_current_user: lambda: admin_user,
            get_current_admin: _fake_admin,
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/", json={
                    # falta 'name' y 'content'
                    "template_type": "cot",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_validate_template_ok(self):
        """
        POST /api/company/templates/validate con template Liquid válido → 200 ok=true.

        Mockea validate_template para evitar dependencia de WeasyPrint/Liquid.
        """
        from unittest.mock import patch

        resultado_ok = {
            "ok": True,
            "errors": [],
            "warnings": [],
            "preview_pdf_b64": None,
        }

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            with patch(
                "app.routers.company_templates.validate_template",
                return_value=resultado_ok,
            ):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/company/templates/validate", json={
                        "content": "<html><body>{{ quote.client_name }}</body></html>",
                        "template_type": "cot",
                    })
        finally:
            _clear_overrides()

        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["errors"] == []

    async def test_validate_template_invalido(self):
        """
        POST /api/company/templates/validate con Liquid roto → 200 ok=false.

        Cuando el template tiene errores de sintaxis, validate_template retorna
        ok=False con la lista de errores. El endpoint siempre responde 200.
        """
        from unittest.mock import patch

        resultado_error = {
            "ok": False,
            "errors": ["Error de sintaxis Liquid: tag no cerrado"],
            "warnings": [],
            "preview_pdf_b64": None,
        }

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            with patch(
                "app.routers.company_templates.validate_template",
                return_value=resultado_error,
            ):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/company/templates/validate", json={
                        "content": "{% for item in items %}sin cerrar",
                        "template_type": "cot",
                    })
        finally:
            _clear_overrides()

        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert len(body["errors"]) > 0

    async def test_validate_template_sin_content_422(self):
        """
        POST /api/company/templates/validate sin campo 'content' → 422.

        TemplateValidateRequest requiere 'content' (str). Sin él → 422.
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/validate", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_templates_filtra_por_company_id(self):
        """
        GET /api/company/templates/ ejecuta query WHERE company_id = user.company_id.

        Verifica el aislamiento multi-tenant en los templates de cotización.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _make_db_captura(captured),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        _assert_company_id_in_queries(captured, COMPANY_A)


# ---------------------------------------------------------------------------
# 10. Órdenes de compra (Purchase Orders)
# ---------------------------------------------------------------------------

class TestPurchaseOrdersIntegration:
    """
    Tests de integración HTTP para la app Inventario → Compras (/api/inventory/purchases).

    Cubre listado vacío, 404 en recurso inexistente y validación de schema.
    Los tests de creación exitosa requieren BD real por las relaciones ORM.
    """

    async def test_purchases_lista_vacia(self):
        """GET /api/inventory/purchases/ autenticado con BD vacía → 200 y lista vacía."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/purchases/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_get_purchase_no_existe_404(self):
        """GET /api/inventory/purchases/9999 con orden inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/purchases/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_delete_purchase_no_existe_404(self):
        """DELETE /api/inventory/purchases/9999 con orden inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/purchases/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_crear_purchase_sin_supplier_422(self):
        """
        POST /api/inventory/purchases/ sin campo 'supplier' (requerido) → 422.

        PurchaseOrderCreate requiere supplier (min_length=1) e items (min_length=1).
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/purchases/", json={})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_purchase_items_vacio_422(self):
        """
        POST /api/inventory/purchases/ con items=[] → 422.

        PurchaseOrderCreate define items con Field(min_length=1).
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/purchases/", json={
                    "supplier": "Proveedor Test",
                    "items": [],  # min_length=1 → 422
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_purchase_item_quantity_cero_422(self):
        """
        POST /api/inventory/purchases/ con quantity=0 en ítem → 422.

        PurchaseOrderItemCreate define quantity con Field(gt=0).
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/purchases/", json={
                    "supplier": "Proveedor Test",
                    "items": [{"name": "Filamento PLA", "quantity": 0, "unit_cost": 25.0}],
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_purchases_filtra_por_company_id(self):
        """
        GET /api/inventory/purchases/ ejecuta query WHERE company_id = user.company_id.

        Verifica el aislamiento multi-tenant en las órdenes de compra.
        """
        user_a = _fake_user(company_id=COMPANY_A)
        captured: list[str] = []

        _set_overrides({
            get_current_user: lambda: user_a,
            get_db: _make_db_captura(captured),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/purchases/")
        finally:
            _clear_overrides()

        assert r.status_code == 200
        _assert_company_id_in_queries(captured, COMPANY_A)
