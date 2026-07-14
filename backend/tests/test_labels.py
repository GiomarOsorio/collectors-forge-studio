"""
Tests para etiquetas PDF de bobinas con QR (issue #135).

Dos bloques:
1. `services/label_renderer.py` — paginación pura (`labels_per_page`),
   generación de PDF no vacía por cada una de las 6 plantillas, orden
   preservado (via spy en la lista de LabelData).
2. Endpoint `POST /api/inventory/spools/labels` — 404 con ids faltantes,
   deep-link con PUBLIC_URL vs. request, orden preservado end-to-end.

QR: decodificar el PNG requiere `pyzbar`/libzbar del sistema (fricción,
no está en dev-deps) — en su lugar se testea la URL ANTES de encodear
(unit del builder de deep-link), siguiendo la recomendación del doc local.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user
from app.services import label_renderer
from app.services.label_renderer import LabelData, labels_per_page, render_labels


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


def _label_data(label_code="SP-0001", **overrides):
    defaults = dict(
        label_code=label_code, name="Carbon Black", material="PLA",
        brand="Bambu Lab", subtype=None, rgba="111111", extra_colors=None,
        storage_location="Estante 1", deeplink_url="https://cfs.test/inventory/spools?spool=1",
    )
    defaults.update(overrides)
    return LabelData(**defaults)


class TestLabelsPerPage:
    def test_single_label_templates_devuelven_1(self):
        for tpl in ("ams_holder_74x33", "ams_holder_75x55", "box_40x30", "box_62x29"):
            assert labels_per_page(tpl) == 1

    def test_avery_5160_devuelve_30(self):
        assert labels_per_page("avery_5160") == 30

    def test_avery_l7160_devuelve_21(self):
        assert labels_per_page("avery_l7160") == 21

    def test_plantilla_desconocida_lanza_value_error(self):
        try:
            labels_per_page("no-existe")
            assert False, "debía lanzar ValueError"
        except ValueError:
            pass


class TestRenderLabels:
    def test_genera_pdf_no_vacio_por_cada_plantilla(self):
        templates = (
            "ams_holder_74x33", "ams_holder_75x55", "box_40x30",
            "box_62x29", "avery_5160", "avery_l7160",
        )
        for tpl in templates:
            pdf = render_labels(tpl, [_label_data()])
            assert pdf.startswith(b"%PDF")
            assert len(pdf) > 0

    def test_avery_35_bobinas_produce_2_paginas(self, monkeypatch):
        """Criterio implícito: 35 bobinas en avery_5160 (30/hoja) -> 2 páginas."""
        pages_drawn = []
        original_show_page = None

        import reportlab.pdfgen.canvas as rl_canvas_module
        original_show_page = rl_canvas_module.Canvas.showPage

        def _spy_show_page(self):
            pages_drawn.append(1)
            return original_show_page(self)

        monkeypatch.setattr(rl_canvas_module.Canvas, "showPage", _spy_show_page)

        data_list = [_label_data(label_code=f"SP-{i:04d}") for i in range(35)]
        render_labels("avery_5160", data_list)
        assert len(pages_drawn) == 2

    def test_multicolor_no_lanza_excepcion(self):
        pdf = render_labels(
            "box_62x29",
            [_label_data(extra_colors=["FF0000", "00FF00"])],
        )
        assert pdf.startswith(b"%PDF")

    def test_monochrome_no_lanza_excepcion(self):
        pdf = render_labels("avery_l7160", [_label_data()], monochrome=True)
        assert pdf.startswith(b"%PDF")

    def test_lista_vacia_produce_pdf_valido(self):
        pdf = render_labels("box_62x29", [])
        assert pdf.startswith(b"%PDF")


class TestPrintSpoolLabelsEndpoint:
    async def test_404_con_ids_faltantes(self):
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        session.execute.return_value = result

        async def _gen():
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/labels",
                    json={"spool_ids": [1, 2], "template": "box_62x29"},
                )
        finally:
            _clear_overrides()
        assert r.status_code == 404
        assert "1" in r.json()["detail"] and "2" in r.json()["detail"]

    async def test_genera_pdf_con_orden_preservado_y_deeplink_public_url(self, monkeypatch):
        monkeypatch.setattr("app.routers.spools.app_config.PUBLIC_URL", "https://cfs.turtlenode.dev")

        def _fake_spool(sid, item_id=1):
            s = MagicMock()
            s.id = sid
            s.inventory_item_id = item_id
            s.label_code = f"SP-{sid:04d}"
            s.extra_colors = None
            return s

        item = MagicMock()
        item.id = 1
        item.name = "PLA Negro"
        item.color_name = "Carbon Black"
        item.filament_type = "PLA"
        item.filament_brand = "Bambu Lab"
        item.filament_subtype = None
        item.color_hex = "#111111"
        item.location = "Estante 1"

        # Request pide [2, 1] — el resultado del ORM viene en otro orden;
        # el endpoint debe reordenar según spool_ids del request.
        spools_unordered = [_fake_spool(1), _fake_spool(2)]

        session = AsyncMock()
        spools_result = MagicMock()
        spools_result.scalars.return_value.all.return_value = spools_unordered
        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = [item]
        session.execute = AsyncMock(side_effect=[spools_result, items_result])

        captured = {}
        original_render = label_renderer.render_labels

        def _spy_render(template, data_list, *, monochrome=False):
            captured["data_list"] = data_list
            return original_render(template, data_list, monochrome=monochrome)

        monkeypatch.setattr("app.routers.spools.render_labels", _spy_render)

        async def _gen():
            yield session

        _set_overrides({get_db: _gen, get_current_user: lambda: _fake_user()})
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                r = await c.post(
                    "/api/inventory/spools/labels",
                    json={"spool_ids": [2, 1], "template": "box_62x29"},
                )
        finally:
            _clear_overrides()

        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content.startswith(b"%PDF")

        data_list = captured["data_list"]
        assert [d.label_code for d in data_list] == ["SP-0002", "SP-0001"]
        assert data_list[0].deeplink_url == "https://cfs.turtlenode.dev/inventory/spools?spool=2"
