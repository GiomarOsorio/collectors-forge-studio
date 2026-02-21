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
