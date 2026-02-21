"""
Router de ítems de impresiones para TurtleForge Cost.

Gestiona el CRUD de productos impresos en 3D del inventario de la empresa:
llaveros, figuras, repuestos, etc. Todos los endpoints filtran por
company_id del usuario autenticado (multi-tenant).

Endpoints:
    GET    /api/inventory/prints/              — Listar ítems con paginación.
    POST   /api/inventory/prints/              — Crear un ítem.
    GET    /api/inventory/prints/{id}          — Obtener ítem por ID.
    PUT    /api/inventory/prints/{id}          — Actualizar un ítem.
    DELETE /api/inventory/prints/{id}          — Eliminar un ítem.
    POST   /api/inventory/prints/{id}/sell     — Registrar venta de unidades.
    POST   /api/inventory/prints/{id}/image    — Subir imagen del ítem.
"""

import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.printed_item import PrintedItem
from app.models.user import User
from app.schemas.printed_item import (
    PrintedItemCreate,
    PrintedItemImageResponse,
    PrintedItemListResponse,
    PrintedItemResponse,
    PrintedItemSellRequest,
    PrintedItemUpdate,
)
from app.services.auth import get_current_user

# Directorio donde se guardan las imágenes de los ítems de impresión
PRINTS_IMAGE_DIR = Path("/app/static/prints")

router = APIRouter(prefix="/api/inventory/prints", tags=["printed_items"])


