"""
Microservicio de laminado 3D con OrcaSlicer.

Recibe peticiones del backend principal y ejecuta OrcaSlicer CLI
en modo headless para laminar archivos STL. Los archivos se leen
y escriben en el volumen compartido /slicer_jobs/.

Endpoints:
    GET  /health  -- Verificar que el servicio esta activo
    POST /slice   -- Laminar un archivo STL con OrcaSlicer
"""

import asyncio
import re
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="TurtleForge Slicer Service", version="1.0.0")

JOBS_DIR = Path("/slicer_jobs")
JOBS_DIR.mkdir(exist_ok=True)

ORCA_BIN = Path("/usr/local/bin/OrcaSlicer")


class SliceRequest(BaseModel):
    """Solicitud de laminado de un archivo STL."""
    job_id: str
    stl_filename: str
    printer_preset: str = "Bambu Lab P2S 0.4 nozzle"
    filament_preset: str = "Bambu PLA Basic @BBL P2S"
    config_preset: str = "0.20mm Standard @BBL P2S"


class PlateMetadata(BaseModel):
    """Metadatos de una placa individual."""
    plate_number: int = 1
    print_time_seconds: Optional[int] = None
    filament_weight_g: Optional[float] = None
    filament_type: Optional[str] = None
    layer_height_mm: Optional[float] = None
    nozzle_temp: Optional[int] = None
    bed_temp: Optional[int] = None


class SliceResponse(BaseModel):
    """Resultado del laminado."""
    status: str  # done, error
    print_time_seconds: Optional[int] = None
    filament_weight_g: Optional[float] = None
    filament_type: Optional[str] = None
    layer_height_mm: Optional[float] = None
    nozzle_temp: Optional[int] = None
    bed_temp: Optional[int] = None
    error_message: Optional[str] = None
    plates_data: list = []
    output_3mf: Optional[str] = None


