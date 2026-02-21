"""
Entorno de ejecución de Alembic para TurtleForge Cost.

Configura el motor asíncrono de SQLAlchemy 2.0 y conecta
target_metadata con Base.metadata para que autogenerate
detecte los modelos ORM correctamente.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Objeto de configuración de Alembic (lee alembic.ini)
config = context.config

# Configurar logging desde el archivo .ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Importar todos los modelos para que Base.metadata los registre.
# IMPORTANTE: mantener estos imports aunque el linter diga "unused".
from app.database import Base  # noqa: E402
from app.models import (  # noqa: E402, F401
    User,
    Filament,
    Printer,
    AppSettings,
    Quote,
    Supply,
    ElectricityTariff,
    PrintedItem,
)

target_metadata = Base.metadata

# Obtener DATABASE_URL desde el objeto settings (config.py), que construye la URL
# correctamente con quote_plus para manejar contraseñas con caracteres especiales.
# Esto evita duplicar la lógica de construcción de URL en este archivo.
from app.config import settings as app_settings  # noqa: E402

config.set_main_option("sqlalchemy.url", app_settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Ejecuta las migraciones en modo 'offline' (sin conexión activa).

    Útil para generar SQL puro sin conectarse a la base de datos.
    Se invoca con: alembic upgrade head --sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Ejecuta las migraciones sobre una conexión activa."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Crea el engine asíncrono y ejecuta las migraciones."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Punto de entrada para migraciones en modo 'online'."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
