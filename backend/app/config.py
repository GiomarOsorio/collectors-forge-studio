"""
Configuración de la aplicación Collector's Forge Studio.

Este módulo centraliza todos los parámetros de configuración de la aplicación
utilizando Pydantic BaseSettings, que permite leer los valores desde variables
de entorno o desde un archivo .env, facilitando la gestión de entornos
(desarrollo, producción, pruebas).
"""

from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configuración principal de la aplicación.

    DATABASE_URL se construye automáticamente desde las variables POSTGRES_*
    si no está definida explícitamente. En el .env solo necesitas definir
    POSTGRES_PASSWORD (y opcionalmente las demás con sus defaults).

    Atributos:
        POSTGRES_USER:     Usuario de PostgreSQL. Default: collectorsforge.
        POSTGRES_PASSWORD: Contraseña de PostgreSQL. Requerida en producción.
        POSTGRES_DB:       Nombre de la base de datos. Default: collectorsforge.
        POSTGRES_HOST:     Host del servidor PostgreSQL. Default: cfs-postgres.
        POSTGRES_PORT:     Puerto de PostgreSQL. Default: 5432.
        DATABASE_URL:      URL de conexión completa. Si no se define, se construye
                           automáticamente desde las variables POSTGRES_*.
        SECRET_KEY:        Clave secreta para firmar tokens JWT.
        ALGORITHM:         Algoritmo JWT. Default: HS256.
        ACCESS_TOKEN_EXPIRE_MINUTES: Duración del token. Default: 1440 (24h).
        ADMIN_USERNAME:    Usuario administrador creado al inicio.
        ADMIN_PASSWORD:    Contraseña del administrador.
        ADMIN_EMAIL:       Email del administrador.
    """

    POSTGRES_USER: str = "collectorsforge"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "collectorsforge"
    POSTGRES_HOST: str = "cfs-postgres"
    POSTGRES_PORT: int = 5432

    DATABASE_URL: str = ""

    SECRET_KEY: str  # Requerida — define en .env o variable de entorno
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENABLE_DOCS: bool = False  # Habilitar /docs y /redoc solo en desarrollo
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = ""  # Ya no requerida — login via OIDC
    ADMIN_EMAIL: str = "admin@cfs.local"

    # OIDC / SSO
    OIDC_ISSUER: str = ""             # ej. https://auth.example.com/application/o/slug/
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_REDIRECT_URI: str = ""       # https://3d.turtledev.dev/api/auth/oidc/callback
    SESSION_SECRET_KEY: str = ""      # clave para SessionMiddleware; usa SECRET_KEY si está vacía

    # MinIO (Vault)
    MINIO_ENDPOINT: str = "http://cfs-minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "cfs-models"
    VAULT_QUOTA_GB: int = 50

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        """
        Construye DATABASE_URL desde las variables POSTGRES_* si no está definida.

        Esto evita tener que repetir la contraseña en dos variables del .env.
        Solo necesitas definir POSTGRES_PASSWORD y el resto usa sus valores por defecto.
        """
        if not self.DATABASE_URL:
            # quote_plus encoda caracteres especiales (#, @, &, etc.) en usuario y
            # contraseña para que no rompan el parsing de la URL de conexión.
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{quote_plus(self.POSTGRES_USER)}:{quote_plus(self.POSTGRES_PASSWORD)}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self


# Instancia global de configuración utilizada en toda la aplicación
settings = Settings()
