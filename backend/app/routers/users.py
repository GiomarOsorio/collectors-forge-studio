"""
Router de gestión de usuarios para TurtleForge Cost.

Permite a los administradores listar los usuarios de su empresa y a
cualquier usuario autenticado actualizar su propio perfil (nombre,
email, contraseña).

Para crear nuevos usuarios se usa POST /api/auth/register (requiere admin).

Endpoints:
    GET /api/users/    — Listar usuarios de la empresa (admin).
    PUT /api/users/me  — Actualizar perfil del usuario autenticado.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserAdminUpdate
from app.services.auth import get_current_admin, get_current_user, verify_password, get_password_hash

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """
    Lista todos los usuarios de la empresa del administrador autenticado.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario administrador autenticado.

    Returns:
        Lista de UserResponse ordenada por ID ascendente.
    """
    result = await db.execute(
        select(User)
        .where(User.company_id == current_user.company_id)
        .order_by(User.id)
    )
    return result.scalars().all()


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza el perfil del usuario autenticado.

    - Para cambiar la contraseña se deben enviar current_password y new_password.
    - Si current_password es incorrecto se retorna 400.
    - Si el username o email ya está en uso por otro usuario se retorna 409.

    Args:
        data:         Campos a actualizar (todos opcionales).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        UserResponse con los datos actualizados.

    Raises:
        HTTPException 400: Si current_password es incorrecto al cambiar contraseña.
        HTTPException 409: Si el username o email ya está en uso.
    """
    # Cambio de contraseña: verificar contraseña actual
    if data.new_password:
        if not data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Se requiere la contraseña actual para cambiarla",
            )
        if not verify_password(data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contraseña actual incorrecta",
            )
        current_user.hashed_password = get_password_hash(data.new_password)

    # Cambio de username: verificar unicidad
    if data.username and data.username != current_user.username:
        existing = await db.execute(
            select(User).where(User.username == data.username)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El nombre de usuario ya está en uso",
            )
        current_user.username = data.username

    # Cambio de email: verificar unicidad
    if data.email and data.email != current_user.email:
        existing = await db.execute(
            select(User).where(User.email == data.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El correo electrónico ya está en uso",
            )
        current_user.email = data.email

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.patch("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """
    Actualiza la contraseña y/o el rol de administrador de otro usuario.

    Solo los administradores pueden usar este endpoint. El usuario objetivo
    debe pertenecer a la misma empresa. Un administrador no puede quitarse
    su propio rol de administrador para evitar quedarse sin acceso.

    Args:
        user_id:      ID del usuario a modificar.
        data:         Campos a actualizar (new_password y/o is_admin).
        db:           Sesión de base de datos.
        current_user: Administrador autenticado.

    Returns:
        UserResponse con los datos actualizados.

    Raises:
        HTTPException 400: Si el admin intenta quitarse su propio rol.
        HTTPException 404: Si el usuario no existe en la empresa.
    """
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.company_id == current_user.company_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if data.new_password is not None:
        target.hashed_password = get_password_hash(data.new_password)

    if data.is_admin is not None:
        if target.id == current_user.id and not data.is_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes quitarte tu propio rol de administrador",
            )
        target.is_admin = data.is_admin

    await db.commit()
    await db.refresh(target)
    return target
