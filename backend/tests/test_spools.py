"""
Tests para bobinas individuales de filamento (issue #134) — el ticket
más delicado del plan bambuddy-sync, porque toca el descuento de
inventario.

Dos bloques:
1. La REGLA DE CONSUMO (`_deduct_vault_item`, rama spool) — probada
   directamente sobre la función, aislando la aritmética de la
   complejidad de mockear toda la cadena HTTP. Cubre exactamente los
   criterios de aceptación del issue: consumo exacto (incluye
   quantity>1), agotamiento → finished + resta `initial_weight_g` (NO
   `remaining_weight_g`, NO "-1") del agregado del padre, NO doble
   descuento (el agregado no se toca mientras la bobina sigue activa),
   insuficiente → warning + floor 0 SIN bloquear (a diferencia del
   camino sin bobina, que sí lanza 400).
2. Los endpoints CRUD de `routers/spools.py` — alta masiva (incluye
   bulk 100), add_to_stock, low-stock, label_code únicos, update,
   delete bloqueado si hay un item 'printing' con esa bobina.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.routers.queue import _deduct_vault_item
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


def _fake_spool(spool_id=1, remaining=Decimal("500.0"), initial=Decimal("1000.0"), status="active"):
    s = MagicMock()
    s.id = spool_id
    s.label_code = f"SP-{spool_id:04d}"
    s.initial_weight_g = initial
    s.remaining_weight_g = remaining
    s.status = status
    s.finished_at = None
    return s


def _no_crossing_results():
    """
    Resultados mock para las 3 queries que `_emit_spool_low_if_crossed`
    (issue #137) dispara siempre tras tocar `remaining_weight_g`: settings,
    InventoryItem padre (para filament_type) y suma agregada de otras
    bobinas activas. Configurados para que el umbral NUNCA se cruce (así
    estos tests de aritmética de consumo no disparan `emit()`).
    """
    settings_result = MagicMock()
    settings_result.scalar_one_or_none.return_value = None  # usa threshold default 200

    parent_result = MagicMock()
    parent = MagicMock()
    parent.filament_type = "PLA"
    parent_result.scalar_one_or_none.return_value = parent

    others_result = MagicMock()
    others_result.scalar.return_value = Decimal("100000.0")  # bien por encima del threshold

    return [settings_result, parent_result, others_result]


def _fake_queue_item_for_deduct(quantity=1, weight_grams=Decimal("100.00"), spool_id=1, printer_id=None):
    item = MagicMock()
    item.quantity = quantity
    item.weight_grams = weight_grams
    item.spool_id = spool_id
    item.filament_id = None
    item.printer_id = printer_id
    item.print_time_hours = None
    return item


# ---------------------------------------------------------------------------
# 1. Regla de consumo — _deduct_vault_item, rama spool
# ---------------------------------------------------------------------------

class TestSpoolConsumptionRule:
    async def test_consumo_exacto_resta_del_spool_no_del_agregado(self):
        """Criterio #2: remaining_weight_g baja EXACTO weight_grams×quantity."""
        spool = _fake_spool(remaining=Decimal("500.0"))
        item = _fake_queue_item_for_deduct(quantity=2, weight_grams=Decimal("100.00"), spool_id=1)

        db = AsyncMock()
        spool_result = MagicMock()
        spool_result.scalar_one_or_none.return_value = spool
        db.execute.side_effect = [spool_result, *_no_crossing_results()]

        warning = await _deduct_vault_item(db, item)

        assert warning is None
        assert spool.remaining_weight_g == Decimal("300.0")  # 500 - (100*2)
        assert spool.status == "active"  # no se agotó
        # 1 query de deducción (spool) + 3 de lectura para el chequeo de
        # cruce de umbral (issue #137, no vuelve a tocar el agregado).
        assert db.execute.call_count == 4

    async def test_agotamiento_marca_finished_y_resta_initial_weight_del_agregado(self):
        """Criterio #2: al agotarse, se resta initial_weight_g (NO remaining, NO '-1') del padre."""
        spool = _fake_spool(remaining=Decimal("100.0"), initial=Decimal("1000.0"))
        item = _fake_queue_item_for_deduct(quantity=1, weight_grams=Decimal("100.00"), spool_id=1)

        parent = MagicMock()
        parent.quantity = Decimal("4000.0")  # agregado del InventoryItem, en gramos

        db = AsyncMock()
        spool_result = MagicMock()
        spool_result.scalar_one_or_none.return_value = spool
        parent_result = MagicMock()
        parent_result.scalar_one_or_none.return_value = parent
        db.execute.side_effect = [spool_result, *_no_crossing_results(), parent_result]

        warning = await _deduct_vault_item(db, item)

        assert warning is None  # consumo exacto, no insuficiente
        assert spool.remaining_weight_g == Decimal("0.0")
        assert spool.status == "finished"
        assert spool.finished_at is not None
        # Resta initial_weight_g (1000g) del agregado — NO "-1", NO remaining_weight_g.
        assert parent.quantity == Decimal("3000.0")

    async def test_insuficiente_floorea_en_0_y_avisa_sin_bloquear(self):
        """Criterio #5: insuficiente → warning + floor 0, NO HTTPException (a diferencia de sin-spool)."""
        spool = _fake_spool(remaining=Decimal("50.0"), initial=Decimal("1000.0"))
        item = _fake_queue_item_for_deduct(quantity=1, weight_grams=Decimal("200.00"), spool_id=1)

        parent = MagicMock()
        parent.quantity = Decimal("500.0")

        db = AsyncMock()
        spool_result = MagicMock()
        spool_result.scalar_one_or_none.return_value = spool
        parent_result = MagicMock()
        parent_result.scalar_one_or_none.return_value = parent
        db.execute.side_effect = [spool_result, *_no_crossing_results(), parent_result]

        # No debe lanzar — a diferencia de _deduct_inventory_and_update_printer
        # con stock insuficiente, que sí lanza HTTPException 400.
        warning = await _deduct_vault_item(db, item)

        assert warning is not None
        assert "SP-0001" in warning
        assert spool.remaining_weight_g == Decimal("0")  # floor, no negativo
        assert spool.status == "finished"  # también se agota al floorear en 0

    async def test_bobina_ya_finished_no_se_re_agota_ni_resta_de_nuevo(self):
        """Si la bobina YA estaba finished (ej. doble llamada), no debe re-restar del agregado."""
        spool = _fake_spool(remaining=Decimal("0.0"), initial=Decimal("1000.0"), status="finished")
        item = _fake_queue_item_for_deduct(quantity=1, weight_grams=Decimal("50.00"), spool_id=1)

        db = AsyncMock()
        spool_result = MagicMock()
        spool_result.scalar_one_or_none.return_value = spool
        db.execute.side_effect = [spool_result, *_no_crossing_results()]

        await _deduct_vault_item(db, item)

        # No se dispara una query de agotamiento al padre porque status !=
        # 'active' — solo las 3 lecturas del chequeo de cruce (issue #137).
        assert db.execute.call_count == 4

    async def test_sin_spool_sigue_el_camino_agregado_intacto(self):
        """Regresión: item SIN spool_id sigue descontando el agregado como siempre."""
        item = _fake_queue_item_for_deduct(quantity=1, weight_grams=Decimal("100.00"), spool_id=None)
        item.filament_id = 10

        inv = MagicMock()
        inv.quantity = Decimal("500.0")
        inv.min_quantity = None
        inv.name = "PLA Negro"

        db = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = inv
        db.execute.return_value = inv_result

        warning = await _deduct_vault_item(db, item)

        assert warning is None
        assert inv.quantity == Decimal("400.0")  # 500 - 100, camino agregado normal


# ---------------------------------------------------------------------------
# 2. Endpoints CRUD de bobinas
# ---------------------------------------------------------------------------

def _fake_inventory_item(item_id=1, quantity=Decimal("0.0"), weight_per_roll=Decimal("1000.0")):
    item = MagicMock()
    item.id = item_id
    item.name = "PLA Negro Marca X"
    item.quantity = quantity
    item.weight_per_roll = weight_per_roll
    item.price_per_kg = Decimal("25.00")
    item.color_hex = "#111111"
    item.color_name = "Carbon Black"
    item.filament_type = "PLA"
    item.filament_brand = "Marca X"
    item.filament_subtype = None
    return item


def _fake_db_bulk_create(item, ids_start=1):
    """
    Simula flush() asignando ids reales a los Spool recién `add()`eados y
    poblando los defaults que en producción asigna SQLAlchemy/Postgres al
    insertar de verdad (`status` es server_default, `created_at`/
    `updated_at` son defaults Python-side vía `default=lambda: ...`) —
    ninguno de los dos se aplica sin una sesión real. Mismo patrón que
    `_fake_refresh_assigns_id_and_created_at` de test_queue_advanced.py,
    pero disparado en `flush`, no en `refresh`.
    """
    added = []
    counter = {"next": ids_start}

    async def _gen():
        session = AsyncMock()
        result_item = MagicMock()
        result_item.scalar_one_or_none.return_value = item
        session.execute.return_value = result_item

        session.add = MagicMock(side_effect=lambda obj: added.append(obj))

        async def _flush():
            for obj in added:
                if getattr(obj, "id", None) is None:
                    obj.id = counter["next"]
                    counter["next"] += 1
                if getattr(obj, "status", None) is None:
                    obj.status = "active"
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                if getattr(obj, "created_at", None) is None:
                    obj.created_at = now
                if getattr(obj, "updated_at", None) is None:
                    obj.updated_at = now

        session.flush = AsyncMock(side_effect=_flush)

        async def _refresh(obj):
            return None

        session.refresh = _refresh
        yield session

    return _gen


class TestSpoolBulkCreate:
    async def test_bulk_crea_n_bobinas_con_label_codes_unicos(self):
        item = _fake_inventory_item()
        _set_overrides({
            get_db: _fake_db_bulk_create(item, ids_start=1),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/",
                    json={"inventory_item_id": 1, "count": 5, "initial_weight_g": 1000},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert len(body) == 5
        codes = {s["label_code"] for s in body}
        assert len(codes) == 5  # todos únicos
        assert all(c.startswith("SP-") for c in codes)
        # Sin add_to_stock (default False): el agregado del padre NO cambia.
        assert item.quantity == Decimal("0.0")

    async def test_bulk_add_to_stock_suma_al_agregado(self):
        item = _fake_inventory_item(quantity=Decimal("2000.0"))
        _set_overrides({
            get_db: _fake_db_bulk_create(item, ids_start=10),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/",
                    json={
                        "inventory_item_id": 1, "count": 3,
                        "initial_weight_g": 1000, "add_to_stock": True,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        # 2000g existentes + 3×1000g nuevas = 5000g.
        assert item.quantity == Decimal("5000.0")

    async def test_bulk_100_es_el_maximo_permitido(self):
        item = _fake_inventory_item()
        _set_overrides({
            get_db: _fake_db_bulk_create(item, ids_start=1),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/",
                    json={"inventory_item_id": 1, "count": 100, "initial_weight_g": 1000},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert len(r.json()) == 100

    async def test_bulk_101_retorna_422(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/",
                    json={"inventory_item_id": 1, "count": 101},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_item_no_encontrado_404(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/",
                    json={"inventory_item_id": 999, "count": 1},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_sin_initial_weight_g_usa_weight_per_roll_del_padre(self):
        item = _fake_inventory_item(weight_per_roll=Decimal("750.0"))
        _set_overrides({
            get_db: _fake_db_bulk_create(item, ids_start=1),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/", json={"inventory_item_id": 1, "count": 1}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert r.json()[0]["initial_weight_g"] == 750.0


class TestSpoolLowStock:
    async def test_low_stock_marca_below_correctamente(self):
        settings = MagicMock()
        settings.spool_low_stock_threshold_g = Decimal("200.0")

        row_below = MagicMock(filament_type="PLA", total_remaining=Decimal("150.0"))
        row_ok = MagicMock(filament_type="PETG", total_remaining=Decimal("800.0"))

        async def _gen():
            session = AsyncMock()
            settings_result = MagicMock()
            settings_result.scalar_one_or_none.return_value = settings
            rows_result = MagicMock()
            rows_result.all.return_value = [row_below, row_ok]
            session.execute.side_effect = [settings_result, rows_result]
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.get("/api/inventory/spools/low-stock")
        finally:
            _clear_overrides()
        assert r.status_code == 200
        body = {row["filament_type"]: row for row in r.json()}
        assert body["PLA"]["below"] is True
        assert body["PETG"]["below"] is False


class TestSpoolUpdate:
    async def test_pesar_manualmente_actualiza_remaining(self):
        spool = _fake_spool(remaining=Decimal("500.0"))
        spool.extra_colors = None
        spool.visual_effect = None
        spool.notes = None
        spool.cost = None
        spool.opened_at = None
        spool.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
        spool.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        spool.inventory_item_id = 1
        item = _fake_inventory_item()

        async def _gen():
            session = AsyncMock()
            spool_result = MagicMock()
            spool_result.scalar_one_or_none.return_value = spool
            item_result = MagicMock()
            item_result.scalar_one_or_none.return_value = item
            session.execute.side_effect = [spool_result, item_result]
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/spools/1", json={"remaining_weight_g": 340})
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert spool.remaining_weight_g == Decimal("340")

    async def test_no_encontrada_404(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/inventory/spools/999", json={"notes": "x"})
        finally:
            _clear_overrides()
        assert r.status_code == 404


class TestSpoolDelete:
    async def test_bloqueado_si_hay_item_printing_con_esa_bobina(self):
        spool = _fake_spool()
        printing_item = MagicMock()

        async def _gen():
            session = AsyncMock()
            spool_result = MagicMock()
            spool_result.scalar_one_or_none.return_value = spool
            printing_result = MagicMock()
            printing_result.scalar_one_or_none.return_value = printing_item
            session.execute.side_effect = [spool_result, printing_result]
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user(role="admin")})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/spools/1")
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_elimina_sin_referencias_printing(self):
        spool = _fake_spool()

        async def _gen():
            session = AsyncMock()
            spool_result = MagicMock()
            spool_result.scalar_one_or_none.return_value = spool
            none_result = MagicMock()
            none_result.scalar_one_or_none.return_value = None
            session.execute.side_effect = [spool_result, none_result]
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user(role="admin")})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/spools/1")
        finally:
            _clear_overrides()
        assert r.status_code == 204

    async def test_no_admin_retorna_403(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user(role="operator")})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete("/api/inventory/spools/1")
        finally:
            _clear_overrides()
        assert r.status_code == 403
