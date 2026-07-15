"""
Esquemas Pydantic para la integración con MakerWorld / Bambu Cloud (issue #139).
"""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ─── Auth Bambu Cloud ───────────────────────────────────────────────────────

class CloudAuthStatus(BaseModel):
    configured: bool
    email_masked: Optional[str] = None
    expires_at: Optional[datetime] = None


class CloudLoginRequest(BaseModel):
    email: str
    password: str


class CloudLoginResponse(BaseModel):
    status: str  # "ok" | "verify_code" | "tfa"
    message: str
    tfa_key: Optional[str] = None


class CloudVerifyRequest(BaseModel):
    code: str
    tfa_key: Optional[str] = None


# ─── Resolve / Import ───────────────────────────────────────────────────────

class MakerWorldResolveRequest(BaseModel):
    url: str = Field(..., description="URL de un modelo de MakerWorld (esquema opcional)")


class MakerWorldInstance(BaseModel):
    """Una instancia/plate del diseño — cada una es un `ModelFile` separado si se importa."""
    id: Optional[int] = None
    profile_id: Optional[int] = None
    title: Optional[str] = None
    thumbnail: Optional[str] = None


class MakerWorldResolveResponse(BaseModel):
    design_id: int
    title: str
    author: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    instances: List[MakerWorldInstance] = Field(default_factory=list)
    already_imported_model_ids: List[int] = Field(default_factory=list)


class MakerWorldImportRequest(BaseModel):
    design_id: int
    profile_id: Optional[int] = Field(
        default=None,
        description="Instancia/plate elegida. Si se omite, se usa la primera disponible.",
    )
    folder_id: Optional[int] = None


class MakerWorldImportResponse(BaseModel):
    model_file_id: int
    name: str
    folder_id: Optional[int] = None
    profile_id: Optional[int] = None
    was_existing: bool


class MakerWorldImportAllRequest(BaseModel):
    design_id: int
    folder_id: Optional[int] = None


class MakerWorldImportAllResult(BaseModel):
    profile_id: Optional[int]
    ok: bool
    model_file_id: Optional[int] = None
    error: Optional[str] = None


class MakerWorldImportAllResponse(BaseModel):
    imported: List[MakerWorldImportAllResult]
    failed: List[MakerWorldImportAllResult]


class MakerWorldRecentImport(BaseModel):
    model_file_id: Optional[int] = None
    design_id: int
    profile_id: Optional[int] = None
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}
