"""
Configuración de la base de datos y gestión de sesiones para TurtleForge Cost.

Este módulo establece la conexión asíncrona con PostgreSQL mediante
SQLAlchemy 2.0 + asyncpg. Las tablas se crean y migran a través de
Alembic (alembic upgrade head), no desde la aplicación en tiempo de ejecución.
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
            await session.close()
