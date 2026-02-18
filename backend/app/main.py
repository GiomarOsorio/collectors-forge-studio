"""
Punto de entrada principal de la API Calculator3D.

Este módulo crea y configura la instancia de FastAPI, registra el middleware
de CORS para permitir solicitudes desde el frontend, incluye todos los
routers de la aplicación y define el ciclo de vida (lifespan) que se encarga
de inicializar la base de datos y crear los datos por defecto (usuario admin,
configuración inicial e impresora BambuLab P1S Combo) la primera vez que
arranca el servidor.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from sqlalchemy import text
from app.config import settings
from app.database import init_db, async_session
from app.models import User, AppSettings, Printer
from app.services.auth import get_password_hash
from app.routers import auth, filaments, printers, settings as settings_router, quotes, supplies


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestor de ciclo de vida de la aplicación FastAPI.

    Se ejecuta al arrancar el servidor (antes de aceptar solicitudes) y al
    apagarse. En la fase de inicio crea las tablas de la base de datos y
    genera los datos por defecto si no existen.

    Args:
        app: Instancia de FastAPI gestionada por el contexto.

    Yields:
        Control al servidor para empezar a atender solicitudes.
    """
    # Startup: crear tablas, migrar columnas nuevas y usuario admin
    await init_db()
    await migrate_db()
    await create_default_data()
    yield


# Instancia principal de la aplicación FastAPI con metadatos para la documentación
app = FastAPI(
    title="Calculator3D API",
    description="API para calcular costos de impresión 3D",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS para permitir el frontend (Vite en puerto 5173 y CRA en 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers con sus respectivos prefijos y etiquetas
app.include_router(auth.router)
app.include_router(filaments.router)
app.include_router(printers.router)
app.include_router(settings_router.router)
app.include_router(quotes.router)
app.include_router(supplies.router)


@app.get("/api/health")
async def health_check():
    """
    Endpoint de verificación del estado del servidor.

    Permite comprobar de forma sencilla que la API está en línea y responde
    correctamente. Útil para herramientas de monitoreo y health checks de
    contenedores (Docker, Kubernetes).

    Returns:
        dict: Diccionario con el campo 'status' en 'ok' y el nombre de la app.
    """
    return {"status": "ok", "app": "Calculator3D"}


async def migrate_db():
    """Agrega columnas nuevas a tablas existentes si no existen (migraciones simples SQLite)."""
    migrations = [
        ("quotes", "supplies_cost", "ALTER TABLE quotes ADD COLUMN supplies_cost FLOAT DEFAULT 0.0"),
        ("quotes", "supplies_detail", "ALTER TABLE quotes ADD COLUMN supplies_detail TEXT DEFAULT '[]'"),
        ("quotes", "additional_filaments_detail", "ALTER TABLE quotes ADD COLUMN additional_filaments_detail TEXT DEFAULT '[]'"),
        ("supplies", "pack_qty", "ALTER TABLE supplies ADD COLUMN pack_qty INTEGER"),
        ("supplies", "pack_price", "ALTER TABLE supplies ADD COLUMN pack_price FLOAT"),
    ]
    async with async_session() as db:
        for table, column, sql in migrations:
            result = await db.execute(text(f"PRAGMA table_info({table})"))
            columns = [row[1] for row in result.fetchall()]
            if column not in columns:
                await db.execute(text(sql))
        await db.commit()


async def create_default_data():
    """
    Crea el usuario administrador y los datos iniciales si aún no existen.

    Esta función es idempotente: si el usuario admin ya existe en la base de
    datos, no realiza ninguna acción. En caso contrario crea:

    - Usuario administrador con credenciales definidas en la configuración.
    - Configuración de aplicación por defecto asociada al admin (tarifas,
      márgenes, moneda, etc.).
    - Impresora BambuLab P1S Combo con parámetros técnicos preconfigurados.
    """
    async with async_session() as db:
        # Verificar si ya existe el usuario admin para evitar duplicados
        result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        if result.scalar_one_or_none():
            return

        # Crear usuario admin con contraseña hasheada usando bcrypt
        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        # Crear configuración de aplicación con valores por defecto razonables
        default_settings = AppSettings(
            user_id=admin.id,
            electricity_rate=0.15,        # USD por kWh
            failure_rate_percent=5.0,      # 5% de absorción por fallos de impresión
            labor_cost_per_hour=10.0,      # USD por hora de trabajo manual
            default_margin_percent=30.0,   # Margen de ganancia del 30%
            currency="USD",
        )
        db.add(default_settings)

        # Crear la impresora BambuLab P1S Combo con sus especificaciones reales
        default_printer = Printer(
            name="Mi BambuLab P1S Combo",
            model="BambuLab P1S Combo",
            purchase_price=699.0,              # Precio de compra en USD
            power_consumption_watts=180.0,     # Consumo promedio durante impresión
            estimated_lifespan_hours=5000.0,   # Vida útil estimada del equipo
            current_hours=0.0,                 # Horas de uso acumuladas al inicio
            nozzle_price=8.0,                  # Costo de reemplazo de boquilla
            nozzle_lifespan_hours=500.0,       # Horas de vida útil de la boquilla
            buildplate_price=35.0,             # Costo de la placa de construcción
            buildplate_lifespan_hours=2000.0,  # Horas de vida útil de la placa
            other_maintenance_per_hour=0.01,   # Otros costos de mantenimiento por hora
            notes="Impresora principal - BambuLab P1S Combo con AMS",
        )
        db.add(default_printer)

        await db.commit()
