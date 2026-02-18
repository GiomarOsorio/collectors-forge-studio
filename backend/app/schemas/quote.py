"""
Esquemas Pydantic para las cotizaciones de impresión 3D.

Define los modelos de validación y serialización de datos para los endpoints
de cotizaciones. Incluye el schema de solicitud de cálculo, el desglose de
costos devuelto como respuesta de preview, y el schema de respuesta completo
para cotizaciones guardadas en el historial.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class QuoteCalculateRequest(BaseModel):
    """
    Esquema de solicitud para calcular o crear una cotización de impresión 3D.

    Utilizado como cuerpo de las solicitudes POST /api/quotes/calculate y
    POST /api/quotes/. Contiene todos los parámetros de entrada necesarios para
    que el motor de cálculo determine el costo completo de la impresión.

    Atributos:
        piece_name: Nombre descriptivo de la pieza a imprimir.
            Ej: "Soporte para monitor", "Engranaje de repuesto".
        description: Descripción opcional detallada del trabajo.
        client_name: Nombre opcional del cliente para el que se realiza
            la cotización. Aparece en el PDF generado.
        filament_id: ID del filamento registrado en el sistema que se usará.
        printer_id: ID de la impresora registrada en el sistema que se usará.
        weight_grams: Cantidad de filamento estimada para la pieza en gramos.
            Generalmente obtenida del slicer (PrusaSlicer, Bambu Studio, etc.).
        print_time_hours: Duración estimada de la impresión en horas.
            Generalmente obtenida del slicer.
        preparation_time_hours: Tiempo dedicado a preparar el archivo y la
            impresora en horas. Contribuye al costo de mano de obra.
            Por defecto 0.0.
        post_processing_time_hours: Tiempo de post-procesado de la pieza
            (lijado, pintura, ensamblaje) en horas. Por defecto 0.0.
        quantity: Número de unidades de la misma pieza a producir. Por defecto 1.
        margin_percent: Porcentaje de margen de ganancia a aplicar. Si es None,
            se utiliza el margen por defecto configurado por el usuario.
        save: Si es True, la cotización se guarda en el historial del usuario.
            Por defecto True. Usado en POST /api/quotes/ para controlar el
            guardado. En /calculate siempre es una previsualización.
    """

    piece_name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    filament_id: int
    printer_id: int
    weight_grams: float
    print_time_hours: float
    preparation_time_hours: float = 0.0
    post_processing_time_hours: float = 0.0
    quantity: int = 1
    margin_percent: Optional[float] = None  # Si es None, usa el default de settings
    save: bool = True                       # Si guardar en historial


class QuoteCostBreakdown(BaseModel):
    """
    Esquema con el desglose completo de costos de una cotización.

    Devuelto por el endpoint POST /api/quotes/calculate como previsualización
    del costo antes de decidir si guardar la cotización. Contiene los valores
    calculados por el motor de costos desglosados por componente.

    Atributos:
        material_cost: Costo del filamento consumido por unidad.
        electricity_cost: Costo de la electricidad consumida por unidad.
        depreciation_cost: Cuota de depreciación de la impresora por unidad.
        maintenance_cost: Costo total de mantenimiento (boquilla + placa + otros) por unidad.
        labor_cost: Costo de mano de obra (preparación + post-procesado) por unidad.
        failure_cost: Incremento porcentual para absorber impresiones fallidas por unidad.
        subtotal: Suma de todos los costos anteriores incluyendo el factor de fallos.
        margin_percent: Porcentaje de margen de ganancia aplicado.
        margin_amount: Importe en moneda del margen de ganancia por unidad.
        total_per_unit: Precio de venta recomendado por unidad.
        quantity: Número de unidades cotizadas.
        total_price: Precio total para todas las unidades (total_per_unit × quantity).
    """

    material_cost: float
    electricity_cost: float
    depreciation_cost: float
    maintenance_cost: float
    labor_cost: float
    failure_cost: float
    subtotal: float
    margin_percent: float
    margin_amount: float
    total_per_unit: float
    quantity: int
    total_price: float


class QuoteResponse(BaseModel):
    """
    Esquema de respuesta con los datos completos de una cotización guardada.

    Devuelto por los endpoints GET y POST del historial de cotizaciones.
    Contiene todos los campos de QuoteCostBreakdown más los metadatos de
    identificación, los parámetros de entrada originales y las marcas de tiempo.

    Atributos:
        id: Identificador único de la cotización guardada.
        piece_name: Nombre de la pieza cotizada.
        description: Descripción del trabajo (puede ser None).
        client_name: Nombre del cliente (puede ser None).
        filament_id: ID del filamento utilizado.
        printer_id: ID de la impresora utilizada.
        weight_grams: Gramos de filamento utilizados.
        print_time_hours: Tiempo de impresión en horas.
        preparation_time_hours: Tiempo de preparación en horas.
        post_processing_time_hours: Tiempo de post-procesado en horas.
        quantity: Número de unidades cotizadas.
        material_cost: Costo de material por unidad.
        electricity_cost: Costo de electricidad por unidad.
        depreciation_cost: Depreciación de impresora por unidad.
        maintenance_cost: Costo de mantenimiento por unidad.
        labor_cost: Costo de mano de obra por unidad.
        failure_cost: Costo absorbido por fallos por unidad.
        subtotal: Subtotal por unidad (costos + fallos).
        margin_percent: Porcentaje de margen aplicado.
        margin_amount: Importe del margen por unidad.
        total_per_unit: Precio de venta por unidad.
        total_price: Precio total de todas las unidades.
        notes: Notas adicionales (puede ser None).
        created_at: Fecha y hora UTC de creación de la cotización.
    """

    id: int
    piece_name: str
    description: Optional[str]
    client_name: Optional[str]
    filament_id: int
    printer_id: int
    weight_grams: float
    print_time_hours: float
    preparation_time_hours: float
    post_processing_time_hours: float
    quantity: int
    material_cost: float
    electricity_cost: float
    depreciation_cost: float
    maintenance_cost: float
    labor_cost: float
    failure_cost: float
    subtotal: float
    margin_percent: float
    margin_amount: float
    total_per_unit: float
    total_price: float
    notes: Optional[str]
    created_at: datetime

    # Permite construir el schema a partir de instancias ORM (from_orm)
    model_config = {"from_attributes": True}
