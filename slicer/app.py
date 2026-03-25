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
import json
import re
import zipfile
from pathlib import Path
from typing import Optional

try:
    import lib3mf
    HAS_LIB3MF = True
except ImportError:
    HAS_LIB3MF = False

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="TurtleForge Slicer Service", version="1.0.0")

JOBS_DIR = Path("/slicer_jobs")
JOBS_DIR.mkdir(exist_ok=True)

ORCA_BIN = Path("/usr/local/bin/OrcaSlicer")

# Perfiles BBL P2S copiados del repo (BambuStudio 2.5.x).
# Se usan para aplanar y generar JSONs sin herencia en runtime.
BBL_PROFILES = Path("/app/profiles/BBL")

# Mapa boquilla → preset de máquina y proceso por defecto
NOZZLE_PRESETS = {
    "0.2": {
        "machine": "Bambu Lab P2S 0.2 nozzle",
        "process": "0.08mm High Quality @BBL P2S 0.2 nozzle",
    },
    "0.4": {
        "machine": "Bambu Lab P2S 0.4 nozzle",
        "process": "0.20mm Standard @BBL P2S",
    },
    "0.6": {
        "machine": "Bambu Lab P2S 0.6 nozzle",
        "process": "0.18mm Balanced Quality @BBL P2S 0.6 nozzle",
    },
    "0.8": {
        "machine": "Bambu Lab P2S 0.8 nozzle",
        "process": "0.24mm Balanced Quality @BBL P2S 0.8 nozzle",
    },
}


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


def _es_proyecto_bs(src_path: Path) -> bool:
    """
    Detecta si un .3mf es un proyecto de BambuStudio (sin gcode dentro).

    Un proyecto BS tiene modelos 3D y configs de proyecto pero no tiene
    archivos .gcode ya generados.
    """
    try:
        with zipfile.ZipFile(src_path, "r") as z:
            names = z.namelist()
            tiene_modelos = any(n.endswith(".model") for n in names)
            tiene_gcode = any(n.endswith(".gcode") for n in names)
            tiene_proyecto = any(n == "Metadata/project_settings.config" for n in names)
            return tiene_modelos and tiene_proyecto and not tiene_gcode
    except Exception:
        return False


def _reexport_3mf_lib3mf(src_path: Path, dst_path: Path) -> tuple:
    """
    Re-exporta un .3mf fusionando todos los meshes en 1 solo objeto.

    Replica el comportamiento de FreeCAD Load3MF: lee todos los mesh objects,
    aplica sus transforms, y fusiona todos los vértices/triángulos en un
    único mesh compound. Esto produce un 3MF con 1 solo <object> que
    OrcaSlicer puede laminar sin crash (27 objetos superpuestos en 1 placa
    causan SIGSEGV en calc_exclude_triangles).

    Returns:
        Tupla (ruta_limpia_o_None, mensaje_debug).
    """
    try:
        wrapper = lib3mf.get_wrapper()
        src_model = wrapper.CreateModel()
        reader = src_model.QueryReader("3mf")
        reader.SetStrictModeActive(False)
        reader.ReadFromFile(str(src_path))

        # Fusionar todos los meshes en 1 compound (estilo FreeCAD).
        # Creamos el mesh destino directamente y le vamos agregando
        # vértices/triángulos de cada mesh fuente con offset.
        dst_model = wrapper.CreateModel()
        compound = dst_model.AddMeshObject()
        compound.SetName("model")

        vert_offset = 0
        mesh_count = 0
        total_tris = 0

        mesh_it = src_model.GetMeshObjects()
        while mesh_it.MoveNext():
            src_mesh = mesh_it.GetCurrentMeshObject()
            vert_count = src_mesh.GetVertexCount()
            tri_count = src_mesh.GetTriangleCount()

            if vert_count == 0 or tri_count == 0:
                continue

            # Copiar vértices directamente al compound
            for i in range(vert_count):
                compound.AddVertex(src_mesh.GetVertex(i))

            # Copiar triángulos con offset de vértices.
            # lib3mf usa ctypes: Triangle.Indices es c_uint_Array_3,
            # no acepta listas de Python.
            for i in range(tri_count):
                src_tri = src_mesh.GetTriangle(i)
                dst_tri = lib3mf.Triangle()
                dst_tri.Indices[0] = src_tri.Indices[0] + vert_offset
                dst_tri.Indices[1] = src_tri.Indices[1] + vert_offset
                dst_tri.Indices[2] = src_tri.Indices[2] + vert_offset
                compound.AddTriangle(dst_tri)

            vert_offset += vert_count
            total_tris += tri_count
            mesh_count += 1

        if mesh_count == 0:
            return None, "lib3mf: 0 meshes encontrados"

        dst_model.AddBuildItem(compound, wrapper.GetIdentityTransform())

        writer = dst_model.QueryWriter("3mf")
        writer.WriteToFile(str(dst_path))

        return dst_path, (
            f"lib3mf compound: {mesh_count} meshes fusionados → "
            f"1 objeto, {total_tris:,} triángulos"
        )

    except Exception as e:
        if dst_path.exists():
            dst_path.unlink()
        return None, f"lib3mf falló: {e}"


