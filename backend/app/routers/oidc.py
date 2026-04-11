"""
Router OIDC para autenticación SSO con PKCE.

Implementa el flujo Authorization Code con PKCE (RFC 7636) usando Authlib.
Compatible con cualquier proveedor OIDC estándar (Authentik, Keycloak, Auth0, etc.).

Endpoints:
    GET /api/auth/oidc/login     — Inicia el flujo OIDC, redirige al IdP.
    GET /api/auth/oidc/callback  — Recibe el code, valida, JIT-provisiona y emite JWT local.
    GET /api/auth/oidc/logout    — Retorna la URL de logout del IdP.
"""

import logging
from typing import Optional

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth import create_access_token, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/oidc", tags=["oidc"])

# Cliente OAuth registrado con Authlib
oauth = OAuth()
oauth.register(
    name="oidc",
    client_id=settings.OIDC_CLIENT_ID,
    client_secret=settings.OIDC_CLIENT_SECRET,
    server_metadata_url=(
        f"{settings.OIDC_ISSUER.rstrip('/')}/.well-known/openid-configuration"
        if settings.OIDC_ISSUER else None
    ),
    client_kwargs={
        "scope": "openid profile email",
        "code_challenge_method": "S256",
    },
)


@router.get("/login")
async def oidc_login(request: Request):
    """
    Inicia el flujo OIDC.

    Genera state, nonce y code_verifier (PKCE), los guarda en la sesión
    del servidor y redirige al usuario al proveedor de identidad.

    Raises:
        HTTPException 503: Si OIDC no está configurado en el servidor.
    """
    if not settings.OIDC_ISSUER or not settings.OIDC_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC no configurado en el servidor",
        )
    redirect_uri = settings.OIDC_REDIRECT_URI or str(
        request.url_for("oidc_callback")
    )
    return await oauth.oidc.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="oidc_callback")
async def oidc_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Callback OIDC: valida el code, intercambia token, JIT-provisiona y emite JWT local.

    Flujo:
    1. Intercambia el authorization code por tokens del IdP (con PKCE).
    2. Extrae claims del ID token (sub, email, preferred_username, name).
    3. Busca usuario por oidc_sub; si no existe lo crea (JIT provisioning).
    4. Emite JWT local y redirige a /auth/success?token=<JWT>.
    5. En caso de error redirige a /login?error=<descripción>.
    """
    try:
        token = await oauth.oidc.authorize_access_token(request)
    except Exception as exc:
        logger.warning("Error al intercambiar token OIDC: %s", exc)
        return RedirectResponse(url="/login?error=oidc_callback_failed")

    # Extraer claims del ID token
    userinfo = token.get("userinfo") or {}
    oidc_sub: Optional[str] = userinfo.get("sub")
    email: Optional[str] = userinfo.get("email")
    preferred_username: Optional[str] = (
        userinfo.get("preferred_username")
        or userinfo.get("nickname")
        or (email.split("@")[0] if email else None)
    )
    name: Optional[str] = userinfo.get("name") or preferred_username

    if not oidc_sub:
        logger.error("ID token no contiene claim 'sub'")
        return RedirectResponse(url="/login?error=missing_sub")

    # JIT provisioning: buscar o crear usuario
    result = await db.execute(select(User).where(User.oidc_sub == oidc_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Verificar si es el primer usuario del sistema (será admin)
        count_result = await db.execute(select(User))
        is_first_user = count_result.scalar_one_or_none() is None

        # Generar username único si ya existe uno igual
        username = preferred_username or f"user_{oidc_sub[:8]}"
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            username = f"{username}_{oidc_sub[:6]}"

        user = User(
            username=username,
            email=email or f"{oidc_sub}@oidc.local",
            hashed_password=None,
            oidc_sub=oidc_sub,
            role="admin" if is_first_user else "operator",
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception as exc:
            await db.rollback()
            logger.error("Error creando usuario JIT: %s", exc)
            return RedirectResponse(url="/login?error=provisioning_failed")
    else:
        # Actualizar email si cambió en el IdP
        if email and user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)

    if not user.is_active:
        return RedirectResponse(url="/login?error=user_inactive")

    # Emitir JWT local
    access_token = create_access_token(data={"sub": user.username})
    return RedirectResponse(url=f"/auth/success?token={access_token}")


@router.get("/logout")
async def oidc_logout(current_user: User = Depends(get_current_user)):
    """
    Retorna la URL de logout del IdP para que el frontend redirija.

    El frontend debe redirigir a logout_url después de limpiar el token local.

    Returns:
        JSON con logout_url apuntando al end_session_endpoint del IdP,
        o a /login si el IdP no expone ese endpoint.
    """
    logout_url = "/login"

    if settings.OIDC_ISSUER:
        try:
            metadata = await oauth.oidc.load_server_metadata()
            end_session = metadata.get("end_session_endpoint")
            if end_session:
                from urllib.parse import urlencode, urljoin
                params = urlencode({
                    "post_logout_redirect_uri": urljoin(
                        settings.OIDC_REDIRECT_URI.rsplit("/", 2)[0], "/login"
                    ) if settings.OIDC_REDIRECT_URI else "/login",
                    "client_id": settings.OIDC_CLIENT_ID,
                })
                logout_url = f"{end_session}?{params}"
        except Exception as exc:
            logger.warning("No se pudo obtener end_session_endpoint: %s", exc)

    return JSONResponse({"logout_url": logout_url})
