"""
Modelos ORM para la app de Mantenimiento de Impresoras.

Define dos entidades:
- MaintenanceLog: registro de un mantenimiento realizado sobre una impresora.
- MaintenanceLogItem: ítem (repuesto/insumo) usado en ese mantenimiento.

Las impresoras se gestionan en la app Cost (modelo Printer). El campo
printer_id referencia directamente a printers.id, de modo que ambas
apps comparten la misma fuente de verdad para las impresoras.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Numeric, DateTime, Integer, ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.printer import Printer
    from app.models.inventory import InventoryItem


class MaintenanceLog(Base):
    """
    Registro de un mantenimiento realizado sobre una impresora.

    Captura el tipo de mantenimiento, las horas de la impresora al momento
    de realizarlo y una lista de ítems (repuestos/insumos) utilizados.
    Referencia directamente al modelo Printer de la app Cost.

    Atributos:
        id:                   PK autoincremental.
        company_id:           UUID de la empresa (multi-tenant).
        printer_id:           FK a printers.id (modelo Printer de Cost).
        hours_at_maintenance: Horas de la impresora cuando se realizó el mantenimiento.
        maintenance_type:     Tipo de mantenimiento (valores en MAINTENANCE_TYPES frontend).
        description:          Descripción libre del mantenimiento realizado.
        performed_at:         Fecha y hora en que se realizó el mantenimiento.
        created_at:           Timestamp UTC de creación del registro.
        printer:              Relación con Printer.
        items:                Ítems usados en este mantenimiento.
    """

    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    printer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("printers.id", ondelete="CASCADE"), nullable=False
    )
    hours_at_maintenance: Mapped[Decimal] = mapped_column(Numeric(8, 1), nullable=False)
    maintenance_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    printer: Mapped["Printer"] = relationship("Printer")
    items: Mapped[List["MaintenanceLogItem"]] = relationship(
        "MaintenanceLogItem", back_populates="log", cascade="all, delete-orphan"
    )


class MaintenanceLogItem(Base):
    """
    Ítem (repuesto o insumo) utilizado en un registro de mantenimiento.

    Puede estar vinculado opcionalmente a un InventoryItem para descontar
    automáticamente el stock al guardar el log.

    Atributos:
        id:                 PK autoincremental.
        log_id:             FK a maintenance_logs (cascade delete).
        inventory_item_id:  FK opcional a inventory_items.
        name:               Nombre del ítem usado.
        quantity:           Cantidad utilizada.
        unit_cost:          Costo unitario del ítem.
        notes:              Notas sobre el uso de este ítem.
        log:                Relación con MaintenanceLog.
        inventory_item:     Relación opcional con InventoryItem.
    """

    __tablename__ = "maintenance_log_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    log_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("maintenance_logs.id", ondelete="CASCADE"), nullable=False
    )
    inventory_item_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    log: Mapped["MaintenanceLog"] = relationship("MaintenanceLog", back_populates="items")
    inventory_item: Mapped[Optional["InventoryItem"]] = relationship(
        "InventoryItem", foreign_keys=[inventory_item_id]
    )
