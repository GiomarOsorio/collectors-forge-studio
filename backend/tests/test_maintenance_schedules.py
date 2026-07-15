"""
Tests para recordatorios de mantenimiento por intervalo (issue #138).

Dos bloques:
1. `_compute_progress` — el cálculo puro de % y status, aislado de HTTP:
   cubre los criterios de aceptación del issue (300h con 250h transcurridas
   → 83.3% due_soon, overdue, tipo 'days' con `_now` mockeado, clamp a 0
   si la impresora tiene menos horas que last_done_hours).
2. Endpoints de `routers/maintenance.py` (schedules CRUD + complete + due
   + integración con create_log) vía HTTP con sesión de DB mockeada.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.routers import maintenance as maintenance_router
from app.routers.maintenance import _compute_progress
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


def _fake_printer(printer_id=1, current_hours=Decimal("250.00"), name="P2S del estudio"):
    p = MagicMock()
    p.id = printer_id
    p.name = name
    p.current_hours = current_hours
    return p


def _fake_schedule(
    schedule_id=1,
    printer=None,
    task_name="Lubricar ejes XY",
    interval_type="print_hours",
    interval_value=Decimal("300.0"),
    last_done_hours=Decimal("0.00"),
    last_done_at=None,
    enabled=True,
):
    s = MagicMock()
    s.id = schedule_id
    s.printer_id = printer.id if printer else 1
    s.printer = printer
    s.task_name = task_name
    s.description = None
    s.interval_type = interval_type
    s.interval_value = interval_value
    s.last_done_hours = last_done_hours
    s.last_done_at = last_done_at or datetime.now(timezone.utc).replace(tzinfo=None)
    s.enabled = enabled
    s.created_at = s.last_done_at
    s.updated_at = s.last_done_at
    return s


def _fake_db_sequence(*results):
    async def _gen():
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=list(results))
        yield session
    return _gen


def _exec_result(scalar_one_or_none=None, scalars_all=None):
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    r.scalars.return_value.all.return_value = scalars_all or []
    return r


# ---------------------------------------------------------------------------
# 1. _compute_progress — cálculo puro
# ---------------------------------------------------------------------------

class TestComputeProgress:
    def test_print_hours_83_por_ciento_es_due_soon(self):
        """Criterio #1: schedule 'cada 300h' con 250h desde el último done → 83% due_soon."""
        printer = _fake_printer(current_hours=Decimal("250.00"))
        schedule = _fake_schedule(printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"))
        pct, status = _compute_progress(schedule)
        assert pct == Decimal("83.3")
        assert status == "due_soon"

    def test_print_hours_overdue(self):
        printer = _fake_printer(current_hours=Decimal("350.00"))
        schedule = _fake_schedule(printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"))
        pct, status = _compute_progress(schedule)
        assert pct >= Decimal("100")
        assert status == "overdue"

    def test_print_hours_ok(self):
        printer = _fake_printer(current_hours=Decimal("50.00"))
        schedule = _fake_schedule(printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"))
        pct, status = _compute_progress(schedule)
        assert pct == Decimal("16.7")
        assert status == "ok"

    def test_dias_vence_correctamente_con_now_mockeado(self, monkeypatch):
        """Criterio #3: tipo 'days' con now inyectado (sin freezegun)."""
        last_done = datetime(2026, 1, 1, 0, 0, 0)
        fixed_now = datetime(2026, 1, 20, 0, 0, 0)  # 19 días después
        monkeypatch.setattr(maintenance_router, "_now", lambda: fixed_now)

        schedule = _fake_schedule(
            printer=_fake_printer(),
            interval_type="days",
            interval_value=Decimal("15.0"),
            last_done_at=last_done,
        )
        pct, status = _compute_progress(schedule)
        assert status == "overdue"
        assert pct >= Decimal("100")

    def test_impresora_con_menos_horas_que_last_done_clampea_en_0(self):
        """Edge: impresora reemplazada/reseteada (current_hours < last_done_hours) → 0%, no negativo."""
        printer = _fake_printer(current_hours=Decimal("10.00"))
        schedule = _fake_schedule(printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("200.00"))
        pct, status = _compute_progress(schedule)
        assert pct == Decimal("0.0")
        assert status == "ok"


# ---------------------------------------------------------------------------
# 2. Endpoints
# ---------------------------------------------------------------------------

class TestCreateSchedule:
    async def test_baseline_arranca_en_0_por_ciento(self):
        """Edge: schedule nuevo (nunca completado) usa created_at/horas actuales como base → 0%."""
        printer = _fake_printer(current_hours=Decimal("120.00"))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        created_schedule = _fake_schedule(
            printer=printer, last_done_hours=Decimal("120.00"), last_done_at=now,
        )
        _set_overrides({
            get_db: _fake_db_sequence(
                _exec_result(scalar_one_or_none=printer),
                _exec_result(scalar_one_or_none=created_schedule),
            ),
            get_current_user: lambda: _fake_user(role="admin"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/maintenance/schedules/",
                    json={
                        "printer_id": 1, "task_name": "Lubricar ejes XY",
                        "interval_type": "print_hours", "interval_value": 300,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert body["progress_pct"] == 0.0
        assert body["status"] == "ok"

    async def test_no_admin_retorna_403(self):
        _set_overrides({
            get_db: _fake_db_sequence(),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/maintenance/schedules/",
                    json={
                        "printer_id": 1, "task_name": "X",
                        "interval_type": "print_hours", "interval_value": 300,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 403


class TestCompleteSchedule:
    async def test_completar_resetea_progreso_y_crea_log(self):
        """Criterio #2: completar mantenimiento resetea el progreso y crea el log."""
        printer = _fake_printer(current_hours=Decimal("400.00"))
        overdue_schedule = _fake_schedule(
            printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"),
        )
        reset_schedule = _fake_schedule(
            printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("400.00"),
        )
        _set_overrides({
            get_db: _fake_db_sequence(
                _exec_result(scalar_one_or_none=overdue_schedule),
                _exec_result(scalar_one_or_none=reset_schedule),
            ),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/maintenance/schedules/1/complete")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["progress_pct"] == 0.0
        assert overdue_schedule.last_done_hours == Decimal("400.00")


class TestSchedulesDue:
    async def test_filtra_solo_status_distinto_de_ok(self):
        printer = _fake_printer(current_hours=Decimal("350.00"))
        overdue = _fake_schedule(schedule_id=1, printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"))
        ok = _fake_schedule(schedule_id=2, printer=printer, interval_value=Decimal("300.0"), last_done_hours=Decimal("340.00"))
        _set_overrides({
            get_db: _fake_db_sequence(_exec_result(scalars_all=[overdue, ok])),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/maintenance/schedules/due")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert ids == [1]


class TestCreateLogMatchesSchedule:
    async def test_log_manual_resetea_schedule_por_task_name(self):
        """El auto-match es case-insensitive contra maintenance_type."""
        printer = _fake_printer(printer_id=1, current_hours=Decimal("400.00"))
        schedule = _fake_schedule(
            schedule_id=7, printer=printer, task_name="lubricar ejes xy",
            interval_value=Decimal("300.0"), last_done_hours=Decimal("0.00"),
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        created_log = MagicMock()
        created_log.id = 99
        created_log.printer_id = 1
        created_log.hours_at_maintenance = Decimal("400.00")
        created_log.maintenance_type = "Lubricar Ejes XY"
        created_log.description = None
        created_log.performed_at = now
        created_log.created_at = now
        created_log.items = []
        created_log.printer = None

        _set_overrides({
            get_db: _fake_db_sequence(
                _exec_result(scalar_one_or_none=printer),   # _get_company_printer
                _exec_result(scalars_all=[schedule]),        # candidate schedules
                _exec_result(scalar_one_or_none=created_log),  # _get_log final
            ),
            get_current_user: lambda: _fake_user(role="operator"),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/maintenance/logs/",
                    json={
                        "printer_id": 1, "hours_at_maintenance": 400,
                        "maintenance_type": "Lubricar Ejes XY",
                        "items": [],
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert r.json()["matched_schedules"] == [7]
        assert schedule.last_done_hours == Decimal("400.00")