def _strip_3mf_manual(src_path: Path, dst_path: Path) -> tuple:
    """
    Fallback: limpieza manual por ZIP del 3MF de BambuStudio.

    Mantiene solo archivos de geometría (3D/, [Content_Types], _rels/) y
    limpia XML de namespaces/metadata de BS. No resuelve <components> pero
    OrcaSlicer puede cargar la geometría con la extensión de producción.

    Returns:
        Tupla (ruta_limpia_o_None, mensaje_debug).
    """
    KEEP_PREFIXES = ("[Content_Types].xml", "_rels/", "3D/")
    SKIP_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
    kept = []

    try:
        with zipfile.ZipFile(src_path, "r") as zin, \
             zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if not any(item.filename.startswith(p) for p in KEEP_PREFIXES):
                    continue
                ext = Path(item.filename).suffix.lower()
                if ext in SKIP_EXTS:
                    continue
                raw = zin.read(item.filename)
                if item.filename.endswith(".model"):
                    try:
                        text = raw.decode("utf-8")
                        # Limpiar custom_supports/seam/color paint data
                        text = re.sub(
                            r'<(?:\w+:)?custom_(?:supports|seam|color)\b[^/]*'
                            r'(?:/>|>[\s\S]*?</[^>]+>)',
                            '', text, flags=re.IGNORECASE)
                        if item.filename == "3D/3dmodel.model":
                            # Quitar metadata BambuStudio
                            text = re.sub(
                                r'\s*<metadata\s+name="[^"]*[Bb]ambu[^"]*">[^<]*</metadata>',
                                '', text)
                            text = re.sub(
                                r'\s*<metadata\s+name="Application">[^<]*</metadata>',
                                '', text)
                            # Quitar namespace BambuStudio del tag <model>
                            text = re.sub(
                                r'\s+xmlns:BambuStudio="[^"]*"', '', text)
                            # Quitar requiredextensions
                            text = re.sub(
                                r'\s+requiredextensions="[^"]*"', '', text,
                                flags=re.IGNORECASE)
                        raw = text.encode("utf-8")
                    except (UnicodeDecodeError, TypeError):
                        pass
                zout.writestr(item, raw)
                kept.append(item.filename)

        return dst_path, (
            f"manual strip: {len(kept)} archivos (solo geometría, sin Metadata BS)"
        )

    except Exception as e:
        if dst_path.exists():
            dst_path.unlink()
        return None, f"manual strip falló: {e}"


def _strip_3mf_to_geometry(src_path: Path) -> tuple:
    """
    Crea un 3MF limpio de un proyecto BambuStudio.

    Intenta lib3mf (C++, re-export completo) y si falla usa limpieza manual
    por ZIP como fallback.

    Args:
        src_path: Ruta al archivo .3mf original.

    Returns:
        Tupla (ruta_limpia_o_None, mensaje_debug).
    """
    dst_path = src_path.with_name(f"clean_{src_path.name}")

    # Intentar lib3mf primero (re-export completo, sin restos de BS)
    if HAS_LIB3MF:
        result, debug = _reexport_3mf_lib3mf(src_path, dst_path)
        if result:
            return result, debug
        print(f"[SLICER] {debug}, intentando fallback manual...", flush=True)

    # Fallback: limpieza manual por ZIP
    return _strip_3mf_manual(src_path, dst_path)


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


