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

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import async_session
from app.limiter import limiter
from app.models import Company, User, AppSettings, Printer
from app.services.auth import get_password_hash
from app.routers import (
    auth, printers, settings as settings_router, quotes,
    client_quotes, inventory, purchase_orders, slicer, printed_items,
)
from app.routers.company import router as company_router
from app.routers.company_templates import router as company_templates_router
from app.routers.users import router as users_router
from app.routers.maintenance import router as maintenance_router
from app.routers.queue import router as queue_router
from app.routers.inventory_categories import router as inventory_categories_router
from app.routers.slicer import cleanup_old_slicer_files

# UUID fijo de la empresa por defecto — coincide con la migración f4a1b9c2d8e7
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _periodic_slicer_cleanup() -> None:
    """
    Tarea de fondo que elimina archivos slicer antiguos cada 24 horas.

    Corre en bucle infinito mientras la aplicación está activa. Se cancela
    limpiamente al apagar el servidor (CancelledError en el await).
    """
    while True:
        try:
            await asyncio.sleep(24 * 3600)
            await cleanup_old_slicer_files()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error en tarea de limpieza de slicer: %s", e)


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
    # Crear directorios estáticos necesarios
    Path("/app/static/companies").mkdir(parents=True, exist_ok=True)
    await create_default_data()
    # Ejecutar limpieza de slicer al inicio y luego cada 24h en background
    await cleanup_old_slicer_files()
    cleanup_task = asyncio.create_task(_periodic_slicer_cleanup())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


# Instancia principal de la aplicación FastAPI con metadatos para la documentación
# /docs y /redoc se deshabilitan en producción (ENABLE_DOCS=False por defecto)
app = FastAPI(
    title="TurtleForge Cost API",
    description="API para calcular costos de impresión 3D",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
)

# Rate limiting: registrar el limiter y el handler de errores 429
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

_audit_logger = logging.getLogger("audit")


@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    """
    Middleware de auditoría: registra cada petición con método, ruta,
    IP de origen, código de respuesta y tiempo de procesamiento (ms).
    Solo registra rutas /api/ para evitar spam de archivos estáticos.
    """
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = round((time.monotonic() - start) * 1000)

    client_ip = request.headers.get("X-Real-IP") or (
        request.client.host if request.client else "unknown"
    )
    _audit_logger.info(
        "%s %s %s %d %dms",
        client_ip,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# Registrar routers con sus respectivos prefijos y etiquetas
app.include_router(auth.router)
app.include_router(printers.router)
app.include_router(settings_router.router)
app.include_router(quotes.router)
app.include_router(client_quotes.router)
app.include_router(inventory.router)
app.include_router(purchase_orders.router)
app.include_router(slicer.router)
app.include_router(printed_items.router)
app.include_router(company_router)
app.include_router(company_templates_router)
app.include_router(users_router)
app.include_router(maintenance_router)
app.include_router(queue_router)
app.include_router(inventory_categories_router)

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
        try:
            await db.commit()
        except IntegrityError:
            # Otra instancia creó el usuario entre la verificación y el INSERT
            await db.rollback()
            return
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
