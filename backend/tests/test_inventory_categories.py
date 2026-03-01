"""
Tests del router de categorías de inventario (inventory_categories.py).

Estrategia:
    - Usa httpx.AsyncClient con ASGITransport para ejercitar endpoints HTTP reales.
    - Las dependencias de BD y autenticación se reemplazan con dependency_overrides.
    - Sigue el mismo patrón de MagicMock que test_company_templates.py.

Cubre:
    GET    /api/inventory/categories/        — lista de categorías
    POST   /api/inventory/categories/        — crear categoría
    PUT    /api/inventory/categories/{id}    — actualizar categoría
    DELETE /api/inventory/categories/{id}    — eliminar categoría

    Casos especiales:
    - 401 sin token en todos los endpoints
    - 404 cuando la categoría no existe
    - 409 al crear con nombre duplicado
    - 403 al renombrar o eliminar categoría de sistema
    - 409 al eliminar categoría con ítems asociados
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user

# UUID de empresa para los tests
COMPANY_A = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fake_user(company_id=COMPANY_A):
    """Crea un usuario MagicMock para inyectar como current_user."""
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
    u.company_id = company_id
    u.is_admin = True
    u.is_active = True
    return u


def _fake_category(
    cat_id: int = 1,
    company_id=COMPANY_A,
    name: str = "General",
    allows_decimals: bool = False,
    is_system: bool = False,
):
    """Crea un mock de InventoryCategory con los atributos mínimos requeridos."""
    c = MagicMock()
    c.id = cat_id
    c.company_id = company_id
    c.name = name
    c.allows_decimals = allows_decimals
    c.is_system = is_system
    c.created_at = datetime(2026, 2, 28, 10, 0, 0)
    return c


async def _fake_db_empty():
    """Mock de sesión de BD que no devuelve registros."""
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    session.execute.return_value = result
    yield session


def _fake_db_with_category(cat):
    """Genera un generador async de BD que devuelve la categoría indicada."""
    async def _inner():
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [cat]
        result.scalar_one_or_none.return_value = cat
        session.execute.return_value = result
        yield session
    return _inner


def _set_overrides(overrides: dict):
    """Aplica dependency_overrides indicados."""
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    """Limpia todos los dependency_overrides."""
    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Autenticación requerida — 401 sin token
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthRequired:
    """Los endpoints de categorías deben rechazar requests sin token JWT."""

    async def test_list_categorias_sin_token_retorna_401(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/categories/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_create_categoria_sin_token_retorna_401(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"name": "Nueva"})
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_update_categoria_sin_token_retorna_401(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/1", json={"name": "Nuevo"})
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_delete_categoria_sin_token_retorna_401(self):
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/categories/1")
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# 2. Listar categorías
# ─────────────────────────────────────────────────────────────────────────────

class TestListCategories:
    """GET /api/inventory/categories/ — lista de categorías."""

    async def test_lista_vacia_retorna_200(self):
        """Sin categorías, devuelve lista vacía con 200."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/categories/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json() == []

    async def test_lista_con_categorias_retorna_datos(self):
        """Con categorías, devuelve lista con los datos correctos."""
        cat = _fake_category(cat_id=1, name="Filamento", allows_decimals=True, is_system=True)
        _set_overrides({
            get_db: _fake_db_with_category(cat),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/categories/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["name"] == "Filamento"
        assert data[0]["allows_decimals"] is True
        assert data[0]["is_system"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 3. Crear categoría
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateCategory:
    """POST /api/inventory/categories/ — crear categoría."""

    async def test_crear_categoria_valida_retorna_201(self):
        """Crear categoría con nombre nuevo → 201 con los datos correctos."""
        new_cat = _fake_category(cat_id=2, name="Tornillería", allows_decimals=False)

        async def _db_no_dup():
            session = AsyncMock()
            result_none = MagicMock()
            result_none.scalar_one_or_none.return_value = None
            session.execute.return_value = result_none

            async def _refresh(obj):
                obj.id = new_cat.id
                obj.company_id = new_cat.company_id
                obj.name = new_cat.name
                obj.allows_decimals = new_cat.allows_decimals
                obj.is_system = new_cat.is_system
                obj.created_at = new_cat.created_at

            session.refresh = _refresh
            yield session

        _set_overrides({
            get_db: _db_no_dup,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={
                    "name": "Tornillería",
                    "allows_decimals": False,
                })
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert r.json()["name"] == "Tornillería"

    async def test_crear_categoria_nombre_duplicado_retorna_409(self):
        """Crear categoría con nombre que ya existe → 409."""
        dup = _fake_category(cat_id=1, name="Herramienta")
        async def _db_dup():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = dup
            session.execute.return_value = result
            yield session
        _set_overrides({
            get_db: _db_dup,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"name": "Herramienta"})
        finally:
            _clear_overrides()
        assert r.status_code == 409

    async def test_crear_categoria_nombre_vacio_retorna_422(self):
        """Nombre vacío → 422 (validación Pydantic)."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"name": ""})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_categoria_nombre_muy_largo_retorna_422(self):
        """Nombre > 100 chars → 422 (validación Pydantic)."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"name": "A" * 101})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_categoria_defaults_allows_decimals_false(self):
        """allows_decimals por defecto es False si no se envía."""
        new_cat = _fake_category(cat_id=3, name="Accesorio", allows_decimals=False)

        async def _db_no_dup():
            session = AsyncMock()
            result_none = MagicMock()
            result_none.scalar_one_or_none.return_value = None
            session.execute.return_value = result_none

            async def _refresh(obj):
                obj.id = new_cat.id
                obj.company_id = new_cat.company_id
                obj.name = new_cat.name
                obj.allows_decimals = new_cat.allows_decimals
                obj.is_system = new_cat.is_system
                obj.created_at = new_cat.created_at

            session.refresh = _refresh
            yield session

        _set_overrides({
            get_db: _db_no_dup,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"name": "Accesorio"})
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert r.json()["allows_decimals"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 4. Actualizar categoría
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateCategory:
    """PUT /api/inventory/categories/{id} — actualizar categoría."""

    async def test_actualizar_categoria_no_existente_retorna_404(self):
        """Categoría no encontrada → 404."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/99", json={"name": "Nuevo"})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_actualizar_categoria_nombre_retorna_200(self):
        """Actualizar nombre de categoría normal → 200."""
        cat = _fake_category(cat_id=1, name="General", is_system=False)

        async def _db_cat():
            session = AsyncMock()
            result_cat = MagicMock()
            result_cat.scalar_one_or_none.return_value = cat
            result_none = MagicMock()
            result_none.scalar_one_or_none.return_value = None  # no hay dup
            # Primera ejecución: obtener cat; segunda: check duplicado
            session.execute.side_effect = [result_cat, result_none]

            async def _refresh(obj):
                obj.id = cat.id
                obj.company_id = cat.company_id
                obj.name = "General v2"
                obj.allows_decimals = cat.allows_decimals
                obj.is_system = cat.is_system
                obj.created_at = cat.created_at

            session.refresh = _refresh
            yield session

        _set_overrides({
            get_db: _db_cat,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/1", json={"name": "General v2"})
        finally:
            _clear_overrides()
        assert r.status_code == 200

    async def test_renombrar_categoria_sistema_retorna_403(self):
        """Intentar renombrar categoría is_system=True → 403."""
        sys_cat = _fake_category(cat_id=1, name="Filamento", is_system=True)
        _set_overrides({
            get_db: _fake_db_with_category(sys_cat),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/1", json={"name": "Filamento Nuevo"})
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_actualizar_allows_decimals_categoria_sistema_retorna_200(self):
        """Cambiar allows_decimals en categoría de sistema → 200 (permitido)."""
        sys_cat = _fake_category(cat_id=1, name="Filamento", is_system=True, allows_decimals=True)
        _set_overrides({
            get_db: _fake_db_with_category(sys_cat),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/1", json={"allows_decimals": False})
        finally:
            _clear_overrides()
        assert r.status_code == 200

    async def test_actualizar_nombre_duplicado_retorna_409(self):
        """Nombre ya tomado por otra categoría → 409."""
        cat = _fake_category(cat_id=2, name="General", is_system=False)
        cat_dup = _fake_category(cat_id=3, name="Accesorio", is_system=False)

        async def _db_multi():
            session = AsyncMock()
            result_cat = MagicMock()
            result_cat.scalar_one_or_none.return_value = cat
            result_dup = MagicMock()
            result_dup.scalar_one_or_none.return_value = cat_dup
            # Primera ejecución: obtener cat; segunda: check dup
            session.execute.side_effect = [result_cat, result_dup]
            yield session

        _set_overrides({
            get_db: _db_multi,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/categories/2", json={"name": "Accesorio"})
        finally:
            _clear_overrides()
        assert r.status_code == 409


# ─────────────────────────────────────────────────────────────────────────────
# 5. Eliminar categoría
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteCategory:
    """DELETE /api/inventory/categories/{id} — eliminar categoría."""

    async def test_eliminar_categoria_no_existente_retorna_404(self):
        """Categoría no encontrada → 404."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/categories/99")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_eliminar_categoria_sistema_retorna_403(self):
        """Intentar eliminar categoría is_system=True → 403."""
        sys_cat = _fake_category(cat_id=1, name="Filamento", is_system=True)
        _set_overrides({
            get_db: _fake_db_with_category(sys_cat),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/categories/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403

    async def test_eliminar_categoria_con_items_retorna_409(self):
        """Eliminar categoría con ítems asociados → 409."""
        cat = _fake_category(cat_id=2, name="Herramienta", is_system=False)
        fake_item = MagicMock()  # Un ítem de inventario que usa esta categoría

        async def _db_cat_with_items():
            session = AsyncMock()
            result_cat = MagicMock()
            result_cat.scalar_one_or_none.return_value = cat
            result_items = MagicMock()
            result_items.scalar_one_or_none.return_value = fake_item
            session.execute.side_effect = [result_cat, result_items]
            yield session

        _set_overrides({
            get_db: _db_cat_with_items,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/categories/2")
        finally:
            _clear_overrides()
        assert r.status_code == 409

    async def test_eliminar_categoria_sin_items_retorna_204(self):
        """Eliminar categoría sin ítems → 204."""
        cat = _fake_category(cat_id=2, name="Herramienta", is_system=False)

        async def _db_cat_no_items():
            session = AsyncMock()
            result_cat = MagicMock()
            result_cat.scalar_one_or_none.return_value = cat
            result_items = MagicMock()
            result_items.scalar_one_or_none.return_value = None
            session.execute.side_effect = [result_cat, result_items]
            yield session

        _set_overrides({
            get_db: _db_cat_no_items,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/categories/2")
        finally:
            _clear_overrides()
        assert r.status_code == 204


# ─────────────────────────────────────────────────────────────────────────────
# 6. Validación de schemas
# ─────────────────────────────────────────────────────────────────────────────

class TestSchemaValidation:
    """Tests de validación de esquemas Pydantic."""

    async def test_crear_sin_nombre_retorna_422(self):
        """Enviar JSON sin campo name → 422."""
        _set_overrides({
            get_db: _fake_db_empty,
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/inventory/categories/", json={"allows_decimals": True})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_respuesta_lista_contiene_campos_requeridos(self):
        """La respuesta de lista contiene id, name, allows_decimals, is_system, created_at."""
        cat = _fake_category(cat_id=5, name="Repuesto", allows_decimals=False, is_system=False)
        _set_overrides({
            get_db: _fake_db_with_category(cat),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/categories/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        item = data[0]
        assert "id" in item
        assert "name" in item
        assert "allows_decimals" in item
        assert "is_system" in item
        assert "created_at" in item
        assert item["id"] == 5
        assert item["name"] == "Repuesto"
        assert item["allows_decimals"] is False
        assert item["is_system"] is False
