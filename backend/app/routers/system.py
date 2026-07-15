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
    GET /api/system/backup → dump de la BD (pg_dump -Fc) streameado como
        descarga (issue #140, pieza E — RECORTADA a solo esto, ver docstring
        de `download_backup`).
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator, List, Optional
from urllib.parse import urlparse, urlunparse

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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


def _pg_dump_dsn() -> str:
    """
    Convierte `settings.DATABASE_URL` (`postgresql+asyncpg://...`) a un DSN
    `postgresql://...` que `pg_dump`/libpq entienden — el driver `+asyncpg`
    es específico de SQLAlchemy, `pg_dump` no lo reconoce.
    """
    parsed = urlparse(settings.DATABASE_URL)
    scheme = parsed.scheme.split("+", 1)[0]
    return urlunparse(parsed._replace(scheme=scheme))


async def _stream_pg_dump() -> AsyncIterator[bytes]:
    """
    Corre `pg_dump -Fc` contra la DSN de la app y streamea stdout en chunks.

    `-Fc` = custom format (comprimido, restaurable con `pg_restore` — igual
    que el backup manual documentado en `docs/despliegue.md`). El proceso se
    espera al final del generator; si termina con código != 0, se loguea
    stderr (ya no hay forma de devolver un error HTTP limpio — la respuesta
    ya empezó a streamear).
    """
    process = await asyncio.create_subprocess_exec(
        "pg_dump", _pg_dump_dsn(), "-Fc",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    assert process.stdout is not None
    try:
        while True:
            chunk = await process.stdout.read(65536)
            if not chunk:
                break
            yield chunk
    finally:
        returncode = await process.wait()
        if returncode != 0:
            stderr = await process.stderr.read() if process.stderr else b""
            logging.getLogger(__name__).error(
                "pg_dump terminó con código %s: %s", returncode, stderr.decode(errors="replace")
            )


@router.get("/backup")
async def download_backup(current_user: User = Depends(get_admin_user)):
    """
    Descarga un dump de la BD (`pg_dump -Fc`) — solo esto, on-demand.

    **Recortado del alcance original del issue #140** (decisión ya tomada
    en el doc del agente, ver `agent-docs/bambuddy-sync/140-polish.md`):
    `docs/despliegue.md` ya documenta un backup programado (cron +
    `pg_dump -Fc`) y su restore por CLI — duplicar ese mecanismo en la UI
    (schedule + restore destructivo desde el navegador) no suma nada y sí
    agrega superficie de riesgo. Esta pieza es solo el botón "Descargar
    backup" — restore sigue siendo exclusivamente por CLI, como ya estaba.
    """
    filename = f"cfs-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.dump"
    return StreamingResponse(
        _stream_pg_dump(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
