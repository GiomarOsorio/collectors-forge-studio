"""Schemas Pydantic para carpetas del Vault (`VaultFolder`)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


def _validate_folder_name(v: Optional[str]) -> Optional[str]:
    """Rechaza nombres que quedan vacíos tras strip (ej. solo espacios)."""
    if v is None:
        return v
    stripped = v.strip()
    if not stripped:
        raise ValueError("El nombre de la carpeta no puede quedar vacío")
    return stripped


class VaultFolderCreate(BaseModel):
    """Datos para crear una carpeta nueva."""
    name: str = Field(min_length=1, max_length=200)
    parent_id: Optional[int] = None

    _validate_name = field_validator("name")(_validate_folder_name)


class VaultFolderUpdate(BaseModel):
    """Renombrar y/o mover una carpeta (todos los campos opcionales)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    parent_id: Optional[int] = None
    # Distingue "no tocar parent_id" (campo ausente) de "mover a la raíz"
    # (parent_id=None enviado explícitamente) — ver uso en el router.
    move_to_root: bool = False

    _validate_name = field_validator("name")(_validate_folder_name)


class VaultFolderResponse(BaseModel):
    """Carpeta con conteo de archivos directos (no recursivo)."""
    id: int
    name: str
    parent_id: Optional[int]
    file_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
