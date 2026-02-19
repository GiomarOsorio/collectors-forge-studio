"""
Esquemas Pydantic para las cotizaciones de impresión 3D.

Define los modelos de validación y serialización de datos para los endpoints
de cotizaciones. Incluye el schema de solicitud de cálculo, el desglose de
costos devuelto como respuesta de preview, y el schema de respuesta completo
para cotizaciones guardadas en el historial.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class FilamentItem(BaseModel):
    """
    Referencia a un filamento adicional para piezas multicolor o multimaterial.

    Se usa en QuoteCalculateRequest.additional_filaments para indicar qué
    filamentos extra (distintos al principal) se usan en la pieza y cuántos
    gramos consume cada uno. Su costo de material se suma al del filamento
    principal en el motor de cálculo.

    Atributos:
        filament_id:  ID del filamento adicional registrado en el catálogo.
        weight_grams: Gramos de este filamento consumidos por la pieza.
    """
    filament_id: int
    weight_grams: float


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
    margin_percent: Optional[float] = None
    save: bool = True
    # Insumos adicionales (argollas, switches, etc.)
    supplies: List["SupplyItemRef"] = []
    # Filamentos adicionales para piezas multicolor o multimaterial
    additional_filaments: List[FilamentItem] = []
    # Nota sobre supplies y additional_filaments:
    #   supplies:              Lista de insumos no filamento (argollas, imanes, etc.)
    #                          que se incorporan físicamente a la pieza. Cada uno
    #                          contribuye a supplies_cost en el desglose final.
    #   additional_filaments:  Filamentos extra distintos al filament_id principal.
    #                          Su costo se suma a material_cost (piezas multicolor).


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
    # Insumos adicionales:
    #   supplies_cost:   Suma del costo de todos los insumos por unidad (USD).
    #   supplies_detail: Lista de dicts con el desglose por insumo (nombre,
    #                    cantidad, precio unitario y subtotal).
    supplies_cost: float = 0.0
    supplies_detail: list = []
    # Conversión a pesos colombianos (solo si se proporcionó la tasa de cambio):
    #   usd_to_cop_rate:    Tasa 1 USD → COP usada en la conversión.
    #   total_per_unit_cop: Precio por unidad expresado en COP.
    #   total_price_cop:    Precio total de todas las unidades en COP.
    usd_to_cop_rate: Optional[float] = None
    total_per_unit_cop: Optional[float] = None
    total_price_cop: Optional[float] = None


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
    supplies_cost: float = 0.0
    supplies_detail: Optional[str] = "[]"
    additional_filaments_detail: Optional[str] = "[]"
    usd_to_cop_rate: Optional[float] = None
    total_per_unit_cop: Optional[float] = None
    total_price_cop: Optional[float] = None
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# Referencia circular resuelta aquí para evitar importar supply en quote
class SupplyItemRef(BaseModel):
    """
    Referencia a un insumo del catálogo para incluir en una cotización.

    Se usa en QuoteCalculateRequest.supplies para indicar qué insumos se
    incorporan a la pieza y en qué cantidad. El router resuelve el precio
    desde la BD y lo pasa al motor de cálculo para determinar supplies_cost.

    Atributos:
        supply_id: ID del insumo registrado en el catálogo de insumos.
        quantity:  Cantidad de unidades de este insumo por pieza. Por defecto 1.0.
    """
    supply_id: int
    quantity: float = 1.0


QuoteCalculateRequest.model_rebuild()
