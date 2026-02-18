"""
Esquemas Pydantic para la gestión de impresoras 3D.

Define los modelos de validación de datos utilizados en los endpoints CRUD
de impresoras. Incluye esquemas separados para creación, actualización parcial
y respuesta, siguiendo el mismo patrón que el resto de recursos de la API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PrinterCreate(BaseModel):
    """
    Esquema para el registro de una nueva impresora 3D.

    Utilizado en el cuerpo de la solicitud POST /api/printers/.
    Los campos requeridos son los mínimos necesarios para calcular costos.
    Los campos de mantenimiento tienen valores por defecto de cero para
    permitir registros simplificados.

    Atributos:
        name: Nombre personalizado dado por el usuario a la impresora.
            Ej: "Mi BambuLab P1S Combo".
        model: Modelo comercial de la impresora. Ej: "BambuLab P1S Combo".
        purchase_price: Precio de compra en la moneda configurada. Usado
            para calcular la depreciación lineal por hora de uso.
        power_consumption_watts: Consumo eléctrico promedio en vatios
            durante la impresión. Usado para calcular el costo de electricidad.
        estimated_lifespan_hours: Vida útil estimada en horas de impresión.
            Define el denominador del cálculo de depreciación por hora.
        current_hours: Horas de uso acumuladas en el momento del registro.
            Por defecto 0.0 para equipos nuevos.
        nozzle_price: Precio de reemplazo de la boquilla. Por defecto 0.0.
        nozzle_lifespan_hours: Horas de vida útil de la boquilla. Por defecto 500 h.
        buildplate_price: Precio de reemplazo de la placa. Por defecto 0.0.
        buildplate_lifespan_hours: Horas de vida útil de la placa. Por defecto 2000 h.
        other_maintenance_per_hour: Otros costos de mantenimiento por hora. Por defecto 0.0.
        notes: Notas opcionales sobre la impresora.
    """

    name: str
    model: str
    purchase_price: float
    power_consumption_watts: float
    estimated_lifespan_hours: float
    current_hours: float = 0.0
    nozzle_price: float = 0.0
    nozzle_lifespan_hours: float = 500.0
    buildplate_price: float = 0.0
    buildplate_lifespan_hours: float = 2000.0
    other_maintenance_per_hour: float = 0.0
    notes: Optional[str] = None


class PrinterUpdate(BaseModel):
    """
    Esquema para la actualización parcial de una impresora existente.

    Utilizado en el cuerpo de la solicitud PUT /api/printers/{id}.
    Todos los campos son opcionales; solo se actualizan los campos enviados
    en la solicitud, lo que permite modificar, por ejemplo, únicamente las
    horas de uso actuales sin necesidad de re-enviar todos los demás campos.

    Atributos:
        name: Nuevo nombre personalizado (opcional).
        model: Nuevo modelo comercial (opcional).
        purchase_price: Nuevo precio de compra (opcional).
        power_consumption_watts: Nuevo consumo en vatios (opcional).
        estimated_lifespan_hours: Nueva vida útil estimada en horas (opcional).
        current_hours: Nuevas horas de uso acumuladas (opcional).
        nozzle_price: Nuevo precio de boquilla (opcional).
        nozzle_lifespan_hours: Nueva vida útil de la boquilla (opcional).
        buildplate_price: Nuevo precio de la placa (opcional).
        buildplate_lifespan_hours: Nueva vida útil de la placa (opcional).
        other_maintenance_per_hour: Nuevos otros costos por hora (opcional).
        notes: Nuevas notas (opcional).
    """

    name: Optional[str] = None
    model: Optional[str] = None
    purchase_price: Optional[float] = None
    power_consumption_watts: Optional[float] = None
    estimated_lifespan_hours: Optional[float] = None
    current_hours: Optional[float] = None
    nozzle_price: Optional[float] = None
    nozzle_lifespan_hours: Optional[float] = None
    buildplate_price: Optional[float] = None
    buildplate_lifespan_hours: Optional[float] = None
    other_maintenance_per_hour: Optional[float] = None
    notes: Optional[str] = None


class PrinterResponse(BaseModel):
    """
    Esquema de respuesta con los datos completos de una impresora.

    Devuelto por los endpoints GET, POST y PUT del recurso impresoras.
    Incluye todos los campos del modelo ORM, incluidos los generados
    automáticamente por la base de datos.

    Atributos:
        id: Identificador numérico único de la impresora.
        name: Nombre personalizado de la impresora.
        model: Modelo comercial.
        purchase_price: Precio de compra.
        power_consumption_watts: Consumo eléctrico en vatios.
        estimated_lifespan_hours: Vida útil estimada en horas.
        current_hours: Horas de uso acumuladas.
        nozzle_price: Precio de la boquilla.
        nozzle_lifespan_hours: Vida útil de la boquilla en horas.
        buildplate_price: Precio de la placa de construcción.
        buildplate_lifespan_hours: Vida útil de la placa en horas.
        other_maintenance_per_hour: Otros costos de mantenimiento por hora.
        notes: Notas adicionales (puede ser None).
        created_at: Fecha y hora UTC de creación del registro.
        updated_at: Fecha y hora UTC de la última modificación.
    """

    id: int
    name: str
    model: str
    purchase_price: float
    power_consumption_watts: float
    estimated_lifespan_hours: float
    current_hours: float
    nozzle_price: float
    nozzle_lifespan_hours: float
    buildplate_price: float
    buildplate_lifespan_hours: float
    other_maintenance_per_hour: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Permite construir el schema a partir de instancias ORM (from_orm)
    model_config = {"from_attributes": True}
