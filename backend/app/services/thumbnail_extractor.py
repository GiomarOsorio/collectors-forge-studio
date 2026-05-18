"""
Extractor + storage de thumbnails embebidos en archivos `.3mf` / `.gcode.3mf`.

OrcaSlicer/BambuStudio escriben un PNG de plate render dentro del ZIP en
`Metadata/plate_N.png` al guardar el archivo. Este servicio:

  1. Abre el ZIP en memoria y extrae el primer PNG candidato disponible
     (prioriza la placa activa si se conoce, sino `plate_1.png`,
     `thumbnail.png`, `model_thumbnail.png`, o cualquier `plate_<N>.png`).
  2. Sube el PNG a MinIO bajo la key `thumbnails/{model_file_id}.png`.

Los thumbnails se sirven al frontend vía el endpoint proxy
`GET /api/vault/{id}/thumbnail` (no por StaticFiles).
"""

import io
import logging
import re
import zipfile
from typing import Optional

from app.services.vault_storage import delete_file, upload_file

logger = logging.getLogger(__name__)

#: Prefix bajo el cual se guardan los thumbnails dentro del bucket MinIO.
_THUMB_PREFIX = "thumbnails"

#: Rutas internas del ZIP que se intentan en orden cuando no se conoce la placa.
DEFAULT_CANDIDATES: tuple = (
    "Metadata/plate_1.png",
    "Metadata/thumbnail.png",
    "Metadata/model_thumbnail.png",
)

#: Patrón para detectar cualquier `Metadata/plate_<N>.png` como último recurso.
_PLATE_RE = re.compile(r"^Metadata/plate_\d+\.png$")


def thumbnail_key(model_file_id: int) -> str:
    """
    Devuelve la key canónica en MinIO para el thumbnail de un `ModelFile`.

    No hace I/O — es solo la convención de naming. La key es
    `thumbnails/{id}.png` dentro del bucket configurado en
    `MINIO_BUCKET` (`cfs-models`).
    """
    return f"{_THUMB_PREFIX}/{model_file_id}.png"


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


async def save_thumbnail(model_file_id: int, png_bytes: bytes) -> str:
    """
    Sube los bytes PNG a MinIO y devuelve la key resultante.

    Args:
        model_file_id:  PK del `model_files` al que pertenece la imagen.
        png_bytes:      Contenido binario del PNG ya validado por `extract_plate_png`.

    Returns:
        Key MinIO (ej. `thumbnails/42.png`). El caller la persiste en
        `ModelFile.thumbnail_key`. Para servirlo al frontend, el router
        del Vault expone `GET /api/vault/{id}/thumbnail` que descarga
        este objeto.
    """
    key = thumbnail_key(model_file_id)
    await upload_file(key, png_bytes, content_type="image/png")
    return key


async def delete_thumbnail(model_file_id: int) -> None:
    """Borra el thumbnail de MinIO (no-op silencioso si ya no existe)."""
    key = thumbnail_key(model_file_id)
    try:
        await delete_file(key)
    except Exception as exc:
        logger.debug("No se pudo borrar thumbnail %s: %s", key, exc)
