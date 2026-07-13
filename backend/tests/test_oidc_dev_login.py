"""
Tests para el bypass de login exclusivo de dev (/api/auth/oidc/dev-login).

Mismo patrón que test_filament_profiles.py: httpx.AsyncClient con
ASGITransport y dependency_overrides para sustituir la BD. `DEV_LOGIN_ENABLED`
se togglea directo sobre la instancia `settings` (monkeypatch), ya que es la
única variable que controla si el endpoint responde o no.

Cubre:
    - dev-login-status refleja DEV_LOGIN_ENABLED
    - dev-login → 404 si DEV_LOGIN_ENABLED=False
    - dev-login → redirige a /auth/success?token= si ya existe el usuario bypass
    - dev-login → redirige a /login?error=user_inactive si el usuario existe pero está inactivo
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import get_db
from app.main import app
from app.models.user import User


def _fake_db_returning(user):
    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        session.execute.return_value = result
        yield session
    return _gen


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


class TestDevLoginStatus:
    async def test_status_refleja_flag_apagado(self, monkeypatch):
        monkeypatch.setattr(settings, "DEV_LOGIN_ENABLED", False)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/auth/oidc/dev-login-status")
        assert r.status_code == 200
        assert r.json() == {"enabled": False}

    async def test_status_refleja_flag_prendido(self, monkeypatch):
        monkeypatch.setattr(settings, "DEV_LOGIN_ENABLED", True)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/auth/oidc/dev-login-status")
        assert r.status_code == 200
        assert r.json() == {"enabled": True}


class TestDevLogin:
    async def test_dev_login_retorna_404_si_deshabilitado(self, monkeypatch):
        monkeypatch.setattr(settings, "DEV_LOGIN_ENABLED", False)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/auth/oidc/dev-login")
        assert r.status_code == 404

    async def test_dev_login_redirige_a_auth_success_con_usuario_existente(self, monkeypatch):
        monkeypatch.setattr(settings, "DEV_LOGIN_ENABLED", True)
        existing = User(
            username="dev-admin",
            email="dev-admin@cfs.local",
            oidc_sub="dev-login-bypass",
            role="admin",
        )
        existing.is_active = True
        _set_overrides({get_db: _fake_db_returning(existing)})
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as c:
                r = await c.get("/api/auth/oidc/dev-login")
        finally:
            _clear_overrides()
        assert r.status_code in (302, 307)
        assert r.headers["location"].startswith("/auth/success?token=")

    async def test_dev_login_redirige_a_error_si_usuario_inactivo(self, monkeypatch):
        monkeypatch.setattr(settings, "DEV_LOGIN_ENABLED", True)
        existing = User(
            username="dev-admin",
            email="dev-admin@cfs.local",
            oidc_sub="dev-login-bypass",
            role="admin",
        )
        existing.is_active = False
        _set_overrides({get_db: _fake_db_returning(existing)})
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as c:
                r = await c.get("/api/auth/oidc/dev-login")
        finally:
            _clear_overrides()
        assert r.status_code in (302, 307)
        assert r.headers["location"] == "/login?error=user_inactive"
