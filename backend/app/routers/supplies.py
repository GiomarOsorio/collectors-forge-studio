"""
Router para la gestión del catálogo de insumos adicionales.

Todos los endpoints filtran automáticamente por company_id del usuario
autenticado, garantizando el aislamiento multi-tenant: cada empresa solo
ve y gestiona sus propios insumos.

Endpoints disponibles bajo el prefijo /api/supplies:
- GET    /       - Lista los insumos de la empresa del usuario.
- POST   /       - Crea un nuevo insumo.
- PUT    /{id}   - Actualiza un insumo existente.
- DELETE /{id}   - Elimina un insumo del catálogo.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.supply import Supply
from app.schemas.supply import SupplyCreate, SupplyUpdate, SupplyResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/supplies", tags=["supplies"])

_6 = Decimal("0.000001")


def _compute_price_per_unit(
    pack_qty: Optional[int],
    pack_price: Optional[Decimal],
    price_per_unit: Optional[Decimal],
) -> Decimal:
    """
    Calcula el precio por unidad a partir de los datos del paquete.

    Si se dan pack_qty y pack_price, devuelve pack_price / pack_qty.
    Si no, usa price_per_unit directamente.
    Lanza ValueError si ninguna combinación es válida.
    """
    if pack_qty and pack_price is not None:
        if pack_qty <= 0:
            raise ValueError("La cantidad del paquete debe ser mayor que 0")
        return (pack_price / Decimal(pack_qty)).quantize(_6, rounding=ROUND_HALF_UP)
    if price_per_unit is not None:
        return price_per_unit
    raise ValueError("Debes proporcionar pack_qty + pack_price, o price_per_unit")


@router.get("/", response_model=list[SupplyResponse])
async def list_supplies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los insumos de la empresa del usuario, ordenados por nombre."""
    result = await db.execute(
        select(Supply)
        .where(Supply.company_id == current_user.company_id)
        .order_by(Supply.name)
    )
    return result.scalars().all()


@router.post("/", response_model=SupplyResponse, status_code=201)
async def create_supply(
    data: SupplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un nuevo insumo en el catálogo de la empresa del usuario.

    Si se proporcionan pack_qty y pack_price, calcula price_per_unit automáticamente.
    El company_id se asigna automáticamente desde el usuario autenticado.
    """
    try:
        computed_price = _compute_price_per_unit(data.pack_qty, data.pack_price, data.price_per_unit)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    payload = data.model_dump(exclude={"price_per_unit"})
    payload["price_per_unit"] = computed_price
    supply = Supply(**payload, company_id=current_user.company_id)
    db.add(supply)
    await db.commit()
    await db.refresh(supply)
    return supply


@router.put("/{supply_id}", response_model=SupplyResponse)
async def update_supply(
    supply_id: int,
    data: SupplyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza parcialmente un insumo de la empresa del usuario autenticado.

    Recalcula price_per_unit si se actualizan pack_qty o pack_price.
    """
    result = await db.execute(
        select(Supply).where(
            Supply.id == supply_id,
            Supply.company_id == current_user.company_id,
        )
    )
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    fields = data.model_dump(exclude_unset=True)

    new_pack_qty = fields.get("pack_qty", supply.pack_qty)
    new_pack_price = fields.get("pack_price", supply.pack_price)
    new_price_per_unit = fields.get("price_per_unit", supply.price_per_unit)

    if "pack_qty" in fields or "pack_price" in fields:
        try:
            fields["price_per_unit"] = _compute_price_per_unit(new_pack_qty, new_pack_price, new_price_per_unit)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    for field, value in fields.items():
        setattr(supply, field, value)
    await db.commit()
    await db.refresh(supply)
    return supply


@router.delete("/{supply_id}", status_code=204)
async def delete_supply(
    supply_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina un insumo de la empresa del usuario autenticado."""
    result = await db.execute(
        select(Supply).where(
            Supply.id == supply_id,
            Supply.company_id == current_user.company_id,
        )
    )
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")
    await db.delete(supply)
    await db.commit()
