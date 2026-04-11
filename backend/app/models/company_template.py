"""
Modelo ORM para los templates de cotización Liquid de cada empresa.

Los templates permiten personalizar el diseño del PDF de cotización COT-XXXX
usando sintaxis Liquid (python-liquid) convertido a PDF con WeasyPrint.
Cada empresa puede tener múltiples templates, con uno marcado como default
por tipo (cot | all).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanyTemplate(Base):
    """
    Template de cotización Liquid asociado a una empresa.

    Atributos:
        id:            ID entero autoincrementable.
        company_id:    UUID de la empresa propietaria del template.
        name:          Nombre descriptivo del template.
        description:   Descripción opcional del template.
        template_type: Tipo de documento para el que aplica ('cot' | 'all').
        content:       Código Liquid HTML completo del template.
        is_default:    Si True, se usa automáticamente al generar el PDF del tipo.
        created_at:    Timestamp UTC de creación (sin timezone para asyncpg).
        updated_at:    Timestamp UTC de la última modificación.
    """

    __tablename__ = "company_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template_type: Mapped[str] = mapped_column(String(20), nullable=False, default="cot")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
