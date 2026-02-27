"""
Modelo ORM para la tabla de empresas (multi-tenant).

Define la entidad Company que representa una organización en el sistema.
Todos los recursos (filamentos, impresoras, cotizaciones, insumos y
configuración) están aislados por company_id, de forma que cada empresa
solo ve y gestiona sus propios datos.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB

from app.database import Base


class Company(Base):
    """
    Empresa registrada en el sistema (unidad de aislamiento multi-tenant).

    Atributos:
        id:         UUID primario de la empresa (generado automáticamente).
        name:       Nombre comercial de la empresa.
        created_at: Timestamp UTC de creación del registro.
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200))
    slogan: Mapped[str] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(String(300), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(100), nullable=True)
    nit: Mapped[str] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True)
    # Paleta de colores dinámica para PDF: [{name: str, hex: str}, ...]
    # Accesible en templates Liquid como {{ palette.nombre }}
    pdf_palette: Mapped[list] = mapped_column(JSONB, nullable=True)
    pdf_terms:   Mapped[str]  = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
