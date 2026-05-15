"""
Extractor de thumbnails embebidos en archivos .3mf.

OrcaSlicer/BambuStudio escriben un PNG de render de placa dentro del ZIP `.3mf`
en `Metadata/plate_N.png` al guardar el archivo. Este servicio abre el ZIP en
memoria, prioriza la placa activa si se conoce y, en su defecto, prueba los
fallbacks usados por bambuddy (`thumbnail.png`, `model_thumbnail.png`).

Los PNGs extraídos se guardan en `/app/static/thumbnails/{model_file_id}.png`
y se sirven vía StaticFiles montado en `/static`.
"""

import io
import logging
import re
import zipfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

#: Carpeta donde se persisten los PNG extraídos. Servida por StaticFiles en `/static`.
THUMBNAIL_DIR = Path("/app/static/thumbnails")

#: Rutas internas del ZIP que se intentan en orden cuando no se conoce la placa.
DEFAULT_CANDIDATES: tuple = (
    "Metadata/plate_1.png",
    "Metadata/thumbnail.png",
    "Metadata/model_thumbnail.png",
)

#: Patrón para detectar cualquier `Metadata/plate_<N>.png` como último recurso.
_PLATE_RE = re.compile(r"^Metadata/plate_\d+\.png$")


def extract_plate_png(zip_bytes: bytes, plate_number: Optional[int] = None) -> Optional[bytes]:
    """
    Extrae el primer PNG candidato de un `.3mf` (ZIP).

    Args:
        zip_bytes:     Contenido completo del archivo `.3mf` en memoria.
        plate_number:  Si se conoce, prioriza `Metadata/plate_{N}.png`.

    Returns:
        Bytes del PNG, o None si el ZIP no contiene ningún candidato.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            namelist = zf.namelist()
            ordered: list = []
            if plate_number is not None:
                ordered.append(f"Metadata/plate_{plate_number}.png")
            ordered.extend(DEFAULT_CANDIDATES)

            # Intentar los candidatos por nombre exacto
            seen = set()
            for path in ordered:
                if path in seen:
                    continue
                seen.add(path)
                if path in namelist:
                    return zf.read(path)

            # Último recurso: cualquier plate_<N>.png
            for name in namelist:
                if _PLATE_RE.match(name):
                    return zf.read(name)
    except (zipfile.BadZipFile, KeyError, OSError) as exc:
        logger.debug("No se pudo extraer thumbnail del .3mf: %s", exc)
    return None


def save_thumbnail(model_file_id: int, png_bytes: bytes) -> str:
    """
    Persiste los bytes PNG en disco y devuelve la URL relativa servida por StaticFiles.

    Args:
        model_file_id:  PK del `model_files` al que pertenece la imagen.
        png_bytes:      Contenido binario del PNG ya validado por `extract_plate_png`.

    Returns:
        Ruta relativa lista para usar en el campo `local_thumbnail_path`
        (por ejemplo `/static/thumbnails/42.png`).
    """
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    path = THUMBNAIL_DIR / f"{model_file_id}.png"
    path.write_bytes(png_bytes)
    return f"/static/thumbnails/{model_file_id}.png"


def delete_thumbnail(model_file_id: int) -> None:
    """Elimina el PNG local si existe (no-op silencioso si ya no está)."""
    path = THUMBNAIL_DIR / f"{model_file_id}.png"
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        logger.debug("No se pudo borrar thumbnail %s: %s", path, exc)
