"""
Modelo ORM para carpetas del Vault.

`VaultFolder` es un árbol simple (auto-referencia por `parent_id`) usado
para organizar los `ModelFile` del Vault. `parent_id=NULL` = carpeta raíz.
Borrar una carpeta borra en cascada sus subcarpetas (`ondelete=CASCADE`);
los `ModelFile` que quedaban dentro no se borran, solo pierden la
referencia (`ModelFile.folder_id` usa `ondelete=SET NULL`).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VaultFolder(Base):
    """
    Carpeta del Vault (árbol de organización de `ModelFile`).

    Atributos:
        id:         PK autoincremental.
        name:       Nombre de la carpeta.
        parent_id:  FK a `vault_folders.id` (carpeta padre). NULL = raíz.
        created_at: Timestamp UTC de creación.
        updated_at: Timestamp UTC de última modificación (rename/move).
    """

    __tablename__ = "vault_folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("vault_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
