"""
Servicio de parseo de archivos de laminado 3D.

Extrae metadatos de archivos .gcode y .3mf generados por Bambu Studio
u OrcaSlicer: tiempo de impresión, gramos de filamento, tipo de material,
temperaturas y altura de capa.

El formato .3mf de Bambu Studio es un archivo ZIP que contiene el G-code
laminado en 'Metadata/plate_1.gcode' o en la raíz del ZIP. El G-code
tiene comentarios de cabecera con todos los metadatos de impresión.

Formatos soportados:
- Bambu Studio / OrcaSlicer: '; estimated printing time: Xh Ym Zs'
- OrcaSlicer / CuraEngine alternativo: ';TIME:XXXX', ';Filament used: X.XXXm'
"""

import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import List, Optional

from app.schemas.slicer import PlateFilament, PlateResult, SliceResult


# Densidades de filamento en g/cm3 para conversión longitud→gramos
DENSIDADES_FILAMENTO = {
    "PLA": 1.24,
    "PETG": 1.27,
    "ABS": 1.05,
    "ASA": 1.07,
    "TPU": 1.21,
    "PA": 1.14,
    "PC": 1.20,
    "PLA-CF": 1.30,
    "PETG-CF": 1.30,
    "ABS-CF": 1.17,
}

# Densidad por defecto si no se reconoce el tipo
DENSIDAD_DEFAULT = 1.24  # PLA


def convert_length_to_grams(length_m: float, filament_type: str = "PLA") -> float:
    """
    Convierte longitud de filamento en metros a gramos.

    Usa la densidad del material y asume filamento de 1.75mm de diámetro.

    Args:
        length_m:      Longitud en metros.
        filament_type: Tipo de filamento (PLA, PETG, ABS, etc.).

    Returns:
        Peso estimado en gramos.
    """
    tipo_normalizado = filament_type.upper().strip()
    densidad = DENSIDADES_FILAMENTO.get(tipo_normalizado, DENSIDAD_DEFAULT)
    radio_cm = 0.175 / 2  # 1.75mm → 0.175cm, radio = 0.0875cm
    volumen_cm3 = length_m * 100 * 3.14159265 * (radio_cm ** 2)
    return round(volumen_cm3 * densidad, 2)


def _parse_gcode_text(text: str) -> SliceResult:
    """
    Parsea el texto de un G-code y extrae los metadatos del encabezado.

    Solo lee las líneas que comienzan con ';' al inicio del archivo.
    Soporta el formato de Bambu Studio/OrcaSlicer y el formato alternativo
    de OrcaSlicer CLI / CuraEngine.

    Args:
        text: Contenido del archivo G-code como string.

    Returns:
        SliceResult con los campos extraídos (None si no se encontraron).
    """
    result = SliceResult()
    filament_length_m: Optional[float] = None
    filament_type_found: Optional[str] = None

    for line in text.splitlines():
        line = line.strip()
        if not line.startswith(";"):
            # Los metadatos solo están en el encabezado
            if result.print_time_seconds is not None:
                break
            continue

        # --- Formato Bambu Studio / OrcaSlicer ---

        # Tiempo estimado: "; estimated printing time: 2h 15m 38s"
        m = re.match(r";\s*estimated printing time[: ]+(.+)", line, re.IGNORECASE)
        if m and result.print_time_seconds is None:
            time_str = m.group(1).strip()
            total = 0
            for val, unit in re.findall(r"(\d+)\s*([hms])", time_str):
                if unit == "h":
                    total += int(val) * 3600
                elif unit == "m":
                    total += int(val) * 60
                elif unit == "s":
                    total += int(val)
            if total > 0:
                result.print_time_seconds = total

        # Gramos: "; filament used [g] = 45.32"
        m = re.match(r";\s*filament used \[g\]\s*=\s*([\d.]+)", line, re.IGNORECASE)
        if m and result.filament_weight_g is None:
            result.filament_weight_g = float(m.group(1))

        # Tipo de filamento: "; filament type = PLA"
        m = re.match(r";\s*filament type\s*=\s*(.+)", line, re.IGNORECASE)
        if m and result.filament_type is None:
            tipo = m.group(1).strip().split(";")[0].strip()
            result.filament_type = tipo
            filament_type_found = tipo

        # Temperatura nozzle: "; nozzle_temperature = 220"
        m = re.match(r";\s*nozzle_temperature\s*=\s*(\d+)", line, re.IGNORECASE)
        if m and result.nozzle_temp is None:
            result.nozzle_temp = int(m.group(1))

        # Temperatura cama: "; bed_temperature = 60"
        m = re.match(r";\s*bed_temperature\s*=\s*(\d+)", line, re.IGNORECASE)
        if m and result.bed_temp is None:
            result.bed_temp = int(m.group(1))

        # Bambu Studio usa campos por tipo de placa en lugar de bed_temperature
        # "; textured_plate_temp = 70,70,70,70" / "; hot_plate_temp = 70,70,70,70"
        if result.bed_temp is None:
            m = re.match(
                r";\s*(?:textured_plate_temp|hot_plate_temp|cool_plate_temp|eng_plate_temp)\s*=\s*(\d+)",
                line, re.IGNORECASE
            )
            if m:
                val = int(m.group(1))
                if val > 0:
                    result.bed_temp = val

        # Altura de capa: "; layer_height = 0.20"
        m = re.match(r";\s*layer_height\s*=\s*([\d.]+)", line, re.IGNORECASE)
        if m and result.layer_height_mm is None:
            result.layer_height_mm = float(m.group(1))

        # --- Formato alternativo OrcaSlicer CLI / CuraEngine ---

        # Tiempo en segundos: ";TIME:3847"
        m = re.match(r";TIME:(\d+)$", line)
        if m and result.print_time_seconds is None:
            result.print_time_seconds = int(m.group(1))

        # Longitud de filamento: ";Filament used: 2.4567m"
        m = re.match(r";Filament used:\s*([\d.]+)m", line, re.IGNORECASE)
        if m and result.filament_weight_g is None:
            filament_length_m = float(m.group(1))

        # Peso directo: ";WEIGHT:7.21"
        m = re.match(r";WEIGHT:([\d.]+)$", line)
        if m and result.filament_weight_g is None:
            result.filament_weight_g = float(m.group(1))

    # Si tenemos longitud pero no gramos, convertir
    if filament_length_m is not None and result.filament_weight_g is None:
        tipo = filament_type_found or "PLA"
        result.filament_weight_g = convert_length_to_grams(filament_length_m, tipo)

    return result


