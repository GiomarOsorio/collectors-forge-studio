"""
Router de trabajos de laminado 3D (Slicer) para TurtleForge Studio.

Gestiona la creación y consulta de trabajos de slicing. Soporta tres
fuentes de entrada: archivos ya laminados (.gcode/.3mf de Bambu Studio),
archivos STL para laminar con OrcaSlicer (contenedor interno), y URLs de
MakerWorld para extraer estimaciones publicadas por la comunidad.

El contenedor OrcaSlicer corre en la red interna de Podman y se comunica
mediante HTTP en el puerto 8001.

Endpoints:
    POST   /api/slicer/upload-gcode    — Subir .gcode o .3mf ya laminado
    POST   /api/slicer/upload-stl      — Subir STL para laminar con OrcaSlicer
    POST   /api/slicer/makerworld      — Extraer datos de URL de MakerWorld
    GET    /api/slicer/jobs            — Listar trabajos del usuario
    GET    /api/slicer/jobs/{id}       — Obtener trabajo por ID
    DELETE /api/slicer/jobs/{id}       — Eliminar trabajo
"""

import asyncio
import logging
import time
import uuid
import zipfile
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.slicing_job import SlicingJob
from app.models.user import User
from app.schemas.slicer import (
    MakerworldRequest,
    SlicingJobListResponse,
    SlicingJobResponse,
)
from app.limiter import limiter
from app.services.auth import get_current_user
from app.services.makerworld_fetcher import extract_model_id, fetch_model_data
from app.services.slicer_parser import parse_gcode_file, parse_3mf_file, parse_3mf_all_plates

router = APIRouter(prefix="/api/slicer", tags=["slicer"])

# Volumen compartido entre el backend y el contenedor OrcaSlicer
SLICER_JOBS_DIR = Path("/slicer_jobs")
try:
    SLICER_JOBS_DIR.mkdir(exist_ok=True)
except OSError:
    pass  # El directorio /slicer_jobs no existe en entorno de desarrollo

# URL del microservicio OrcaSlicer en la red interna de Podman
ORCA_SERVICE_URL = "http://calculator3d-slicer:8001"

# Presets por defecto para la BambuLab P2S
DEFAULT_PRINTER = "Bambu Lab P2S 0.4 nozzle"
DEFAULT_FILAMENT = "Bambu PLA Basic @BBL P2S"
DEFAULT_CONFIG = "0.20mm Standard @BBL P2S"

# Extensiones permitidas
ALLOWED_GCODE_EXTENSIONS = {".gcode", ".3mf"}
ALLOWED_STL_EXTENSIONS = {".stl", ".3mf", ".step", ".stp", ".obj", ".amf"}

# Límite de tamaño de archivo (M-06): protección DoS en acceso directo al puerto 8000
MAX_UPLOAD_BYTES = 250 * 1024 * 1024  # 250 MB, consistente con nginx client_max_body_size


def _plates_to_jsonb(plates: list) -> list:
    """Convierte lista de PlateResult a lista de dicts para JSONB."""
    result = []
    for p in plates:
        filaments = []
        if p.filaments:
            for f in p.filaments:
                filaments.append({
                    "filament_type": f.filament_type,
                    "colour_hex": f.colour_hex,
                    "weight_g": f.weight_g,
                    "length_m": f.length_m,
                })
        result.append({
            "plate_number": p.plate_number,
            "print_time_seconds": p.print_time_seconds,
            "filament_weight_g": p.filament_weight_g,
            "filament_type": p.filament_type,
            "layer_height_mm": p.layer_height_mm,
            "nozzle_temp": p.nozzle_temp,
            "bed_temp": p.bed_temp,
            "filaments": filaments,
            "objects": p.objects or [],
        })
    return result