def _flatten_preset(name: str, profiles_dir: Path) -> dict:
    """Aplana la cadena 'inherits' de un preset BBL en un solo dict.

    OrcaSlicer 2.3.x crashea (SIGSEGV) al resolver cadenas "inherits" via
    CLI en update_values_to_printer_extruders_for_multiple_filaments.
    Aplanamos manualmente: cargamos parent recursivo, mergeamos, y eliminamos
    "inherits" para que OrcaSlicer reciba un JSON completo sin herencia.
    """
    path = profiles_dir / f"{name}.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    parent_name = data.pop("inherits", None)
    if parent_name:
        parent = _flatten_preset(parent_name, profiles_dir)
        parent.update(data)
        return parent
    return data


# Arrays que son listas legítimas de geometría/config, NO de extrusores.
# Estos NO se deben truncar a 1 elemento.
_KEEP_FULL_ARRAYS = {
    "printable_area", "bed_exclude_area", "wrapping_exclude_area",
    "upward_compatible_machine", "thumbnails",
}


def _single_extruder(preset: dict) -> dict:
    """Trunca arrays multi-extruder a 1 elemento para evitar SIGSEGV.

    Los presets BBL P2S definen 2 slots de extrusor (arrays de 2 elems)
    pero la P2S tiene 1 extrusor físico (nozzle_diameter: ["0.4"]).
    OrcaSlicer CLI crashea cuando extruder_count=1 pero encuentra
    arrays de >1 elemento (different_extruder=1 → SIGSEGV).
    """
    for key, val in preset.items():
        if key in _KEEP_FULL_ARRAYS:
            continue
        if isinstance(val, list) and len(val) > 1:
            preset[key] = [val[0]]
    return preset


