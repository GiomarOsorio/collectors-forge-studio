"""
Tests unitarios para el servicio slicer_parser.

Verifica el parseo de archivos .gcode y .3mf generados por Bambu Studio
y OrcaSlicer, incluyendo la extracción de tiempo, gramos, tipo de
filamento, temperaturas y la conversión de longitud a gramos.
"""

import io
import zipfile
import pytest

from app.services.slicer_parser import (
    parse_gcode_file,
    parse_3mf_file,
    convert_length_to_grams,
    _parse_gcode_text,
)


# --- Fixtures de contenido G-code ---

GCODE_BAMBU = """\
; HEADER_BLOCK_START
; estimated printing time: 2h 15m 38s
; filament used [g] = 45.32
; filament type = PLA
; nozzle_temperature = 220
; bed_temperature = 60
; layer_height = 0.20
; HEADER_BLOCK_END
G28 ; home all axes
G1 X0 Y0 Z0.2 F3000
"""

GCODE_ORCA_ALT = """\
;TIME:8138
;Filament used: 2.4567m
;WEIGHT:7.21
;Layer height: 0.2
M104 S215
G28
"""

GCODE_VACIO = """\
G28
G1 X10 Y10
"""


# --- Tests de convert_length_to_grams ---

def test_convert_length_pla():
    """Conversión de metros a gramos para PLA."""
    gramos = convert_length_to_grams(1.0, "PLA")
    # radio = 0.0875 cm, vol = 1*100*pi*(0.0875)^2 ≈ 2.405 cm3, peso = 2.405*1.24 ≈ 2.98g
    assert 2.5 < gramos < 3.5


def test_convert_length_petg():
    """Conversión para PETG (densidad 1.27)."""
    gramos = convert_length_to_grams(1.0, "PETG")
    assert gramos > convert_length_to_grams(1.0, "ABS")


def test_convert_length_desconocido_usa_default():
    """Tipo de filamento desconocido usa densidad PLA por defecto."""
    gramos_pla = convert_length_to_grams(1.0, "PLA")
    gramos_raro = convert_length_to_grams(1.0, "FILAMENTO_RARO")
    assert gramos_pla == gramos_raro


# --- Tests de _parse_gcode_text ---

def test_parse_texto_bambu_completo():
    """Parseo de cabecera formato Bambu Studio."""
    resultado = _parse_gcode_text(GCODE_BAMBU)
    assert resultado.print_time_seconds == (2 * 3600 + 15 * 60 + 38)
    assert resultado.filament_weight_g == pytest.approx(45.32)
    assert resultado.filament_type == "PLA"
    assert resultado.nozzle_temp == 220
    assert resultado.bed_temp == 60
    assert resultado.layer_height_mm == pytest.approx(0.20)


def test_parse_texto_orcaslicer_alternativo():
    """Parseo de cabecera formato OrcaSlicer CLI / CuraEngine."""
    resultado = _parse_gcode_text(GCODE_ORCA_ALT)
    assert resultado.print_time_seconds == 8138
    # Debe tener gramos (de ;WEIGHT: o calculado desde longitud)
    assert resultado.filament_weight_g is not None
    assert resultado.filament_weight_g > 0


def test_parse_texto_vacio_retorna_nulos():
    """G-code sin cabecera retorna campos None."""
    resultado = _parse_gcode_text(GCODE_VACIO)
    assert resultado.print_time_seconds is None
    assert resultado.filament_weight_g is None


def test_parse_tiempo_solo_minutos():
    """Cabecera con tiempo solo en minutos."""
    gcode = "; estimated printing time: 135m\nG28\n"
    resultado = _parse_gcode_text(gcode)
    assert resultado.print_time_seconds == 135 * 60


def test_parse_tiempo_horas_y_minutos():
    """Cabecera con horas y minutos, sin segundos."""
    gcode = "; estimated printing time: 1h 30m\nG28\n"
    resultado = _parse_gcode_text(gcode)
    assert resultado.print_time_seconds == 5400


# --- Tests de parse_gcode_file ---

def test_parse_gcode_file_valido(tmp_path):
    """Parsea un .gcode real en disco."""
    archivo = tmp_path / "test.gcode"
    archivo.write_text(GCODE_BAMBU, encoding="utf-8")
    resultado = parse_gcode_file(str(archivo))
    assert resultado is not None
    assert resultado.print_time_seconds == (2 * 3600 + 15 * 60 + 38)
    assert resultado.filament_weight_g == pytest.approx(45.32)


def test_parse_gcode_file_sin_metadatos(tmp_path):
    """G-code sin cabecera retorna None."""
    archivo = tmp_path / "vacio.gcode"
    archivo.write_text(GCODE_VACIO, encoding="utf-8")
    resultado = parse_gcode_file(str(archivo))
    assert resultado is None


def test_parse_gcode_file_inexistente():
    """Archivo inexistente retorna None sin lanzar excepción."""
    resultado = parse_gcode_file("/ruta/que/no/existe.gcode")
    assert resultado is None


# --- Tests de parse_3mf_file ---

def _crear_3mf_con_gcode(gcode_content: str, ruta_interna: str = "Metadata/plate_1.gcode") -> bytes:
    """Crea un .3mf (ZIP) en memoria con el G-code dado."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(ruta_interna, gcode_content)
        zf.writestr("3D/3dmodel.model", "<model/>")
    return buffer.getvalue()


def test_parse_3mf_con_gcode_bambu(tmp_path):
    """Parsea un .3mf de Bambu Studio con G-code en Metadata/plate_1.gcode."""
    contenido = _crear_3mf_con_gcode(GCODE_BAMBU)
    archivo = tmp_path / "modelo.3mf"
    archivo.write_bytes(contenido)
    resultado = parse_3mf_file(str(archivo))
    assert resultado is not None
    assert resultado.print_time_seconds == (2 * 3600 + 15 * 60 + 38)
    assert resultado.filament_weight_g == pytest.approx(45.32)
    assert resultado.filament_type == "PLA"


def test_parse_3mf_gcode_en_raiz(tmp_path):
    """Parsea un .3mf con G-code en la raíz del ZIP."""
    contenido = _crear_3mf_con_gcode(GCODE_BAMBU, "output.gcode")
    archivo = tmp_path / "modelo.3mf"
    archivo.write_bytes(contenido)
    resultado = parse_3mf_file(str(archivo))
    assert resultado is not None
    assert resultado.print_time_seconds is not None


def test_parse_3mf_sin_gcode(tmp_path):
    """Un .3mf sin G-code (modelo no laminado) retorna None."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("3D/3dmodel.model", "<model/>")
    archivo = tmp_path / "crudo.3mf"
    archivo.write_bytes(buffer.getvalue())
    resultado = parse_3mf_file(str(archivo))
    assert resultado is None


def test_parse_3mf_archivo_invalido(tmp_path):
    """Archivo que no es ZIP retorna None sin excepción."""
    archivo = tmp_path / "invalido.3mf"
    archivo.write_bytes(b"esto no es un zip")
    resultado = parse_3mf_file(str(archivo))
    assert resultado is None


def test_parse_3mf_inexistente():
    """Archivo inexistente retorna None."""
    resultado = parse_3mf_file("/ruta/inexistente.3mf")
    assert resultado is None
