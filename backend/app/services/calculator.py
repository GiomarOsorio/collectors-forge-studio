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
) -> QuoteCostBreakdown:
    """
    Calcula el costo total de una pieza 3D.

    Fórmula:
    1. Material = gramos × (precio_por_kg / 1000)
    2. Electricidad = watts × horas × tarifa_kWh / 1000
    3. Depreciación = (precio_impresora / vida_útil_horas) × horas_impresión
    4. Mantenimiento = (costo_boquilla/vida_boquilla + costo_placa/vida_placa + otros) × horas
    5. Mano de obra = (preparación + post_procesado) × costo_hora
    6. Factor de fallos = % sobre el subtotal anterior
    7. Margen = % sobre el total con fallos
    """
    # 1. Costo de material
    price_per_gram = filament.price_per_kg / 1000.0
    material_cost = weight_grams * price_per_gram

    # 2. Costo de electricidad
    kwh_consumed = (printer.power_consumption_watts * print_time_hours) / 1000.0
    electricity_cost = kwh_consumed * app_settings.electricity_rate

    # 3. Depreciación de la impresora
    depreciation_per_hour = printer.purchase_price / printer.estimated_lifespan_hours
    depreciation_cost = depreciation_per_hour * print_time_hours

    # 4. Mantenimiento
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
    maintenance_per_hour = (
        nozzle_cost_per_hour + buildplate_cost_per_hour + printer.other_maintenance_per_hour
    )
    maintenance_cost = maintenance_per_hour * print_time_hours

    # 5. Mano de obra
    total_labor_hours = preparation_time_hours + post_processing_time_hours
    labor_cost = total_labor_hours * app_settings.labor_cost_per_hour

    # Subtotal antes de fallos
    base_cost = material_cost + electricity_cost + depreciation_cost + maintenance_cost + labor_cost

    # 6. Factor de fallos
    failure_rate = app_settings.failure_rate_percent / 100.0
    failure_cost = base_cost * failure_rate

    # Subtotal con fallos
    subtotal = base_cost + failure_cost

    # 7. Margen de ganancia
    margin = margin_percent if margin_percent is not None else app_settings.default_margin_percent
    margin_amount = subtotal * (margin / 100.0)

    # Total por unidad
    total_per_unit = round(subtotal + margin_amount, 2)

    # Total final
    total_price = round(total_per_unit * quantity, 2)

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
    )
