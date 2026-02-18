"""
Modelo ORM para la tabla de cotizaciones de impresión 3D.

Define la entidad Quote que representa el resultado completo de un cálculo de
costo de impresión guardado en el historial del usuario. Almacena tanto los
parámetros de entrada (peso, tiempo, cantidad) como el desglose detallado de
todos los componentes del costo (material, electricidad, depreciación,
mantenimiento, mano de obra, fallos y margen).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Float, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Quote(Base):
    """
    Modelo de base de datos que representa una cotización de impresión 3D guardada.

    Cada cotización es el resultado persistido de ejecutar el motor de cálculo
    de costos para una pieza específica. Contiene referencias al filamento e
    impresora utilizados, los parámetros de la impresión y el desglose completo
    de costos para facilitar la consulta histórica y la generación de PDFs.

    Atributos:
        id: Clave primaria autoincremental de la cotización.
        user_id: Clave foránea hacia el usuario propietario de la cotización.

        -- Información de la pieza --
        piece_name: Nombre descriptivo de la pieza o trabajo cotizado.
        description: Descripción opcional detallada del trabajo.
        client_name: Nombre opcional del cliente al que va dirigida la cotización.

        -- Referencias a recursos --
        filament_id: Clave foránea al filamento utilizado en la cotización.
        printer_id: Clave foránea a la impresora utilizada en la cotización.

        -- Parámetros de impresión --
        weight_grams: Cantidad de filamento consumido en gramos.
        print_time_hours: Duración de la impresión en horas.
        preparation_time_hours: Tiempo de preparación del archivo y la impresora
            en horas. Contribuye al costo de mano de obra.
        post_processing_time_hours: Tiempo de post-procesado (lijado, pintura,
            ensamblaje, etc.) en horas. Contribuye al costo de mano de obra.
        quantity: Número de unidades de la pieza a producir.

        -- Desglose de costos (valores calculados por unidad) --
        material_cost: Costo del filamento consumido por unidad.
        electricity_cost: Costo de electricidad consumida por unidad.
        depreciation_cost: Cuota de depreciación de la impresora por unidad.
        maintenance_cost: Costo de mantenimiento (boquilla, placa, otros) por unidad.
        labor_cost: Costo de mano de obra (preparación + post-procesado) por unidad.
        failure_cost: Incremento porcentual para absorber impresiones fallidas.
        subtotal: Suma de todos los costos anteriores (base_cost + failure_cost).
        margin_percent: Porcentaje de margen de ganancia aplicado.
        margin_amount: Importe en moneda del margen de ganancia.
        total_per_unit: Precio de venta recomendado por unidad (subtotal + margen).
        total_price: Precio total para todas las unidades (total_per_unit × quantity).

        -- Metadata --
        notes: Notas opcionales adicionales sobre la cotización.
        created_at: Marca de tiempo UTC de creación de la cotización.
    """

    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))

    # Información de la pieza
    piece_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Referencias al filamento e impresora utilizados
    filament_id: Mapped[int] = mapped_column(Integer, ForeignKey("filaments.id"))
    printer_id: Mapped[int] = mapped_column(Integer, ForeignKey("printers.id"))

    # Parámetros de impresión ingresados por el usuario
    weight_grams: Mapped[float] = mapped_column(Float)               # Gramos de filamento
    print_time_hours: Mapped[float] = mapped_column(Float)           # Tiempo de impresión
    preparation_time_hours: Mapped[float] = mapped_column(Float, default=0.0)       # Preparación
    post_processing_time_hours: Mapped[float] = mapped_column(Float, default=0.0)   # Post-procesado
    quantity: Mapped[int] = mapped_column(Integer, default=1)        # Cantidad de piezas

    # Desglose de costos calculados (por unidad)
    material_cost: Mapped[float] = mapped_column(Float)
    electricity_cost: Mapped[float] = mapped_column(Float)
    depreciation_cost: Mapped[float] = mapped_column(Float)
    maintenance_cost: Mapped[float] = mapped_column(Float)
    labor_cost: Mapped[float] = mapped_column(Float)
    failure_cost: Mapped[float] = mapped_column(Float)    # Costo absorbido por fallos
    subtotal: Mapped[float] = mapped_column(Float)
    margin_percent: Mapped[float] = mapped_column(Float)
    margin_amount: Mapped[float] = mapped_column(Float)
    total_per_unit: Mapped[float] = mapped_column(Float)
    total_price: Mapped[float] = mapped_column(Float)     # total_per_unit * quantity

    # Insumos adicionales (argollas, switches, etc.) - JSON: [{name, quantity, unit, unit_price, subtotal}]
    supplies_cost: Mapped[float] = mapped_column(Float, default=0.0)
    supplies_detail: Mapped[Optional[str]] = mapped_column(Text, default="[]", nullable=True)

    # Filamentos adicionales para piezas multicolor - JSON: [{filament_id, name, weight_grams, material_cost}]
    additional_filaments_detail: Mapped[Optional[str]] = mapped_column(Text, default="[]", nullable=True)

    # Metadata
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
