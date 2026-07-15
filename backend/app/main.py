"""
Punto de entrada principal de la API Collector's Forge Studio.

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

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    client_quotes, inventory, purchase_orders, printed_items,
)
from app.routers.company import router as company_router
from app.routers.company_templates import router as company_templates_router
from app.routers.users import router as users_router
from app.routers.maintenance import router as maintenance_router
from app.routers.queue import router as queue_router
from app.routers.inventory_categories import router as inventory_categories_router
from app.routers.vault import router as vault_router
from app.routers.filament_profiles import router as filament_profiles_router
from app.routers.projects import router as projects_router
from app.routers.oidc import router as oidc_router
from app.routers.spools import router as spools_router
from app.routers.stats import router as stats_router
from app.routers.notifications import router as notifications_router
from app.services.thumbnail_extractor import extract_plate_png, save_thumbnail
from app.services.vault_storage import download_file, ensure_bucket
from app.services.tariff_scraper import refresh_if_stale
from app.services.notifier import digest_loop, maintenance_due_loop

# UUID fijo de la empresa por defecto — coincide con la migración f4a1b9c2d8e7
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# Build de Vite copiado por el Containerfile a app/spa/ (index.html + assets/).
# OJO: NO "app/static/" — ese directorio ya existe y lo usa pdf_generator.py
# para el logo/fuentes de ReportLab (Path(__file__).parent.parent / "static").
# Un mismo nombre pisaría logo.png con el del build de Vite.
SPA_DIR = Path(__file__).parent / "spa"


async def _backfill_vault_thumbnails() -> None:
    """
    Backfill idempotente de thumbnails de plate render del Vault.

    Recorre los `model_files` con `thumbnail_key IS NULL`, descarga el
    `.3mf` / `.gcode.3mf` de MinIO y extrae el PNG embebido por
    OrcaSlicer/BambuStudio. El PNG se sube a MinIO bajo
    `thumbnails/{id}.png` y se persiste la key en la columna. Los fallos
    por archivo se loggean y no detienen el resto (puede ser un .3mf sin
    slicing, sin PNG embebido, o un objeto corrupto en MinIO).

    Corre una sola vez al arrancar dentro del `lifespan`. Es no-op si
    todos los modelos ya tienen `thumbnail_key`.
    """
    # Import diferido para evitar dependencia circular con app.models en tests.
    from app.models.model_file import ModelFile

    try:
        async with async_session() as db:
            result = await db.execute(
                select(ModelFile).where(ModelFile.thumbnail_key.is_(None))
            )
            models = result.scalars().all()

            if not models:
                return

            logger.info("Backfill de thumbnails: %d modelos pendientes", len(models))
            ok = 0
            for model in models:
                try:
                    # Probar print_file primero (más rico en thumbnails), luego source.
                    key = model.print_file_key or model.source_file_key
                    if not key:
                        continue
                    zip_bytes = await download_file(key)
                    png = extract_plate_png(zip_bytes)
                    if not png:
                        continue
                    model.thumbnail_key = await save_thumbnail(model.id, png)
                    await db.commit()
                    await db.refresh(model)
                    ok += 1
                except Exception as exc:
                    logger.warning(
                        "Backfill thumbnail falló para model_file=%s: %s", model.id, exc
                    )
                    await db.rollback()
            logger.info("Backfill de thumbnails: %d/%d completados", ok, len(models))
    except Exception as exc:
        logger.error("Backfill de thumbnails abortado: %s", exc)


async def _periodic_tariff_refresh() -> None:
    """
    Tarea de fondo que refresca la tarifa EPM cada 24 horas.

    `refresh_if_stale` consulta primero la BD y omite el scrape si el último
    registro tiene < 7 días, así que aunque corramos diario, EPM recibe a lo
    sumo ~4-5 hits/mes. EPM publica tarifas mensualmente (mid-month), por
    lo que este intervalo cubre la latencia de publicación con holgura.
    """
    while True:
        try:
            await asyncio.sleep(24 * 3600)
            async with async_session() as db:
                await refresh_if_stale(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error en refresh periódico de tarifa EPM: %s", e)


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
    # Inicializar bucket MinIO del Vault (no-fatal si MinIO no está disponible)
    await ensure_bucket()
    # Backfill de thumbnails embebidos en .3mf — idempotente, no-op si todo está al día.
    asyncio.create_task(_backfill_vault_thumbnails())
    # Refresco condicional de tarifa EPM al inicio + cada 24h (gating en BD)
    try:
        async with async_session() as db:
            await refresh_if_stale(db)
    except Exception as e:
        logger.error("Refresh inicial de tarifa EPM falló: %s", e)
    tariff_task = asyncio.create_task(_periodic_tariff_refresh())
    # Notificaciones (issue #137): digest diario + chequeo de mantenimiento vencido.
    digest_task = asyncio.create_task(digest_loop())
    maintenance_due_task = asyncio.create_task(maintenance_due_loop())
    yield
    tariff_task.cancel()
    digest_task.cancel()
    maintenance_due_task.cancel()
    for task in (tariff_task, digest_task, maintenance_due_task):
        try:
            await task
        except asyncio.CancelledError:
            pass


# Instancia principal de la aplicación FastAPI con metadatos para la documentación
# /docs y /redoc se deshabilitan en producción (ENABLE_DOCS=False por defecto)
app = FastAPI(
    title="Collector's Forge API",
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

# CORS: permite el dev server de Vite y el dominio de producción. Ya no
# incluye localhost:3000 — el frontend dejó de correr standalone en ese
# puerto, FastAPI sirve el SPA directo desde el mismo origen.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://cfs.turtlenode.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_audit_logger = logging.getLogger("audit")


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """
    Headers de seguridad HTTP — antes los ponía nginx (frontend/nginx.conf),
    ahora que FastAPI sirve el SPA directo (sin nginx de por medio) hay que
    agregarlos acá para no perder la protección.

    CSP: script-src incluye 'unsafe-inline' porque Cloudflare (Rocket Loader /
    Bot Fight Mode) inyecta sus propios scripts inline (utils.js, etc.) que no
    podemos controlar. data-cfasync="false" en nuestros <script> (vite.config.js)
    impide que Rocket Loader reescriba nuestros módulos ES, que es lo que
    causaba React error #130. connect-src incluye el dominio de producción.
    """
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' https://cfs.turtlenode.dev;"
    )
    return response


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
app.include_router(printed_items.router)
app.include_router(company_router)
app.include_router(company_templates_router)
app.include_router(users_router)
app.include_router(maintenance_router)
app.include_router(queue_router)
app.include_router(inventory_categories_router)
app.include_router(vault_router)
app.include_router(filament_profiles_router)
app.include_router(projects_router)
app.include_router(spools_router)
app.include_router(stats_router)
app.include_router(notifications_router)

# NOTA: el mount clásico de `/static` para binarios subidos por el usuario
# (thumbnails de Vault, logos de empresa, imágenes de impresiones) no existe
# — esos viven en MinIO y se sirven vía endpoints proxy dedicados
# (`GET /api/vault/{id}/thumbnail`, `GET /api/company/logo`,
# `GET /api/inventory/prints/{id}/image`). El mount de acá es otra cosa:
# el build de Vite (JS/CSS con nombre hasheado) que el Containerfile copia
# a app/spa/. Se sirve bajo /assets; el catch-all SPA más abajo cubre el
# resto de rutas del frontend.
#
# app/spa/ solo existe DENTRO del container (lo copia el Containerfile en
# build time) — en dev local (uvicorn corriendo directo desde backend/, sin
# Containerfile) y en tests no existe, porque el frontend se sirve aparte
# con `npm run dev` (vite.config.js ya proxea /api → localhost:8000). Sin
# este guard, StaticFiles revienta en el import con RuntimeError apenas se
# importa app.main fuera del container.
if (SPA_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=SPA_DIR / "assets"), name="spa-assets")


@app.get("/api/health")
async def health_check():
    """
    Endpoint de verificación del estado del servidor.

    Returns:
        dict: Diccionario con el campo 'status' en 'ok' y el nombre de la app.
    """
    return {"status": "ok", "app": "Collector's Forge Studio"}


@app.get("/api/health/full")
async def health_check_full():
    """
    Health check completo — verifica DB (Postgres) + MinIO + tabla migrations.

    Útil para uptime monitors. Retorna 200 si todo OK, 503 si algo falla.

    Returns:
        dict con `status: ok|degraded`, `checks: { db, minio, alembic }`
    """
    from fastapi import status as http_status
    from fastapi.responses import JSONResponse
    from sqlalchemy import text

    checks = {"db": "unknown", "minio": "unknown", "alembic": "unknown"}

    # DB ping
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
            checks["db"] = "ok"
    except Exception as exc:
        logger.error("Health DB falló: %s", exc)
        checks["db"] = f"error: {type(exc).__name__}"

    # MinIO ping (head_bucket)
    try:
        import asyncio as _asyncio
        from app.services.vault_storage import _get_client
        from app.config import settings as _settings

        def _ping():
            client = _get_client()
            client.head_bucket(Bucket=_settings.MINIO_BUCKET)

        await _asyncio.to_thread(_ping)
        checks["minio"] = "ok"
    except Exception as exc:
        logger.error("Health MinIO falló: %s", exc)
        checks["minio"] = f"error: {type(exc).__name__}"

    # Alembic version actual
    try:
        async with async_session() as db:
            result = await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            version = result.scalar()
            checks["alembic"] = version or "no version"
    except Exception as exc:
        logger.error("Health alembic falló: %s", exc)
        checks["alembic"] = f"error: {type(exc).__name__}"

    all_ok = checks["db"] == "ok" and checks["minio"] == "ok"
    body = {"status": "ok" if all_ok else "degraded", "checks": checks}
    code = http_status.HTTP_200_OK if all_ok else http_status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=body, status_code=code)


# Catch-all del SPA — DEBE ir después de todos los routers y endpoints de
# arriba: Starlette matchea rutas en orden de registro, así que cualquier
# /api/* ya matcheó su endpoint real antes de llegar acá. Sirve archivos
# sueltos del build (favicon, logo) si existen, y si no hace fallback a
# index.html para que React Router resuelva la ruta client-side
# (ej. /inventory/purchases, que no existe como archivo).
# methods=["GET", "HEAD"]: nginx respondía HEAD sin problema (try_files no
# distingue método); FastAPI no agrega HEAD automático a una ruta GET.
#
# Sin build (dev local / tests, ver guard del mount de /assets arriba):
# devuelve 404 en vez de FileResponse a un index.html que no existe — el
# frontend en dev corre aparte con `npm run dev`, este catch-all solo tiene
# sentido dentro del container con el build de Vite ya copiado.
@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)
    index_file = SPA_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404)
    if full_path:
        # resolve() + is_relative_to() evita path traversal (../../etc/passwd)
        # — a diferencia de StaticFiles, este catch-all arma el path a mano.
        candidate = (SPA_DIR / full_path).resolve()
        if candidate.is_relative_to(SPA_DIR.resolve()) and candidate.is_file():
            return FileResponse(candidate)
    return FileResponse(index_file)


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
                notes="Impresora principal - BambuLab P2S Combo con AMS 2 Pro",
            )
            db.add(default_printer)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
