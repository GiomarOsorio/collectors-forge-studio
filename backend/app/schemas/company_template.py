"""
Esquemas Pydantic para los templates de cotización Liquid (CompanyTemplate).
"""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CompanyTemplateBase(BaseModel):
    """Campos comunes de un template de cotización."""

    name: str
    description: Optional[str] = None
    template_type: str = "cot"
    content: str
    is_default: bool = False


class CompanyTemplateCreate(CompanyTemplateBase):
    """Schema para crear un nuevo template."""
    pass


class CompanyTemplateUpdate(BaseModel):
    """Schema para actualizar un template (todos los campos opcionales)."""

    name: Optional[str] = None
    description: Optional[str] = None
    template_type: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None


class CompanyTemplateResponse(CompanyTemplateBase):
    """Datos completos del template retornados por la API."""

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TemplateValidateRequest(BaseModel):
    """Cuerpo de la petición de validación de un template Liquid."""

    content: str
    template_type: str = "cot"


class TemplateValidateResponse(BaseModel):
    """Resultado de la validación de un template Liquid."""

    ok: bool
    errors: List[str]
    warnings: List[str]
    preview_pdf_b64: Optional[str] = None
