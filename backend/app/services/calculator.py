"""
Motor de cálculo de costos de impresión 3D para Collector's Forge Studio.

Fórmula de cálculo aplicada:
    El peso y tiempo de impresión representan el trabajo completo (la placa con
    todas las piezas). La cantidad indica cuántas piezas produce ese trabajo.

    1. Costo de material   = gramos_totales × (precio_por_kg / 1000) + filamentos adicionales
    2. Costo eléctrico     = (watts × horas_totales / 1000) × tarifa_kWh
    3. Depreciación        = (precio_impresora / vida_útil_horas) × horas_totales
    4. Mantenimiento       = (boquilla/vida_boquilla + placa/vida_placa + otros) × horas_totales
    5. Mano de obra        = (t_preparación + t_post_procesado) × costo_hora
    6. Costo de fallos     = (suma 1-5) × (tasa_fallos / 100)
    7. Subtotal base       = suma 1-5 + costo_fallos
    8. Insumos adicionales = suma(cantidad × precio_unitario) por cada insumo
    9. Desgaste consumible = suma(unit_cost_cal / useful_life_hours × horas_impresión)
   10. Subtotal final      = subtotal_base + insumos + consumibles
   11. Margen              = subtotal_final × (margen_percent / 100)
   12. Total trabajo       = subtotal_final + margen  (lo que paga el cliente)
   13. Precio por pieza    = total_trabajo / cantidad
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.schemas.quote import QuoteCostBreakdown

# Constantes de cuantización — nunca se construye Decimal desde float literal
_2     = Decimal("0.01")
_4     = Decimal("0.0001")
_0     = Decimal("1")       # enteros para COP
_D0    = Decimal("0")
_D100  = Decimal("100")
_D1000 = Decimal("1000")


def _d(value) -> Decimal:
    """
    Convierte un valor externo (float de JSON, dict de supplies) a Decimal.

    Solo se usa para valores que vienen de fuentes externas (dicts de supplies
    y additional_filaments que el router construye desde JSON). Los campos ORM
    ya llegan como Decimal desde asyncpg (columnas Numeric). NUNCA se hace
    Decimal(float_value) directamente; se usa str() como puente intermedio.
    """
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def calculate_cost(
    filament: Filament,
    printer: Printer,
    app_settings: AppSettings,
    weight_grams: Decimal,
    print_time_hours: Decimal,
    preparation_time_hours: Decimal,
    post_processing_time_hours: Decimal,
    quantity: int,
    margin_percent: Optional[Decimal] = None,
    usd_to_cop_rate: Optional[Decimal] = None,
    supplies: Optional[List[dict]] = None,
    additional_filaments: Optional[List[dict]] = None,
    consumables: Optional[List[dict]] = None,
) -> QuoteCostBreakdown:
    """
    Calcula el costo total de imprimir una pieza 3D con desglose por componente.

    Todos los campos de filament, printer y app_settings son Decimal (columnas
    Numeric → asyncpg devuelve Decimal automáticamente). Los parámetros de
    entrada weight_grams, print_time_hours, etc. se reciben como Decimal desde
    los schemas Pydantic. Los dicts en supplies, additional_filaments y consumables
    pueden traer float desde JSON; se convierten con _d() antes de cualquier operación.

    La conversión de tipo es responsabilidad exclusiva de los schemas (Pydantic).
    El dominio opera únicamente con Decimal en todos los pasos.

    Args:
        filament:                    ORM Filament. Campos son Decimal.
        printer:                     ORM Printer. Campos son Decimal.
        app_settings:                ORM AppSettings. Campos son Decimal.
        weight_grams:                Gramos de filamento (Decimal).
        print_time_hours:            Horas de impresión (Decimal).
        preparation_time_hours:      Horas de preparación (Decimal).
        post_processing_time_hours:  Horas de post-procesado (Decimal).
        quantity:                    Número de unidades (int).
        margin_percent:              Margen de ganancia opcional (Decimal).
        usd_to_cop_rate:             Tasa USD→COP opcional (Decimal).
        supplies:                    Lista de dicts de insumos con float desde JSON.
        additional_filaments:        Lista de dicts de filamentos extra con float desde JSON.
        consumables:                 Lista de dicts de consumibles con unit_cost_cal y
                                     useful_life_hours. Su desgaste se calcula automáticamente
                                     proporcional a print_time_hours.

    Returns:
        QuoteCostBreakdown con todos los valores como Decimal.
        La conversión a float para JSON ocurre en el schema (PlainSerializer).
    """

    # ── Normalización de entradas (float → Decimal) ──────────────────────────
    # _d() es idempotente: los Decimal pasan tal cual; los float/int se convierten
    # via str() para eliminar artefactos IEEE 754 antes de cualquier aritmética.
    # Necesario mientras los schemas Pydantic usen float y los modelos AppSettings
    # sigan teniendo columnas Float en lugar de Numeric.
    weight_grams               = _d(weight_grams)
    print_time_hours           = _d(print_time_hours)
    preparation_time_hours     = _d(preparation_time_hours)
    post_processing_time_hours = _d(post_processing_time_hours)

    # ── 1. Costo de material ─────────────────────────────────────────────────
    price_per_gram: Decimal = _d(filament.price_per_kg) / _D1000
    material_cost: Decimal = weight_grams * price_per_gram

    for af in (additional_filaments or []):
        af_weight = _d(af["weight_grams"])
        af_price_per_gram = _d(af["price_per_kg"]) / _D1000
        material_cost += af_weight * af_price_per_gram

    # ── 2. Costo de electricidad ─────────────────────────────────────────────
    kwh_consumed: Decimal = (_d(printer.power_consumption_watts) * print_time_hours) / _D1000
    electricity_cost: Decimal = kwh_consumed * _d(app_settings.electricity_rate)

    # ── 3. Depreciación lineal ───────────────────────────────────────────────
    estimated_lifespan: Decimal = _d(printer.estimated_lifespan_hours)
    depreciation_per_hour: Decimal = (
        _d(printer.purchase_price) / estimated_lifespan
        if estimated_lifespan > _D0
        else _D0
    )
    depreciation_cost: Decimal = depreciation_per_hour * print_time_hours

    # ── 4. Mantenimiento ─────────────────────────────────────────────────────
    nozzle_lifespan: Decimal = _d(printer.nozzle_lifespan_hours)
    nozzle_cost_per_hour: Decimal = (
        _d(printer.nozzle_price) / nozzle_lifespan
        if nozzle_lifespan > _D0
        else _D0
    )
    buildplate_lifespan: Decimal = _d(printer.buildplate_lifespan_hours)
    buildplate_cost_per_hour: Decimal = (
        _d(printer.buildplate_price) / buildplate_lifespan
        if buildplate_lifespan > _D0
        else _D0
    )
    maintenance_per_hour: Decimal = (
        nozzle_cost_per_hour + buildplate_cost_per_hour + _d(printer.other_maintenance_per_hour)
    )
    maintenance_cost: Decimal = maintenance_per_hour * print_time_hours

    # ── 5. Mano de obra ──────────────────────────────────────────────────────
    total_labor_hours: Decimal = preparation_time_hours + post_processing_time_hours
    labor_cost: Decimal = total_labor_hours * _d(app_settings.labor_cost_per_hour)

    base_cost: Decimal = (
        material_cost + electricity_cost + depreciation_cost + maintenance_cost + labor_cost
    )

    # ── 6. Factor de fallos ──────────────────────────────────────────────────
    failure_rate: Decimal = _d(app_settings.failure_rate_percent) / _D100
    failure_cost: Decimal = base_cost * failure_rate

    subtotal: Decimal = base_cost + failure_cost

    # ── 8. Insumos adicionales ───────────────────────────────────────────────
    # Los valores de los dicts vienen de JSON (float); _d() los convierte a Decimal.
    # Los valores en supplies_detail se mantienen como Decimal — la conversión
    # a float para JSON es responsabilidad del schema (PlainSerializer).
    supplies_detail: list = []
    supplies_cost: Decimal = _D0

    for s in (supplies or []):
        qty: Decimal = _d(s["quantity"])
        unit_price: Decimal = _d(s["price_per_unit"])
        line_total: Decimal = (qty * unit_price).quantize(_4, rounding=ROUND_HALF_UP)
        supplies_cost += line_total
        supplies_detail.append({
            "name":       s["name"],
            "unit":       s["unit"],
            "quantity":   qty,         # Decimal — no float(); schema convierte al serializar
            "unit_price": unit_price,  # Decimal
            "subtotal":   line_total,  # Decimal
        })

    supplies_cost = supplies_cost.quantize(_2, rounding=ROUND_HALF_UP)

    # ── 9. Desgaste de consumibles ────────────────────────────────────────────
    # Los consumibles (boquillas, calcetas, filtros, etc.) se desgastan
    # proporcionalmente a las horas de impresión. Se cargan automáticamente
    # desde el inventario (categoría "Consumible") sin intervención del usuario.
    # Fórmula por consumible: unit_cost_cal / useful_life_hours × print_time_hours
    consumables_wear_cost: Decimal = _D0
    for c in (consumables or []):
        life_hours: Decimal = _d(c["useful_life_hours"])
        cost_cal: Decimal = _d(c["unit_cost_cal"])
        if life_hours > _D0:
            consumables_wear_cost += (cost_cal / life_hours * print_time_hours).quantize(
                _4, rounding=ROUND_HALF_UP
            )
    consumables_wear_cost = consumables_wear_cost.quantize(_2, rounding=ROUND_HALF_UP)

    subtotal_with_supplies: Decimal = subtotal + supplies_cost + consumables_wear_cost

    # ── 11. Margen ────────────────────────────────────────────────────────────
    margin: Decimal = (
        _d(margin_percent) if margin_percent is not None else _d(app_settings.default_margin_percent)
    )
    margin_amount: Decimal = subtotal_with_supplies * (margin / _D100)

    total_price: Decimal = (subtotal_with_supplies + margin_amount).quantize(
        _2, rounding=ROUND_HALF_UP
    )

    # Decimal / int es seguro — Python soporta Decimal.__truediv__(int) directamente.
    # No se necesita Decimal(str(quantity)); quantity es int y no tiene representación
    # IEEE 754 a limpiar.
    total_per_unit: Decimal = (total_price / quantity).quantize(_2, rounding=ROUND_HALF_UP)

    # ── Conversión COP ────────────────────────────────────────────────────────
    total_per_unit_cop: Optional[Decimal] = None
    total_price_cop: Optional[Decimal] = None
    if usd_to_cop_rate:
        rate: Decimal = _d(usd_to_cop_rate)
        total_per_unit_cop = (total_per_unit * rate).quantize(_0, rounding=ROUND_HALF_UP)
        total_price_cop = (total_price * rate).quantize(_0, rounding=ROUND_HALF_UP)

    return QuoteCostBreakdown(
        material_cost=material_cost.quantize(_2, rounding=ROUND_HALF_UP),
        electricity_cost=electricity_cost.quantize(_2, rounding=ROUND_HALF_UP),
        depreciation_cost=depreciation_cost.quantize(_2, rounding=ROUND_HALF_UP),
        maintenance_cost=maintenance_cost.quantize(_2, rounding=ROUND_HALF_UP),
        labor_cost=labor_cost.quantize(_2, rounding=ROUND_HALF_UP),
        failure_cost=failure_cost.quantize(_2, rounding=ROUND_HALF_UP),
        subtotal=subtotal_with_supplies.quantize(_2, rounding=ROUND_HALF_UP),
        margin_percent=margin,
        margin_amount=margin_amount.quantize(_2, rounding=ROUND_HALF_UP),
        total_per_unit=total_per_unit,
        quantity=quantity,
        total_price=total_price,
        supplies_cost=supplies_cost,
        supplies_detail=supplies_detail,
        consumables_wear_cost=consumables_wear_cost,
        usd_to_cop_rate=_d(usd_to_cop_rate) if usd_to_cop_rate else None,
        total_per_unit_cop=total_per_unit_cop,
        total_price_cop=total_price_cop,
    )
