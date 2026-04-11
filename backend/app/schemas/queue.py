"""
Schemas Pydantic para la cola de impresión (Queue).

Define los modelos de entrada y salida usados por el router de queue.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PrintQueueItemCreate(BaseModel):
    """Datos requeridos para agregar un ítem a la cola."""

    quote_id: int
    notes: Optional[str] = None


class QueueQuoteSnapshot(BaseModel):
    """
    Información de la cotización embebida en la respuesta del ítem de cola.

    Se carga manualmente en el router para evitar joins complejos.
    """

    id: int
    piece_name: str
    printer_id: int
    printer_name: str
    weight_grams: float
    print_time_hours: float
    quantity: int
    total_price: float


class PrintQueueItemResponse(BaseModel):
    """Respuesta completa de un ítem de la cola de impresión."""

    id: int
    quote_id: Optional[int]
    status: str
    position: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    quote: Optional[QueueQuoteSnapshot] = None

    model_config = {"from_attributes": True}


class PrintQueueStatusUpdate(BaseModel):
    """Payload para cambiar el estado de un ítem de la cola."""

    status: str  # 'printing' | 'done' | 'cancelled'
