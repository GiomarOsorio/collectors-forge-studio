"""
Modelo ORM para perfiles de impresión (slicer) de un filamento.

`FilamentProfile` guarda los parámetros de slicer (temperaturas, velocidad,
retracción, flow ratio, fan speed, K-value) asociados a un `InventoryItem`
de categoría "Filamento" — el catálogo real que usa toda la app (queue,
quotes, calculadora). Es informativo/de referencia: no participa en
ningún cálculo de costo, solo evita tener que buscar la ficha técnica del
filamento cada vez que se lamina.

Relación 1:1 con `InventoryItem` (un perfil por filamento).

Nota sobre `k_value` (issue #118): bambuddy-cfs tiene un sistema de
K-profiles sincronizado en vivo con la impresora (MQTT, ~20 slots por
impresora/extrusor/nozzle). Eso no aplica acá — no hay impresora en LAN.
`k_value` es 100% manual: el usuario calibra por su cuenta (flujo estándar
de Bambu Studio/OrcaSlicer) y anota el resultado acá como referencia.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FilamentProfile(Base):
    """
    Perfil de impresión (slicer) de un filamento del inventario.

    Atributos:
        id:                     PK autoincremental.
        inventory_item_id:      FK única a `inventory_items.id` (1:1).
        nozzle_temp_min:        Temperatura mínima de boquilla (°C).
        nozzle_temp_max:        Temperatura máxima de boquilla (°C).
        bed_temp:                Temperatura de cama (°C).
        bed_temp_first_layer:    Temperatura de cama en la primera capa (°C).
        print_speed_mms:         Velocidad de impresión (mm/s).
        retraction_distance_mm:  Distancia de retracción (mm).
        retraction_speed_mms:    Velocidad de retracción (mm/s).
        flow_ratio:              Multiplicador de flujo (ej. 0.98).
        fan_speed_percent:       Velocidad del fan (%).
        k_value:                 K-factor de presión dinámica (Bambu/Klipper),
                                  calibrado manualmente (ej. "0.020").
        nozzle_diameter:         Diámetro de boquilla usado en la calibración
                                  del K-value (ej. "0.4") — el K depende de esto.
        calibrated_at:           Fecha de la última calibración manual.
        notes:                   Notas libres (ej. "necesita enclosure").
        created_at, updated_at:  Timestamps UTC.
    """

    __tablename__ = "filament_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inventory_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    nozzle_temp_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    nozzle_temp_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bed_temp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bed_temp_first_layer: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    print_speed_mms: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1), nullable=True)
    retraction_distance_mm: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    retraction_speed_mms: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1), nullable=True)
    flow_ratio: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3), nullable=True)
    fan_speed_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    k_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4), nullable=True)
    nozzle_diameter: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    calibrated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
