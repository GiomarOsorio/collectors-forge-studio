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
    parse_3mf_all_plates,
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


# --- Tests de parse_3mf_all_plates ---

SLICE_INFO_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="20541"/>
    <metadata key="weight" value="151.66"/>
    <object identify_id="1" name="ModeloA" skipped="false" />
    <object identify_id="2" name="ModeloB" skipped="false" />
    <filament id="1" type="PETG" color="#FFFFFF" used_m="49.26" used_g="151.66"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="15158"/>
    <metadata key="weight" value="80.63"/>
    <object identify_id="3" name="PartC" skipped="false" />
    <filament id="2" type="PETG" color="#161616" used_m="26.19" used_g="80.63"/>
  </plate>
  <plate>
    <metadata key="index" value="3"/>
    <metadata key="prediction" value="22128"/>
    <metadata key="weight" value="88.79"/>
    <object identify_id="4" name="Body" skipped="false" />
    <filament id="3" type="PETG" color="#0056B8" used_m="14.07" used_g="43.32"/>
    <filament id="4" type="PLA" color="#F72323" used_m="14.77" used_g="45.47"/>
  </plate>
</config>
"""

GCODE_PLATE_HEADER = """\
; estimated printing time: {time}
; total filament weight [g] : {weight}
; filament type = {ftype}
; nozzle_temperature = {nozzle}
; textured_plate_temp = {bed}
; layer_height = {layer}
G28
"""


def _crear_3mf_multiplaca(num_plates=3, con_slice_info=True):
    """Crea un .3mf con múltiples placas y opcionalmente slice_info.config."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("3D/3dmodel.model", "<model/>")
        if con_slice_info:
            zf.writestr("Metadata/slice_info.config", SLICE_INFO_XML)

        tiempos = ["5h 42m 21s", "4h 12m 38s", "6h 8m 48s"]
        pesos = ["151.66", "80.63", "43.32,45.47"]
        tipos = ["PETG", "PETG", "PETG"]
        for i in range(num_plates):
            gcode = GCODE_PLATE_HEADER.format(
                time=tiempos[i], weight=pesos[i], ftype=tipos[i],
                nozzle="245", bed="70", layer="0.2"
            )
            zf.writestr(f"Metadata/plate_{i+1}.gcode", gcode)

        # JSON de placa para plate_3 con colores
        plate3_json = '{"filament_colors":["#0056B8","#F72323"],"bbox_objects":[{"name":"Body","layer_height":0.2}]}'
        zf.writestr("Metadata/plate_3.json", plate3_json)

    return buffer.getvalue()


def test_parse_all_plates_con_slice_info(tmp_path):
    """Parsea 3 placas desde slice_info.config XML."""
    contenido = _crear_3mf_multiplaca(3, con_slice_info=True)
    archivo = tmp_path / "multi.3mf"
    archivo.write_bytes(contenido)

    plates = parse_3mf_all_plates(str(archivo))
    assert len(plates) == 3

    # Placa 1: datos del XML
    assert plates[0].plate_number == 1
    assert plates[0].print_time_seconds == 20541
    assert plates[0].filament_weight_g == pytest.approx(151.66)
    assert plates[0].filament_type == "PETG"
    assert plates[0].objects == ["ModeloA", "ModeloB"]
    assert len(plates[0].filaments) == 1
    assert plates[0].filaments[0].colour_hex == "#FFFFFF"

    # Placa 2: datos del XML
    assert plates[1].plate_number == 2
    assert plates[1].print_time_seconds == 15158
    assert plates[1].filament_weight_g == pytest.approx(80.63)

    # Placa 3: multi-filamento
    assert plates[2].plate_number == 3
    assert plates[2].filament_weight_g == pytest.approx(88.79)
    assert len(plates[2].filaments) == 2
    assert plates[2].filaments[0].colour_hex == "#0056B8"
    assert plates[2].filaments[1].colour_hex == "#F72323"
    # Tipo mixto PETG/PLA
    assert "PETG" in plates[2].filament_type
    assert "PLA" in plates[2].filament_type

    # Enriquecimiento desde gcode headers
    assert plates[0].nozzle_temp == 245
    assert plates[0].bed_temp == 70
    assert plates[0].layer_height_mm == pytest.approx(0.2)


def test_parse_all_plates_sin_slice_info(tmp_path):
    """Sin slice_info.config, parsea directamente los gcode headers."""
    contenido = _crear_3mf_multiplaca(2, con_slice_info=False)
    archivo = tmp_path / "nogxml.3mf"
    archivo.write_bytes(contenido)

    plates = parse_3mf_all_plates(str(archivo))
    assert len(plates) == 2
    assert plates[0].plate_number == 1
    assert plates[0].nozzle_temp == 245
    assert plates[0].filament_type == "PETG"


def test_parse_all_plates_una_sola_placa(tmp_path):
    """Un .3mf con una sola placa retorna lista de 1 elemento."""
    contenido = _crear_3mf_con_gcode(GCODE_BAMBU)
    archivo = tmp_path / "single.3mf"
    archivo.write_bytes(contenido)

    plates = parse_3mf_all_plates(str(archivo))
    # Puede ser 0 o 1 dependiendo de si hay slice_info
    # Sin slice_info, debe encontrar plate_1.gcode
    assert len(plates) >= 1
    assert plates[0].print_time_seconds == (2 * 3600 + 15 * 60 + 38)


def test_parse_all_plates_archivo_invalido(tmp_path):
    """Archivo no-ZIP retorna lista vacía."""
    archivo = tmp_path / "basura.3mf"
    archivo.write_bytes(b"no soy un zip")
    assert parse_3mf_all_plates(str(archivo)) == []


def test_parse_all_plates_inexistente():
    """Ruta inexistente retorna lista vacía."""
    assert parse_3mf_all_plates("/no/existe.3mf") == []


def test_parse_3mf_backward_compat_con_multiplaca(tmp_path):
    """parse_3mf_file retorna solo datos de placa 1 (backward compat)."""
    contenido = _crear_3mf_multiplaca(3, con_slice_info=True)
    archivo = tmp_path / "multi.3mf"
    archivo.write_bytes(contenido)

    resultado = parse_3mf_file(str(archivo))
    assert resultado is not None
    # Debe ser la placa 1
    assert resultado.print_time_seconds == 20541
    assert resultado.filament_weight_g == pytest.approx(151.66)
    assert resultado.filament_type == "PETG"


def test_parse_bed_temp_textured_plate():
    """Extrae bed_temp desde textured_plate_temp cuando bed_temperature no existe."""
    gcode = "; nozzle_temperature = 245\n; textured_plate_temp = 70\n; layer_height = 0.2\nG28\n"
    resultado = _parse_gcode_text(gcode)
    assert resultado.bed_temp == 70


def test_parse_bed_temp_hot_plate():
    """Extrae bed_temp desde hot_plate_temp."""
    gcode = "; hot_plate_temp = 85\nG28\n"
    resultado = _parse_gcode_text(gcode)
    assert resultado.bed_temp == 85
