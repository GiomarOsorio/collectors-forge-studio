"""
Punto de entrada principal de la API TurtleForge Cost.

Este módulo crea y configura la instancia de FastAPI, registra el middleware
de CORS para permitir solicitudes desde el frontend, incluye todos los
routers de la aplicación y define el ciclo de vida (lifespan) que se encarga
de crear los datos por defecto (usuario admin, configuración inicial e
impresora BambuLab P1S Combo) si aún no existen.

Las tablas de la base de datos se crean y migran a través de Alembic
(alembic upgrade head) ANTES de arrancar el servidor, no en tiempo de ejecución.
"""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Company, User, AppSettings, Printer
from app.services.auth import get_password_hash
from app.routers import (
    auth, filaments, printers, settings as settings_router, quotes,
    supplies, client_quotes, inventory, purchase_orders, slicer, printed_items,
)

# UUID fijo de la empresa por defecto — coincide con la migración f4a1b9c2d8e7
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestor de ciclo de vida de la aplicación FastAPI.

    Se ejecuta al arrancar el servidor (antes de aceptar solicitudes) y al
    apagarse. En la fase de inicio crea los datos por defecto si no existen.
    Las tablas deben haberse creado previamente con `alembic upgrade head`.

    Args:
        app: Instancia de FastAPI gestionada por el contexto.

    Yields:
        Control al servidor para empezar a atender solicitudes.
    """
    await create_default_data()
    yield


# Instancia principal de la aplicación FastAPI con metadatos para la documentación
app = FastAPI(
    title="TurtleForge Cost API",
    description="API para calcular costos de impresión 3D",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: permite el frontend local (Vite/CRA) y el dominio de producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://3d.turtlenode.dev",
    ],
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
app.include_router(client_quotes.router)
app.include_router(supplies.router)
app.include_router(inventory.router)
app.include_router(purchase_orders.router)
app.include_router(slicer.router)
app.include_router(printed_items.router)

# Archivos estáticos: imágenes de ítems de impresión y otros recursos subidos
app.mount("/static", StaticFiles(directory="/app/static", check_dir=False), name="static")


@app.get("/api/health")
async def health_check():
    """
    Endpoint de verificación del estado del servidor.

    Returns:
        dict: Diccionario con el campo 'status' en 'ok' y el nombre de la app.
    """
    return {"status": "ok", "app": "TurtleForge Cost"}


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

        # Crear empresa por defecto si aún no existe (la migración la crea en upgrade,
        # pero en una instalación fresca sin datos previos puede no estar presente)
        company_result = await db.execute(
            select(Company).where(Company.id == DEFAULT_COMPANY_ID)
        )
        default_company = company_result.scalar_one_or_none()
        if not default_company:
            default_company = Company(id=DEFAULT_COMPANY_ID, name="Calculator3D")
            db.add(default_company)
            await db.commit()
            await db.refresh(default_company)

        # Crear usuario admin con contraseña hasheada usando bcrypt
        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            is_admin=True,
            company_id=DEFAULT_COMPANY_ID,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        # Crear configuración de la empresa con valores por defecto razonables
        default_settings = AppSettings(
            user_id=admin.id,
            company_id=DEFAULT_COMPANY_ID,
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
            notes="Impresora principal - BambuLab P2S Combo con AMS 2 Pro",
            company_id=DEFAULT_COMPANY_ID,
        )
        db.add(default_printer)

        await db.commit()