def _aggregate_plates(plates: list) -> dict:
    """Calcula totales agregados de todas las placas para campos legacy."""
    total_time = 0
    total_weight = 0.0
    filament_type = None
    nozzle_temp = None
    bed_temp = None
    layer_height = None
    tipos = set()

    for p in plates:
        if p.print_time_seconds:
            total_time += p.print_time_seconds
        if p.filament_weight_g:
            total_weight += p.filament_weight_g
        if p.filament_type:
            tipos.add(p.filament_type)
        if nozzle_temp is None and p.nozzle_temp:
            nozzle_temp = p.nozzle_temp
        if bed_temp is None and p.bed_temp:
            bed_temp = p.bed_temp
        if layer_height is None and p.layer_height_mm:
            layer_height = p.layer_height_mm

    if len(tipos) == 1:
        filament_type = tipos.pop()
    elif tipos:
        filament_type = "/".join(sorted(tipos))

    return {
        "print_time_seconds": total_time if total_time > 0 else None,
        "filament_weight_g": round(total_weight, 2) if total_weight > 0 else None,
        "filament_type": filament_type,
        "nozzle_temp": nozzle_temp,
        "bed_temp": bed_temp,
        "layer_height_mm": layer_height,
    }


def _es_3mf_proyecto(file_path: Path) -> bool:
    """
    Detecta si un .3mf es un proyecto sin laminar (sin G-code embebido).

    Los .3mf de proyecto (exportados desde Bambu Studio sin laminar o
    descargados de MakerWorld) contienen la geometría 3D pero no el G-code.
    Los .3mf laminados contienen Metadata/plate_X.gcode dentro del ZIP.

    Args:
        file_path: Ruta al archivo .3mf.

    Returns:
        True si es un proyecto sin laminar, False en caso contrario.
    """
    try:
        with zipfile.ZipFile(str(file_path), "r") as zf:
            nombres = zf.namelist()
            tiene_modelo = any(
                n.lower().endswith(".model") or "3dmodel" in n.lower()
                for n in nombres
            )
            tiene_gcode = any(n.lower().endswith(".gcode") for n in nombres)
            return tiene_modelo and not tiene_gcode
    except Exception:
        return False


async def _get_company_slicing_job(
    db: AsyncSession, job_id: int, company_id
) -> SlicingJob:
    """
    Obtiene un SlicingJob verificando que pertenezca a la empresa.

    Args:
        db:         Sesión de base de datos.
        job_id:     ID del trabajo de laminado.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de SlicingJob si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(SlicingJob).where(
            SlicingJob.id == job_id,
            SlicingJob.company_id == company_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de laminado no encontrado",
        )
    return job


async def _run_orca_slicer(
    db_session_factory,
    job_id: int,
    company_id,
    stl_filename: str,
    printer_preset: str,
    filament_preset: str,
    config_preset: str,
) -> None:
    """
    Tarea de fondo que llama al microservicio OrcaSlicer y actualiza el job.

    Se ejecuta de forma asíncrona después de subir el STL. Actualiza el
    estado del SlicingJob a 'slicing', luego a 'done' o 'error' según
    el resultado del microservicio.

    Args:
        db_session_factory: Función para crear sesiones de DB.
        job_id:             ID del SlicingJob en la DB.
        company_id:         UUID de la empresa (para multi-tenant).
        stl_filename:       Nombre del archivo STL en el volumen compartido.
        printer_preset:     Perfil de impresora OrcaSlicer.
        filament_preset:    Perfil de filamento OrcaSlicer.
        config_preset:      Perfil de configuración OrcaSlicer.
    """
    from app.database import async_session

    async with async_session() as db:
        # Marcar como "slicing"
        result = await db.execute(
            select(SlicingJob).where(
                SlicingJob.id == job_id,
                SlicingJob.company_id == company_id,
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            return

        job.status = "slicing"
        await db.commit()

        # Llamar al microservicio OrcaSlicer
        try:
            async with httpx.AsyncClient(timeout=360.0) as client:
                resp = await client.post(
                    f"{ORCA_SERVICE_URL}/slice",
                    json={
                        "job_id": str(job_id),
                        "stl_filename": stl_filename,
                        "printer_preset": printer_preset,
                        "filament_preset": filament_preset,
                        "config_preset": config_preset,
                    },
                )
                data = resp.json()

            # Re-fetch para evitar condición de carrera (el job pudo ser eliminado
            # mientras esperábamos la respuesta del microservicio OrcaSlicer)
            r2 = await db.execute(
                select(SlicingJob).where(
                    SlicingJob.id == job_id,
                    SlicingJob.company_id == company_id,
                )
            )
            job = r2.scalar_one_or_none()
            if not job:
                return
            if data.get("status") == "done":
                job.status = "done"
                job.print_time_seconds = data.get("print_time_seconds")
                job.filament_weight_g = data.get("filament_weight_g")
                job.filament_type = data.get("filament_type")
                job.layer_height_mm = data.get("layer_height_mm")
                job.nozzle_temp = data.get("nozzle_temp")
                job.bed_temp = data.get("bed_temp")
            else:
                job.status = "error"
                job.error_message = data.get("error_message", "Error desconocido en OrcaSlicer")

        except httpx.ConnectError:
            r2 = await db.execute(
                select(SlicingJob).where(
                    SlicingJob.id == job_id,
                    SlicingJob.company_id == company_id,
                )
            )
            job = r2.scalar_one_or_none()
            if not job:
                return
            job.status = "error"
            job.error_message = (
                "No se pudo conectar al servicio de laminado (OrcaSlicer). "
                "Verifica que el contenedor 'slicer' esté corriendo."
            )
        except Exception as e:
            r2 = await db.execute(
                select(SlicingJob).where(
                    SlicingJob.id == job_id,
                    SlicingJob.company_id == company_id,
                )
            )
            job = r2.scalar_one_or_none()
            if not job:
                return
            job.status = "error"
            job.error_message = f"Error inesperado: {str(e)[:200]}"

        await db.commit()


@router.get("/cli-help")
async def slicer_cli_help(current_user: User = Depends(get_current_user)):
    """Proxea el output de OrcaSlicer --help desde el microservicio para depuración."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{ORCA_SERVICE_URL}/cli-help")
            return resp.json()
    except Exception as e:
        return {"error": str(e)}


