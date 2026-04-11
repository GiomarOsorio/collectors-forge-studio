"""
Tests del router de templates de cotización Liquid (company_templates.py).

Estrategia:
    - Usa httpx.AsyncClient con ASGITransport para ejercitar endpoints HTTP reales.
    - Las dependencias de BD y autenticación se reemplazan con dependency_overrides.
    - La generación de PDF (validate_template) se mockea para no depender de
      python-liquid ni WeasyPrint en el entorno de CI.
    - Sigue el mismo patrón de MagicMock que test_integration_http.py.

Cubre:
    GET    /api/company/templates/           — lista de templates
    POST   /api/company/templates/           — crear template
    GET    /api/company/templates/{id}       — obtener por ID, 404 si no existe
    PUT    /api/company/templates/{id}       — actualizar, 404 si no existe
    DELETE /api/company/templates/{id}       — eliminar, 404 si no existe
    POST   /api/company/templates/{id}/set-default — marcar como default
    POST   /api/company/templates/validate   — validar Liquid
    GET    /api/company/templates/{id}/preview — PDF de muestra
    GET    /api/company/templates/default-template — template por defecto del sistema

    Autenticación:
    - GET endpoints protegidos: 401 sin token.
    - POST/PUT/DELETE solo admin: 401 sin token.
"""

import base64
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fake_user(user_id=1, role="operator"):
    """Crea un usuario MagicMock para inyectar como current_user."""
    u = MagicMock()
    u.id = user_id
    u.username = "testuser"
    u.role = role
    u.is_active = True
    return u


def _fake_admin():
    """Crea un usuario administrador MagicMock."""
    return _fake_user(role="admin")


def _fake_template(
    template_id: int = 1,
    name: str = "Template de prueba",
    description: str = "Descripción de prueba",
    template_type: str = "cot",
    content: str = "{{ quote_number }}",
    is_default: bool = False,
):
    """Crea un mock de CompanyTemplate con los atributos mínimos requeridos."""
    t = MagicMock()
    t.id = template_id
    t.name = name
    t.description = description
    t.template_type = template_type
    t.content = content
    t.is_default = is_default
    t.created_at = datetime(2026, 2, 27, 12, 0, 0)
    t.updated_at = None
    return t


async def _fake_db_empty():
    """
    Mock de sesión de BD que no devuelve registros.
    Seguro para endpoints que esperan lista vacía o 404.
    """
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    session.execute.return_value = result
    yield session


