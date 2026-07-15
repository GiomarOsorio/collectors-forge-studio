"""Schemas Pydantic para proyectos (agrupador de la cola de impresión)."""

import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

#: Paleta sugerida de 8 colores para el picker de la card (issue #136).
SUGGESTED_PROJECT_COLORS = [
    "#F59E0B", "#3B82F6", "#8B5CF6", "#14B8A6",
    "#F43F5E", "#22C55E", "#EAB308", "#6366F1",
]

_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _validar_hex_color(v: Optional[str]) -> Optional[str]:
    if v is not None and not _HEX_COLOR_RE.match(v):
        raise ValueError(f"Color inválido: '{v}' — use formato #RRGGBB")
    return v


class ProjectCreate(BaseModel):
    """Datos para crear un proyecto nuevo."""
    name: str = Field(min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None
    color: Optional[str] = None
    external_url: Optional[str] = Field(default=None, max_length=500)
    client_quote_id: Optional[int] = None

    _validar_color = field_validator("color")(_validar_hex_color)


class ProjectUpdate(BaseModel):
    """Datos editables de un proyecto (todos opcionales)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = None  # 'active' | 'completed' | 'archived'
    notes: Optional[str] = None
    color: Optional[str] = None
    external_url: Optional[str] = Field(default=None, max_length=500)
    client_quote_id: Optional[int] = None

    _validar_color = field_validator("color")(_validar_hex_color)


class ProjectResponse(BaseModel):
    """Proyecto tal como está en BD, sin progreso agregado."""
    id: int
    name: str
    client_name: Optional[str]
    status: str
    notes: Optional[str]
    color: Optional[str] = None
    external_url: Optional[str] = None
    client_quote_id: Optional[int] = None
    has_cover: bool = False
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
    # Presentes solo si `client_quote_id` resuelve a una cotización real
    # (puede haberse borrado tras vincularse — SET NULL no lo garantiza
    # hasta el próximo guardado del proyecto).
    client_quote_code: Optional[str] = None
    client_quote_client_name: Optional[str] = None


# ─── Vínculo a Vault (issue #136, sub-ticket 2/3) ──────────────────────────

class ProjectFilesRequest(BaseModel):
    """Body de `POST /{id}/files` — añade archivos al puente (idempotente)."""
    model_file_ids: List[int] = Field(..., min_length=1, max_length=200)


class ProjectLinkedFile(BaseModel):
    """
    Vista mínima de solo-lectura de un `ModelFile` vinculado a un proyecto.

    Deliberadamente NO reusa `ModelFileResponse` (Vault) — ese schema
    carga metadata sliced/tags/print_count que el detalle de proyecto no
    necesita; esto evita construir esas piezas solo para descartarlas.
    """
    id: int
    name: str
    local_thumbnail_url: Optional[str] = None
    is_print_ready: bool
