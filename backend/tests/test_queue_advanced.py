"""
Tests para la Queue avanzada (issue #133): reorder, lotes (batch),
duplicar, programar (schedule) y "separar copias" al encolar desde el
Vault. También incluye el test de regresión explícito que pide el issue:
`_deduct_vault_item`/`_deduct_inventory_and_update_printer` (el descuento
atómico de inventario + suma de horas al marcar 'done') no se tocaron en
este ticket — se prueban directamente para dejar constancia de que su
aritmética sigue intacta.

Mismo patrón que test_queue.py: httpx.AsyncClient con ASGITransport y
dependency_overrides para sustituir la BD y el usuario autenticado.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.routers.queue import _deduct_inventory_and_update_printer, _deduct_vault_item
from app.services.auth import get_current_user


# ---------------------------------------------------------------------------
# Helpers (mismo patrón que test_queue.py)
# ---------------------------------------------------------------------------

def _fake_user(role="operator"):
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
    u.role = role
    u.is_active = True
    return u


async def _fake_db_empty():
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar_one_or_none.return_value = None
    result.scalar_one.return_value = 0
    result.scalar.return_value = None
    session.execute.return_value = result
    yield session


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


def _fake_queue_item(item_id=1, status="pending", position=0):
    """
    Fake PrintQueueItem completo — cubre todos los campos que
    `_build_response` lee. Un campo faltante rompe la validación Pydantic
    con un MagicMock genérico en su lugar (ver bug de #130/PR #146).
    """
    m = MagicMock()
    m.id = item_id
    m.status = status
    m.position = position
    m.quote_id = None
    m.vault_model_id = None
    m.project_id = None
    m.piece_name = None
    m.printer_id = None
    m.filament_id = None
    m.started_at = None
    m.completed_at = None
    m.notes = None
    m.failure_reason = None
    m.failure_category = None
    m.batch_id = None
    m.scheduled_at = None
    m.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    return m


def _fake_pending_items(n=3, start_id=1):
    return [_fake_queue_item(item_id=start_id + i, status="pending", position=i) for i in range(n)]


def _fake_db_items_list(items):
    """
    Sesión cuyo `scalars().all()` devuelve `items` sin importar el WHERE
    real (el mock no evalúa SQL) — sirve tanto para el query de pending de
    `reorder` como el `id.in_(...)` de `batch`/`delete_queue_batch`.
    """
    async def _gen():
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = list(items)
        session.execute.return_value = result
        yield session

    return _gen


def _fake_refresh_assigns_id_and_created_at(session, start_id=100):
    """
    Mockea `session.refresh` para simular lo que Postgres asignaría a un
    `PrintQueueItem` real recién insertado (id autoincremental,
    created_at con default) — sin esto, `id`/`created_at` quedan en None
    (el objeto es una instancia ORM real, no un MagicMock) y
    `_build_response` falla la validación Pydantic (mismo bug que en
    PR #146 con `ModelFilePhoto`).
    """
    counter = {"next": start_id}

    async def _refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = counter["next"]
            counter["next"] += 1
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc).replace(tzinfo=None)

    session.refresh = _refresh


# ---------------------------------------------------------------------------
# 1. PUT /api/queue/reorder
# ---------------------------------------------------------------------------

class TestQueueReorder:
    async def test_ids_duplicados_400(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/reorder", json={"item_ids": [1, 1, 2]})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_lista_vacia_422(self):
        """item_ids no puede estar vacío (min_length=1 en el schema)."""
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/reorder", json={"item_ids": []})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_lista_no_coincide_con_pending_actuales_400(self):
        items = _fake_pending_items(2, start_id=1)
        _set_overrides({
            get_db: _fake_db_items_list(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/reorder", json={"item_ids": [1, 2, 999]})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_reordena_exitosamente(self):
        items = _fake_pending_items(3, start_id=1)  # ids 1,2,3 con position 0,1,2
        items_by_id = {i.id: i for i in items}
        _set_overrides({
            get_db: _fake_db_items_list(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/reorder", json={"item_ids": [3, 1, 2]})
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert items_by_id[3].position == 0
        assert items_by_id[1].position == 1
        assert items_by_id[2].position == 2
        body = r.json()
        assert [it["id"] for it in body] == [3, 1, 2]


# ---------------------------------------------------------------------------
# 2. POST /api/queue/batch, DELETE /api/queue/batch/{batch_id}
# ---------------------------------------------------------------------------

class TestQueueBatchCreate:
    async def test_menos_de_2_422(self):
        """QueueBatchCreateRequest exige min_length=2."""
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/batch", json={"item_ids": [1]})
        finally:
            _clear_overrides()
        assert r.status_code == 422

    async def test_ids_duplicados_400(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/batch", json={"item_ids": [1, 1]})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_item_no_encontrado_404(self):
        _set_overrides({
            get_db: _fake_db_items_list([]),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/batch", json={"item_ids": [1, 2]})
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_item_no_pending_400(self):
        items = _fake_pending_items(2, start_id=1)
        items[1].status = "printing"
        _set_overrides({
            get_db: _fake_db_items_list(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/batch", json={"item_ids": [1, 2]})
        finally:
            _clear_overrides()
        assert r.status_code == 400

    async def test_agrupa_exitosamente(self):
        items = _fake_pending_items(3, start_id=1)
        items_by_id = {i.id: i for i in items}
        _set_overrides({
            get_db: _fake_db_items_list(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/batch", json={"item_ids": [1, 2]})
        finally:
            _clear_overrides()
        assert r.status_code == 201
        assert items_by_id[1].batch_id is not None
        assert items_by_id[1].batch_id == items_by_id[2].batch_id
        assert items_by_id[3].batch_id is None
        body = r.json()
        assert len(body) == 2
        assert body[0]["batch_id"] == body[1]["batch_id"]


class TestQueueBatchDelete:
    async def test_no_encontrado_404(self):
        _set_overrides({
            get_db: _fake_db_items_list([]),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete(f"/api/queue/batch/{uuid.uuid4()}")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_desagrupa_exitosamente(self):
        shared = uuid.uuid4()
        items = _fake_pending_items(2, start_id=1)
        for it in items:
            it.batch_id = shared
        _set_overrides({
            get_db: _fake_db_items_list(items),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.delete(f"/api/queue/batch/{shared}")
        finally:
            _clear_overrides()
        assert r.status_code == 204
        assert items[0].batch_id is None
        assert items[1].batch_id is None


# ---------------------------------------------------------------------------
# 3. POST /api/queue/{id}/duplicate
# ---------------------------------------------------------------------------

class TestQueueDuplicate:
    async def test_no_encontrado_404(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/999/duplicate")
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_duplica_item_pending_al_final(self):
        original = MagicMock()
        original.id = 1
        original.quote_id = None
        original.vault_model_id = None
        original.print_file_snapshot_path = None
        original.piece_name = None  # evita la rama de vault_snapshot en _build_response
        original.printer_id = None
        original.filament_id = None
        original.quantity = 2
        original.weight_grams = None
        original.print_time_hours = None
        original.project_id = None
        original.notes = "nota original"

        async def _gen():
            session = AsyncMock()
            result_item = MagicMock()
            result_item.scalar_one_or_none.return_value = original
            result_maxpos = MagicMock()
            result_maxpos.scalar.return_value = 5
            session.execute.side_effect = [result_item, result_maxpos]
            _fake_refresh_assigns_id_and_created_at(session, start_id=42)
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post("/api/queue/1/duplicate")
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 42
        assert body["status"] == "pending"
        assert body["position"] == 6
        assert body["notes"] == "nota original"


# ---------------------------------------------------------------------------
# 4. PUT /api/queue/{id}/schedule
# ---------------------------------------------------------------------------

class TestQueueSchedule:
    def _fake_db_single_item(self, item):
        async def _gen():
            session = AsyncMock()
            result = MagicMock()
            result.scalar_one_or_none.return_value = item
            session.execute.return_value = result
            yield session

        return _gen

    async def test_no_encontrado_404(self):
        _set_overrides({get_db: _fake_db_empty, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/999/schedule", json={"scheduled_at": "2026-08-01T10:00:00"}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404

    async def test_asigna_fecha(self):
        item = _fake_queue_item(item_id=1)
        _set_overrides({
            get_db: self._fake_db_single_item(item),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/1/schedule", json={"scheduled_at": "2026-08-01T10:00:00"}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert item.scheduled_at == datetime(2026, 8, 1, 10, 0, 0)

    async def test_null_quita_fecha(self):
        item = _fake_queue_item(item_id=1)
        item.scheduled_at = datetime(2026, 1, 1, 0, 0, 0)
        _set_overrides({
            get_db: self._fake_db_single_item(item),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put("/api/queue/1/schedule", json={"scheduled_at": None})
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert item.scheduled_at is None

    async def test_fecha_pasada_en_pending_marca_overdue_true(self):
        """Criterio de aceptación #3 del issue: fecha pasada + pending → overdue."""
        item = _fake_queue_item(item_id=1, status="pending")
        _set_overrides({
            get_db: self._fake_db_single_item(item),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/1/schedule", json={"scheduled_at": "2020-01-01T00:00:00"}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["overdue"] is True

    async def test_fecha_futura_no_marca_overdue(self):
        item = _fake_queue_item(item_id=1, status="pending")
        _set_overrides({
            get_db: self._fake_db_single_item(item),
            get_current_user: lambda: _fake_user(),
        })
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.put(
                    "/api/queue/1/schedule", json={"scheduled_at": "2099-01-01T00:00:00"}
                )
        finally:
            _clear_overrides()
        assert r.status_code == 200
        assert r.json()["overdue"] is False


# ---------------------------------------------------------------------------
# 5. POST /api/queue/from-vault con split_copies (issue #133)
# ---------------------------------------------------------------------------

def _fake_vault_model(model_id=1, sliced_time_seconds=None, sliced_weight_g=None):
    model = MagicMock()
    model.id = model_id
    model.print_file_key = "modelo.gcode.3mf"
    model.sliced_time_seconds = sliced_time_seconds
    model.sliced_weight_g = sliced_weight_g
    model.name = "Modelo split"
    # Campos que _build_response lee del ModelFile en el vault snapshot —
    # sin esto quedan como MagicMock y rompen la validación Optional[str]
    # (mismo bug que "notes" en PR #144/#146).
    model.print_file_name = None
    model.sliced_filament_type = None
    return model


def _fake_printer(printer_id=1, name="Impresora Test"):
    printer = MagicMock()
    printer.id = printer_id
    printer.name = name
    return printer


class TestQueueSplitCopies:
    async def test_split_copies_crea_n_items_con_batch_compartido(self):
        model = _fake_vault_model(sliced_time_seconds=3600, sliced_weight_g=Decimal("20.00"))
        printer = _fake_printer()
        captured = {}

        async def _gen():
            session = AsyncMock()
            result_model = MagicMock()
            result_model.scalar_one_or_none.return_value = model
            result_printer = MagicMock()
            result_printer.scalar_one_or_none.return_value = printer
            result_maxpos = MagicMock()
            result_maxpos.scalar.return_value = 0
            # Orden: modelo, impresora, maxpos, (dentro de _build_response del
            # primer item) impresora de nuevo, modelo de nuevo.
            session.execute.side_effect = [
                result_model, result_printer, result_maxpos,
                result_printer, result_model,
            ]
            _fake_refresh_assigns_id_and_created_at(session, start_id=200)
            captured["session"] = session
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/queue/from-vault",
                    json={
                        "vault_model_id": 1,
                        "printer_id": 1,
                        "quantity": 3,
                        "split_copies": True,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert body["batch_id"] is not None
        assert body["vault"]["quantity"] == 1
        # 3 items independientes creados (uno por copia), no uno con quantity=3.
        assert captured["session"].add.call_count == 3

    async def test_sin_split_copies_crea_un_item_quantity_n(self):
        """Sanity check: sin split_copies, sigue el comportamiento previo (1 item, quantity=N)."""
        model = _fake_vault_model(sliced_time_seconds=None, sliced_weight_g=None)
        printer = _fake_printer()
        captured = {}

        async def _gen():
            session = AsyncMock()
            result_model = MagicMock()
            result_model.scalar_one_or_none.return_value = model
            result_printer = MagicMock()
            result_printer.scalar_one_or_none.return_value = printer
            result_maxpos = MagicMock()
            result_maxpos.scalar.return_value = 0
            session.execute.side_effect = [
                result_model, result_printer, result_maxpos,
                result_printer, result_model,
            ]
            _fake_refresh_assigns_id_and_created_at(session, start_id=300)
            captured["session"] = session
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/queue/from-vault",
                    json={
                        "vault_model_id": 1,
                        "printer_id": 1,
                        "quantity": 5,
                        "split_copies": False,
                    },
                )
        finally:
            _clear_overrides()
        assert r.status_code == 201
        body = r.json()
        assert body["batch_id"] is None
        assert body["vault"]["quantity"] == 5
        assert captured["session"].add.call_count == 1


# ---------------------------------------------------------------------------
# 6. Test de regresión (issue #133, criterio de aceptación #5): el
#    descuento atómico de inventario + suma de horas al marcar 'done' NO
#    se toca en este ticket. Se prueba directamente sobre las funciones
#    privadas para aislar la aritmética de la complejidad de mockear toda
#    la cadena HTTP (item → _build_response con sus propias queries).
# ---------------------------------------------------------------------------

class TestRegressionInventoryDeduction:
    async def test_deduct_vault_item_descuenta_filamento_y_suma_horas(self):
        item = MagicMock()
        item.quantity = 3
        item.filament_id = 10
        item.weight_grams = Decimal("25.00")
        item.printer_id = 5
        item.print_time_hours = Decimal("2.5")

        inv = MagicMock()
        inv.quantity = Decimal("500.00")
        inv.min_quantity = Decimal("50.00")
        inv.needs_purchase = False
        inv.name = "PLA Negro"

        printer = MagicMock()
        printer.current_hours = Decimal("100.00")

        db = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = inv
        printer_result = MagicMock()
        printer_result.scalar_one_or_none.return_value = printer
        db.execute.side_effect = [inv_result, printer_result]

        await _deduct_vault_item(db, item)

        assert inv.quantity == Decimal("500.00") - Decimal("75.00")  # 25 * 3
        assert printer.current_hours == Decimal("100.00") + Decimal("7.5")  # 2.5 * 3

    async def test_deduct_vault_item_stock_insuficiente_levanta_400(self):
        item = MagicMock()
        item.quantity = 100
        item.filament_id = 10
        item.weight_grams = Decimal("25.00")
        item.printer_id = None
        item.print_time_hours = None

        inv = MagicMock()
        inv.quantity = Decimal("10.00")
        inv.min_quantity = None
        inv.name = "PLA Negro"

        db = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = inv
        db.execute.return_value = inv_result

        with pytest.raises(HTTPException) as exc_info:
            await _deduct_vault_item(db, item)
        assert exc_info.value.status_code == 400

    async def test_deduct_quote_descuenta_filamento_principal_y_horas(self):
        quote = MagicMock()
        quote.quantity = 2
        quote.inventory_item_id = 10
        quote.weight_grams = Decimal("50.00")
        quote.additional_filaments_detail = []
        quote.supplies_detail = []
        quote.printer_id = 5
        quote.print_time_hours = Decimal("3.0")

        inv = MagicMock()
        inv.quantity = Decimal("1000.00")
        inv.min_quantity = None
        inv.name = "PETG Blanco"

        printer = MagicMock()
        printer.current_hours = Decimal("50.00")

        db = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = inv
        printer_result = MagicMock()
        printer_result.scalar_one_or_none.return_value = printer
        db.execute.side_effect = [inv_result, printer_result]

        await _deduct_inventory_and_update_printer(db, quote)

        assert inv.quantity == Decimal("1000.00") - Decimal("100.00")  # 50 * 2
        assert printer.current_hours == Decimal("50.00") + Decimal("6.0")  # 3 * 2

    async def test_deduct_quote_stock_insuficiente_levanta_400(self):
        quote = MagicMock()
        quote.quantity = 10
        quote.inventory_item_id = 10
        quote.weight_grams = Decimal("50.00")
        quote.additional_filaments_detail = []
        quote.supplies_detail = []

        inv = MagicMock()
        inv.quantity = Decimal("5.00")
        inv.min_quantity = None
        inv.name = "PETG Blanco"

        db = AsyncMock()
        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = inv
        db.execute.return_value = inv_result

        with pytest.raises(HTTPException) as exc_info:
            await _deduct_inventory_and_update_printer(db, quote)
        assert exc_info.value.status_code == 400