def _fake_db_with_template(template):
    """Genera un generador async de BD que devuelve el template indicado."""
    async def _inner():
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [template]
        result.scalar_one_or_none.return_value = template
        result.scalar_one.return_value = 1
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
    """Los endpoints de templates deben rechazar requests sin token JWT."""

    async def test_list_templates_sin_token_retorna_401(self):
        """GET /api/company/templates/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_create_template_sin_token_retorna_401(self):
        """POST /api/company/templates/ sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/", json={
                    "name": "Test", "content": "{{ quote_number }}", "template_type": "cot",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_get_template_sin_token_retorna_401(self):
        """GET /api/company/templates/{id} sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/1")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_update_template_sin_token_retorna_401(self):
        """PUT /api/company/templates/{id} sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/company/templates/1", json={"name": "Nuevo"})
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_delete_template_sin_token_retorna_401(self):
        """DELETE /api/company/templates/{id} sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/company/templates/1")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_set_default_sin_token_retorna_401(self):
        """POST /api/company/templates/{id}/set-default sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/1/set-default")
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_validate_sin_token_retorna_401(self):
        """POST /api/company/templates/validate sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/validate", json={"content": "{{ quote_number }}"})
        finally:
            _clear_overrides()
        assert r.status_code == 401

    async def test_preview_sin_token_retorna_401(self):
        """GET /api/company/templates/{id}/preview sin token → 401."""
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/1/preview")
        finally:
            _clear_overrides()
        assert r.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# 2. GET /api/company/templates/ — listar templates
# ─────────────────────────────────────────────────────────────────────────────

class TestListTemplates:
    """Verifica el endpoint de listado de templates."""

    async def test_lista_vacia_retorna_200_con_array_vacio(self):
        """Sin templates en BD → 200 con lista vacía."""
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

    async def test_lista_con_template_retorna_array_con_un_elemento(self):
        """Con un template en BD → 200 con lista de un elemento."""
        tpl = _fake_template()
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_with_template(tpl),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == 1
        assert data[0]["name"] == "Template de prueba"


# ─────────────────────────────────────────────────────────────────────────────
# 3. POST /api/company/templates/ — crear template
# ─────────────────────────────────────────────────────────────────────────────

class TestCreateTemplate:
    """Verifica el endpoint de creación de templates."""

    async def test_crear_template_valido_retorna_201(self):
        """POST con datos válidos y usuario admin → 201 con template creado."""
        tpl = _fake_template(name="Mi Template", content="{{ quote_number }}")

        async def _db_create():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            result.scalar_one_or_none.return_value = None
            session.execute.return_value = result
            session.refresh.side_effect = lambda obj: None
            # El objeto añadido vuelve con los datos correctos después de refresh
            async def _refresh(obj):
                obj.id = tpl.id
                obj.company_id = tpl.company_id
                obj.name = tpl.name
                obj.content = tpl.content
                obj.template_type = tpl.template_type
                obj.is_default = tpl.is_default
                obj.created_at = tpl.created_at
                obj.updated_at = tpl.updated_at
                obj.description = tpl.description
            session.refresh = _refresh
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _db_create,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/", json={
                    "name": "Mi Template",
                    "content": "{{ quote_number }}",
                    "template_type": "cot",
                    "is_default": False,
                })
        finally:
            _clear_overrides()
        assert r.status_code == 201

    async def test_crear_template_sin_nombre_retorna_422(self):
        """POST sin campo 'name' requerido → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/", json={
                    # Falta "name"
                    "content": "{{ quote_number }}",
                    "template_type": "cot",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_crear_template_sin_content_retorna_422(self):
        """POST sin campo 'content' requerido → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/", json={
                    "name": "Test",
                    # Falta "content"
                    "template_type": "cot",
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# 4. GET /api/company/templates/{id} — obtener por ID
# ─────────────────────────────────────────────────────────────────────────────

class TestGetTemplate:
    """Verifica el endpoint de obtención de template por ID."""

    async def test_template_existente_retorna_200(self):
        """Template existente → 200 con datos del template."""
        tpl = _fake_template(template_id=5, name="Template Específico")
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_with_template(tpl),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/5")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == 5
        assert data["name"] == "Template Específico"

    async def test_template_inexistente_retorna_404(self):
        """Template que no existe → 404."""
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

    async def test_template_de_empresa_ajena_retorna_404(self):
        """Template de empresa diferente (no encontrado en BD filtrada) → 404."""
        # La BD mockeada no devuelve nada (simula aislamiento multi-tenant)
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/42")
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 5. PUT /api/company/templates/{id} — actualizar
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateTemplate:
    """Verifica el endpoint de actualización de templates."""

    async def test_update_template_existente_retorna_200(self):
        """PUT en template existente → 200 con datos actualizados."""
        tpl = _fake_template(template_id=3, name="Nombre Original")

        async def _db_with_tpl():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = [tpl]
            result.scalar_one_or_none.return_value = tpl
            session.execute.return_value = result

            async def _refresh(obj):
                # Simular que el nombre fue actualizado
                obj.name = "Nombre Actualizado"
                obj.id = tpl.id
                obj.company_id = tpl.company_id
                obj.content = tpl.content
                obj.template_type = tpl.template_type
                obj.is_default = tpl.is_default
                obj.created_at = tpl.created_at
                obj.updated_at = datetime(2026, 2, 28, 10, 0, 0)
                obj.description = tpl.description
            session.refresh = _refresh
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _db_with_tpl,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/company/templates/3", json={"name": "Nombre Actualizado"})
        finally:
            _clear_overrides()
        assert r.status_code == 200

    async def test_update_template_inexistente_retorna_404(self):
        """PUT en template inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/company/templates/9999", json={"name": "Nuevo"})
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 6. DELETE /api/company/templates/{id} — eliminar
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteTemplate:
    """Verifica el endpoint de eliminación de templates."""

    async def test_delete_template_existente_retorna_204(self):
        """DELETE en template existente → 204 sin contenido."""
        tpl = _fake_template(template_id=10)

        async def _db_with_tpl():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = tpl
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _db_with_tpl,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/company/templates/10")
        finally:
            _clear_overrides()
        assert r.status_code == 204

    async def test_delete_template_inexistente_retorna_404(self):
        """DELETE en template inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/company/templates/9999")
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 7. POST /api/company/templates/{id}/set-default — marcar como default
# ─────────────────────────────────────────────────────────────────────────────

class TestSetDefaultTemplate:
    """Verifica el endpoint para marcar un template como default."""

    async def test_set_default_existente_retorna_200_con_is_default_true(self):
        """POST set-default en template existente → 200 con is_default=True."""
        tpl = _fake_template(template_id=2, is_default=False)

        async def _db_with_tpl():
            session = AsyncMock()
            result = MagicMock()
            result.scalars.return_value.all.return_value = []  # sin otros defaults a limpiar
            result.scalar_one_or_none.return_value = tpl
            session.execute.return_value = result

            async def _refresh(obj):
                obj.id = tpl.id
                obj.company_id = tpl.company_id
                obj.name = tpl.name
                obj.content = tpl.content
                obj.template_type = tpl.template_type
                obj.is_default = True  # marcado como default
                obj.created_at = tpl.created_at
                obj.updated_at = datetime(2026, 2, 28, 12, 0, 0)
                obj.description = tpl.description
            session.refresh = _refresh
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _db_with_tpl,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/2/set-default")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["is_default"] is True

    async def test_set_default_inexistente_retorna_404(self):
        """POST set-default en template inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_admin(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/9999/set-default")
        finally:
            _clear_overrides()
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 8. POST /api/company/templates/validate — validar template Liquid
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateTemplate:
    """Verifica el endpoint de validación de templates Liquid."""

    async def test_validate_template_valido_retorna_ok_true(self):
        """Template válido (mockeado) → ok=True, sin errors, con warnings."""
        pdf_bytes = b"%PDF-FAKE-FOR-TESTING"
        resultado_ok = {
            "ok": True,
            "errors": [],
            "warnings": [],
            "preview_pdf_b64": base64.b64encode(pdf_bytes).decode("utf-8"),
        }

        async def _db_con_company():
            session = AsyncMock()
            result = MagicMock()
            # company encontrada
            company_mock = MagicMock()
            company_mock.pdf_palette = None
            result.scalar_one_or_none.return_value = company_mock
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _db_con_company,
        })
        try:
            with patch("app.routers.company_templates.validate_template", return_value=resultado_ok):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/company/templates/validate", json={
                        "content": "{{ quote_number }} {{ total_fmt }}",
                        "template_type": "cot",
                    })
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["errors"] == []

    async def test_validate_template_invalido_retorna_ok_false(self):
        """Template inválido (mockeado) → ok=False con mensaje de error."""
        resultado_invalido = {
            "ok": False,
            "errors": ["Tag '{% if' no cerrado"],
            "warnings": [],
            "preview_pdf_b64": None,
        }

        async def _db_con_company():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = None  # sin company
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _db_con_company,
        })
        try:
            with patch("app.routers.company_templates.validate_template", return_value=resultado_invalido):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/company/templates/validate", json={
                        "content": "{% if sin_cerrar",
                        "template_type": "cot",
                    })
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert len(body["errors"]) > 0

    async def test_validate_sin_content_retorna_422(self):
        """POST sin campo 'content' requerido → 422."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/company/templates/validate", json={
                    "template_type": "cot",
                    # Falta "content"
                })
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_validate_template_con_warnings_retorna_ok_true(self):
        """Template sin variables recomendadas → ok=True con warnings."""
        resultado_con_warnings = {
            "ok": True,
            "errors": [],
            "warnings": [
                "Variable recomendada ausente: {{ quote_number }}",
                "Variable recomendada ausente: {{ items }}",
                "Variable recomendada ausente: {{ total_fmt }}",
            ],
            "preview_pdf_b64": base64.b64encode(b"%PDF-FAKE").decode("utf-8"),
        }

        async def _db_sin_company():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _db_sin_company,
        })
        try:
            with patch("app.routers.company_templates.validate_template", return_value=resultado_con_warnings):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.post("/api/company/templates/validate", json={
                        "content": "<p>Contenido estático</p>",
                    })
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert len(body["warnings"]) == 3


# ─────────────────────────────────────────────────────────────────────────────
# 9. GET /api/company/templates/{id}/preview — PDF de muestra
# ─────────────────────────────────────────────────────────────────────────────

class TestPreviewTemplate:
    """Verifica el endpoint de preview de PDF para un template."""

    async def test_preview_template_existente_retorna_pdf(self):
        """Template existente y válido → 200 con Content-Type application/pdf."""
        tpl = _fake_template(template_id=7, content="{{ quote_number }}")
        pdf_bytes = b"%PDF-PREVIEW-FAKE"
        resultado_ok = {
            "ok": True,
            "errors": [],
            "warnings": [],
            "preview_pdf_b64": base64.b64encode(pdf_bytes).decode("utf-8"),
        }

        async def _db_with_tpl():
            session = AsyncMock()
            result = MagicMock()
            # Primera llamada: obtiene el template; segunda: busca la company
            result.scalar_one_or_none.side_effect = [tpl, None]
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _db_with_tpl,
        })
        try:
            with patch("app.routers.company_templates.validate_template", return_value=resultado_ok):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.get("/api/company/templates/7/preview")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content == pdf_bytes

    async def test_preview_template_inexistente_retorna_404(self):
        """Template inexistente → 404."""
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/9999/preview")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_preview_template_invalido_retorna_500(self):
        """Template que falla al renderizar → 500."""
        tpl = _fake_template(template_id=8, content="{% if sin_cerrar")
        resultado_error = {
            "ok": False,
            "errors": ["Error de sintaxis Liquid"],
            "warnings": [],
            "preview_pdf_b64": None,
        }

        async def _db_with_tpl():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.side_effect = [tpl, None]
            session.execute.return_value = result
            yield session

        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _db_with_tpl,
        })
        try:
            with patch("app.routers.company_templates.validate_template", return_value=resultado_error):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                    r = await c.get("/api/company/templates/8/preview")
        finally:
            _clear_overrides()
        assert r.status_code == 500


# ─────────────────────────────────────────────────────────────────────────────
# 10. GET /api/company/templates/default-template
# ─────────────────────────────────────────────────────────────────────────────

class TestDefaultTemplateContent:
    """
    Verifica el endpoint que retorna el template por defecto del sistema.

    Nota sobre routing: FastAPI evalúa GET /{template_id} (int) ANTES que
    GET /default-template porque está declarado primero en el router. La ruta
    /default-template produce 422 al intentar parsear "default-template" como
    int. El contenido del template por defecto se verifica directamente
    importando DEFAULT_COT_TEMPLATE del servicio.
    """

    async def test_ruta_default_template_retorna_200_con_contenido(self):
        """
        GET /default-template con token válido retorna 200 con el template base del sistema.
        La ruta fue movida antes de /{template_id} para corregir el conflicto de orden (CAL-M04).
        """
        _set_overrides({
            get_current_user: lambda: _fake_user(),
            get_db: _fake_db_empty,
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/default-template")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert "content" in body
        assert len(body["content"]) > 100  # el template por defecto no está vacío

    async def test_sin_token_retorna_401_o_422(self):
        """
        GET /default-template sin token: el resultado depende de cuál middleware
        evalúa primero (validación de path vs. OAuth2). En la práctica retorna 401
        si la auth se evalúa primero, o 422 si la validación de path va primero.
        """
        _set_overrides({get_db: _fake_db_empty})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/company/templates/default-template")
        finally:
            _clear_overrides()
        # Cualquiera de los dos es aceptable dado el orden de rutas
        assert r.status_code in (401, 422)

    def test_default_cot_template_contiene_liquid_syntax(self):
        """DEFAULT_COT_TEMPLATE tiene sintaxis Liquid válida con variables clave."""
        from app.services.liquid_pdf import DEFAULT_COT_TEMPLATE
        assert "{{ quote_number }}" in DEFAULT_COT_TEMPLATE
        assert "{{ total_fmt }}" in DEFAULT_COT_TEMPLATE
        assert "{% for item in items %}" in DEFAULT_COT_TEMPLATE

    def test_default_cot_template_es_html_valido(self):
        """DEFAULT_COT_TEMPLATE comienza con DOCTYPE HTML."""
        from app.services.liquid_pdf import DEFAULT_COT_TEMPLATE
        assert DEFAULT_COT_TEMPLATE.strip().startswith("<!DOCTYPE html>")

    def test_default_cot_template_contiene_variables_de_paleta(self):
        """DEFAULT_COT_TEMPLATE referencia la paleta de colores de la empresa."""
        from app.services.liquid_pdf import DEFAULT_COT_TEMPLATE
        assert "palette.primary" in DEFAULT_COT_TEMPLATE
        assert "palette.accent" in DEFAULT_COT_TEMPLATE