def parse_gcode_metadata(gcode_path: Path) -> dict:
    """
    Extrae metadatos del encabezado del G-code generado por OrcaSlicer.

    Busca comentarios de cabecera con tiempo, gramos, tipo de filamento,
    temperaturas y altura de capa.

    Args:
        gcode_path: Ruta al archivo .gcode generado.

    Returns:
        Diccionario con los campos extraidos.
    """
    result = {}
    try:
        with open(gcode_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not line.startswith(";"):
                    break
                line = line.strip()

                # Formato Bambu/OrcaSlicer
                m = re.match("; estimated printing time: (.+)", line)
                if m:
                    time_str = m.group(1)
                    total = 0
                    for val, unit in re.findall(r"(\d+)([hms])", time_str):
                        if unit == "h":
                            total += int(val) * 3600
                        elif unit == "m":
                            total += int(val) * 60
                        elif unit == "s":
                            total += int(val)
                    result["print_time_seconds"] = total

                m = re.match(r"; filament used \[g\] = ([\d.]+)", line)
                if m:
                    result["filament_weight_g"] = float(m.group(1))

                m = re.match("; filament type = (.+)", line)
                if m:
                    result["filament_type"] = m.group(1).strip().split(";")[0].strip()

                m = re.match(r"; nozzle_temperature = (\d+)", line)
                if m:
                    result["nozzle_temp"] = int(m.group(1))

                m = re.match(r"; bed_temperature = (\d+)", line)
                if m:
                    result["bed_temp"] = int(m.group(1))

                # Bambu Studio usa campos por tipo de placa
                if "bed_temp" not in result:
                    m = re.match(
                        r";\s*(?:textured_plate_temp|hot_plate_temp|cool_plate_temp|eng_plate_temp)\s*=\s*(\d+)",
                        line, re.IGNORECASE
                    )
                    if m:
                        val = int(m.group(1))
                        if val > 0:
                            result["bed_temp"] = val

                m = re.match(r"; layer_height = ([\d.]+)", line)
                if m:
                    result["layer_height_mm"] = float(m.group(1))

                # Formato OrcaSlicer/CuraEngine alternativo
                m = re.match(r";TIME:(\d+)", line)
                if m and "print_time_seconds" not in result:
                    result["print_time_seconds"] = int(m.group(1))

    except Exception:
        pass
    return result


def _patch_3mf_params(src_path: Path) -> tuple:
    """
    Corrige valores incompatibles en 3MF de Bambu Studio para OrcaSlicer 2.3.x.

    Problemas que resuelve:
    1. Valores centinela fuera de rango (raft_first_layer_expansion=-1, etc.)
    2. Valores "nil" en JSON configs (project_settings, filament_settings) que causan
       "Deserializing nil into a non-nullable object"
    3. Valores "nil" en XML metadata (model_settings) como value="30,nil"
    4. Anotaciones de pintura de triángulos (custom_supports/seam/color) incompatibles
    5. cut_information.xml con conectores de corte de BS 2.5+ que causan crash
    6. Metadata XML con claves BS 2.5+ desconocidas para OrcaSlicer 2.3.x

    Args:
        src_path: Ruta al archivo .3mf original.

    Returns:
        Tupla (ruta_parcheada_o_None, mensaje_debug).
    """
    # (param, valor_centinela_invalido, valor_valido_por_defecto)
    FIXES = [
        ("raft_first_layer_expansion", "-1", "0"),
        ("solid_infill_filament",      "0",  "1"),
        ("sparse_infill_filament",     "0",  "1"),
        ("tree_support_wall_count",    "-1", "0"),
        ("wall_filament",              "0",  "1"),
    ]
    BINARY_EXTS = {".png", ".jpg", ".jpeg", ".stl", ".obj", ".bin", ".ttf", ".gcode"}

    # Archivos del 3MF que deben ser eliminados completamente.
    # cut_information.xml tiene conectores de corte de BS 2.5+ que OrcaSlicer 2.3.x
    # no reconoce y provocan crash en calc_exclude_triangles.
    SKIP_FILES = {"Metadata/cut_information.xml"}

    # Claves de metadata XML (model_settings.config) que son exclusivas de BS 2.5+
    # y OrcaSlicer 2.3.x no reconoce. Solo eliminamos las cosméticas/internas.
    # MANTENER: plater_id (asignación de placa), plater_name, filament_maps,
    # filament_map_mode (funcionales para multi-placa/multi-extruder).
    BS25_XML_KEYS = {
        "filament_volume_maps",
        "skeleton_infill_density", "skin_infill_density", "identify_id",
        "pick_file", "top_file",
        "thumbnail_file", "thumbnail_no_light_file", "top_one_wall_type",
    }

    dst_path = src_path.with_name(f"patched_{src_path.name}")
    total_changes = 0
    nil_fixes = 0
    skipped_files = []
    files_text = []

    try:
        with zipfile.ZipFile(src_path, "r") as zin, \
             zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                # --- Fix 5: eliminar archivos incompatibles ---
                if item.filename in SKIP_FILES:
                    skipped_files.append(item.filename)
                    continue

                raw = zin.read(item.filename)
                ext = Path(item.filename).suffix.lower()

                if ext not in BINARY_EXTS:
                    try:
                        text = raw.decode("utf-8")
                        files_text.append(item.filename)

                        # --- Fix 1: valores centinela fuera de rango ---
                        for param, bad, good in FIXES:
                            p = re.escape(param)
                            b = re.escape(bad)
                            # XML value attr: param" value="bad"
                            text, n = re.subn(
                                p + r'("\s+value\s*=\s*")' + b + r'"',
                                param + r'\g<1>' + good + '"', text)
                            total_changes += n
                            # XML direct attr: param="bad"
                            text, n = re.subn(
                                p + r'(\s*=\s*")' + b + r'"',
                                param + r'\g<1>' + good + '"', text)
                            total_changes += n
                            # JSON valor string: "param": "bad"
                            text, n = re.subn(
                                r'"' + p + r'"(\s*:\s*)"' + b + r'"',
                                '"' + param + r'"\g<1>"' + good + '"', text)
                            total_changes += n
                            # JSON valor entero: "param": bad
                            text, n = re.subn(
                                r'"' + p + r'"(\s*:\s*)' + b + r'(?=[,}\s\n])',
                                '"' + param + r'"\g<1>' + good, text)
                            total_changes += n
                            # INI: param = bad
                            text, n = re.subn(
                                r'(\b' + p + r'\s*=\s*)' + b + r'(\s*(?:#|$|\n))',
                                r'\g<1>' + good + r'\2', text)
                            total_changes += n

                        # --- Fix 2: "nil" en JSON configs ---
                        # Bambu Studio 2.5+ usa "nil" como placeholder en arrays de
                        # filament settings (retraction, temperature, z_hop, etc.).
                        # OrcaSlicer 2.3.x no puede deserializar "nil".
                        if item.filename.endswith(".config") and '"nil"' in text:
                            before = text.count('"nil"')
                            text = re.sub(r',\s*"nil"', '', text)
                            text = re.sub(r'"nil"\s*,\s*', '', text)
                            text = re.sub(r'"nil"', '', text)
                            after = text.count('"nil"')
                            nil_fixes += before - after

                        # --- Fix 3: ",nil" en XML metadata values ---
                        # model_settings.config: value="30,nil" → value="30"
                        if item.filename.endswith(".config") and ",nil" in text:
                            before_count = text.count(",nil")
                            text = re.sub(r',nil(?=")', '', text)
                            nil_fixes += before_count - text.count(",nil")

                        # --- Fix 4: anotaciones de pintura de triángulos ---
                        # OrcaSlicer 2.3.x no parsea el formato binario de BS 2.5.x
                        # y crashea en calc_exclude_triangles.
                        text, n = re.subn(
                            r'<(?:\w+:)?custom_(?:supports|seam|color)\b[^/]*'
                            r'(?:/>|>[\s\S]*?</[^>]+>)',
                            '', text, flags=re.IGNORECASE)
                        total_changes += n

                        # --- Fix 6: claves BS 2.5+ en model_settings.config ---
                        # Eliminar <metadata key="KEY" value="..."/> desconocidas
                        if item.filename.endswith("model_settings.config"):
                            for key in BS25_XML_KEYS:
                                text, n = re.subn(
                                    r'\s*<metadata\s+key="' + re.escape(key)
                                    + r'"[^>]*/>\s*',
                                    '\n', text)
                                total_changes += n

                        raw = text.encode("utf-8")
                    except (UnicodeDecodeError, TypeError):
                        pass

                zout.writestr(item, raw)

        debug = (
            f"parche OK: {total_changes} fixes, {nil_fixes} nils eliminados, "
            f"{len(skipped_files)} archivos eliminados "
            f"en {len(files_text)} archivos"
        )
        return dst_path, debug

    except Exception as e:
        if dst_path.exists():
            dst_path.unlink()
        return None, f"parche falló: {e}"


@app.get("/health")
async def health():
    """Verifica que el servicio esta activo y OrcaSlicer accesible."""
    return {
        "status": "ok",
        "orcaslicer": "available" if ORCA_BIN.exists() else "not_found",
    }


@app.get("/cli-help")
async def cli_help():
    """
    Retorna el output de OrcaSlicer --help para depurar flags disponibles.

    Util para confirmar los nombres exactos de las flags CLI en la version
    nightly instalada en el contenedor.
    """
    if not ORCA_BIN.exists():
        return {"error": "OrcaSlicer no encontrado"}
    try:
        proc = await asyncio.create_subprocess_exec(
            str(ORCA_BIN), "--help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                "DISPLAY": "",
                "HOME": "/tmp",
                "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            },
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return {
            "returncode": proc.returncode,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/slice", response_model=SliceResponse)
async def slice_model(request: SliceRequest):
    """
    Lamina un archivo STL con OrcaSlicer CLI.

    Lee el STL del volumen compartido, ejecuta OrcaSlicer en modo
    headless y retorna los metadatos del G-code generado.

    Args:
        request: Datos del trabajo de laminado.

    Returns:
        SliceResponse con tiempo, gramos y demas metadatos.
    """
    stl_path = JOBS_DIR / request.stl_filename
    if not stl_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {request.stl_filename}")

    if not ORCA_BIN.exists():
        raise HTTPException(status_code=503, detail="OrcaSlicer no disponible en el contenedor")

    # Para archivos .3mf de Bambu Studio 2.5+, parchear params centinela fuera
    # de rango antes de pasar a OrcaSlicer 2.3.x (raft_first_layer_expansion=-1, etc.)
    effective_path = stl_path
    patched_path: Optional[Path] = None
    patch_debug = "sin parche (no es .3mf)"
    if stl_path.suffix.lower() == ".3mf":
        patched, patch_debug = _patch_3mf_params(stl_path)
        if patched:
            patched_path = patched
            effective_path = patched_path

    # OrcaSlicer 2.3.x CLI flags correctos (verificados en --help):
    #   --slice 0             → lamina todas las placas (0=all, N=placa N)
    #   --outputdir           → directorio de salida (NO es -o)
    #   --allow-newer-file    → acepta 3MF creados con versiones más recientes
    #   --load-settings       → archivos JSON de proceso/máquina (para presets futuros)
    #   --load-filaments      → archivos JSON de filamento (para presets futuros)
    cmd = [
        str(ORCA_BIN),
        "--slice", "0",
        "--allow-newer-file",
        "--no-check",
        "--outputdir", str(JOBS_DIR),
        str(effective_path),
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                "DISPLAY": "",
                "HOME": "/tmp",
                "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            },
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)

        if proc.returncode != 0:
            combined = (stdout.decode(errors="replace") + stderr.decode(errors="replace")).strip()
            # Crash por señal (SIGSEGV=-11, SIGABRT=-6): mensaje específico
            if proc.returncode in (-11, -6):
                signal_name = "SIGSEGV (segfault)" if proc.returncode == -11 else "SIGABRT"
                return SliceResponse(
                    status="error",
                    error_message=(
                        f"OrcaSlicer crasheó ({signal_name}) al procesar el modelo. "
                        f"Posiblemente la geometría tiene problemas (manifold, triángulos degenerados) "
                        f"o hay un bug en esta versión de OrcaSlicer con este tipo de archivo. "
                        f"Prueba exportar el modelo desde el slicer de origen antes de subirlo.\n"
                        f"Detalle: {combined[:1000]}\n[debug parche: {patch_debug}]"
                    ),
                )
            return SliceResponse(
                status="error",
                error_message=f"OrcaSlicer error (codigo {proc.returncode}): {combined[:4000]}\n[debug parche: {patch_debug}]",
            )

        # Buscar los gcodes generados (OrcaSlicer genera plate_N.gcode por placa)
        stem = stl_path.stem
        gcode_files = sorted(JOBS_DIR.glob(f"*{request.job_id}*.gcode"))
        if not gcode_files:
            gcode_files = sorted(JOBS_DIR.glob(f"{stem}*.gcode"))
        # Filtrar solo archivos .gcode (no .gcode.3mf)
        gcode_files = [f for f in gcode_files if not f.name.endswith(".3mf")]

        # Buscar .gcode.3mf (contiene todas las placas en un ZIP)
        output_3mf_files = list(JOBS_DIR.glob(f"*{request.job_id}*.gcode.3mf"))
        if not output_3mf_files:
            output_3mf_files = list(JOBS_DIR.glob(f"{stem}*.gcode.3mf"))
        # También buscar .3mf que OrcaSlicer pueda generar como output
        if not output_3mf_files:
            output_3mf_files = list(JOBS_DIR.glob(f"{stem}*.3mf"))
            output_3mf_files = [f for f in output_3mf_files if f != stl_path and f != effective_path]

        if not gcode_files and not output_3mf_files:
            return SliceResponse(status="error", error_message="No se genero el G-code")

        # Parsear cada gcode individual → plates_data
        plates_data = []
        for gf in gcode_files:
            meta = parse_gcode_metadata(gf)
            if not meta:
                continue
            # Extraer número de placa del nombre: plate_1, plate_2, etc.
            plate_match = re.search(r"plate_(\d+)", gf.name, re.IGNORECASE)
            plate_num = int(plate_match.group(1)) if plate_match else (len(plates_data) + 1)
            meta["plate_number"] = plate_num
            plates_data.append(meta)

        # Ordenar por número de placa
        plates_data.sort(key=lambda x: x.get("plate_number", 0))

        # Campos legacy = primera placa (o agregado si hay múltiples)
        if plates_data:
            first = plates_data[0]
            total_time = sum(p.get("print_time_seconds", 0) or 0 for p in plates_data)
            total_weight = sum(p.get("filament_weight_g", 0) or 0 for p in plates_data)
            legacy = {
                "print_time_seconds": total_time if total_time > 0 else first.get("print_time_seconds"),
                "filament_weight_g": round(total_weight, 2) if total_weight > 0 else first.get("filament_weight_g"),
                "filament_type": first.get("filament_type"),
                "layer_height_mm": first.get("layer_height_mm"),
                "nozzle_temp": first.get("nozzle_temp"),
                "bed_temp": first.get("bed_temp"),
            }
        elif gcode_files:
            legacy = parse_gcode_metadata(gcode_files[0])
        else:
            legacy = {}

        output_3mf = output_3mf_files[0].name if output_3mf_files else None

        return SliceResponse(
            status="done",
            plates_data=plates_data,
            output_3mf=output_3mf,
            **legacy,
        )

    except asyncio.TimeoutError:
        return SliceResponse(status="error", error_message="Tiempo de laminado agotado (>5 minutos)")
    except Exception as e:
        return SliceResponse(status="error", error_message=str(e))
    finally:
        if patched_path and patched_path.exists():
            try:
                patched_path.unlink()
            except Exception:
                pass
