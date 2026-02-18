"""
Configuración de la base de datos y gestión de sesiones para Calculator3D.

Este módulo establece la conexión asíncrona con la base de datos mediante
SQLAlchemy y aiosqlite. Expone el motor de base de datos, la fábrica de
sesiones asíncronas, la clase base para los modelos ORM, y las funciones
auxiliares necesarias para inyectar sesiones en los endpoints de FastAPI y
para inicializar el esquema de la base de datos al arranque de la aplicación.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Motor asíncrono de SQLAlchemy; echo=False suprime el log de SQL en consola
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Fábrica de sesiones asíncronas; expire_on_commit=False evita que los
# objetos ORM se vuelvan inaccesibles después de un commit
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """
    Clase base declarativa para todos los modelos ORM de la aplicación.

    Todos los modelos (User, Filament, Printer, etc.) deben heredar de esta
    clase para que SQLAlchemy pueda gestionar sus tablas y relaciones.
    """

    pass


async def get_db():
    """
    Generador asíncrono que provee una sesión de base de datos por solicitud.

    Se utiliza como dependencia de FastAPI (Depends) en los endpoints para
    garantizar que cada solicitud HTTP utilice su propia sesión y que ésta
    se cierre correctamente al finalizar, independientemente de si ocurrió
    un error o no.

    Yields:
        AsyncSession: Sesión activa de SQLAlchemy lista para ejecutar consultas.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            # Cierre explícito de la sesión para liberar la conexión al pool
            await session.close()


async def init_db():
    """
    Inicializa la base de datos creando todas las tablas definidas en los modelos.

    Debe invocarse una única vez durante el arranque de la aplicación (lifespan).
    Si las tablas ya existen, SQLAlchemy las deja intactas (CREATE TABLE IF NOT EXISTS).
    """
    async with engine.begin() as conn:
        # Crea todas las tablas registradas en Base.metadata de forma sincrónica
        await conn.run_sync(Base.metadata.create_all)
