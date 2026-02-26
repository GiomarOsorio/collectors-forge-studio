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


def _patch_3mf_params(src_path: Path) -> Optional[Path]:
    """
    Corrige valores centinela fuera de rango en config de 3MF de Bambu Studio/OrcaSlicer 2.5+.

    OrcaSlicer 2.3.x rechaza valores como -1 y 0 que en versiones 2.5+ significan
    "heredar de preset". Crea un archivo temporal con los valores corregidos.

    Args:
        src_path: Ruta al archivo .3mf original.

    Returns:
        Ruta al .3mf corregido, o None si falla la operacion.
    """
    # (param, valor_centinela, valor_valido_por_defecto)
    FIXES = [
        (b"raft_first_layer_expansion", b"-1", b"0"),
        (b"solid_infill_filament",      b"0",  b"1"),
        (b"sparse_infill_filament",     b"0",  b"1"),
        (b"tree_support_wall_count",    b"-1", b"0"),
        (b"wall_filament",              b"0",  b"1"),
    ]
    BINARY_EXTS = {".png", ".jpg", ".jpeg", ".stl", ".obj", ".bin", ".ttf"}

    dst_path = src_path.with_name(f"patched_{src_path.name}")
    try:
        with zipfile.ZipFile(src_path, "r") as zin, \
             zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if Path(item.filename).suffix.lower() not in BINARY_EXTS:
                    for param, bad, good in FIXES:
                        # XML: key="param" value="-1" o param="-1"
                        data = data.replace(param + b'" value="' + bad + b'"',
                                            param + b'" value="' + good + b'"')
                        data = data.replace(param + b'="' + bad + b'"',
                                            param + b'="' + good + b'"')
                        # JSON: "param": -1
                        data = data.replace(b'"' + param + b'": ' + bad,
                                            b'"' + param + b'": ' + good)
                        # INI: param = -1
                        data = data.replace(param + b" = " + bad,
                                            param + b" = " + good)
                zout.writestr(item, data)
        return dst_path
    except Exception:
        if dst_path.exists():
            dst_path.unlink()
        return None


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
    if stl_path.suffix.lower() == ".3mf":
        patched = _patch_3mf_params(stl_path)
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
            return SliceResponse(
                status="error",
                error_message=f"OrcaSlicer error (codigo {proc.returncode}): {combined[:5000]}",
            )

        # Buscar el gcode generado (OrcaSlicer nombra el output)
        gcode_files = list(JOBS_DIR.glob(f"*{request.job_id}*.gcode"))
        if not gcode_files:
            stem = stl_path.stem
            gcode_files = list(JOBS_DIR.glob(f"{stem}*.gcode"))

        if not gcode_files:
            return SliceResponse(status="error", error_message="No se genero el G-code")

        metadata = parse_gcode_metadata(gcode_files[0])
        return SliceResponse(status="done", **metadata)

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
