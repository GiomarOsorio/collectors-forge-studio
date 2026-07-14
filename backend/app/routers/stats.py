"""
Router del dashboard de Stats: analytics de impresión y costos (issue #132).

Endpoints:
    GET /api/stats/overview   — resumen agregado (tasa de éxito, horas,
                                 gramos/costo por filamento, por impresora,
                                 por usuario, fallos). Acepta `?format=csv`.
    GET /api/stats/trends     — serie temporal agrupada por day/week/month.
                                 Acepta `?format=csv`.

Query params comunes: `date_from`/`date_to` en formato 'YYYY-MM-DD' (día
calendario en América/Bogotá, mismo criterio que `/queue/log` de #131). Sin
rango, se agregan TODOS los items done/cancelled históricos.
"""

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.queue import _bogota_day_bounds_to_utc
from app.schemas.stats import StatsOverviewResponse, StatsTrendsResponse
from app.services.auth import get_current_user
from app.services.stats import get_overview, get_trends

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _date_bounds(date_from: Optional[str], date_to: Optional[str]):
    start_utc = _bogota_day_bounds_to_utc(date_from)[0] if date_from else None
    end_utc = _bogota_day_bounds_to_utc(date_to)[1] if date_to else None
    return start_utc, end_utc


def _overview_to_csv(overview: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["métrica", "valor"])
    writer.writerow(["prints_done", overview["prints_done"]])
    writer.writerow(["prints_cancelled", overview["prints_cancelled"]])
    writer.writerow(["success_rate_pct", overview["success_rate_pct"]])
    writer.writerow(["total_hours", overview["total_hours"]])
    writer.writerow(["material_cost_cop", overview["material_cost_cop"]])
    writer.writerow(["electricity_cost_cop", overview["electricity_cost_cop"]])
    writer.writerow([])
    writer.writerow(["tipo_filamento", "gramos", "costo_cop"])
    for e in overview["grams_by_filament_type"]:
        writer.writerow([e["filament_type"], e["grams"], e["cost_cop"]])
    writer.writerow([])
    writer.writerow(["impresora", "prints", "horas"])
    for e in overview["by_printer"]:
        writer.writerow([e["printer_name"], e["prints"], e["hours"]])
    writer.writerow([])
    writer.writerow(["usuario", "prints"])
    for e in overview["by_user"]:
        writer.writerow([e["username"], e["prints"]])
    writer.writerow([])
    writer.writerow(["categoría_fallo", "conteo"])
    for e in overview["failure_breakdown"]:
        writer.writerow([e["category"], e["count"]])
    return buf.getvalue()


def _trends_to_csv(trends: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["bucket_start", "prints_done", "prints_cancelled", "gramos"])
    for p in trends["series"]:
        writer.writerow([p["bucket_start"], p["prints_done"], p["prints_cancelled"], p["grams"]])
    return buf.getvalue()


@router.get("/overview")
async def stats_overview(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    format: Optional[str] = None,  # noqa: A002 — mismo nombre de param que /queue/log
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen agregado del rango de fechas. `?format=csv` para descargar."""
    start_utc, end_utc = _date_bounds(date_from, date_to)
    overview = await get_overview(db, start_utc, end_utc)
    if format == "csv":
        csv_text = _overview_to_csv(overview)
        return StreamingResponse(
            iter([csv_text]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=stats_overview.csv"},
        )
    return StatsOverviewResponse(**overview)


@router.get("/trends")
async def stats_trends(
    bucket: str = Query(default="day", pattern="^(day|week|month)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    format: Optional[str] = None,  # noqa: A002
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serie temporal agrupada por bucket. `?format=csv` para descargar."""
    start_utc, end_utc = _date_bounds(date_from, date_to)
    trends = await get_trends(db, start_utc, end_utc, bucket)
    if format == "csv":
        csv_text = _trends_to_csv(trends)
        return StreamingResponse(
            iter([csv_text]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=stats_trends.csv"},
        )
    return StatsTrendsResponse(**trends)
