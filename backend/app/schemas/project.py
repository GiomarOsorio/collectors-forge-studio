"""Schemas Pydantic para proyectos (agrupador de la cola de impresión)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """Datos para crear un proyecto nuevo."""
    name: str = Field(min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Datos editables de un proyecto (todos opcionales)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = None  # 'active' | 'completed' | 'archived'
    notes: Optional[str] = None


class ProjectResponse(BaseModel):
    """Proyecto tal como está en BD, sin progreso agregado."""
    id: int
    name: str
    client_name: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectWithProgress(ProjectResponse):
    """Proyecto + conteo de items de cola por estado (para la lista/cards)."""
    total_items: int = 0
    pending_count: int = 0
    printing_count: int = 0
    done_count: int = 0
    cancelled_count: int = 0
