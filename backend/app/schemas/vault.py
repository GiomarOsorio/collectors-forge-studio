"""
Schemas Pydantic para el Vault de modelos .3mf / .gcode.3mf.

`ModelFile` ahora soporta dos slots de archivo (source + print). El
response expone ambos por separado más los metadatos pre-parseados
del header del G-code laminado.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, PlainSerializer

DecimalAsFloat = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


class ModelFileCreate(BaseModel):
    """
    Metadatos enviados junto al/los archivo(s) al hacer upload.

    El/los archivo(s) viaja(n) como UploadFile multipart en los campos
    `source_file` y/o `print_file` (al menos uno requerido). Este schema
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
    """Respuesta completa de un archivo del Vault con ambos slots."""
    id: int
    uploaded_by: Optional[int]
    uploaded_by_username: Optional[str]

    # Source (.3mf editable)
    source_file_name: Optional[str]
    source_file_size: Optional[int]

    # Print (.gcode.3mf laminado)
    print_file_name: Optional[str]
    print_file_size: Optional[int]

    # Sliced metadata (auto-parseado del print_file)
    sliced_weight_g: Optional[DecimalAsFloat] = None
    sliced_time_seconds: Optional[int] = None
    sliced_printer_model: Optional[str] = None
    sliced_filament_type: Optional[str] = None

    # Derivado
    is_print_ready: bool

    # Display / metadata
    name: str
    description: Optional[str]
    thumbnail_url: Optional[str]
    # URL del endpoint proxy que sirve el PNG desde MinIO. Vacío si el
    # modelo no tiene plate-render extraído. El frontend lo usa como
    # `<img src>` directamente.
    local_thumbnail_url: Optional[str] = None
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
