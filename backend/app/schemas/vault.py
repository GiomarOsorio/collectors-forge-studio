"""
Schemas Pydantic para el Vault de modelos .3mf.

Define los modelos de validación y serialización para crear, actualizar
y retornar archivos del Vault, así como la respuesta de estadísticas de
almacenamiento y la pre-lectura de metadata desde URLs externas.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ModelFileCreate(BaseModel):
    """
    Metadatos enviados junto al archivo al hacer upload.

    El archivo mismo viaja como UploadFile multipart; este schema
    corresponde al campo Form 'metadata' serializado como JSON.
    """
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(default=None, max_length=1000)
    tags: List[str] = Field(default_factory=list)
    source_url: Optional[str] = Field(default=None, max_length=1000)
    source_platform: Optional[str] = Field(default=None, max_length=50)
    creator_name: Optional[str] = Field(default=None, max_length=200)
    creator_url: Optional[str] = Field(default=None, max_length=1000)


class ModelFileUpdate(BaseModel):
    """Datos editables de un archivo ya subido (todos opcionales)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[List[str]] = None
    source_url: Optional[str] = Field(default=None, max_length=1000)
    source_platform: Optional[str] = Field(default=None, max_length=50)
    creator_name: Optional[str] = Field(default=None, max_length=200)
    creator_url: Optional[str] = Field(default=None, max_length=1000)


class ModelFileResponse(BaseModel):
    """Respuesta completa de un archivo del Vault."""
    id: int
    uploaded_by: Optional[int]
    uploaded_by_username: Optional[str]
    file_name: str
    file_size: int
    name: str
    description: Optional[str]
    thumbnail_url: Optional[str]
    local_thumbnail_path: Optional[str] = None
    tags: List[str]
    source_url: Optional[str]
    source_platform: Optional[str]
    creator_name: Optional[str]
    creator_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModelFileListResponse(BaseModel):
    """Respuesta paginada de la galería."""
    items: List[ModelFileResponse]
    total: int
    page: int
    page_size: int


class VaultStatsResponse(BaseModel):
    """Estadísticas de uso del almacenamiento."""
    used_bytes: int
    quota_bytes: int
    percent: float


class VaultDownloadResponse(BaseModel):
    """URL pre-firmada para descarga directa desde MinIO."""
    url: str
    file_name: str
    expires_in: int  # segundos


class VaultMetadataRequest(BaseModel):
    """URL de la que se quiere extraer metadata."""
    url: str


class VaultMetadataResponse(BaseModel):
    """Metadata pre-rellenada a partir de la URL del modelo."""
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    source_platform: Optional[str] = None
    creator_name: Optional[str] = None
    creator_url: Optional[str] = None
