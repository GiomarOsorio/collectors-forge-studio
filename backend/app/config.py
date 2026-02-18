"""
Configuración de la aplicación Calculator3D.

Este módulo centraliza todos los parámetros de configuración de la aplicación
utilizando Pydantic BaseSettings, que permite leer los valores desde variables
de entorno o desde un archivo .env, facilitando la gestión de entornos
(desarrollo, producción, pruebas).
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configuración principal de la aplicación.

    Los valores pueden sobreescribirse mediante variables de entorno o el
    archivo .env ubicado en la raíz del proyecto. En producción se deben
    reemplazar los valores por defecto de SECRET_KEY, ADMIN_USERNAME,
    ADMIN_PASSWORD y ADMIN_EMAIL por valores seguros.

    Atributos:
        DATABASE_URL: Cadena de conexión a la base de datos. Por defecto usa
            SQLite asíncrono (aiosqlite) almacenado en el directorio actual.
        SECRET_KEY: Clave secreta utilizada para firmar los tokens JWT.
            Cambiar obligatoriamente en producción.
        ALGORITHM: Algoritmo de firma para los tokens JWT (HS256 por defecto).
        ACCESS_TOKEN_EXPIRE_MINUTES: Duración en minutos del token de acceso.
            Por defecto 1440 minutos (24 horas).
        ADMIN_USERNAME: Nombre de usuario del administrador creado al inicio.
        ADMIN_PASSWORD: Contraseña del administrador creado al inicio.
        ADMIN_EMAIL: Correo electrónico del administrador creado al inicio.
    """

    DATABASE_URL: str = "sqlite+aiosqlite:///./calculator3d.db"
    SECRET_KEY: str = "dev-secret-key-cambiar-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 horas
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_EMAIL: str = "admin@calculator3d.local"

    model_config = {"env_file": ".env"}


# Instancia global de configuración utilizada en toda la aplicación
settings = Settings()
