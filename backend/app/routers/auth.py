"""
Router de autenticación de TurtleForge Studio.

Endpoints disponibles:
    GET  /api/auth/me       — Devuelve los datos del usuario autenticado actual.
    POST /api/auth/logout   — Invalida el token de acceso actual (blacklist).

El login se realiza vía OIDC (ver routers/oidc.py).
"""

import jwt
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, Token
from app.services.auth import (
    create_access_token,
    get_current_user,
    blacklist_token,
    oauth2_scheme,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    """
    Invalida el token de acceso del usuario autenticado.

    Agrega el token a una blacklist en memoria para que no pueda reutilizarse
    aunque aún no haya expirado. La entrada se elimina automáticamente cuando
    el token expire.

    Args:
        current_user: Usuario autenticado (valida que el token sea vigente).
        token:        Token JWT extraído del header Authorization.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = payload.get("exp")
        if exp:
            expiry = datetime.utcfromtimestamp(exp)
        else:
            expiry = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    except Exception:
        expiry = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    blacklist_token(token, expiry)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Devuelve los datos del usuario autenticado actualmente.

    Args:
        current_user: Usuario autenticado extraído del token JWT.

    Returns:
        UserResponse: Datos públicos del usuario autenticado.

    Raises:
        HTTPException 401: Si el token de acceso no es válido o ha expirado.
    """
    return current_user
