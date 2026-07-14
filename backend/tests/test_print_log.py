"""
Tests para la bitácora global de impresiones (issue #131):
`GET /api/queue/log` — filtros, paginación, export CSV.

Nota sobre alcance: al no correr contra Postgres real, los mocks no
evalúan el WHERE/JOIN generado por SQLAlchemy — no se puede verificar
aquí que `printer_id=5` filtre realmente por esa impresora. Lo que SÍ se
prueba: validación de input (fecha inválida → 400 antes de tocar la BD),
forma de la respuesta paginada, que el log no filtra por status por
defecto (a diferencia de /history), export CSV con las columnas
correctas, y la conversión de fecha América/Bogotá → UTC (unit test
directo sobre `_bogota_day_bounds_to_utc`, sin mocks).
"""

import csv
import io
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.routers.queue import _bogota_day_bounds_to_utc
from app.services.auth import get_current_user


def _fake_user(role="operator"):
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
    u.role = role
    u.is_active = True
    return u


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


async def _fake_db_empty():
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    result.scalar.return_value = None
    session.execute.return_value = result
    yield session


def _fake_log_item(item_id, status="pending", created_at=None, piece_name=None, created_by=None):
    """
    Fake PrintQueueItem completo para el log — cubre todos los campos que
    `_build_response`/`_build_responses_bulk` leen (mismo patrón que
    test_queue_advanced.py, para no repetir el bug de #130/#146).
    """
    m = MagicMock()
    m.id = item_id
    m.status = status
    m.position = 0
    m.quote_id = None
    m.vault_model_id = None
    m.project_id = None
    m.piece_name = piece_name
    m.printer_id = None
    m.filament_id = None
    m.spool_id = None
    m.quantity = 1
    m.weight_grams = None
    m.print_time_hours = None
    m.started_at = None
    m.completed_at = None
    m.notes = None
    m.failure_reason = None
    m.failure_category = None
    m.batch_id = None
    m.scheduled_at = None
    m.created_by = created_by
    m.created_at = created_at or datetime.now(timezone.utc).replace(tzinfo=None)
    return m


def _fake_db_log(items, total):
    """
    Sesión para el camino paginado: 1ª query = count, 2ª = items paginados.
    Los items no tienen piece_name/printer_id/filament_id/vault_model_id/
    created_by (por defecto None), así que `_build_responses_bulk` no
    dispara queries adicionales.
    """
    async def _gen():
        session = AsyncMock()
        result_count = MagicMock()
        result_count.scalar_one.return_value = total
        result_items = MagicMock()
        result_items.scalars.return_value.all.return_value = items
        session.execute.side_effect = [result_count, result_items]
        yield session

    return _gen


def _fake_db_log_csv(items):
    """Sesión para el camino CSV: solo 1 query (sin count, sin paginar)."""
    async def _gen():
        session = AsyncMock()
        result_items = MagicMock()
        result_items.scalars.return_value.all.return_value = items
        session.execute.return_value = result_items
        yield session

    return _gen


# ---------------------------------------------------------------------------
# 1. Conversión de fecha América/Bogotá → UTC (unit test, sin mocks)
# ---------------------------------------------------------------------------

class TestBogotaDayBounds:
    def test_bogota_es_utc_menos_5_todo_el_año(self):
        """Colombia no tiene horario de verano — offset fijo -05:00."""
        start, end = _bogota_day_bounds_to_utc("2026-07-14")
        assert start == datetime(2026, 7, 14, 5, 0, 0)
        assert end == datetime(2026, 7, 15, 5, 0, 0)

    def test_dia_calendario_completo_enero(self):
        start, end = _bogota_day_bounds_to_utc("2026-01-01")
        assert start == datetime(2026, 1, 1, 5, 0, 0)
        assert end == datetime(2026, 1, 2, 5, 0, 0)

    def test_fecha_con_formato_invalido_levanta_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _bogota_day_bounds_to_utc("14/07/2026")
        assert exc_info.value.status_code == 400

    def test_fecha_vacia_levanta_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _bogota_day_bounds_to_utc("")
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# 2. GET /api/queue/log — respuesta paginada
# ---------------------------------------------------------------------------

class TestPrintLogPagination:
    async def test_sin_filtros_incluye_todos_los_estados(self):
        """A diferencia de /history, /log no filtra por status por defecto."""
        items = [
            _fake_log_item(1, status="pending"),
            _fake_log_item(2, status="printing"),
            _fake_log_item(3, status="done"),
            _fake_log_item(4, status="cancelled"),
        ]
        _set_overrides({
            get_db: _fake_db_log(items, 4),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 4
        assert {it["status"] for it in body["items"]} == {"pending", "printing", "done", "cancelled"}

    async def test_paginacion_respeta_page_y_page_size(self):
        items = [_fake_log_item(i) for i in range(1, 6)]
        _set_overrides({
            get_db: _fake_db_log(items, 42),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?page=3&page_size=5")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 42
        assert body["page"] == 3
        assert body["page_size"] == 5
        assert len(body["items"]) == 5

    async def test_page_size_fuera_de_rango_retorna_422(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?page_size=500")
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_page_cero_retorna_422(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?page=0")
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_fecha_invalida_retorna_400_antes_de_tocar_bd(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?date_from=no-es-fecha")
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_combinacion_de_filtros_no_rompe_la_request(self):
        """Smoke test: todos los filtros juntos no deben producir un 500."""
        items = [_fake_log_item(1, status="done")]
        _set_overrides({
            get_db: _fake_db_log(items, 1),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get(
                    "/api/queue/log"
                    "?q=figura&printer_id=3&status=done,cancelled&user_id=1"
                    "&date_from=2026-01-01&date_to=2026-12-31&page=1&page_size=25"
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["total"] == 1


# ---------------------------------------------------------------------------
# 3. GET /api/queue/log?format=csv
# ---------------------------------------------------------------------------

class TestPrintLogCsvExport:
    async def test_csv_incluye_header_y_fila_con_datos_correctos(self):
        item = _fake_log_item(1, status="done", piece_name="Figura Vader", created_by=7)

        fake_creator = MagicMock()
        fake_creator.id = 7
        fake_creator.username = "giomar"

        async def _gen():
            session = AsyncMock()
            result_items = MagicMock()
            result_items.scalars.return_value.all.return_value = [item]
            result_creator = MagicMock()
            result_creator.scalars.return_value.all.return_value = [fake_creator]
            session.execute.side_effect = [result_items, result_creator]
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?format=csv")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")

        rows = list(csv.reader(io.StringIO(r.text)))
        assert rows[0] == [
            "id", "fecha", "pieza", "origen", "impresora", "usuario", "estado",
            "cantidad", "peso_g", "tiempo_h", "costo",
        ]
        assert rows[1][0] == "1"
        assert rows[1][2] == "Figura Vader"
        assert rows[1][3] == "vault"
        assert rows[1][5] == "giomar"
        assert rows[1][6] == "done"
        assert rows[1][7] == "1"

    async def test_csv_no_pagina_trae_todo_el_set_filtrado(self):
        items = [_fake_log_item(i, status="done") for i in range(1, 11)]
        _set_overrides({
            get_db: _fake_db_log_csv(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/queue/log?format=csv&page_size=5")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        rows = list(csv.reader(io.StringIO(r.text)))
        # header + 10 filas, sin importar el page_size=5 pedido (CSV ignora paginación).
        assert len(rows) == 11
