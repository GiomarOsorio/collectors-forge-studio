"""
Motor de cálculo de costos de impresión 3D para Calculator3D.

Este módulo implementa la función principal de cálculo que determina el costo
total de imprimir una pieza 3D, desglosado en todos sus componentes. El
algoritmo toma como entrada los datos del filamento, la impresora y la
configuración del usuario, junto con los parámetros específicos de la
impresión (peso, tiempo, cantidad), y devuelve un desglose detallado.

Fórmula de cálculo aplicada:
    El peso y tiempo de impresión representan el trabajo completo (la placa con
    todas las piezas). La cantidad indica cuántas piezas produce ese trabajo.

    1. Costo de material  = gramos_totales × (precio_por_kg / 1000) + filamentos adicionales
    2. Costo eléctrico    = (watts × horas_totales / 1000) × tarifa_kWh
    3. Depreciación       = (precio_impresora / vida_útil_horas) × horas_totales
    4. Mantenimiento      = (boquilla/vida_boquilla + placa/vida_placa + otros) × horas_totales
    5. Mano de obra       = (t_preparación + t_post_procesado) × costo_hora
    6. Costo de fallos    = (suma 1-5) × (tasa_fallos / 100)
    7. Subtotal base      = suma 1-5 + costo_fallos
    8. Insumos            = suma(cantidad × precio_unitario) por cada insumo
    9. Subtotal final     = subtotal_base + insumos
   10. Margen             = subtotal_final × (margen_percent / 100)
   11. Total trabajo      = subtotal_final + margen  (lo que paga el cliente)
   12. Precio por pieza   = total_trabajo / cantidad
"""

from typing import Optional, List

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
    supplies: Optional[List[dict]] = None,
    additional_filaments: Optional[List[dict]] = None,
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
        usd_to_cop_rate: Tasa de cambio 1 USD → COP para calcular los campos
            total_per_unit_cop y total_price_cop. Si es None, dichos campos
            se devuelven como None en el resultado.
        supplies: Lista de dicts con los insumos adicionales de la pieza. Cada
            dict debe tener las claves name, unit, price_per_unit y quantity.
            Generado por _resolve_supplies en el router de cotizaciones.
        additional_filaments: Lista de dicts con filamentos adicionales para
            piezas multicolor o multimaterial. Cada dict debe tener las claves
            price_per_kg y weight_grams. Su costo se suma a material_cost.
            Generado por _resolve_additional_filaments en el router de cotizaciones.

    Returns:
        QuoteCostBreakdown: Objeto Pydantic con el desglose completo de costos:
            material_cost, electricity_cost, depreciation_cost,
            maintenance_cost, labor_cost, failure_cost, subtotal,
            margin_percent, margin_amount, total_per_unit, quantity,
            total_price, supplies_cost, supplies_detail y los campos
            opcionales usd_to_cop_rate, total_per_unit_cop y total_price_cop.
            Todos los valores monetarios redondeados a 2 decimales.
    """
    # 1. Costo de material: filamento principal + filamentos adicionales (multicolor)
    price_per_gram = filament.price_per_kg / 1000.0
    material_cost = weight_grams * price_per_gram
    for af in (additional_filaments or []):
        material_cost += af["weight_grams"] * (af["price_per_kg"] / 1000.0)

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

    # 8. Insumos adicionales: costo de materiales no filamento (argollas, imanes, etc.)
    supplies_detail = []
    supplies_cost = 0.0
    for s in (supplies or []):
        line_total = round(s["quantity"] * s["price_per_unit"], 4)
        supplies_cost += line_total
        supplies_detail.append({
            "name": s["name"],
            "unit": s["unit"],
            "quantity": s["quantity"],
            "unit_price": s["price_per_unit"],
            "subtotal": line_total,
        })
    supplies_cost = round(supplies_cost, 2)

    # Subtotal final incluyendo insumos
    subtotal_with_supplies = subtotal + supplies_cost

    # 10. Margen de ganancia sobre el subtotal final (incluyendo insumos)
    margin = margin_percent if margin_percent is not None else app_settings.default_margin_percent
    margin_amount = subtotal_with_supplies * (margin / 100.0)

    # El precio total es el costo del trabajo completo (la placa con todas las piezas)
    total_price = round(subtotal_with_supplies + margin_amount, 2)
    # El precio por pieza es el total dividido entre la cantidad producida
    total_per_unit = round(total_price / quantity, 2)

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
        subtotal=round(subtotal_with_supplies, 2),
        margin_percent=margin,
        margin_amount=round(margin_amount, 2),
        total_per_unit=total_per_unit,
        quantity=quantity,
        total_price=total_price,
        supplies_cost=supplies_cost,
        supplies_detail=supplies_detail,
        usd_to_cop_rate=usd_to_cop_rate,
        total_per_unit_cop=total_per_unit_cop,
        total_price_cop=total_price_cop,
    )
