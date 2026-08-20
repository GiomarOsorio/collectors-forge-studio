"""
Tests del endpoint POST /api/quotes/parse-slice.

Cubre el flujo que la calculadora usa para precargar datos desde un
`.gcode.3mf`: multi-placa, `.gcode` plano, validación de extensión y
archivos sin metadatos de laminado.
"""

import io
import zipfile
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services.auth import get_current_user


GCODE_BAMBU = """\
; estimated printing time: 2h 15m 38s
; filament used [g] = 45.32
; filament type = PLA
; nozzle_temperature = 220
; bed_temperature = 60
; layer_height = 0.20
G28
"""

SLICE_INFO_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="20541"/>
    <metadata key="weight" value="151.66"/>
    <object identify_id="1" name="ModeloA" skipped="false" />
    <filament id="1" type="PETG" color="#FFFFFF" used_m="49.26" used_g="151.66"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="15158"/>
    <metadata key="weight" value="80.63"/>
    <object identify_id="2" name="PartC" skipped="false" />
    <filament id="2" type="PETG" color="#161616" used_m="13.09" used_g="40.31"/>
    <filament id="3" type="PLA" color="#F72323" used_m="13.10" used_g="40.32"/>
  </plate>
</config>
"""


def _fake_user():
    u = MagicMock()
    u.id = 1
    u.username = "testuser"
    u.role = "operator"
    u.is_active = True
    return u


async def _fake_db():
    session = AsyncMock()
    yield session


def _multiplate_3mf() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("3D/3dmodel.model", "<model/>")
        zf.writestr("Metadata/slice_info.config", SLICE_INFO_XML)
        zf.writestr("Metadata/plate_1.gcode", GCODE_BAMBU)
        zf.writestr("Metadata/plate_2.gcode", GCODE_BAMBU)
    return buffer.getvalue()


async def _post(files):
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            return await c.post("/api/quotes/parse-slice", files=files)
    finally:
        app.dependency_overrides.clear()


async def test_parse_slice_multiplaca():
    """Un .gcode.3mf de 2 placas devuelve las 2 con peso, tiempo y filamentos."""
    r = await _post({"file": ("modelo.gcode.3mf", _multiplate_3mf(), "application/octet-stream")})
    assert r.status_code == 200
    body = r.json()
    assert body["filename"] == "modelo.gcode.3mf"
    assert len(body["plates"]) == 2

    p1 = body["plates"][0]
    assert p1["plate_number"] == 1
    assert p1["print_time_seconds"] == 20541
    assert p1["print_time_hours"] == pytest.approx(20541 / 3600, rel=1e-3)
    assert p1["filament_weight_g"] == pytest.approx(151.66)
    assert len(p1["objects"]) == 1

    p2 = body["plates"][1]
    assert len(p2["filaments"]) == 2
    assert p2["filaments"][1]["colour_hex"] == "#F72323"


async def test_parse_slice_gcode_plano():
    """Un .gcode suelto devuelve una única placa con plate_number=1."""
    r = await _post({"file": ("pieza.gcode", GCODE_BAMBU.encode(), "text/plain")})
    assert r.status_code == 200
    plates = r.json()["plates"]
    assert len(plates) == 1
    assert plates[0]["plate_number"] == 1
    assert plates[0]["filament_weight_g"] == pytest.approx(45.32)
    assert plates[0]["filament_type"] == "PLA"


async def test_parse_slice_extension_invalida():
    """Extensión no soportada → 400 con detalle string."""
    r = await _post({"file": ("modelo.stl", b"solid x", "application/octet-stream")})
    assert r.status_code == 400
    assert isinstance(r.json()["detail"], str)


async def test_parse_slice_sin_metadatos():
    """.3mf sin G-code laminado → 422 (no revienta el parser)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("3D/3dmodel.model", "<model/>")
    r = await _post({"file": ("crudo.3mf", buffer.getvalue(), "application/octet-stream")})
    assert r.status_code == 422


async def test_parse_slice_sin_token():
    """Sin autenticación → 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/quotes/parse-slice",
            files={"file": ("modelo.3mf", _multiplate_3mf(), "application/octet-stream")},
        )
    assert r.status_code == 401
