"""
Modelo ORM para la tabla de usuarios de collectors-forge-studio.

Define la entidad User que representa a los usuarios del sistema, incluyendo
sus credenciales de autenticación y su rol (admin / operator / viewer).
La contraseña nunca se almacena en texto plano; únicamente se guarda el hash
generado con bcrypt.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    """
    Modelo de base de datos que representa a un usuario de la aplicación.

    Atributos:
        id: Clave primaria autoincremental del usuario.
        username: Nombre de usuario único (máx. 50 caracteres).
        email: Correo electrónico único (máx. 100 caracteres).
        hashed_password: Hash bcrypt de la contraseña (nullable para usuarios OIDC).
        oidc_sub: Subject del proveedor OIDC (nullable para usuarios locales).
        is_active: Indica si el usuario está activo.
        role: Rol del usuario: 'admin' | 'operator' | 'viewer'.
        created_at: Marca de tiempo UTC de creación del registro.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    oidc_sub: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="operator")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