def _write_flat_presets(
    output_dir: Path,
    nozzle: str = "0.4",
    process_name: Optional[str] = None,
) -> list[Path]:
    """Genera presets BBL aplanados (sin 'inherits') para OrcaSlicer CLI.

    Resuelve la cadena de herencia de los presets del repo (profiles/BBL),
    trunca arrays multi-extruder a 1 elemento, y renombra los presets
    para que OrcaSlicer no intente resolver herencia contra sus presets
    BBL internos (lo que causa SIGSEGV).

    Args:
        output_dir: Directorio donde escribir los JSONs.
        nozzle: Tamaño de boquilla ("0.2", "0.4", "0.6", "0.8").
        process_name: Nombre del process preset. Si es None, usa el
                      default para la boquilla.
    """
    machine_dir = BBL_PROFILES / "machine"
    process_dir = BBL_PROFILES / "process"

    preset_info = NOZZLE_PRESETS.get(nozzle, NOZZLE_PRESETS["0.4"])
    machine_name = preset_info["machine"]
    if process_name is None:
        process_name = preset_info["process"]

    paths = []
    flat_machine_name = f"TF P2S {nozzle}"

    # Machine aplanado + single extruder + nombre genérico
    if machine_dir.exists():
        flat_machine = _flatten_preset(machine_name, machine_dir)
        if flat_machine:
            flat_machine.pop("inherits", None)
            flat_machine["from"] = "system"
            flat_machine["name"] = flat_machine_name
            flat_machine["instantiation"] = "true"
            _single_extruder(flat_machine)
            p = output_dir / "machine_flat.json"
            p.write_text(json.dumps(flat_machine, indent=2))
            paths.append(p)

    # Process aplanado + single extruder + compatible con machine renombrado
    if process_dir.exists():
        flat_process = _flatten_preset(process_name, process_dir)
        if flat_process:
            flat_process.pop("inherits", None)
            flat_process["from"] = "system"
            flat_process["name"] = f"TF {process_name}"
            flat_process["instantiation"] = "true"
            flat_process["compatible_printers"] = [flat_machine_name]
            _single_extruder(flat_process)
            p = output_dir / "process_flat.json"
            p.write_text(json.dumps(flat_process, indent=2))
            paths.append(p)

    return paths


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

    # Para archivos .3mf: dos estrategias según el tipo
    effective_path = stl_path
    patched_path: Optional[Path] = None
    patch_debug = "sin parche (no es .3mf)"
    needs_presets = False
    print(f"[SLICER] recibido: {request.stl_filename} (job {request.job_id})", flush=True)

    if stl_path.suffix.lower() == ".3mf":
        if _es_proyecto_bs(stl_path):
            # Proyecto BS sin gcode: OrcaSlicer no puede cargar la estructura de
            # proyecto BS 2.5.x (0 objects, crash). Re-exportamos con lib3mf
            # (o fallback manual) para obtener un 3MF limpio. Se ejecuta en
            # thread para no bloquear el event loop de uvicorn.
            print(f"[SLICER] proyecto BS detectado, iniciando re-export...", flush=True)
            cleaned, patch_debug = await asyncio.to_thread(
                _strip_3mf_to_geometry, stl_path
            )
            print(f"[SLICER] re-export resultado: {patch_debug}", flush=True)
            if cleaned:
                patched_path = cleaned
                effective_path = patched_path
                needs_presets = True
        else:
            # 3MF genérico o con gcode parcial: parchear configs incompatibles
            patched, patch_debug = await asyncio.to_thread(
                _patch_3mf_params, stl_path
            )
            if patched:
                patched_path = patched
                effective_path = patched_path

    # OrcaSlicer 2.3.x CLI flags correctos (verificados en --help):
    #   --slice 0             → lamina todas las placas (0=all, N=placa N)
    #   --outputdir           → directorio de salida (NO es -o)
    #   --allow-newer-file    → acepta 3MF creados con versiones más recientes
    #   --load-settings       → "machine.json;process.json" de máquina/proceso
    #   --load-filaments      → "filament.json" de filamento
    cmd = [
        str(ORCA_BIN),
        "--slice", "0",
        "--allow-newer-file",
        "--no-check",
        "--debug", "5",
        "--outputdir", str(JOBS_DIR),
    ]

    # Presets para OrcaSlicer CLI:
    # Tanto proyectos BS re-exportados como STL necesitan presets aplanados.
    # _write_flat_presets() aplana la cadena de herencia BBL completa,
    # renombra con prefijo "TF" para evitar que OrcaSlicer resuelva herencia
    # por nombre contra sus presets internos (causa SIGSEGV por arrays
    # multi-extruder).
    settings_files: list[Path] = []
    if needs_presets or stl_path.suffix.lower() == ".stl":
        settings_files = _write_flat_presets(JOBS_DIR)
        if settings_files:
            cmd.extend([
                "--load-settings",
                ";".join(str(p) for p in settings_files),
            ])

    cmd.append(str(effective_path))

    print(f"[SLICER] cmd: {' '.join(cmd)}", flush=True)
    print(f"[SLICER] patch: {patch_debug}", flush=True)

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

        stdout_text = stdout.decode(errors="replace")
        stderr_text = stderr.decode(errors="replace")
        combined = (stdout_text + stderr_text).strip()

        # Log completo de OrcaSlicer para depuración
        # Con --debug 5 puede generar mucho output; mostrar inicio y final
        print(f"[SLICER] returncode: {proc.returncode}", flush=True)
        print(f"[SLICER] stdout ({len(stdout_text)} chars) FIRST 3000:\n{stdout_text[:3000]}", flush=True)
        if len(stdout_text) > 3000:
            print(f"[SLICER] stdout LAST 5000:\n{stdout_text[-5000:]}", flush=True)
        print(f"[SLICER] stderr ({len(stderr_text)} chars):\n{stderr_text[:3000]}", flush=True)

        if proc.returncode != 0:
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
                        f"Detalle: {combined[:2000]}\n[debug parche: {patch_debug}]"
                    ),
                )
            return SliceResponse(
                status="error",
                error_message=f"OrcaSlicer error (codigo {proc.returncode}): {combined[:4000]}\n[debug parche: {patch_debug}]",
            )

        # Buscar los gcodes generados (OrcaSlicer genera plate_N.gcode por placa)
        stem = stl_path.stem
        effective_stem = effective_path.stem
        gcode_files = sorted(JOBS_DIR.glob(f"*{request.job_id}*.gcode"))
        if not gcode_files:
            gcode_files = sorted(JOBS_DIR.glob(f"{stem}*.gcode"))
        if not gcode_files and effective_stem != stem:
            gcode_files = sorted(JOBS_DIR.glob(f"{effective_stem}*.gcode"))
        # Filtrar solo archivos .gcode (no .gcode.3mf)
        gcode_files = [f for f in gcode_files if not f.name.endswith(".3mf")]

        # Buscar .gcode.3mf (contiene todas las placas en un ZIP)
        output_3mf_files = list(JOBS_DIR.glob(f"*{request.job_id}*.gcode.3mf"))
        if not output_3mf_files:
            output_3mf_files = list(JOBS_DIR.glob(f"{stem}*.gcode.3mf"))
        if not output_3mf_files and effective_stem != stem:
            output_3mf_files = list(JOBS_DIR.glob(f"{effective_stem}*.gcode.3mf"))
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