@router.post("/upload-gcode", response_model=SlicingJobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def upload_gcode(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sube un archivo .gcode o .3mf ya laminado y extrae sus metadatos.

    El archivo debe haber sido generado por Bambu Studio u OrcaSlicer.
    Se parsean los comentarios de cabecera para obtener tiempo de impresión,
    gramos de filamento, temperatura y demás parámetros.

    Args:
        file:         Archivo .gcode o .3mf a parsear.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        SlicingJobResponse con los datos extraídos y status='done'.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo requerido")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_GCODE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión no permitida: {ext}. Usa .gcode o .3mf",
        )

    # Detectar source según extensión
    source = "upload_3mf" if ext == ".3mf" else "upload_gcode"

    # Guardar archivo en disco con nombre temporal (UUID) hasta obtener job.id
    # Path(...).name extrae solo el nombre base, eliminando cualquier ../ del path
    safe_filename = Path(file.filename).name
    job_uuid = str(uuid.uuid4())
    temp_path = SLICER_JOBS_DIR / f"{job_uuid}_{safe_filename}"
    contenido = await file.read()
    if len(contenido) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Archivo demasiado grande (máx. 250 MB)")
    temp_path.write_bytes(contenido)

    # Parsear metadatos
    plates_data_json = []
    if ext == ".3mf":
        plates = parse_3mf_all_plates(str(temp_path))
        if plates:
            plates_data_json = _plates_to_jsonb(plates)
            agg = _aggregate_plates(plates)
            resultado = type("R", (), agg)()  # objeto con atributos de los agregados
        else:
            resultado = None
    else:
        resultado = parse_gcode_file(str(temp_path))

    # Crear registro en DB
    if resultado is None and ext == ".3mf" and _es_3mf_proyecto(temp_path):
        error_msg = (
            "Este archivo es un proyecto .3mf sin laminar. "
            "Para usarlo: ábrelo en Bambu Studio, lámínalo y exporta el .3mf laminado. "
            "O sube el archivo directamente para laminarlo automáticamente con OrcaSlicer."
        )
    elif resultado is None:
        error_msg = "No se pudieron extraer metadatos. ¿Es un archivo laminado por Bambu Studio u OrcaSlicer?"
    else:
        error_msg = None

    job = SlicingJob(
        company_id=current_user.company_id,
        user_id=current_user.id,
        source=source,
        original_filename=file.filename,
        status="done" if resultado else "error",
        error_message=error_msg,
        plates_data=plates_data_json,
    )

    if resultado:
        job.print_time_seconds = resultado.print_time_seconds
        job.filament_weight_g = resultado.filament_weight_g
        job.filament_type = resultado.filament_type
        job.layer_height_mm = resultado.layer_height_mm
        job.nozzle_temp = resultado.nozzle_temp
        job.bed_temp = resultado.bed_temp

    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Renombrar archivo con job.id para que el glob de eliminación sea preciso (A-01)
    final_path = SLICER_JOBS_DIR / f"job{job.id}_{safe_filename}"
    temp_path.rename(final_path)

    return SlicingJobResponse.model_validate(job)


@router.post("/upload-stl", response_model=SlicingJobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def upload_stl(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    printer_preset: Optional[str] = Query(default=None),
    filament_preset: Optional[str] = Query(default=None),
    config_preset: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sube un archivo STL o .3mf crudo para laminar con OrcaSlicer.

    El laminado ocurre de forma asíncrona en el contenedor OrcaSlicer.
    El job se crea con status='pending' y el cliente debe hacer polling
    a GET /api/slicer/jobs/{id} para verificar cuando esté listo.

    Args:
        file:            Archivo STL o 3MF crudo a laminar.
        printer_preset:  Perfil de impresora (default: P2S 0.4 nozzle).
        filament_preset: Perfil de filamento (default: Bambu PLA Basic).
        config_preset:   Perfil de configuración (default: 0.20mm Standard).
        db:              Sesión de base de datos.
        current_user:    Usuario autenticado.

    Returns:
        SlicingJobResponse con status='pending'. El laminado sigue en segundo plano.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo requerido")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_STL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión no permitida: {ext}. Formatos aceptados: .stl .3mf .step .stp .obj .amf",
        )

    # Guardar en volumen compartido con nombre temporal (UUID) hasta obtener job.id
    # Path(...).name extrae solo el nombre base, eliminando cualquier ../ del path
    safe_filename = Path(file.filename).name
    job_uuid = str(uuid.uuid4())
    temp_path = SLICER_JOBS_DIR / f"{job_uuid}_{safe_filename}"
    contenido = await file.read()
    if len(contenido) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Archivo demasiado grande (máx. 250 MB)")
    temp_path.write_bytes(contenido)

    # Presets con valores por defecto
    p_preset = printer_preset or DEFAULT_PRINTER
    f_preset = filament_preset or DEFAULT_FILAMENT
    c_preset = config_preset or DEFAULT_CONFIG

    # Fuente según extensión del archivo
    source_map = {
        ".3mf":  "upload_3mf",
        ".step": "upload_step",
        ".stp":  "upload_step",
        ".obj":  "upload_obj",
        ".amf":  "upload_amf",
    }
    source = source_map.get(ext, "upload_stl")

    # Crear job en DB
    job = SlicingJob(
        company_id=current_user.company_id,
        user_id=current_user.id,
        source=source,
        original_filename=file.filename,
        status="pending",
        printer_preset=p_preset,
        filament_preset=f_preset,
        config_preset=c_preset,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Renombrar archivo con job.id para que el glob de eliminación sea preciso (A-01)
    stl_filename = f"job{job.id}_{safe_filename}"
    temp_path.rename(SLICER_JOBS_DIR / stl_filename)

    # Lanzar tarea de fondo
    background_tasks.add_task(
        _run_orca_slicer,
        None,  # no se usa, se obtiene internamente
        job.id,
        current_user.company_id,
        stl_filename,
        p_preset,
        f_preset,
        c_preset,
    )

    return SlicingJobResponse.model_validate(job)


@router.post("/makerworld", response_model=SlicingJobResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def fetch_makerworld(
    request: Request,
    payload: MakerworldRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Extrae estimaciones de impresión de un modelo de MakerWorld.

    Obtiene tiempo estimado y uso de filamento de la página pública del
    modelo. Los datos corresponden al perfil publicado por el creador del
    modelo en MakerWorld, no a la configuración personal del usuario.

    Args:
        request:      Objeto con la URL del modelo en MakerWorld.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        SlicingJobResponse con los datos extraídos (status='done') o
        con status='error' si no fue posible obtener los datos.
    """
    model_id = extract_model_id(payload.url)
    if not model_id:
        raise HTTPException(
            status_code=400,
            detail="URL de MakerWorld no válida. Formato esperado: makerworld.com/en/models/XXXXX",
        )

    # B-03: fetch_model_data usa httpx.Client() síncrono; ejecutar en thread
    # para no bloquear el event loop de FastAPI.
    datos = await asyncio.to_thread(fetch_model_data, model_id)

    job = SlicingJob(
        company_id=current_user.company_id,
        user_id=current_user.id,
        source="makerworld",
        makerworld_url=payload.url,
        makerworld_model_id=model_id,
        original_filename=datos.model_name if datos else None,
    )

    if datos:
        job.status = "done"
        job.print_time_seconds = datos.print_time_seconds
        job.filament_weight_g = datos.filament_weight_g
        job.filament_type = datos.filament_type
    else:
        job.status = "error"
        job.error_message = (
            "No se pudieron obtener datos de MakerWorld. "
            "La página puede requerir autenticación o el modelo no tiene perfil de impresión."
        )

    db.add(job)
    await db.commit()
    await db.refresh(job)
    return SlicingJobResponse.model_validate(job)


@router.get("/jobs", response_model=SlicingJobListResponse)
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """
    Lista los trabajos de laminado de la empresa, ordenados por fecha.

    Args:
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.
        page:         Número de página (1-indexed).
        per_page:     Registros por página.

    Returns:
        SlicingJobListResponse con los jobs y el total.
    """
    # Total
    total_result = await db.execute(
        select(func.count(SlicingJob.id)).where(
            SlicingJob.company_id == current_user.company_id
        )
    )
    total = total_result.scalar_one()

    # Listado con paginación page/per_page
    offset = (page - 1) * per_page
    result = await db.execute(
        select(SlicingJob)
        .where(SlicingJob.company_id == current_user.company_id)
        .order_by(SlicingJob.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    jobs = result.scalars().all()

    return SlicingJobListResponse(
        items=[SlicingJobResponse.model_validate(j) for j in jobs],
        total=total,
    )


@router.get("/jobs/{job_id}", response_model=SlicingJobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene el detalle de un trabajo de laminado por ID.

    Usado por el frontend para hacer polling del status de un job async.

    Args:
        job_id:       ID del trabajo de laminado.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        SlicingJobResponse con el estado actual del job.
    """
    job = await _get_company_slicing_job(db, job_id, current_user.company_id)
    return SlicingJobResponse.model_validate(job)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina un trabajo de laminado y el archivo STL en disco si existe.

    Args:
        job_id:       ID del trabajo a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.
    """
    job = await _get_company_slicing_job(db, job_id, current_user.company_id)

    # Eliminar archivos en disco asociados al job (A-01: patrón preciso con job.id)
    for archivo in SLICER_JOBS_DIR.glob(f"job{job_id}_*"):
        try:
            archivo.unlink()
        except Exception:
            pass

    await db.delete(job)
    await db.commit()


# ── Limpieza periódica de archivos slicer ─────────────────────────────────────

_SLICER_FILE_TTL_DAYS = 7


async def cleanup_old_slicer_files() -> int:
    """
    Elimina archivos del directorio SLICER_JOBS_DIR con más de 7 días de antigüedad.

    Los archivos temporales de slicing (gcode, stl, 3mf) pueden acumularse si
    el usuario no los elimina explícitamente. Esta función se llama periódicamente
    desde el lifespan de la aplicación.

    Returns:
        int: Número de archivos eliminados.
    """
    if not SLICER_JOBS_DIR.exists():
        return 0

    cutoff = time.time() - _SLICER_FILE_TTL_DAYS * 24 * 3600
    count = 0
    for archivo in SLICER_JOBS_DIR.iterdir():
        try:
            if archivo.is_file() and archivo.stat().st_mtime < cutoff:
                archivo.unlink()
                count += 1
                logger.debug("Slicer cleanup: eliminado %s", archivo.name)
        except OSError as e:
            logger.warning("Slicer cleanup: error al eliminar %s: %s", archivo.name, e)

    if count:
        logger.info("Slicer cleanup: %d archivos eliminados (TTL %d días)", count, _SLICER_FILE_TTL_DAYS)
    return count
