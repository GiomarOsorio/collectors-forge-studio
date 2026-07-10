"""
Modelo ORM para la tabla de archivos del Vault.

Cada `ModelFile` puede tener hasta DOS archivos asociados en MinIO:

- **source_file**: el `.3mf` editable (proyecto OrcaSlicer/BambuStudio).
  Útil para iterar el modelo más tarde.
- **print_file**: el `.gcode.3mf` laminado (paquete con G-code listo para
  imprimir). Es lo que el picker de Queue selecciona para meter a la cola
  con `weight_g` / `time_h` / `filament_type` ya resueltos.

Al menos uno de los dos debe estar presente (CHECK constraint). Si solo se
sube uno, se considera "source-only" o "print-only". Subir ambos es el
flujo ideal: edición + impresión cubiertas.

Cuando se sube un `.gcode.3mf` (slot print), el header del G-code se parsea
automáticamente y popula `sliced_weight_g`, `sliced_time_seconds`,
`sliced_printer_model` y `sliced_filament_type` — Queue los usa para
crear el `PrintQueueItem` sin pedirle nada al usuario.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.vault_tag import VaultTag, model_file_tags


class ModelFile(Base):
    """
    Archivo(s) del Vault con metadatos de display.

    Atributos:
        id:              PK autoincremental.
        uploaded_by:     ID del usuario que subió (nullable al borrar usuario).
        source_file_key: Clave MinIO del `.3mf` editable. Nullable.
        source_file_name: Nombre original del `.3mf` editable.
        source_file_size: Tamaño en bytes del `.3mf` editable.
        print_file_key:  Clave MinIO del `.gcode.3mf` laminado. Nullable.
        print_file_name: Nombre original del `.gcode.3mf` laminado.
        print_file_size: Tamaño en bytes del `.gcode.3mf` laminado.
        sliced_weight_g:      Peso (g) extraído del header del .gcode.3mf.
        sliced_time_seconds:  Tiempo de impresión (s) extraído del header.
        sliced_printer_model: Modelo de impresora (ej. "Bambu Lab P2S").
        sliced_filament_type: Tipo de filamento (ej. "PLA").
        name:            Nombre de display editable por el usuario.
        description:     Descripción libre del modelo (opcional).
        thumbnail_url:   URL externa de miniatura (MakerWorld/Printables).
        thumbnail_key:   Key MinIO del PNG plate-render extraído de
                         cualquiera de los dos `.3mf` (formato:
                         `thumbnails/{id}.png`). Se sirve al frontend
                         vía `GET /api/vault/{id}/thumbnail` (proxy).
        tags:            Etiquetas (catálogo relacional M2M, ver `VaultTag`).
        deleted_at:      NULL = activo; con fecha = en la papelera (soft-delete).
        source_url:      URL de origen del modelo.
        source_platform: Plataforma de origen.
        creator_name:    Nombre del creador del modelo original.
        creator_url:     URL del perfil del creador.
        created_at:      Timestamp UTC de creación.
        updated_at:      Timestamp UTC de última modificación.
    """

    __tablename__ = "model_files"
    __table_args__ = (
        # Al menos un archivo (source o print) tiene que estar presente.
        CheckConstraint(
            "source_file_key IS NOT NULL OR print_file_key IS NOT NULL",
            name="ck_model_files_at_least_one_file",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uploaded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Source (.3mf editable) ──────────────────────────────────────────────
    source_file_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # ── Print (.gcode.3mf laminado) ─────────────────────────────────────────
    print_file_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    print_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    print_file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # ── Metadatos pre-parseados del .gcode.3mf (slot print) ────────────────
    # Estos campos son CACHE del plate activo — sincronizados al cambiar
    # `active_plate_index` o al re-subir el .gcode.3mf. Queue + Calc leen
    # estos campos directamente sin tocar `plates`.
    sliced_weight_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    sliced_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sliced_printer_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sliced_filament_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Plate activo dentro del .gcode.3mf — el que se muestra en thumbnail y
    # el que cachea los `sliced_*`. Issue #68. Default 0 (primer plate).
    active_plate_index: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )

    # Carpeta del Vault donde vive el archivo. NULL = raíz. Si se borra la
    # carpeta, el archivo se mueve a la raíz (ondelete=SET NULL) en vez de
    # borrarse con ella.
    folder_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("vault_folders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Display / metadata ──────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    thumbnail_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    source_platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    creator_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    creator_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    # Papelera: NULL = activo. Si tiene fecha, está en la papelera (soft-delete)
    # — los bytes en MinIO NO se borran hasta el borrado permanente desde
    # DELETE /api/vault/trash/{id}. Sigue contando para la cuota de storage
    # mientras está acá (los bytes siguen ocupando espacio real).
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ── Tags (catálogo relacional M2M — ver app.models.vault_tag) ───────────
    tags: Mapped[list["VaultTag"]] = relationship(
        "VaultTag", secondary=model_file_tags, order_by="VaultTag.name"
    )

    # ── Plates extraídos del .gcode.3mf (issue #68) ─────────────────────────
    # Un `ModelFile` con multi-plate tiene N rows en `model_file_plates`.
    # cascade=delete-orphan: si se borra el modelo, todos los plates se van.
    plates: Mapped[list["ModelFilePlate"]] = relationship(
        "ModelFilePlate",
        back_populates="model_file",
        cascade="all, delete-orphan",
        order_by="ModelFilePlate.plate_index",
    )

    # ── Helpers ─────────────────────────────────────────────────────────────

    @property
    def is_print_ready(self) -> bool:
        """True si el modelo tiene un `.gcode.3mf` listo para meter a cola."""
        return self.print_file_key is not None

    @property
    def total_size_bytes(self) -> int:
        """Suma source + print (cualquiera puede ser None) — usado por la cuota."""
        return (self.source_file_size or 0) + (self.print_file_size or 0)


class ModelFilePlate(Base):
    """
    Plate individual extraído de un `.gcode.3mf` multi-plate. Issue #68.

    Un `ModelFile` con N plates tiene N rows aquí, una por cada placa.
    `plate_index` es 0-based para alinear con `ModelFile.active_plate_index`.

    Cada plate tiene su propio thumbnail PNG en MinIO bajo
    `thumbnails/{model_file_id}_plate{plate_index}.png` y sus propios
    `weight_g` / `time_seconds` / `filament_type` extraídos del parser.

    El `thumbnail_key` de `ModelFile` apunta al plate activo (refrescado
    al cambiar `active_plate_index`).
    """

    __tablename__ = "model_file_plates"
    __table_args__ = (
        UniqueConstraint("model_file_id", "plate_index", name="uq_model_file_plate_idx"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_file_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("model_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 0-based: coincide con ModelFile.active_plate_index
    plate_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Metadata extraída del .gcode.3mf por plate
    weight_g: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    filament_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    printer_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Key MinIO del thumbnail específico de este plate
    thumbnail_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    model_file: Mapped["ModelFile"] = relationship(
        "ModelFile", back_populates="plates"
    )
