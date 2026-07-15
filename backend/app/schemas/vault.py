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
    folder_id: Optional[int] = None


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
    folder_id: Optional[int] = None
    notes: Optional[str] = None


class PlateInfo(BaseModel):
    """Info de un plate del .gcode.3mf (issue #68)."""
    plate_index: int
    weight_g: Optional[float] = None
    time_seconds: Optional[int] = None
    filament_type: Optional[str] = None
    printer_model: Optional[str] = None
    thumbnail_url: Optional[str] = None


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
    folder_id: Optional[int] = None
    notes: Optional[str] = None
    # Cuántos PrintQueueItem (done/cancelled/printing) referencian este
    # modelo — badge "N impresiones" en el grid (issue #130). Se calcula
    # con un outerjoin agregado en el listado, nunca query por archivo.
    print_count: int = 0

    # Multi-plate (issue #68). `active_plate_index` indica cuál plate
    # actualmente sincroniza `sliced_*` + thumbnail principal.
    active_plate_index: int = 0
    plates: List[PlateInfo] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime
    # NULL = activo. Con fecha = está en la papelera (usado por la vista
    # de papelera para mostrar "eliminado el X").
    deleted_at: Optional[datetime] = None

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


class ModelFilePhotoResponse(BaseModel):
    """Foto adjunta a un archivo del Vault (issue #130)."""
    id: int
    caption: Optional[str] = None
    photo_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelFilePhotoCaptionUpdate(BaseModel):
    """Payload para editar el caption de una foto ya subida."""
    caption: Optional[str] = Field(default=None, max_length=300)


class PrintHistoryEntry(BaseModel):
    """Una fila del historial de impresiones de un modelo (issue #130)."""
    id: int
    status: str
    quantity: int
    piece_name: Optional[str] = None
    printer_name: Optional[str] = None
    filament_name: Optional[str] = None
    weight_grams: Optional[DecimalAsFloat] = None
    print_time_hours: Optional[DecimalAsFloat] = None
    failure_reason: Optional[str] = None
    failure_category: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class PrintHistoryResponse(BaseModel):
    """Historial completo + agregados de un modelo del Vault."""
    items: List[PrintHistoryEntry]
    total_grams: float
    success_rate_pct: Optional[float] = None


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
    # Issue #71 — fallback al link cuando el parser local del .gcode.3mf
    # no encuentra estos datos. Best-effort scraping de MakerWorld/Printables.
    weight_g: Optional[float] = None
    time_seconds: Optional[int] = None
    filament_type: Optional[str] = None


class VaultZipImportResponse(BaseModel):
    """Resumen de un import de ZIP al Vault (issue #127)."""
    folders_created: int
    files_created: int
    skipped_entries: int
    root_folder_id: Optional[int] = None
