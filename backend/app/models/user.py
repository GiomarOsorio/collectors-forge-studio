"""
Modelo ORM para la tabla de usuarios de Calculator3D.

Define la entidad User que representa a los usuarios del sistema, incluyendo
sus credenciales de autenticación y sus atributos de rol (usuario normal vs.
administrador). La contraseña nunca se almacena en texto plano; únicamente
se guarda el hash generado con bcrypt.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class User(Base):
    """
    Modelo de base de datos que representa a un usuario de la aplicación.

    Cada usuario puede autenticarse mediante JWT y tiene acceso a sus propios
    filamentos, impresoras, configuraciones y cotizaciones. Los administradores
    (is_admin=True) tienen además la capacidad de registrar nuevos usuarios.

    Atributos:
        id: Clave primaria autoincremental del usuario.
        username: Nombre de usuario único (máx. 50 caracteres), indexado para
            búsquedas rápidas en el login.
        email: Correo electrónico único (máx. 100 caracteres), indexado.
        hashed_password: Hash bcrypt de la contraseña del usuario.
        is_active: Indica si el usuario está activo. Los usuarios inactivos
            no pueden autenticarse aunque sus credenciales sean correctas.
        is_admin: Indica si el usuario tiene privilegios de administrador.
        created_at: Marca de tiempo UTC de creación del registro.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True
    )
