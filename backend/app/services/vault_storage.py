"""
Cliente de almacenamiento para el Vault (MinIO vía boto3 S3-compatible).

Todas las operaciones de I/O se ejecutan en un hilo de sistema operativo
mediante asyncio.to_thread para no bloquear el event loop de FastAPI.

El cliente boto3 es síncrono por diseño; usamos functools.partial para
empaquetar las llamadas con sus argumentos y pasarlas a asyncio.to_thread.
"""

import asyncio
import logging
from functools import partial
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Crea un cliente boto3 S3 apuntando al endpoint MinIO configurado."""
    return boto3.client(
        "s3",
        endpoint_url=settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",  # MinIO ignora la región pero boto3 la requiere
    )


async def ensure_bucket() -> None:
    """
    Crea el bucket del Vault si todavía no existe.

    Se llama una sola vez en el lifespan de la aplicación. Si MinIO no
    está disponible se registra el error pero no se interrumpe el arranque.
    """
    def _create():
        client = _get_client()
        try:
            client.head_bucket(Bucket=settings.MINIO_BUCKET)
            logger.info("Vault bucket '%s' ya existe", settings.MINIO_BUCKET)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("404", "NoSuchBucket"):
                client.create_bucket(Bucket=settings.MINIO_BUCKET)
                logger.info("Vault bucket '%s' creado", settings.MINIO_BUCKET)
            else:
                raise

    try:
        await asyncio.to_thread(_create)
    except Exception as exc:
        logger.error("Error al verificar/crear bucket Vault: %s", exc)


async def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """
    Sube un objeto binario a MinIO.

    Args:
        key:          Clave del objeto (ruta dentro del bucket).
        data:         Contenido del archivo en bytes.
        content_type: MIME type del archivo.
    """
    def _upload():
        import io
        client = _get_client()
        client.upload_fileobj(
            io.BytesIO(data),
            settings.MINIO_BUCKET,
            key,
            ExtraArgs={"ContentType": content_type},
        )

    await asyncio.to_thread(_upload)


async def delete_file(key: str) -> None:
    """
    Elimina un objeto de MinIO. No lanza excepción si ya no existe.

    Args:
        key: Clave del objeto a eliminar.
    """
    def _delete():
        client = _get_client()
        try:
            client.delete_object(Bucket=settings.MINIO_BUCKET, Key=key)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code != "NoSuchKey":
                raise

    await asyncio.to_thread(_delete)


async def get_presigned_url(key: str, expires: int = 3600) -> str:
    """
    Genera una URL pre-firmada para descarga directa desde MinIO.

    Args:
        key:     Clave del objeto.
        expires: TTL de la URL en segundos (default 1 hora).

    Returns:
        URL pre-firmada como string.
    """
    def _presign():
        client = _get_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.MINIO_BUCKET, "Key": key},
            ExpiresIn=expires,
        )

    return await asyncio.to_thread(_presign)
