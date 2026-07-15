"""
Modelo ORM para etiquetas del Vault (catálogo relacional M2M).

Reemplaza el JSONB `ModelFile.tags` original — un catálogo global de tags
reales permite contar uso por tag, renombrar una sola vez (aplica a todos
los archivos etiquetados) y filtrar con un índice, cosas que un array
serializado no puede hacer bien (renombrar requiere reescribir cada fila;
"contiene tag X" sobre texto JSON es frágil y lento).

Deliberadamente mínimo (mismo alcance que bambuddy-cfs): solo etiqueta, sin
color/ícono, catálogo global (sin scope por usuario), y solo aplica a
archivos — las carpetas ya expresan jerarquía, los tags son ortogonales.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Tabla de asociación pura M2M — sin columnas propias más allá de las FKs.
# Un ModelFile puede tener N tags; un tag puede estar en N archivos.
model_file_tags = Table(
    "model_file_tags",
    Base.metadata,
    Column(
        "model_file_id", Integer,
        ForeignKey("model_files.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id", Integer,
        ForeignKey("vault_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class VaultTag(Base):
    """
    Etiqueta del catálogo global del Vault.

    Atributos:
        id:         PK autoincremental.
        name:       Nombre a mostrar, preserva mayúsculas/minúsculas tal
                    cual se creó (ej. "PLA Silk").
        name_key:   `name` normalizado (trim + lower) — único. Evita que
                    "PLA" y "pla" coexistan como dos tags distintos.
        created_at: Timestamp UTC de creación.
    """

    __tablename__ = "vault_tags"
    __table_args__ = (
        UniqueConstraint("name_key", name="uq_vault_tags_name_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_key: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
