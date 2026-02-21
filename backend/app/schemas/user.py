"""
Esquemas Pydantic para la autenticación y gestión de usuarios.

Este módulo define los modelos de validación de datos (schemas) utilizados
en los endpoints de autenticación: registro de usuarios, inicio de sesión,
respuesta con datos del usuario y representación de los tokens JWT.

Pydantic garantiza la validación y serialización automática de los datos
recibidos en las solicitudes HTTP y de los datos devueltos en las respuestas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """
    Esquema para la creación de un nuevo usuario.

    Utilizado por el endpoint POST /api/auth/register. Solo los administradores
    pueden crear nuevos usuarios.

    Atributos:
        username: Nombre de usuario deseado (debe ser único en el sistema).
        email: Dirección de correo electrónico válida (debe ser única).
        password: Contraseña en texto plano que será hasheada antes de
            almacenarse en la base de datos.
    """

    username: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    """
    Esquema para el inicio de sesión de un usuario.

    Utilizado internamente para estructurar las credenciales. El endpoint de
    login usa OAuth2PasswordRequestForm de FastAPI, pero este schema puede
    emplearse en pruebas o integraciones alternativas.

    Atributos:
        username: Nombre de usuario registrado en el sistema.
        password: Contraseña en texto plano del usuario.
    """

    username: str
    password: str


class UserResponse(BaseModel):
    """
    Esquema de respuesta con los datos públicos de un usuario.

    Devuelve únicamente los campos seguros para exponer al cliente, omitiendo
    la contraseña hasheada y otros datos internos.

    Atributos:
        id: Identificador numérico único del usuario.
        username: Nombre de usuario.
        email: Correo electrónico del usuario.
        is_active: Estado de la cuenta (activa/inactiva).
        is_admin: Indica si el usuario tiene privilegios de administrador.
        created_at: Fecha y hora UTC de creación de la cuenta.
    """

    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    # Permite construir el schema a partir de instancias ORM (from_orm)
    model_config = {"from_attributes": True}


class Token(BaseModel):
    """
    Esquema de respuesta del token JWT tras un login exitoso.

    Atributos:
        access_token: Cadena JWT firmada que debe incluirse en el header
            Authorization: Bearer <token> de las solicitudes autenticadas.
        token_type: Tipo de token. Siempre "bearer" según el estándar OAuth2.
    """

    access_token: str
    token_type: str


class UserUpdate(BaseModel):
    """
    Esquema para actualizar el perfil del usuario autenticado.

    Todos los campos son opcionales. Para cambiar la contraseña se deben
    enviar current_password y new_password juntos.

    Atributos:
        username:         Nuevo nombre de usuario (mín. 3, máx. 50 caracteres).
        email:            Nueva dirección de correo electrónico válida.
        current_password: Contraseña actual (requerida si se envía new_password).
        new_password:     Nueva contraseña en texto plano (mín. 8, máx. 128).
    """

    username: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class TokenData(BaseModel):
    """
    Esquema interno para los datos extraídos del payload del token JWT.

    Se usa durante la validación del token para identificar al usuario
    autenticado a partir del claim 'sub' (subject) del JWT.

    Atributos:
        username: Nombre de usuario extraído del payload del token.
            Puede ser None si el token no contiene el campo 'sub'.
    """

    username: Optional[str] = None
