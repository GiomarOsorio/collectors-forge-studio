"""
Esquemas Pydantic para la empresa (perfil y actualización).
"""

import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, field_validator


class PaletteColor(BaseModel):
    """Entrada de la paleta de colores PDF: nombre + valor hex."""

    name: str
    hex: str

    @field_validator("hex")
    @classmethod
    def valid_hex(cls, v: str) -> str:
        """Valida que el color sea un hex de 6 dígitos con #."""
        v = v.strip()
        if not (v.startswith("#") and len(v) == 7):
            raise ValueError(f"El color debe ser un hex de 6 dígitos (ej: #1A2B3C), recibido: {v!r}")
        return v.upper()


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
    pdf_palette: Optional[List[Dict[str, Any]]] = None
    pdf_terms:   Optional[str] = None

    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    """Campos actualizables del perfil de empresa (todos opcionales)."""

    name: Optional[str] = None
    slogan: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    nit: Optional[str] = None
    pdf_palette: Optional[List[PaletteColor]] = None
    pdf_terms:   Optional[str] = None

    def model_dump(self, **kwargs):
        """Serializa pdf_palette como lista de dicts planos para almacenar en JSONB."""
        data = super().model_dump(**kwargs)
        if data.get("pdf_palette") is not None:
            data["pdf_palette"] = [
                {"name": c["name"], "hex": c["hex"]}
                for c in data["pdf_palette"]
            ]
        return data
