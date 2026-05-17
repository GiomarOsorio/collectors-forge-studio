"""
Schemas Pydantic para la cola de impresión (Queue).

Soporta dos fuentes de items:
- **Quote** (camino histórico): `quote` snapshot embebido en la respuesta.
- **Vault** (chunk C): `vault` snapshot embebido en la respuesta.

Cada response trae uno de los dos no-nulo (los items pre-existentes solo
traen `quote`; los nuevos desde el picker traen `vault`).
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class PrintQueueItemCreate(BaseModel):
    """Datos requeridos para agregar un ítem desde un Quote existente."""

    quote_id: int
    notes: Optional[str] = None


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
    status: str
    position: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    quote: Optional[QueueQuoteSnapshot] = None
    vault: Optional[QueueVaultSnapshot] = None

    model_config = {"from_attributes": True}


class PrintQueueStatusUpdate(BaseModel):
    """Payload para cambiar el estado de un ítem de la cola."""

    status: str  # 'printing' | 'done' | 'cancelled'
