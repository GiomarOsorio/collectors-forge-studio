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
import zipfile
from pathlib import Path
from typing import Optional

from app.schemas.slicer import SliceResult


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


def parse_3mf_file(file_path: str) -> Optional[SliceResult]:
    """
    Parsea un archivo .3mf de Bambu Studio y extrae los metadatos.

    Un .3mf es un archivo ZIP. Busca el G-code laminado dentro del ZIP
    en las rutas conocidas de Bambu Studio: 'Metadata/plate_1.gcode',
    'Metadata/plate_*.gcode', o cualquier .gcode en la raíz.

    Args:
        file_path: Ruta al archivo .3mf.

    Returns:
        SliceResult con los datos extraídos, o None si no hay G-code laminado.
    """
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            nombres = zf.namelist()

            # Buscar G-code en orden de prioridad
            candidatos = []
            for nombre in nombres:
                nombre_lower = nombre.lower()
                if nombre_lower.endswith(".gcode"):
                    # Priorizar plate_1.gcode de Bambu Studio
                    if "plate_1" in nombre_lower:
                        candidatos.insert(0, nombre)
                    else:
                        candidatos.append(nombre)

            for candidato in candidatos:
                with zf.open(candidato) as f:
                    # Leer solo los primeros 200 KB del gcode
                    contenido = f.read(200 * 1024).decode("utf-8", errors="ignore")
                result = _parse_gcode_text(contenido)
                if result.print_time_seconds is not None or result.filament_weight_g is not None:
                    return result

        return None
    except (zipfile.BadZipFile, Exception):
        return None
