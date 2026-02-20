"""
Router de autenticación y gestión de usuarios de Calculator3D.

Este módulo expone los endpoints HTTP necesarios para autenticar usuarios
mediante el flujo OAuth2 con contraseña y tokens JWT:

- POST /api/auth/login   - Autentica las credenciales y emite un token JWT.
- POST /api/auth/register - Registra un nuevo usuario (solo para admins).
- GET  /api/auth/me       - Devuelve los datos del usuario autenticado actual.

Todos los endpoints de este router están bajo el prefijo /api/auth y se
etiquetan como "auth" en la documentación automática de FastAPI.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_admin,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Autentica un usuario y emite un token de acceso JWT.

    Verifica las credenciales proporcionadas contra la base de datos. Si son
    correctas y el usuario está activo, genera y devuelve un token JWT con
    tiempo de expiración configurado en los ajustes de la aplicación.

    Args:
        form_data: Formulario OAuth2 con los campos 'username' y 'password'.
        db: Sesión de base de datos inyectada por FastAPI.

    Returns:
        Token: Objeto con el access_token JWT y el token_type "bearer".

    Raises:
        HTTPException 401: Si el usuario no existe o la contraseña es incorrecta.
        HTTPException 403: Si el usuario existe pero está desactivado.
    """
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )
    # Genera el token JWT con el username como subject (claim 'sub')
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """
    Registra un nuevo usuario en el sistema (requiere privilegios de administrador).

    Solo los usuarios con is_admin=True pueden acceder a este endpoint.
    Al crear el usuario se genera automáticamente una configuración por defecto
    asociada a la nueva cuenta.

    Args:
        user_data: Datos del nuevo usuario (username, email, password).
        db: Sesión de base de datos inyectada por FastAPI.
        current_user: Usuario administrador autenticado (inyectado por FastAPI).

    Returns:
        UserResponse: Datos públicos del usuario recién creado.

    Raises:
        HTTPException 400: Si el nombre de usuario o el email ya están en uso.
        HTTPException 401: Si el token de acceso no es válido.
        HTTPException 403: Si el usuario autenticado no es administrador.
    """
    # Solo admin puede crear usuarios; verificar unicidad de username y email
    result = await db.execute(
        select(User).where(
            (User.username == user_data.username) | (User.email == user_data.email)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario o email ya existe",
        )

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        company_id=current_user.company_id,  # Mismo company que el admin que registra
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # No se crea configuración de usuario: la empresa ya tiene una configuración compartida.
    # Si por algún motivo no existiera, se crea automáticamente en el primer acceso a /api/settings.

    return new_user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Devuelve los datos del usuario autenticado actualmente.

    Endpoint de introspección que permite al cliente conocer la información
    del usuario asociado al token JWT que está utilizando.

    Args:
        current_user: Usuario autenticado extraído del token JWT (inyectado
            por FastAPI a través de get_current_user).

    Returns:
        UserResponse: Datos públicos del usuario autenticado.

    Raises:
        HTTPException 401: Si el token de acceso no es válido o ha expirado.
    """
    return current_user
