"""
Modelos ORM para la app de Mantenimiento de Impresoras.

Define tres entidades:
- MaintenancePrinter: impresora registrada con contador acumulado de horas.
- MaintenanceLog: registro de un mantenimiento realizado.
- MaintenanceLogItem: ítem (repuesto/insumo) usado en ese mantenimiento.

Cada registro de mantenimiento puede descontar automáticamente ítems del
inventario de la empresa (ver router maintenance.py).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Numeric, DateTime, Integer, ForeignKey, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.inventory import InventoryItem


class MaintenancePrinter(Base):
    """
    Impresora registrada en el módulo de mantenimiento.

    Lleva el contador acumulado de horas de uso. Es diferente al modelo
    Printer de la calculadora (ese tiene costos de depreciación); este
    modelo es exclusivo para el historial de mantenimiento.

    Atributos:
        id:            PK autoincremental.
        company_id:    UUID de la empresa (multi-tenant).
        name:          Nombre descriptivo de la impresora.
        model:         Modelo comercial (ej. "P2S Combo").
        current_hours: Horas actuales acumuladas (actualizable).
        notes:         Notas adicionales.
        created_at:    Timestamp UTC de creación.
        logs:          Relación inversa con los registros de mantenimiento.
    """

    __tablename__ = "maintenance_printers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_hours: Mapped[Decimal] = mapped_column(
        Numeric(8, 1), nullable=False, default=Decimal("0")
    )
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    logs: Mapped[List["MaintenanceLog"]] = relationship(
        "MaintenanceLog", back_populates="printer", cascade="all, delete-orphan"
    )


class MaintenanceLog(Base):
    """
    Registro de un mantenimiento realizado sobre una impresora.

    Captura el tipo de mantenimiento, las horas de la impresora al momento
    de realizarlo y una lista de ítems (repuestos/insumos) utilizados.

    Atributos:
        id:                   PK autoincremental.
        company_id:           UUID de la empresa (multi-tenant).
        printer_id:           FK a maintenance_printers.
        hours_at_maintenance: Horas de la impresora cuando se realizó el mantenimiento.
        maintenance_type:     Tipo de mantenimiento (valores en MAINTENANCE_TYPES frontend).
        description:          Descripción libre del mantenimiento realizado.
        performed_at:         Fecha y hora en que se realizó el mantenimiento.
        created_at:           Timestamp UTC de creación del registro.
        printer:              Relación con MaintenancePrinter.
        items:                Ítems usados en este mantenimiento.
    """

    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    printer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("maintenance_printers.id", ondelete="CASCADE"), nullable=False
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

    printer: Mapped["MaintenancePrinter"] = relationship(
        "MaintenancePrinter", back_populates="logs"
    )
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
