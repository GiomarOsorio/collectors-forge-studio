"""
Motor de cálculo de costos de impresión 3D para Calculator3D.

Este módulo implementa la función principal de cálculo que determina el costo
total de imprimir una pieza 3D, desglosado en todos sus componentes. El
algoritmo toma como entrada los datos del filamento, la impresora y la
configuración del usuario, junto con los parámetros específicos de la
impresión (peso, tiempo, cantidad), y devuelve un desglose detallado.

Fórmula de cálculo aplicada:
    1. Costo de material  = gramos × (precio_por_kg / 1000)
    2. Costo eléctrico    = (watts × horas / 1000) × tarifa_kWh
    3. Depreciación       = (precio_impresora / vida_útil_horas) × horas
    4. Mantenimiento      = (boquilla/vida_boquilla + placa/vida_placa + otros) × horas
    5. Mano de obra       = (t_preparación + t_post_procesado) × costo_hora
    6. Costo de fallos    = (suma 1-5) × (tasa_fallos / 100)
    7. Subtotal           = suma 1-5 + costo_fallos
    8. Margen             = subtotal × (margen_percent / 100)
    9. Total por unidad   = subtotal + margen
   10. Total final        = total_por_unidad × cantidad
"""

from typing import Optional

from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.schemas.quote import QuoteCostBreakdown


def calculate_cost(
    filament: Filament,
    printer: Printer,
    app_settings: AppSettings,
    weight_grams: float,
    print_time_hours: float,
    preparation_time_hours: float,
    post_processing_time_hours: float,
    quantity: int,
    margin_percent: Optional[float] = None,
    usd_to_cop_rate: Optional[float] = None,
) -> QuoteCostBreakdown:
    """
    Calcula el costo total de imprimir una pieza 3D con desglose por componente.

    Aplica el modelo de costos de siete pasos descrito en el módulo, tomando
    en cuenta todos los gastos directos e indirectos asociados a la producción
    de la pieza: materiales, energía, desgaste del equipo, mano de obra y
    un porcentaje de absorción de impresiones fallidas. Finalmente aplica el
    margen de ganancia configurado.

    Todos los valores monetarios del resultado se redondean a dos decimales
    para facilitar la presentación al usuario y en los PDFs generados.

    Args:
        filament: Instancia ORM del filamento a utilizar. Se leen brand,
            price_per_kg y density.
        printer: Instancia ORM de la impresora a utilizar. Se leen
            purchase_price, estimated_lifespan_hours, power_consumption_watts,
            nozzle_price, nozzle_lifespan_hours, buildplate_price,
            buildplate_lifespan_hours y other_maintenance_per_hour.
        app_settings: Instancia ORM con la configuración del usuario. Se leen
            electricity_rate, labor_cost_per_hour, failure_rate_percent y
            default_margin_percent.
        weight_grams: Gramos de filamento consumidos por la pieza. Generalmente
            obtenido del slicer.
        print_time_hours: Duración de la impresión en horas. Generalmente
            obtenido del slicer.
        preparation_time_hours: Horas dedicadas a preparar el archivo y la
            impresora. Contribuye al costo de mano de obra.
        post_processing_time_hours: Horas de trabajo manual posterior a la
            impresión (lijado, pintura, ensamblaje). Contribuye a mano de obra.
        quantity: Número de unidades idénticas a producir.
        margin_percent: Porcentaje de margen de ganancia a aplicar. Si es None,
            se utiliza el valor default_margin_percent de app_settings.

    Returns:
        QuoteCostBreakdown: Objeto Pydantic con el desglose completo de costos:
            material_cost, electricity_cost, depreciation_cost,
            maintenance_cost, labor_cost, failure_cost, subtotal,
            margin_percent, margin_amount, total_per_unit, quantity
            y total_price. Todos los valores monetarios redondeados a 2 decimales.
    """
    # 1. Costo de material: convierte precio/kg a precio/gramo y multiplica por el peso
    price_per_gram = filament.price_per_kg / 1000.0
    material_cost = weight_grams * price_per_gram

    # 2. Costo de electricidad: convierte watts×horas a kWh y aplica la tarifa
    kwh_consumed = (printer.power_consumption_watts * print_time_hours) / 1000.0
    electricity_cost = kwh_consumed * app_settings.electricity_rate

    # 3. Depreciación lineal de la impresora: divide el costo total entre la vida útil
    depreciation_per_hour = printer.purchase_price / printer.estimated_lifespan_hours
    depreciation_cost = depreciation_per_hour * print_time_hours

    # 4. Costo de mantenimiento: suma los costos por hora de boquilla, placa y otros
    nozzle_cost_per_hour = (
        printer.nozzle_price / printer.nozzle_lifespan_hours
        if printer.nozzle_lifespan_hours > 0
        else 0.0
    )
    buildplate_cost_per_hour = (
        printer.buildplate_price / printer.buildplate_lifespan_hours
        if printer.buildplate_lifespan_hours > 0
        else 0.0
    )
    # Costo total de mantenimiento por hora (boquilla + placa + otros)
    maintenance_per_hour = (
        nozzle_cost_per_hour + buildplate_cost_per_hour + printer.other_maintenance_per_hour
    )
    maintenance_cost = maintenance_per_hour * print_time_hours

    # 5. Mano de obra: solo se cobran las horas manuales (preparación y post-procesado)
    total_labor_hours = preparation_time_hours + post_processing_time_hours
    labor_cost = total_labor_hours * app_settings.labor_cost_per_hour

    # Subtotal base antes de aplicar el factor de fallos
    base_cost = material_cost + electricity_cost + depreciation_cost + maintenance_cost + labor_cost

    # 6. Factor de fallos: porcentaje del costo base para absorber impresiones fallidas
    failure_rate = app_settings.failure_rate_percent / 100.0
    failure_cost = base_cost * failure_rate

    # Subtotal final incluyendo la absorción de fallos
    subtotal = base_cost + failure_cost

    # 7. Margen de ganancia: usa el proporcionado o el configurado por defecto
    margin = margin_percent if margin_percent is not None else app_settings.default_margin_percent
    margin_amount = subtotal * (margin / 100.0)

    # Total por unidad redondeado a 2 decimales para presentación
    total_per_unit = round(subtotal + margin_amount, 2)

    # Total final para todas las unidades solicitadas
    total_price = round(total_per_unit * quantity, 2)

    # Conversión a pesos colombianos si se proporcionó la tasa
    total_per_unit_cop = round(total_per_unit * usd_to_cop_rate, 0) if usd_to_cop_rate else None
    total_price_cop = round(total_price * usd_to_cop_rate, 0) if usd_to_cop_rate else None

    return QuoteCostBreakdown(
        material_cost=round(material_cost, 2),
        electricity_cost=round(electricity_cost, 2),
        depreciation_cost=round(depreciation_cost, 2),
        maintenance_cost=round(maintenance_cost, 2),
        labor_cost=round(labor_cost, 2),
        failure_cost=round(failure_cost, 2),
        subtotal=round(subtotal, 2),
        margin_percent=margin,
        margin_amount=round(margin_amount, 2),
        total_per_unit=total_per_unit,
        quantity=quantity,
        total_price=total_price,
        usd_to_cop_rate=usd_to_cop_rate,
        total_per_unit_cop=total_per_unit_cop,
        total_price_cop=total_price_cop,
    )
