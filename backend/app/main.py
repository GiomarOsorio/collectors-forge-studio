from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import init_db, async_session
from app.models import User, AppSettings, Printer
from app.services.auth import get_password_hash
from app.routers import auth, filaments, printers, settings as settings_router, quotes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crear tablas y usuario admin
    await init_db()
    await create_default_data()
    yield


app = FastAPI(
    title="Calculator3D API",
    description="API para calcular costos de impresión 3D",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS para permitir el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(auth.router)
app.include_router(filaments.router)
app.include_router(printers.router)
app.include_router(settings_router.router)
app.include_router(quotes.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Calculator3D"}


async def create_default_data():
    """Crear usuario admin y datos iniciales si no existen."""
    async with async_session() as db:
        # Verificar si ya existe el admin
        result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        if result.scalar_one_or_none():
            return

        # Crear usuario admin
        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        # Crear settings por defecto
        default_settings = AppSettings(
            user_id=admin.id,
            electricity_rate=0.15,
            failure_rate_percent=5.0,
            labor_cost_per_hour=10.0,
            default_margin_percent=30.0,
            currency="USD",
        )
        db.add(default_settings)

        # Crear la BambuLab P1S Combo por defecto
        default_printer = Printer(
            name="Mi BambuLab P1S Combo",
            model="BambuLab P1S Combo",
            purchase_price=699.0,
            power_consumption_watts=180.0,
            estimated_lifespan_hours=5000.0,
            current_hours=0.0,
            nozzle_price=8.0,
            nozzle_lifespan_hours=500.0,
            buildplate_price=35.0,
            buildplate_lifespan_hours=2000.0,
            other_maintenance_per_hour=0.01,
            notes="Impresora principal - BambuLab P1S Combo con AMS",
        )
        db.add(default_printer)

        await db.commit()
