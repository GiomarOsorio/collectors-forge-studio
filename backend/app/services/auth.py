"""
Servicio de autenticación y autorización para Calculator3D.

Este módulo implementa toda la lógica de seguridad de la aplicación:
- Hashing y verificación de contraseñas con bcrypt (a través de passlib).
- Creación y decodificación de tokens JWT firmados con HS256 (PyJWT).
- Dependencias de FastAPI para inyectar el usuario autenticado en los endpoints.
- Dependencia adicional para requerir privilegios de administrador.
- Blacklist en memoria para invalidar tokens en logout.

Los tokens JWT siguen el estándar OAuth2 Bearer y se configuran con la
clave secreta y el tiempo de expiración definidos en app/config.py.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenData

# ── Blacklist de tokens (en memoria) ──────────────────────────────────────────
# Mapea hash SHA-256 del token → datetime de expiración (naive UTC).
# Se limpia automáticamente de entradas expiradas en cada operación.
_token_blacklist: Dict[str, datetime] = {}


def _hash_token(token: str) -> str:
    """Retorna el hash SHA-256 del token para no almacenar el token completo."""
    return hashlib.sha256(token.encode()).hexdigest()


def blacklist_token(token: str, expiry: datetime) -> None:
    """
    Agrega un token a la blacklist hasta su expiración.

    También limpia entradas expiradas para evitar crecimiento ilimitado.

    Args:
        token:  Token JWT completo.
        expiry: Datetime de expiración (naive UTC) extraído del claim 'exp'.
    """
    _token_blacklist[_hash_token(token)] = expiry
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for h in [h for h, exp in list(_token_blacklist.items()) if exp < now]:
        del _token_blacklist[h]


def is_token_blacklisted(token: str) -> bool:
    """Retorna True si el token fue invalidado mediante logout."""
    return _hash_token(token) in _token_blacklist

# Contexto de hashing: usa bcrypt como algoritmo principal; los esquemas
# marcados como "deprecated" se verifican pero no se usan para nuevos hashes
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Esquema OAuth2 que extrae el token Bearer del header Authorization;
# tokenUrl indica la URL donde se obtiene el token (usada en la doc de Swagger)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con su hash almacenado.

    Utiliza bcrypt internamente, que incluye el salt en el propio hash, por
    lo que no es necesario gestionar el salt de forma separada.

    Args:
        plain_password: Contraseña en texto plano proporcionada por el usuario.
        hashed_password: Hash bcrypt almacenado en la base de datos.

    Returns:
        bool: True si la contraseña coincide con el hash, False en caso contrario.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Genera el hash bcrypt de una contraseña en texto plano.

    Debe llamarse siempre antes de almacenar una contraseña en la base de
    datos. El hash incluye el salt y el factor de costo de bcrypt.

    Args:
        password: Contraseña en texto plano a hashear.

    Returns:
        str: Hash bcrypt listo para almacenarse en la base de datos.
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea y firma un token JWT con los datos proporcionados.

    Agrega automáticamente el claim de expiración ('exp') al payload antes
    de firmarlo. Si no se especifica expires_delta, utiliza el tiempo
    configurado en ACCESS_TOKEN_EXPIRE_MINUTES.

    Args:
        data: Diccionario con los claims a incluir en el payload del JWT.
            Generalmente contiene {'sub': username}.
        expires_delta: Duración personalizada del token. Si es None, se usa
            el valor por defecto de la configuración (24 horas).

    Returns:
        str: Token JWT firmado como cadena codificada en Base64URL.
    """
    to_encode = data.copy()
    # Calcula el tiempo de expiración usando UTC para evitar problemas de zona horaria
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    # PyJWT encode retorna str directamente (a diferencia de python-jose que podía retornar bytes)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependencia de FastAPI que extrae y valida el usuario desde el token JWT.

    Decodifica el token Bearer del header Authorization, verifica su firma y
    expiración, extrae el username del claim 'sub', y consulta el usuario en
    la base de datos para asegurarse de que existe y está activo.

    Args:
        token: Token JWT extraído automáticamente del header Authorization por
            el esquema oauth2_scheme.
        db: Sesión de base de datos inyectada por FastAPI.

    Returns:
        User: Instancia ORM del usuario autenticado y activo.

    Raises:
        HTTPException 401: Si el token es inválido, ha expirado, no contiene
            el claim 'sub', o el usuario no existe o está desactivado.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Verificar si el token fue invalidado por logout
    if is_token_blacklisted(token):
        raise credentials_exception
    try:
        # Decodifica y verifica la firma y la expiración del token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        # Instancia TokenData para validar el tipo del campo username
        TokenData(username=username)
    except InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    # Rechazar si el usuario no existe o está desactivado en el sistema
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Alias de compatibilidad → get_admin_user. Usar get_admin_user en código nuevo."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """
    Dependencia que requiere rol 'admin'.

    Raises:
        HTTPException 403: Si el usuario no tiene rol 'admin'.
    """
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return user


async def get_operator_user(user: User = Depends(get_current_user)) -> User:
    """
    Dependencia que requiere rol 'admin' o 'operator'.

    Raises:
        HTTPException 403: Si el usuario tiene rol 'viewer'.
    """
    if user.role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de operador o superior",
        )
    return user