def parse_gcode_file(file_path: str) -> Optional[SliceResult]:
    """
    Parsea un archivo .gcode y extrae los metadatos del encabezado.

    Args:
        file_path: Ruta al archivo .gcode.

    Returns:
        SliceResult con los datos extraídos, o None si hubo un error.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            # Leer solo los primeros 200 KB para no cargar archivos grandes
            content = f.read(200 * 1024)
        result = _parse_gcode_text(content)
        # Retornar None si no se extrajo ningún dato útil
        if result.print_time_seconds is None and result.filament_weight_g is None:
            return None
        return result
    except Exception:
        return None


def _parse_slice_info_xml(xml_text: str) -> List[PlateResult]:
    """
    Parsea el archivo slice_info.config (XML) de Bambu Studio.

    Este XML contiene la información más rica por placa: tiempo estimado,
    peso total, y detalle de cada filamento (tipo, color, gramos, metros).

    Args:
        xml_text: Contenido del archivo slice_info.config.

    Returns:
        Lista de PlateResult, una por cada placa encontrada.
    """
    plates = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return plates

    for plate_el in root.findall("plate"):
        meta = {}
        for m in plate_el.findall("metadata"):
            meta[m.get("key", "")] = m.get("value", "")

        plate_num = int(meta.get("index", "0"))
        if plate_num == 0:
            continue

        pr = PlateResult(plate_number=plate_num)

        # Tiempo de impresión en segundos
        prediction = meta.get("prediction")
        if prediction:
            pr.print_time_seconds = int(prediction)

        # Peso total de la placa
        weight = meta.get("weight")
        if weight:
            pr.filament_weight_g = float(weight)

        # Diámetro de boquilla → nozzle_temp se extrae del gcode
        # Objetos de la placa
        objetos = []
        for obj_el in plate_el.findall("object"):
            nombre = obj_el.get("name", "")
            if nombre and obj_el.get("skipped") != "true":
                objetos.append(nombre)
        if objetos:
            pr.objects = objetos

        # Filamentos usados en esta placa
        filamentos = []
        tipos_unicos = set()
        for fil_el in plate_el.findall("filament"):
            pf = PlateFilament(
                filament_type=fil_el.get("type", ""),
                colour_hex=fil_el.get("color", ""),
                weight_g=float(fil_el.get("used_g", "0")),
                length_m=float(fil_el.get("used_m", "0")),
            )
            filamentos.append(pf)
            if pf.filament_type:
                tipos_unicos.add(pf.filament_type)

        if filamentos:
            pr.filaments = filamentos
            # Tipo de filamento: si todos iguales usar ese, si mixto separar con "/"
            if len(tipos_unicos) == 1:
                pr.filament_type = tipos_unicos.pop()
            elif tipos_unicos:
                pr.filament_type = "/".join(sorted(tipos_unicos))

        # Cambios de color desde <layer_filament_lists>: cada bloque con
        # filament_list no vacío es un tramo de un filamento. Las transiciones
        # entre tramos consecutivos son los cambios reales de color.
        bloques_filamento = []
        for lfl_root in plate_el.findall("layer_filament_lists"):
            for lfl in lfl_root.findall("layer_filament_list"):
                fl = (lfl.get("filament_list") or "").strip()
                if not fl:
                    continue
                rangos = (lfl.get("layer_ranges") or "0 0").split()
                start_layer = int(rangos[0]) if rangos else 0
                bloques_filamento.append((start_layer, fl))
        if bloques_filamento:
            bloques_filamento.sort(key=lambda x: x[0])
            pr.color_changes = max(0, len(bloques_filamento) - 1)

        plates.append(pr)

    return plates


def _count_color_changes_in_gcode(gcode_text: str) -> int:
    """
    Cuenta los cambios de color (filamento) reales en un G-code de placa.

    Cada selección de herramienta `Tn` (línea con solo 'T' + dígitos) representa
    una activación de extrusor. La primera carga inicial el material; las siguientes
    son cambios reales de color durante la impresión. El comando final `T65535`
    de Bambu (parking/unload) no se cuenta como cambio.

    Solo cuenta líneas exactas `^T[0-9]+$`, lo que excluye los comandos templados
    (`T[next_extruder]`, etc.) presentes en bloques de start/end gcode.

    Args:
        gcode_text: Contenido del G-code (puede ser parcial).

    Returns:
        Número de cambios de color (cero para impresiones de un solo filamento).
    """
    tool_changes = 0
    for raw in gcode_text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";"):
            continue
        m = re.match(r"^T(\d+)$", line)
        if m and int(m.group(1)) != 65535:
            tool_changes += 1
    return max(0, tool_changes - 1)


def _enrich_plates_from_gcode(zf: zipfile.ZipFile, plates: List[PlateResult]) -> None:
    """
    Complementa los datos de las placas con info del gcode header.

    Extrae temperaturas (nozzle, cama), altura de capa, colores de
    filamento y conteo de cambios de color que no están en slice_info.config.

    Args:
        zf:     ZipFile abierto del .3mf.
        plates: Lista de PlateResult a enriquecer (se modifican in-place).
    """
    for plate in plates:
        gcode_name = f"Metadata/plate_{plate.plate_number}.gcode"
        try:
            with zf.open(gcode_name) as f:
                # Header de 200KB para metadatos; conteo de cambios stream completo aparte.
                header_bytes = f.read(200 * 1024)
                resto = f.read()
            contenido_header = header_bytes.decode("utf-8", errors="ignore")
            contenido_total = contenido_header + resto.decode("utf-8", errors="ignore")
        except KeyError:
            continue

        result = _parse_gcode_text(contenido_header)
        # Solo recurrir al conteo por gcode si slice_info no aportó datos de filamentos:
        # el start-gcode de Bambu emite múltiples T0 de inicialización que inflan
        # el conteo y no son cambios de color reales.
        if not plate.filaments and plate.color_changes == 0:
            plate.color_changes = _count_color_changes_in_gcode(contenido_total)
        if plate.nozzle_temp is None and result.nozzle_temp is not None:
            plate.nozzle_temp = result.nozzle_temp
        if plate.bed_temp is None and result.bed_temp is not None:
            plate.bed_temp = result.bed_temp
        if plate.layer_height_mm is None and result.layer_height_mm is not None:
            plate.layer_height_mm = result.layer_height_mm
        # Si no tenemos tiempo del XML, usar el del gcode
        if plate.print_time_seconds is None and result.print_time_seconds is not None:
            plate.print_time_seconds = result.print_time_seconds
        # Si no tenemos peso del XML, usar el del gcode
        if plate.filament_weight_g is None and result.filament_weight_g is not None:
            plate.filament_weight_g = result.filament_weight_g
        if plate.filament_type is None and result.filament_type is not None:
            plate.filament_type = result.filament_type


def _enrich_plates_from_json(zf: zipfile.ZipFile, plates: List[PlateResult]) -> None:
    """
    Complementa datos de las placas con los JSON de placa (plate_N.json).

    Extrae colores de filamento y nombres de objetos si no se obtuvieron
    de slice_info.config.

    Args:
        zf:     ZipFile abierto del .3mf.
        plates: Lista de PlateResult a enriquecer (se modifican in-place).
    """
    import json

    for plate in plates:
        json_name = f"Metadata/plate_{plate.plate_number}.json"
        try:
            with zf.open(json_name) as f:
                data = json.loads(f.read())
        except (KeyError, Exception):
            continue

        # Objetos del JSON si no los tenemos del XML
        if not plate.objects and "bbox_objects" in data:
            nombres = [
                obj.get("name", "")
                for obj in data["bbox_objects"]
                if obj.get("name")
            ]
            if nombres:
                plate.objects = nombres

        # layer_height del primer objeto
        if plate.layer_height_mm is None and "bbox_objects" in data:
            for obj in data["bbox_objects"]:
                lh = obj.get("layer_height")
                if lh and lh > 0:
                    plate.layer_height_mm = round(lh, 3)
                    break


def parse_3mf_all_plates(file_path: str) -> List[PlateResult]:
    """
    Parsea TODAS las placas de un archivo .3mf de Bambu Studio.

    Estrategia de parseo (en orden de prioridad):
    1. slice_info.config (XML) — datos más ricos: tiempo, peso, filamentos
    2. plate_N.gcode headers — temperaturas, altura de capa
    3. plate_N.json — objetos, colores de filamento

    Si no existe slice_info.config, detecta los plate_N.gcode y parsea
    cada uno individualmente.

    Args:
        file_path: Ruta al archivo .3mf.

    Returns:
        Lista de PlateResult, una por cada placa. Lista vacía si no hay
        datos de laminado.
    """
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            nombres = zf.namelist()
            plates: List[PlateResult] = []

            # Intentar parsear slice_info.config primero (fuente más rica)
            if "Metadata/slice_info.config" in nombres:
                with zf.open("Metadata/slice_info.config") as f:
                    xml_text = f.read().decode("utf-8", errors="ignore")
                plates = _parse_slice_info_xml(xml_text)

            # Si no hay slice_info, detectar placas por gcode (Metadata/plate_N.gcode)
            if not plates:
                plate_gcodes = sorted([
                    n for n in nombres
                    if re.match(r"Metadata/plate_\d+\.gcode$", n, re.IGNORECASE)
                ])
                for gcode_name in plate_gcodes:
                    m = re.search(r"plate_(\d+)", gcode_name)
                    if not m:
                        continue
                    plate_num = int(m.group(1))
                    with zf.open(gcode_name) as f:
                        contenido = f.read().decode("utf-8", errors="ignore")
                    result = _parse_gcode_text(contenido[:200 * 1024])
                    if result.print_time_seconds is not None or result.filament_weight_g is not None:
                        plates.append(PlateResult(
                            plate_number=plate_num,
                            print_time_seconds=result.print_time_seconds,
                            filament_weight_g=result.filament_weight_g,
                            filament_type=result.filament_type,
                            layer_height_mm=result.layer_height_mm,
                            nozzle_temp=result.nozzle_temp,
                            bed_temp=result.bed_temp,
                            color_changes=_count_color_changes_in_gcode(contenido),
                        ))

            # Fallback: buscar cualquier .gcode en el ZIP (raíz u otra ruta)
            if not plates:
                for nombre in nombres:
                    if nombre.lower().endswith(".gcode"):
                        with zf.open(nombre) as f:
                            contenido = f.read().decode("utf-8", errors="ignore")
                        result = _parse_gcode_text(contenido[:200 * 1024])
                        if result.print_time_seconds is not None or result.filament_weight_g is not None:
                            plates.append(PlateResult(
                                plate_number=1,
                                print_time_seconds=result.print_time_seconds,
                                filament_weight_g=result.filament_weight_g,
                                filament_type=result.filament_type,
                                layer_height_mm=result.layer_height_mm,
                                nozzle_temp=result.nozzle_temp,
                                bed_temp=result.bed_temp,
                                color_changes=_count_color_changes_in_gcode(contenido),
                            ))
                            break

            if not plates:
                return []

            # Enriquecer con datos de gcode headers y JSONs de placa
            _enrich_plates_from_gcode(zf, plates)
            _enrich_plates_from_json(zf, plates)

            return plates

    except (zipfile.BadZipFile, Exception):
        return []


def parse_3mf_file(file_path: str) -> Optional[SliceResult]:
    """
    Parsea un archivo .3mf de Bambu Studio y extrae los metadatos.

    Usa parse_3mf_all_plates() internamente y retorna los datos de la
    primera placa como SliceResult (backward compat).

    Args:
        file_path: Ruta al archivo .3mf.

    Returns:
        SliceResult con los datos extraídos, o None si no hay G-code laminado.
    """
    plates = parse_3mf_all_plates(file_path)
    if not plates:
        return None

    # Retornar datos de la primera placa
    p = plates[0]
    return SliceResult(
        print_time_seconds=p.print_time_seconds,
        filament_weight_g=p.filament_weight_g,
        filament_type=p.filament_type,
        layer_height_mm=p.layer_height_mm,
        nozzle_temp=p.nozzle_temp,
        bed_temp=p.bed_temp,
    )