async def _get_company_printed_item(
    db: AsyncSession, item_id: int, company_id
) -> PrintedItem:
    """
    Obtiene un ítem de impresión verificando que pertenezca a la empresa.

    Args:
        db:         Sesión de base de datos.
        item_id:    ID del ítem de impresión.
        company_id: UUID de la empresa del usuario autenticado.

    Returns:
        Instancia de PrintedItem si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe o no pertenece a la empresa.
    """
    result = await db.execute(
        select(PrintedItem).where(
            PrintedItem.id == item_id,
            PrintedItem.company_id == company_id,
        )
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
    """
    Lista los ítems de impresión de la empresa con paginación.

    Filtra opcionalmente por categoría. Los resultados se ordenan por
    fecha de creación descendente (más recientes primero).

    Args:
        skip:         Número de ítems a omitir (para paginación).
        limit:        Máximo de ítems a retornar (default 20, max 100).
        category:     Categoría para filtrar (opcional). Ej: "Llaveros".
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemListResponse con la lista paginada y el total de ítems.
    """
    base_query = select(PrintedItem).where(
        PrintedItem.company_id == current_user.company_id
    )
    if category:
        base_query = base_query.where(PrintedItem.category == category)

    # Contar el total antes de aplicar paginación
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    # Aplicar ordenamiento y paginación
    items_result = await db.execute(
        base_query.order_by(PrintedItem.created_at.desc()).offset(skip).limit(limit)
    )
    items = items_result.scalars().all()

    return PrintedItemListResponse(items=list(items), total=total)


@router.post("/", response_model=PrintedItemResponse, status_code=status.HTTP_201_CREATED)
async def create_printed_item(
    data: PrintedItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un nuevo ítem de impresión en el inventario de la empresa.

    Args:
        data:         Datos del ítem a crear.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemResponse con los datos del ítem creado.
    """
    item = PrintedItem(
        company_id=current_user.company_id,
        name=data.name,
        category=data.category,
        description=data.description,
        image_url=data.image_url,
        quantity=data.quantity,
        unit_price=data.unit_price,
        material=data.material,
        color=data.color,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=PrintedItemResponse)
async def get_printed_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene un ítem de impresión por ID.

    Args:
        item_id:      ID del ítem.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemResponse si existe y pertenece a la empresa.

    Raises:
        HTTPException 404: Si no existe.
    """
    return await _get_company_printed_item(db, item_id, current_user.company_id)


@router.put("/{item_id}", response_model=PrintedItemResponse)
async def update_printed_item(
    item_id: int,
    data: PrintedItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza un ítem de impresión existente.

    Solo actualiza los campos que se envíen (exclude_unset=True). El campo
    updated_at se actualiza automáticamente por el ORM (onupdate).

    Args:
        item_id:      ID del ítem a actualizar.
        data:         Datos parciales de actualización.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemResponse con los datos actualizados.

    Raises:
        HTTPException 404: Si no existe.
    """
    item = await _get_company_printed_item(db, item_id, current_user.company_id)

    # Actualizar solo los campos que se enviaron (exclude_unset=True)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printed_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina un ítem de impresión por ID.

    Si el ítem tiene una imagen asociada, la imagen NO se elimina del
    sistema de archivos (puede ser referenciada por otros registros o
    gestionarse externamente).

    Args:
        item_id:      ID del ítem a eliminar.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Raises:
        HTTPException 404: Si no existe.
    """
    item = await _get_company_printed_item(db, item_id, current_user.company_id)
    await db.delete(item)
    await db.commit()


@router.post("/{item_id}/sell", response_model=PrintedItemResponse)
async def sell_printed_item(
    item_id: int,
    data: PrintedItemSellRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registra la venta de unidades de un ítem de impresión.

    Decrementa la cantidad en stock según las unidades vendidas. Si el
    stock resultante sería negativo, retorna un error 400.

    Args:
        item_id:      ID del ítem a vender.
        data:         Objeto con el campo quantity (entero positivo).
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemResponse con la cantidad de stock actualizada.

    Raises:
        HTTPException 404: Si el ítem no existe.
        HTTPException 400: Si el stock es insuficiente para la venta.
    """
    item = await _get_company_printed_item(db, item_id, current_user.company_id)

    new_quantity = item.quantity - data.quantity
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Disponible: {item.quantity}, solicitado: {data.quantity}",
        )

    item.quantity = new_quantity
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{item_id}/image", response_model=PrintedItemImageResponse)
async def upload_printed_item_image(
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sube una imagen de referencia para un ítem de impresión.

    Guarda el archivo en /app/static/prints/ con un UUID como nombre para
    evitar colisiones. Actualiza el campo image_url del ítem con la ruta
    relativa al directorio estático.

    Args:
        item_id:      ID del ítem al que se asocia la imagen.
        file:         Archivo de imagen enviado como multipart/form-data.
        db:           Sesión de base de datos.
        current_user: Usuario autenticado.

    Returns:
        PrintedItemImageResponse con la URL relativa de la imagen guardada.

    Raises:
        HTTPException 404: Si el ítem no existe.
        HTTPException 400: Si el tipo de archivo no es una imagen permitida.
    """
    # Validar content-type declarado (primera línea de defensa)
    allowed_content_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido: {file.content_type}. "
                   f"Use JPEG, PNG, WebP o GIF.",
        )

    item = await _get_company_printed_item(db, item_id, current_user.company_id)

    # Leer contenido y validar magic bytes reales (segunda línea de defensa)
    # Evita que un atacante suba un archivo ejecutable con Content-Type: image/jpeg
    content = await file.read()
    _MAGIC_CHECKS = {
        "image/jpeg": lambda c: c[:3] == b"\xff\xd8\xff",
        "image/png":  lambda c: c[:4] == b"\x89PNG",
        "image/webp": lambda c: c[:4] == b"RIFF" and len(c) >= 12 and c[8:12] == b"WEBP",
        "image/gif":  lambda c: c[:6] in (b"GIF87a", b"GIF89a"),
    }
    check = _MAGIC_CHECKS.get(file.content_type)
    if not content or (check and not check(content)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del archivo no corresponde a una imagen válida.",
        )

    # Crear el directorio de imágenes si no existe
    PRINTS_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Generar nombre único con UUID conservando la extensión original
    extension = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{extension}"
    file_path = PRINTS_IMAGE_DIR / filename

    # Guardar el archivo en disco (content ya leído arriba)
    file_path.write_bytes(content)

    # Actualizar la URL de la imagen en el registro
    image_url = f"/static/prints/{filename}"
    item.image_url = image_url
    await db.commit()
    await db.refresh(item)

    return PrintedItemImageResponse(image_url=image_url)
