"""
Esquemas Pydantic para la empresa (perfil y actualización).
"""

import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr


class CompanyResponse(BaseModel):
    """Datos públicos de la empresa."""

    id: uuid.UUID
    name: str
    slogan: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[str] = None
    nit: Optional[str] = None
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    """Campos actualizables del perfil de empresa (todos opcionales)."""

    name: Optional[str] = None
    slogan: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    nit: Optional[str] = None
