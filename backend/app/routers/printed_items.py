"""
Router de ítems de impresiones para Collector's Forge Studio.

Gestiona el CRUD de productos impresos en 3D del inventario: llaveros,
figuras, repuestos, etc.

La imagen de referencia del ítem se almacena en MinIO bajo la key
`prints/{uuid}.{ext}` (no en disk local). El frontend la consume vía el
endpoint proxy `GET /api/inventory/prints/{id}/image`, que streamea el
binario desde MinIO con caché HTTP de 24h.

Endpoints:
    GET    /api/inventory/prints/              — Listar ítems con paginación.
    POST   /api/inventory/prints/              — Crear un ítem.
    GET    /api/inventory/prints/{id}          — Obtener ítem por ID.
    PUT    /api/inventory/prints/{id}          — Actualizar un ítem.
    DELETE /api/inventory/prints/{id}          — Eliminar un ítem.
    POST   /api/inventory/prints/{id}/sell     — Registrar venta de unidades.
    POST   /api/inventory/prints/{id}/image    — Subir imagen del ítem.
    GET    /api/inventory/prints/{id}/image    — Servir imagen del ítem (binario).
"""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.printed_item import PrintedItem
from app.models.user import User
from app.services.formatters import IMAGE_MAGIC_CHECKS, IMAGE_EXT_MAP
from app.services.vault_storage import delete_file, download_file, upload_file
from app.schemas.printed_item import (
    PrintedItemCreate,
    PrintedItemImageResponse,
    PrintedItemListResponse,
    PrintedItemResponse,
    PrintedItemSellRequest,
    PrintedItemUpdate,
)
from app.services.auth import get_current_user, get_operator_user

logger = logging.getLogger(__name__)

# Límite de tamaño para imágenes subidas (M-06)
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

#: Prefix bajo el cual se guardan las imágenes en el bucket MinIO.
_IMAGE_PREFIX = "prints"

#: Map de extensión a media_type devuelto en el response del proxy.
_IMAGE_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

router = APIRouter(prefix="/api/inventory/prints", tags=["printed_items"])


def _to_response(item: PrintedItem) -> PrintedItemResponse:
    """
    Construye `PrintedItemResponse` mapeando `image_key` (interno MinIO) al
    `image_url` (URL proxy con cache-buster basado en `updated_at`).
    """
    image_url = None
    if item.image_key:
        ts = int(item.updated_at.timestamp()) if item.updated_at else 0
        image_url = f"/api/inventory/prints/{item.id}/image?v={ts}"
    return PrintedItemResponse(
        id=item.id,
        name=item.name,
        category=item.category,
        description=item.description,
        image_url=image_url,
        quantity=item.quantity,
        unit_price=item.unit_price,
        material=item.material,
        color=item.color,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _get_company_printed_item(
    db: AsyncSession, item_id: int
) -> PrintedItem:
    """Obtiene un ítem de impresión por ID. Lanza 404 si no existe."""
    result = await db.execute(
        select(PrintedItem).where(PrintedItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ítem de impresión no encontrado",
        )
    return item


@router.get("/", response_model=PrintedItemListResponse)
async def list_printed_items(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los ítems de impresión paginados (ordenados por created_at desc)."""
    base_query = select(PrintedItem)
    if category:
        base_query = base_query.where(PrintedItem.category == category)

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    items_result = await db.execute(
        base_query.order_by(PrintedItem.created_at.desc()).offset(skip).limit(limit)
    )
    items = items_result.scalars().all()

    return PrintedItemListResponse(
        items=[_to_response(it) for it in items],
        total=total,
    )


@router.post("/", response_model=PrintedItemResponse, status_code=status.HTTP_201_CREATED)
async def create_printed_item(
    data: PrintedItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Crea un nuevo ítem de impresión (la imagen se sube luego vía /image)."""
    item = PrintedItem(
        name=data.name,
        category=data.category,
        description=data.description,
        quantity=data.quantity,
        unit_price=data.unit_price,
        material=data.material,
        color=data.color,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.get("/{item_id}", response_model=PrintedItemResponse)
async def get_printed_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene un ítem de impresión por ID."""
    item = await _get_company_printed_item(db, item_id)
    return _to_response(item)


@router.put("/{item_id}", response_model=PrintedItemResponse)
async def update_printed_item(
    item_id: int,
    data: PrintedItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Actualiza un ítem (solo campos enviados; updated_at por ORM)."""
    item = await _get_company_printed_item(db, item_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printed_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Elimina un ítem; borra su imagen de MinIO best-effort."""
    item = await _get_company_printed_item(db, item_id)
    old_key = item.image_key
    await db.delete(item)
    await db.commit()
    if old_key:
        try:
            await delete_file(old_key)
        except Exception as exc:
            logger.debug("No se pudo borrar imagen %s: %s", old_key, exc)


@router.post("/{item_id}/sell", response_model=PrintedItemResponse)
async def sell_printed_item(
    item_id: int,
    data: PrintedItemSellRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """Decrementa el stock por unidades vendidas (400 si no alcanza)."""
    item = await _get_company_printed_item(db, item_id)

    new_quantity = item.quantity - data.quantity
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Disponible: {item.quantity}, solicitado: {data.quantity}",
        )

    item.quantity = new_quantity
    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.post("/{item_id}/image", response_model=PrintedItemImageResponse)
async def upload_printed_item_image(
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    """
    Sube la imagen del ítem a MinIO bajo la key `prints/{uuid}.{ext}`.

    El binario previo (si lo había) se borra best-effort. El response
    incluye la URL del proxy con cache-buster (`?v=<updated_at>`).
    """
    allowed_content_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido: {file.content_type}. "
                   f"Use JPEG, PNG, WebP o GIF.",
        )

    item = await _get_company_printed_item(db, item_id)

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagen demasiado grande (máx. 10 MB)",
        )
    check = IMAGE_MAGIC_CHECKS.get(file.content_type)
    if not content or (check and not check(content)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del archivo no corresponde a una imagen válida.",
        )

    extension = IMAGE_EXT_MAP.get(file.content_type, ".jpg")
    new_key = f"{_IMAGE_PREFIX}/{uuid.uuid4()}{extension}"

    old_key = item.image_key
    await upload_file(new_key, content, content_type=file.content_type)
    item.image_key = new_key
    await db.commit()
    await db.refresh(item)

    if old_key:
        try:
            await delete_file(old_key)
        except Exception as exc:
            logger.debug("No se pudo borrar imagen vieja %s: %s", old_key, exc)

    ts = int(item.updated_at.timestamp()) if item.updated_at else 0
    return PrintedItemImageResponse(
        image_url=f"/api/inventory/prints/{item.id}/image?v={ts}"
    )


@router.get("/{item_id}/image")
async def get_printed_item_image(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Streamea el binario de la imagen desde MinIO con caché HTTP de 24h.

    Endpoint **público** (sin JWT) porque los `<img>` tags del browser
    no pueden enviar el header `Authorization`. La imagen es una foto
    del producto, no info sensible. El cache-buster (`?v=<updated_at>`)
    invalida la caché cuando se sube una imagen nueva.
    """
    item = await _get_company_printed_item(db, item_id)
    if not item.image_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El ítem no tiene imagen cargada",
        )

    try:
        data = await download_file(item.image_key)
    except Exception as exc:
        logger.warning("No se pudo descargar imagen %s: %s", item.image_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Imagen no disponible en almacenamiento",
        ) from exc

    ext = "." + item.image_key.rsplit(".", 1)[-1].lower() if "." in item.image_key else ".jpg"
    media_type = _IMAGE_MEDIA_TYPES.get(ext, "image/jpeg")
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
