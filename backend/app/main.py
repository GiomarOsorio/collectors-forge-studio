"""
Punto de entrada principal de la API TurtleForge Cost.

Este módulo crea y configura la instancia de FastAPI, registra el middleware
de CORS y SessionMiddleware, incluye todos los routers de la aplicación y
define el ciclo de vida (lifespan) que crea la empresa por defecto, la
configuración inicial y la impresora BambuLab P2S Combo si aún no existen.

Los usuarios se crean automáticamente vía JIT provisioning en el callback OIDC.
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
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.database import async_session
from app.limiter import limiter
from app.models import Company, AppSettings, Printer
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
from app.routers.vault import router as vault_router
from app.routers.oidc import router as oidc_router
from app.routers.slicer import cleanup_old_slicer_files
from app.services.vault_storage import ensure_bucket

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
    # Inicializar bucket MinIO del Vault (no-fatal si MinIO no está disponible)
    await ensure_bucket()
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

# SessionMiddleware requerido por Authlib para almacenar state/nonce/PKCE durante el flujo OIDC
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY or settings.SECRET_KEY,
    https_only=not settings.ENABLE_DOCS,  # False en dev, True en prod
    same_site="lax",
    max_age=600,  # 10 minutos, suficiente para completar el flujo OIDC
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
app.include_router(oidc_router)
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
app.include_router(vault_router)

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
    Crea los datos iniciales de la empresa por defecto si aún no existen.

    Esta función es idempotente. Crea:
    - Empresa por defecto "The Collector Forge" (UUID fijo).
    - AppSettings por defecto para la empresa.
    - Impresora BambuLab P2S Combo por defecto.

    Los usuarios se crean automáticamente vía JIT provisioning en el callback OIDC.
    """
    async with async_session() as db:
        # Crear empresa por defecto si aún no existe
        company_result = await db.execute(
            select(Company).where(Company.id == DEFAULT_COMPANY_ID)
        )
        default_company = company_result.scalar_one_or_none()
        if not default_company:
            default_company = Company(id=DEFAULT_COMPANY_ID, name="The Collector Forge")
            db.add(default_company)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
            await db.refresh(default_company) if default_company.id else None

        # Crear AppSettings por defecto si aún no existe (singleton)
        settings_result = await db.execute(select(AppSettings).limit(1))
        if not settings_result.scalar_one_or_none():
            default_settings = AppSettings(
                user_id=None,
                electricity_rate=0.15,
                failure_rate_percent=5.0,
                labor_cost_per_hour=10.0,
                default_margin_percent=30.0,
                currency="USD",
            )
            db.add(default_settings)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()

        # Crear impresora BambuLab P2S Combo por defecto si aún no existe
        printer_result = await db.execute(select(Printer).limit(1))
        if not printer_result.scalar_one_or_none():
            default_printer = Printer(
                name="Mi BambuLab P2S Combo",
                model="BambuLab P2S Combo",
                purchase_price=799.0,
                power_consumption_watts=180.0,
                estimated_lifespan_hours=5000.0,
                current_hours=0.0,
                nozzle_price=8.0,
                nozzle_lifespan_hours=500.0,
                buildplate_price=35.0,
                buildplate_lifespan_hours=2000.0,
                other_maintenance_per_hour=0.01,
                notes="Impresora principal - BambuLab P2S Combo con AMS 2 Pro",
            )
            db.add(default_printer)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
