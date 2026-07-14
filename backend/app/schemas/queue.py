"""
Schemas Pydantic para la cola de impresión (Queue).

Soporta dos fuentes de items:
- **Quote** (camino histórico): `quote` snapshot embebido en la respuesta.
- **Vault** (chunk C): `vault` snapshot embebido en la respuesta.

Cada response trae uno de los dos no-nulo (los items pre-existentes solo
traen `quote`; los nuevos desde el picker traen `vault`).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, PlainSerializer, model_validator

#: Categorías de motivo de fallo (issue #130) — alimentan el historial
#: por modelo del Vault y el futuro epic de Stats.
FailureCategory = Literal[
    "adhesion", "clog", "filament_runout", "power_loss", "layer_shift", "other"
]

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class PrintQueueItemCreate(BaseModel):
    """Datos requeridos para agregar un ítem desde un Quote existente."""

    quote_id: int
    notes: Optional[str] = None
    project_id: Optional[int] = None


class PrintQueueItemFromVaultCreate(BaseModel):
    """
    Datos requeridos para agregar un ítem desde un `ModelFile` con
    `.gcode.3mf`. El backend lee `sliced_weight_g`/`sliced_time_seconds`
    del modelo y los denormaliza en el `PrintQueueItem`.
    """

    vault_model_id: int
    printer_id: int
    filament_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1, le=999)
    notes: Optional[str] = None
    project_id: Optional[int] = None
    #: Si True y quantity > 1, crea `quantity` items independientes
    #: (quantity=1 cada uno) compartiendo un `batch_id` autogenerado, en
    #: vez de un solo item con quantity=N. Permite repartir copias entre
    #: impresoras/horarios distintos (issue #133).
    split_copies: bool = False


class QueueQuoteSnapshot(BaseModel):
    """Info de la cotización embebida en la respuesta (camino Quote)."""

    id: int
    piece_name: str
    printer_id: int
    printer_name: str
    weight_grams: float
    print_time_hours: float
    quantity: int
    total_price: float


class QueueVaultSnapshot(BaseModel):
    """
    Info del modelo del Vault embebida en la respuesta (camino Vault).

    No incluye `total_price` porque los items que vienen del Vault no
    pasaron por la calculadora — solo conocemos los parámetros físicos
    de impresión.
    """

    vault_model_id: int
    name: str  # piece_name
    printer_id: Optional[int]
    printer_name: Optional[str]
    filament_id: Optional[int]
    filament_name: Optional[str]
    sliced_filament_type: Optional[str] = None
    weight_grams: Optional[DecimalAsFloat]
    print_time_hours: Optional[DecimalAsFloat]
    quantity: int
    print_file_name: Optional[str] = None


class PrintQueueItemResponse(BaseModel):
    """Respuesta completa de un ítem de la cola de impresión."""

    id: int
    quote_id: Optional[int]
    vault_model_id: Optional[int] = None
    project_id: Optional[int] = None
    status: str
    position: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    failure_reason: Optional[str] = None
    failure_category: Optional[FailureCategory] = None
    batch_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    #: Calculado (no vive en BD): True si `scheduled_at` ya pasó y el item
    #: sigue `pending`. Puramente informativo — no bloquea nada.
    overdue: bool = False
    #: Usuario que creó el item (issue #131). None en items pre-migración
    #: o si el usuario fue borrado después (ondelete=SET NULL).
    created_by: Optional[int] = None
    created_by_username: Optional[str] = None
    created_at: datetime
    quote: Optional[QueueQuoteSnapshot] = None
    vault: Optional[QueueVaultSnapshot] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _compute_overdue(self) -> "PrintQueueItemResponse":
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.overdue = (
            self.status == "pending"
            and self.scheduled_at is not None
            and self.scheduled_at < now
        )
        return self


class PrintQueueStatusUpdate(BaseModel):
    """
    Payload para cambiar el estado de un ítem de la cola.

    `failure_reason`/`failure_category` solo se guardan cuando `status`
    es `cancelled` — se ignoran silenciosamente en cualquier otra
    transición (no bloquean el flujo, ambos campos son opcionales).
    """

    status: str  # 'printing' | 'done' | 'cancelled'
    failure_reason: Optional[str] = Field(default=None, max_length=200)
    failure_category: Optional[FailureCategory] = None


class PrintQueueProjectUpdate(BaseModel):
    """Payload para (re)asignar o quitar el proyecto de un ítem ya encolado."""

    project_id: Optional[int] = None


class QueueReorderRequest(BaseModel):
    """
    Payload para reordenar la cola por drag-and-drop.

    `item_ids` es la lista COMPLETA de ids pending en el nuevo orden — el
    backend asigna `position` = índice en la lista. Todos deben existir y
    estar en estado `pending`.
    """

    item_ids: List[int] = Field(min_length=1)


class QueueBatchCreateRequest(BaseModel):
    """Payload para agrupar ≥2 items pending como lote."""

    item_ids: List[int] = Field(min_length=2)


class QueueScheduleUpdate(BaseModel):
    """Payload para programar (o quitar programación de) un ítem."""

    scheduled_at: Optional[datetime] = None


class PrintQueueLogResponse(BaseModel):
    """
    Respuesta paginada de `GET /api/queue/log` (issue #131) — bitácora
    global de impresiones con filtros. Endpoint separado de `/history`
    (que solo filtra `done`/`cancelled` para el tab Historial de
    QueuePage) porque el log necesita TODOS los estados.
    """

    items: List[PrintQueueItemResponse]
    total: int
    page: int
    page_size: int
