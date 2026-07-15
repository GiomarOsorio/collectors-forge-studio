"""
Router de System Info para Collector's Forge Studio (issue #140, pieza C).

Todo el módulo es admin-only. Solo lecturas de catálogo de PostgreSQL
(`pg_database_size`, `pg_total_relation_size` vía `pg_stat_user_tables`) —
sin parámetros de usuario en el SQL crudo.

Endpoints:
    GET /api/system/info → versión (git SHA), uptime, tamaño de BD (top 10
        tablas), espacio MinIO usado, conteos de negocio, estado de
        migraciones Alembic (current vs. head).
    GET /api/system/logs?level=&limit=200 → snapshot del buffer en memoria
        (sin streaming — refresh manual desde la UI).
"""

import time
from pathlib import Path
from typing import List, Optional

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.client_quote import ClientQuote
from app.models.model_file import ModelFile
from app.models.queue import PrintQueueItem
from app.models.spool import Spool
from app.models.user import User
from app.routers.vault import _get_used_bytes
from app.schemas.system import (
    Counts, DbInfo, LogRow, MigrationsInfo, MinioInfo, SystemInfoResponse, TopTable,
)
from app.services.auth import get_admin_user
from app.services.log_buffer import get_logs

router = APIRouter(prefix="/api/system", tags=["system"])

_START = time.time()
_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def _get_head_revision() -> Optional[str]:
    """
    Cabeza de la cadena de migraciones según los archivos en `alembic/versions/`.

    No requiere DB — lee el script directory. `None` si `alembic.ini` no
    está disponible (ej. algún entorno de test empaquetado distinto).
    """
    if not _ALEMBIC_INI.exists():
        return None
    cfg = AlembicConfig(str(_ALEMBIC_INI))
    script = ScriptDirectory.from_config(cfg)
    return script.get_current_head()


@router.get("/info", response_model=SystemInfoResponse)
async def get_system_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    db_size_result = await db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()))"))
    db_size_pretty = db_size_result.scalar() or "0 bytes"

    top_tables_result = await db.execute(text(
        "SELECT relname, pg_total_relation_size(relid) AS size_bytes "
        "FROM pg_catalog.pg_stat_user_tables "
        "ORDER BY size_bytes DESC LIMIT 10"
    ))
    top_tables = [
        TopTable(name=row.relname, size_pretty=_pretty_bytes(row.size_bytes), size_bytes=row.size_bytes)
        for row in top_tables_result.all()
    ]

    used_bytes = await _get_used_bytes(db)

    model_files_count = (await db.execute(select(func.count(ModelFile.id)))).scalar() or 0
    queue_done_count = (await db.execute(
        select(func.count(PrintQueueItem.id)).where(PrintQueueItem.status == "done")
    )).scalar() or 0
    client_quotes_count = (await db.execute(select(func.count(ClientQuote.id)))).scalar() or 0
    spools_count = (await db.execute(select(func.count(Spool.id)))).scalar() or 0

    current_result = await db.execute(text("SELECT version_num FROM alembic_version"))
    current_rev = current_result.scalar()
    head_rev = _get_head_revision()

    return SystemInfoResponse(
        version=settings.GIT_SHA[:12] if settings.GIT_SHA else "dev",
        uptime_seconds=time.time() - _START,
        db=DbInfo(size_pretty=db_size_pretty, top_tables=top_tables),
        minio=MinioInfo(used_bytes=used_bytes),
        counts=Counts(
            model_files=model_files_count,
            queue_items_done=queue_done_count,
            client_quotes=client_quotes_count,
            spools=spools_count,
        ),
        migrations=MigrationsInfo(
            current=current_rev,
            head=head_rev,
            up_to_date=bool(current_rev and head_rev and current_rev == head_rev),
        ),
    )


def _pretty_bytes(n: int) -> str:
    """Formato legible simple (KB/MB/GB) — evita depender de otra query a pg_size_pretty por fila."""
    value = float(n or 0)
    for unit in ("bytes", "KB", "MB", "GB", "TB"):
        if value < 1024:
            return f"{value:.1f} {unit}" if unit != "bytes" else f"{int(value)} {unit}"
        value /= 1024
    return f"{value:.1f} PB"


@router.get("/logs", response_model=List[LogRow])
async def get_system_logs(
    level: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    current_user: User = Depends(get_admin_user),
):
    return get_logs(level=level, limit=limit)
