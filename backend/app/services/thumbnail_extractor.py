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
    Devuelve la key canónica en MinIO para el thumbnail principal de un
    `ModelFile`. Por defecto apunta al plate activo (issue #68).

    No hace I/O — es solo la convención de naming. La key es
    `thumbnails/{id}.png` dentro del bucket configurado en
    `MINIO_BUCKET` (`cfs-models`).
    """
    return f"{_THUMB_PREFIX}/{model_file_id}.png"


def thumbnail_key_for_plate(model_file_id: int, plate_index: int) -> str:
    """
    Key MinIO del thumbnail de un plate específico (issue #68).

    Formato: `thumbnails/{model_file_id}_plate{plate_index}.png`.
    El plate activo replica adicionalmente bajo `thumbnails/{id}.png`
    para mantener el endpoint legacy `GET /api/vault/{id}/thumbnail`.
    """
    return f"{_THUMB_PREFIX}/{model_file_id}_plate{plate_index}.png"


def extract_all_plates_pngs(zip_bytes: bytes) -> dict:
    """
    Extrae TODOS los plate PNGs de un `.3mf` (ZIP). Issue #68.

    Returns:
        dict {plate_index (0-based): png_bytes}. Dict vacío si no se
        encuentran. `Metadata/plate_N.png` → plate_index N-1 (los
        slicers numeran desde 1; nosotros 0-based para coincidir con
        `ModelFile.active_plate_index`).
    """
    out: dict = {}
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in zf.namelist():
                m = re.match(r"^Metadata/plate_(\d+)\.png$", name)
                if not m:
                    continue
                idx = int(m.group(1)) - 1  # 1-based → 0-based
                if idx >= 0 and idx not in out:
                    out[idx] = zf.read(name)
            # Fallback adicional para archivos sin numeración
            if not out:
                for fallback in ("Metadata/thumbnail.png", "Metadata/model_thumbnail.png"):
                    if fallback in zf.namelist():
                        out[0] = zf.read(fallback)
                        break
    except (zipfile.BadZipFile, OSError) as exc:
        logger.debug("No se pudieron extraer plates del .3mf: %s", exc)
    return out


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
    Sube los bytes PNG del thumbnail principal a MinIO y devuelve la key.

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


async def save_plate_thumbnail(model_file_id: int, plate_index: int, png_bytes: bytes) -> str:
    """Sube el thumbnail de un plate específico (issue #68)."""
    key = thumbnail_key_for_plate(model_file_id, plate_index)
    await upload_file(key, png_bytes, content_type="image/png")
    return key


async def copy_plate_to_primary(model_file_id: int, png_bytes: bytes) -> str:
    """
    Sincroniza el thumbnail del plate activo al slot principal
    (`thumbnails/{id}.png`) para que el endpoint legacy
    `GET /api/vault/{id}/thumbnail` siga funcionando.
    """
    key = thumbnail_key(model_file_id)
    await upload_file(key, png_bytes, content_type="image/png")
    return key


async def delete_thumbnail(model_file_id: int) -> None:
    """Borra el thumbnail principal de MinIO (no-op si ya no existe)."""
    key = thumbnail_key(model_file_id)
    try:
        await delete_file(key)
    except Exception as exc:
        logger.debug("No se pudo borrar thumbnail %s: %s", key, exc)


async def delete_plate_thumbnail(model_file_id: int, plate_index: int) -> None:
    """Borra el thumbnail de un plate específico (issue #68)."""
    key = thumbnail_key_for_plate(model_file_id, plate_index)
    try:
        await delete_file(key)
    except Exception as exc:
        logger.debug("No se pudo borrar plate thumbnail %s: %s", key, exc)
