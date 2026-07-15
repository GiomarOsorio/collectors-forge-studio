"""
Tests para el servicio de agregación de Stats (issue #132).

Datos conocidos (criterio de aceptación #1): 3 items 'done' + 1 'cancelled'
→ success_rate 75.00%; gramos/costo por tipo de filamento exactos en
Decimal. También cubre el bucketing de fechas cruzando medianoche Bogotá
(criterio #3) inyectando `completed_at` conocidos, sin freezegun.
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from app.services.stats import _bucket_key, get_overview, get_trends


def _fake_item(
    status="done", printer_id=1, filament_id=10, weight_grams=Decimal("100.0"),
    quantity=1, print_time_hours=Decimal("1.0"), created_by=1,
    failure_category=None, completed_at=None, quote_id=None,
):
    it = MagicMock()
    it.status = status
    it.quote_id = quote_id
    it.printer_id = printer_id
    it.filament_id = filament_id
    it.weight_grams = weight_grams
    it.quantity = quantity
    it.print_time_hours = print_time_hours
    it.created_by = created_by
    it.failure_category = failure_category
    it.completed_at = completed_at or datetime(2026, 1, 15, 12, 0, 0)
    return it


def _fake_printer(printer_id, name, watts):
    p = MagicMock()
    p.id = printer_id
    p.name = name
    p.power_consumption_watts = Decimal(str(watts))
    return p


def _fake_user(user_id, username):
    u = MagicMock()
    u.id = user_id
    u.username = username
    return u


def _fake_inventory_item(item_id, filament_type, price_per_kg):
    i = MagicMock()
    i.id = item_id
    i.filament_type = filament_type
    i.price_per_kg = Decimal(str(price_per_kg))
    return i


def _fake_settings(electricity_rate):
    s = MagicMock()
    s.electricity_rate = Decimal(str(electricity_rate))
    return s


def _exec_result(scalars_all=None, scalar_one_or_none=None):
    r = MagicMock()
    r.scalars.return_value.all.return_value = scalars_all or []
    r.scalar_one_or_none.return_value = scalar_one_or_none
    return r


def _fake_db(items, printers, users, inventory_items, settings):
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[
        _exec_result(scalars_all=items),
        _exec_result(scalars_all=printers),
        _exec_result(scalars_all=users),
        _exec_result(scalars_all=inventory_items),
        _exec_result(scalar_one_or_none=settings),
    ])
    return session


class TestOverview:
    async def test_success_rate_y_gramos_con_datos_conocidos(self):
        """Criterio #1: 3 done + 1 cancelled -> 75.00%; gramos exactos."""
        items = [
            _fake_item(printer_id=1, filament_id=10, weight_grams=Decimal("100.0"),
                       quantity=2, print_time_hours=Decimal("3.0"), created_by=1),
            _fake_item(printer_id=1, filament_id=10, weight_grams=Decimal("50.0"),
                       quantity=1, print_time_hours=Decimal("1.0"), created_by=2),
            _fake_item(printer_id=2, filament_id=20, weight_grams=Decimal("200.0"),
                       quantity=1, print_time_hours=Decimal("2.0"), created_by=1),
            _fake_item(status="cancelled", printer_id=1, filament_id=10, created_by=1,
                       failure_category="warping"),
        ]
        printers = [_fake_printer(1, "P2S", 200), _fake_printer(2, "A1", 300)]
        users = [_fake_user(1, "giomar"), _fake_user(2, "operario")]
        inv = [
            _fake_inventory_item(10, "PLA", 20),
            _fake_inventory_item(20, "PETG", 30),
        ]
        settings = _fake_settings(1000)

        db = _fake_db(items, printers, users, inv, settings)
        overview = await get_overview(db, None, None)

        assert overview["prints_done"] == 3
        assert overview["prints_cancelled"] == 1
        assert overview["success_rate_pct"] == Decimal("75.00")
        assert overview["total_hours"] == Decimal("9.0")  # 3*2 + 1*1 + 2*1

        grams_by_type = {e["filament_type"]: e["grams"] for e in overview["grams_by_filament_type"]}
        assert grams_by_type["PLA"] == Decimal("250.0")  # 100*2 + 50*1
        assert grams_by_type["PETG"] == Decimal("200.0")

        assert overview["material_cost_cop"] == Decimal("11.000")  # 250/1000*20 + 200/1000*30
        assert overview["electricity_cost_cop"] == Decimal("2000.000")  # 1.4*1000 + 0.6*1000

        by_printer = {e["printer_id"]: e for e in overview["by_printer"]}
        assert by_printer[1]["prints"] == 2
        assert by_printer[1]["hours"] == Decimal("7.0")
        assert by_printer[2]["prints"] == 1
        assert by_printer[2]["hours"] == Decimal("2.0")

        by_user = {e["user_id"]: e for e in overview["by_user"]}
        assert by_user[1]["prints"] == 3
        assert by_user[2]["prints"] == 1

        assert overview["failure_breakdown"] == [{"category": "warping", "count": 1}]

    async def test_sin_items_no_rompe_y_success_rate_es_0(self):
        db = _fake_db([], [], [], [], None)
        overview = await get_overview(db, None, None)
        assert overview["prints_done"] == 0
        assert overview["success_rate_pct"] == Decimal("0.00")
        assert overview["grams_by_filament_type"] == []


class TestBucketing:
    def test_cruza_medianoche_bogota_cae_en_dia_local_correcto(self):
        """Criterio #3: 04:30 UTC (23:30 Bogotá del día anterior) -> día local anterior."""
        completed_at = datetime(2026, 1, 15, 4, 30, 0)  # UTC
        key = _bucket_key(completed_at, "day")
        assert key.isoformat() == "2026-01-14"

    def test_bucket_week_usa_lunes_como_inicio(self):
        # 2026-01-15 es jueves; el lunes de esa semana es 2026-01-12.
        completed_at = datetime(2026, 1, 15, 20, 0, 0)  # 15:00 Bogotá, mismo día local
        key = _bucket_key(completed_at, "week")
        assert key.isoformat() == "2026-01-12"

    def test_bucket_month_trunca_al_primero(self):
        completed_at = datetime(2026, 1, 20, 20, 0, 0)
        key = _bucket_key(completed_at, "month")
        assert key.isoformat() == "2026-01-01"


class TestTrends:
    async def test_series_agrupa_por_dia_correctamente(self):
        items = [
            _fake_item(completed_at=datetime(2026, 1, 15, 15, 0, 0), weight_grams=Decimal("100.0"), quantity=1),
            _fake_item(completed_at=datetime(2026, 1, 15, 18, 0, 0), weight_grams=Decimal("50.0"), quantity=1),
            _fake_item(status="cancelled", completed_at=datetime(2026, 1, 16, 15, 0, 0)),
        ]
        db = _fake_db(items, [_fake_printer(1, "P2S", 200)], [_fake_user(1, "giomar")],
                       [_fake_inventory_item(10, "PLA", 20)], _fake_settings(1000))
        trends = await get_trends(db, None, None, "day")
        by_day = {p["bucket_start"]: p for p in trends["series"]}
        assert by_day["2026-01-15"]["prints_done"] == 2
        assert by_day["2026-01-15"]["grams"] == Decimal("150.0")
        assert by_day["2026-01-16"]["prints_cancelled"] == 1
