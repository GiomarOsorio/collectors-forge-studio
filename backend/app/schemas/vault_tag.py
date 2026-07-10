"""Schemas Pydantic para el catálogo de tags del Vault (`VaultTag`)."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _validate_tag_name(v: str) -> str:
    """Rechaza nombres que quedan vacíos tras strip (ej. solo espacios)."""
    stripped = v.strip()
    if not stripped:
        raise ValueError("El nombre del tag no puede quedar vacío")
    return stripped


class VaultTagCreate(BaseModel):
    """Datos para crear un tag nuevo."""
    name: str = Field(min_length=1, max_length=100)

    _validate_name = field_validator("name")(_validate_tag_name)


class VaultTagUpdate(BaseModel):
    """Renombrar un tag existente."""
    name: str = Field(min_length=1, max_length=100)

    _validate_name = field_validator("name")(_validate_tag_name)


class VaultTagResponse(BaseModel):
    """Tag con conteo de archivos activos (no trasheados) que lo usan."""
    id: int
    name: str
    file_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
