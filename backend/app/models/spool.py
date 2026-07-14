"""
Modelo ORM para bobinas físicas individuales de filamento (issue #134).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
solo el concepto de tracking por-bobina; el modelo en sí es propio de CFS
(bambuddy delega esto a una integración externa con Spoolman + hardware
NFC/AMS, fuera de alcance aquí).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Spool(Base):
    """
    Bobina física individual de filamento, hija de un `InventoryItem` de
    categoría Filamento.

    ## Regla de sincronía con el stock agregado (`InventoryItem.quantity`)

    `InventoryItem.quantity` para un ítem de categoría Filamento se mide
    en **gramos agregados** (no en "cantidad de rollos" — confirmado en
    `_deduct_inventory_and_update_printer`/`_deduct_vault_item`, que
    restan `weight_grams` directamente sin ninguna conversión). La
    sincronía con las bobinas es **boundary-only**, deliberadamente NO en
    tiempo real:

    - **Alta de bobina**: por defecto NO toca `quantity` del padre (las
      bobinas normalmente se crean para trackear en detalle stock que YA
      estaba contado en el agregado). Si el usuario marca "sumar al
      stock" (compra nueva), se suma `initial_weight_g` por bobina creada.
    - **Consumo** (marcar un `PrintQueueItem` con `spool_id` asignado
      como `done`): descuenta `weight_grams × quantity` SOLO de
      `remaining_weight_g` de la bobina. `InventoryItem.quantity` del
      padre **NO se mueve** en este paso — el descuento agregado normal
      (`_deduct_vault_item`) se **omite por completo** para ese item
      (evita doble descuento).
    - **Agotamiento** (`remaining_weight_g` llega a 0): `status` pasa a
      `finished`, `finished_at=now`, y **recién ahí** se resta
      `initial_weight_g` (no `remaining_weight_g`, que ya está en ~0) de
      `InventoryItem.quantity` — la bobina física completa deja de
      existir en el agregado.

    **Consecuencia deliberada**: mientras una bobina está `active` y
    parcialmente consumida, `InventoryItem.quantity` queda
    desactualizado respecto al total real restante (se actualiza recién
    al agotarse, no gramo a gramo). Para ver el remanente real de un
    ítem que ya usa bobinas, hay que mirar la suma de
    `remaining_weight_g` de sus bobinas activas, no el agregado del
    padre. Trade-off aceptado a cambio de simplicidad — decisión
    documentada en agent-docs/bambuddy-sync/134-spools.md.

    Atributos:
        id:                  PK autoincremental.
        inventory_item_id:   FK al ítem de inventario padre (CASCADE).
        label_code:          Código corto único para etiquetas físicas (ej. "SP-0042").
        initial_weight_g:    Peso al abrir la bobina (gramos).
        remaining_weight_g:  Peso restante actual (gramos).
        cost:                Costo de esta bobina específica; NULL hereda `unit_cost` del padre.
        extra_colors:        `{"stops": ["RRGGBB", ...]}` para gradientes/multi-color. NULL = color sólido (usa `color_hex` del padre).
        visual_effect:       Uno de: sparkle, wood, marble, glow, matte, silk, galaxy, rainbow, metal, translucent, gradient, dual-color, tri-color, multicolor. NULL = sin efecto.
        status:              'active' | 'finished' | 'archived'.
        opened_at:           Cuándo se empezó a usar (opcional, informativo).
        finished_at:         Cuándo se agotó (poblado automáticamente al llegar a 0g).
        notes:                Notas libres (ej. "pesé la bobina: 340g").
        created_at/updated_at: Timestamps UTC.
    """

    __tablename__ = "spools"
    __table_args__ = (
        UniqueConstraint("label_code", name="uq_spools_label_code"),
        CheckConstraint(
            "status IN ('active', 'finished', 'archived')", name="ck_spools_status"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inventory_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_code: Mapped[str] = mapped_column(String(12), nullable=False)
    initial_weight_g: Mapped[Decimal] = mapped_column(Numeric(8, 1), nullable=False)
    remaining_weight_g: Mapped[Decimal] = mapped_column(Numeric(8, 1), nullable=False)
    cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    extra_colors: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    visual_effect: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default=text("'active'"))
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    @property
    def percent_remaining(self) -> float:
        """% restante respecto al peso inicial — 0 si initial_weight_g es 0 (evita división por cero)."""
        if not self.initial_weight_g:
            return 0.0
        pct = float(self.remaining_weight_g) / float(self.initial_weight_g) * 100
        return max(0.0, min(100.0, pct))
