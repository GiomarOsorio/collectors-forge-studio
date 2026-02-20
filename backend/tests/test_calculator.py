"""
Tests unitarios del motor de cálculo de costos de impresión 3D.

Todos los inputs y asserts usan Decimal. Nunca float.

Valores de referencia pre-calculados con aritmética Decimal ROUND_HALF_UP
(ver comentarios inline). Los fixtures base están en conftest.py.

NOTA sobre ROUND_HALF_UP vs banker's rounding:
    Python's round(0.125, 2) = 0.12  (banker's rounding — redondea al par)
    ROUND_HALF_UP(0.125, 2)  = 0.13  (redondea siempre hacia arriba en 0.5)
    El motor usa ROUND_HALF_UP en todos los quantize().
"""

from decimal import Decimal

import pytest

from app.services.calculator import calculate_cost


# ─────────────────────────────────────────────────────────────────────────────
# TestMaterialCost
# ─────────────────────────────────────────────────────────────────────────────

class TestMaterialCost:
    """Costo de material: gramos × (precio_kg / 1000)."""

    def test_material_100g_basico(self, filament, printer, app_settings):
        """100g × $0.025/g = $2.50 (exacto, sin redondeo)."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.material_cost == Decimal("2.50")

    def test_material_peso_minimo_no_lanza_excepcion(self, filament, printer, app_settings):
        """0.01g es el peso más pequeño posible. No debe lanzar excepción."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0.01"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        # 0.01g × $0.025/g = $0.00025 → quantize ROUND_HALF_UP → $0.00
        assert result.material_cost >= Decimal("0")
        assert result.total_price >= Decimal("0")

    def test_material_peso_alto_500g(self, filament, printer, app_settings):
        """500g × $0.025/g = $12.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("500"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.material_cost == Decimal("12.50")

    def test_material_peso_cero_cost_cero(self, filament, printer, app_settings):
        """
        Peso 0 llega directamente al calculator (sin pasar por schema).
        El calculator no valida — ese rol es del schema (Field(gt=0)).
        Con 0g el costo de material es $0.00.
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.material_cost == Decimal("0.00")

    def test_material_con_filamentos_adicionales(self, filament, printer, app_settings):
        """
        Principal: 80g × $0.025 = $2.00
        Adicional:  20g × $0.030 = $0.60
        Total:                      $2.60
        """
        additional = [{"price_per_kg": Decimal("30"), "weight_grams": Decimal("20")}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("80"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            additional_filaments=additional,
        )
        assert result.material_cost == Decimal("2.60")


# ─────────────────────────────────────────────────────────────────────────────
# TestElectricityCost
# ─────────────────────────────────────────────────────────────────────────────

class TestElectricityCost:
    """Costo eléctrico: (watts × horas / 1000) × tarifa_kWh."""

    def test_electricity_350w_2h(self, filament, printer, app_settings):
        """
        350W × 2h = 0.7 kWh × $0.15 = $0.105
        ROUND_HALF_UP(0.105, 2) = $0.11
        (Python's round() daría 0.10 por banker's rounding)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.electricity_cost == Decimal("0.11")

    def test_electricity_sin_tiempo_es_cero(self, filament, printer, app_settings):
        """Sin tiempo de impresión el costo eléctrico es $0.00."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.electricity_cost == Decimal("0.00")


# ─────────────────────────────────────────────────────────────────────────────
# TestDepreciationCost
# ─────────────────────────────────────────────────────────────────────────────

class TestDepreciationCost:
    """Depreciación: (precio_impresora / vida_útil) × horas_impresión."""

    def test_depreciation_800usd_5000h_2h(self, filament, printer, app_settings):
        """
        $800 / 5000h = $0.16/h
        $0.16 × 2h  = $0.32
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.depreciation_cost == Decimal("0.32")

    def test_depreciation_sin_tiempo_es_cero(self, filament, printer, app_settings):
        """Sin tiempo de impresión no hay depreciación."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.depreciation_cost == Decimal("0.00")


# ─────────────────────────────────────────────────────────────────────────────
# TestMaintenanceCost
# ─────────────────────────────────────────────────────────────────────────────

class TestMaintenanceCost:
    """Mantenimiento: (boquilla/vida_boquilla + placa/vida_placa + otros) × horas."""

    def test_maintenance_nozzle_buildplate_2h(self, filament, printer, app_settings):
        """
        Boquilla: $5  / 500h  = $0.010/h
        Placa:    $20 / 2000h = $0.010/h
        Total:                  $0.020/h × 2h = $0.04
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.maintenance_cost == Decimal("0.04")

    def test_maintenance_con_otros_costos(self, filament, printer, app_settings):
        """
        Con $0.05/h adicionales: ($0.01 + $0.01 + $0.05) × 2h = $0.14.
        """
        printer.other_maintenance_per_hour = Decimal("0.05")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.maintenance_cost == Decimal("0.14")


# ─────────────────────────────────────────────────────────────────────────────
# TestLaborCost
# ─────────────────────────────────────────────────────────────────────────────

class TestLaborCost:
    """Mano de obra: (preparación + post-procesado) × costo_hora."""

    def test_labor_solo_preparacion(self, filament, printer, app_settings):
        """0.5h × $5/h = $2.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0.5"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.labor_cost == Decimal("2.50")

    def test_labor_preparacion_y_post(self, filament, printer, app_settings):
        """(0.5h + 1.0h) × $5/h = $7.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0.5"),
            post_processing_time_hours=Decimal("1.0"),
            quantity=1,
        )
        assert result.labor_cost == Decimal("7.50")

    def test_labor_tiempo_impresion_no_cuenta(self, filament, printer, app_settings):
        """El tiempo de impresión no cuenta para mano de obra."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("10"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.labor_cost == Decimal("0.00")


# ─────────────────────────────────────────────────────────────────────────────
# TestFailureCost
# ─────────────────────────────────────────────────────────────────────────────

class TestFailureCost:
    """Factor de fallos: base_cost × (tasa_fallos / 100)."""

    def test_failure_5_pct_sobre_material_puro(self, filament, printer, app_settings):
        """
        100g → material $2.50
        5% de $2.50 = $0.125 → ROUND_HALF_UP → $0.13
        (Python's round(0.125, 2) daría $0.12 — banco rounding)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.failure_cost == Decimal("0.13")

    def test_failure_tasa_cero_costo_cero(self, filament, printer, app_settings):
        """Con tasa de fallos 0% el costo de fallos es $0.00."""
        app_settings.failure_rate_percent = Decimal("0")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.failure_cost == Decimal("0.00")

    def test_failure_tasa_alta_50pct(self, filament, printer, app_settings):
        """
        100g → material $2.50, tasa 50%
        failure = $2.50 × 0.50 = $1.25
        """
        app_settings.failure_rate_percent = Decimal("50")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.failure_cost == Decimal("1.25")


# ─────────────────────────────────────────────────────────────────────────────
# TestRedondeoRoundHalfUp
# ─────────────────────────────────────────────────────────────────────────────

class TestRedondeoRoundHalfUp:
    """Verifica que el motor usa ROUND_HALF_UP, no banker's rounding."""

    def test_0125_redondea_a_013_no_012(self, filament, printer, app_settings):
        """
        failure_cost = material $2.50 × 5% = $0.125
        ROUND_HALF_UP → $0.13  ✓
        Banker's rounding → $0.12  ✗
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.failure_cost == Decimal("0.13")
        assert result.failure_cost != Decimal("0.12")

    def test_0105_redondea_a_011_no_010(self, filament, printer, app_settings):
        """
        electricity = 350W × 2h / 1000 × $0.15 = $0.105
        ROUND_HALF_UP → $0.11  ✓
        Banker's rounding → $0.10  ✗
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.electricity_cost == Decimal("0.11")
        assert result.electricity_cost != Decimal("0.10")

    def test_subtotal_redondea_arriba_en_exactamente_05(self, filament, printer, app_settings):
        """
        subtotal_raw = 2.5 + 0.125 = 2.625
        ROUND_HALF_UP → 2.63  ✓
        Banker's rounding → 2.62  ✗ (redondea al par)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.subtotal == Decimal("2.63")
        assert result.subtotal != Decimal("2.62")


# ─────────────────────────────────────────────────────────────────────────────
# TestGuardDivisionPorCero
# ─────────────────────────────────────────────────────────────────────────────

class TestGuardDivisionPorCero:
    """
    El motor tiene guards explícitos para divisores que podrían ser 0.
    En lugar de lanzar ZeroDivisionError retorna $0 para ese componente.

    En producción estos valores son > 0 gracias a CheckConstraints en la DB
    y Field(gt=0) en los schemas. Los guards son defensa en profundidad.
    """

    def test_estimated_lifespan_cero_depreciacion_es_cero(self, filament, printer, app_settings):
        """
        Si estimated_lifespan_hours = 0, depreciation_cost = $0.00.
        No se lanza ZeroDivisionError.
        """
        printer.estimated_lifespan_hours = Decimal("0")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("5"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.depreciation_cost == Decimal("0.00")
        assert result.total_price >= Decimal("0")

    def test_nozzle_lifespan_cero_solo_placa_contribuye(self, filament, printer, app_settings):
        """
        Si nozzle_lifespan = 0, se ignora ese componente.
        Sólo buildplate contribuye: $20/2000h × 2h = $0.02
        """
        printer.nozzle_lifespan_hours = Decimal("0")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.maintenance_cost == Decimal("0.02")

    def test_buildplate_lifespan_cero_solo_boquilla_contribuye(self, filament, printer, app_settings):
        """
        Si buildplate_lifespan = 0, se ignora ese componente.
        Sólo nozzle contribuye: $5/500h × 2h = $0.02
        """
        printer.buildplate_lifespan_hours = Decimal("0")
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.maintenance_cost == Decimal("0.02")


# ─────────────────────────────────────────────────────────────────────────────
# TestMarginAndTotal
# ─────────────────────────────────────────────────────────────────────────────

class TestMarginAndTotal:
    """Margen y totales: subtotal × margen% / 100, total = subtotal + margen."""

    def test_margen_cero_total_igual_subtotal(self, filament, printer, app_settings):
        """
        Con margen 0%: margin_amount = $0, total_price = subtotal.
        subtotal_raw = 2.625 → quantize ROUND_HALF_UP → $2.63
        total_price  = 2.625 → quantize → $2.63 (mismo valor)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("0"),
        )
        assert result.margin_percent == Decimal("0")
        assert result.margin_amount == Decimal("0.00")
        assert result.total_price == result.subtotal

    def test_margen_default_30pct(self, filament, printer, app_settings):
        """Sin pasar margin_percent usa el de app_settings (30%)."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.margin_percent == Decimal("30")

    def test_margen_personalizado_sobreescribe_settings(self, filament, printer, app_settings):
        """margin_percent=50 sobreescribe el 30% de app_settings."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("50"),
        )
        assert result.margin_percent == Decimal("50")

    def test_margen_100pct_total_mayor_que_subtotal(self, filament, printer, app_settings):
        """Con margen 100%, total > subtotal y margin_amount > 0."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("100"),
        )
        assert result.margin_percent == Decimal("100")
        assert result.margin_amount > Decimal("0")
        assert result.total_price > result.subtotal
        # total_raw = 2.625 × 2 = 5.25 → $5.25
        assert result.total_price == Decimal("5.25")

    def test_total_exacto_100g_0h_margen30(self, filament, printer, app_settings):
        """
        Valor exacto verificado con aritmética Decimal:
        subtotal_raw  = 2.625
        margin_raw    = 2.625 × 0.3 = 0.7875
        total_raw     = 3.4125 → quantize ROUND_HALF_UP → $3.41
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.total_price == Decimal("3.41")
        assert result.total_per_unit == Decimal("3.41")

    def test_total_per_unit_con_3_piezas(self, filament, printer, app_settings):
        """
        Con quantity=3:
        total_price = $7.46 (ver TestCalculoCompleto)
        total_per_unit = 7.46 / 3 = $2.4866... → ROUND_HALF_UP → $2.49
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0.5"),
            post_processing_time_hours=Decimal("0"),
            quantity=3,
        )
        assert result.quantity == 3
        assert result.total_per_unit == Decimal("2.49")
        assert result.total_price > result.total_per_unit


# ─────────────────────────────────────────────────────────────────────────────
# TestSuppliesCost
# ─────────────────────────────────────────────────────────────────────────────

class TestSuppliesCost:
    """Insumos adicionales: se suman al subtotal antes del margen."""

    def test_supply_una_unidad(self, filament, printer, app_settings):
        """1 argolla × $0.10 → supplies_cost = $0.10."""
        supplies = [{"name": "Argolla", "unit": "unidad", "price_per_unit": Decimal("0.10"), "quantity": Decimal("1")}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            supplies=supplies,
        )
        assert result.supplies_cost == Decimal("0.10")

    def test_supply_multiples_unidades_detalle(self, filament, printer, app_settings):
        """4 imanes × $0.25 = $1.00. El detalle incluye subtotal correcto."""
        supplies = [{"name": "Imán", "unit": "pieza", "price_per_unit": Decimal("0.25"), "quantity": Decimal("4")}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            supplies=supplies,
        )
        assert result.supplies_cost == Decimal("1.00")
        assert len(result.supplies_detail) == 1
        assert result.supplies_detail[0]["name"] == "Imán"
        assert result.supplies_detail[0]["quantity"] == Decimal("4")
        assert result.supplies_detail[0]["subtotal"] == Decimal("1.0000")

    def test_sin_supplies_costo_cero_detalle_vacio(self, filament, printer, app_settings):
        """Sin insumos, supplies_cost = $0 y supplies_detail = []."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.supplies_cost == Decimal("0.00")
        assert result.supplies_detail == []

    def test_supplies_incrementan_total(self, filament, printer, app_settings):
        """El total con supplies es mayor que sin supplies."""
        base = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        con_supplies = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            supplies=[{"name": "Switch", "unit": "pieza", "price_per_unit": Decimal("0.50"), "quantity": Decimal("1")}],
        )
        assert con_supplies.total_price > base.total_price


# ─────────────────────────────────────────────────────────────────────────────
# TestCOPConversion
# ─────────────────────────────────────────────────────────────────────────────

class TestCOPConversion:
    """Conversión a pesos colombianos (COP)."""

    def test_conversion_cop_con_tasa_4000(self, filament, printer, app_settings):
        """
        total_price = $3.41 USD, rate = 4000 COP/USD
        total_price_cop = 3.41 × 4000 = 13640 COP
        (quantize a enteros ROUND_HALF_UP)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            usd_to_cop_rate=Decimal("4000"),
        )
        assert result.usd_to_cop_rate == Decimal("4000")
        assert result.total_price_cop == Decimal("13640")
        assert result.total_per_unit_cop == Decimal("13640")

    def test_conversion_cop_none_sin_tasa(self, filament, printer, app_settings):
        """Sin tasa de cambio, los tres campos COP son None."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.usd_to_cop_rate is None
        assert result.total_price_cop is None
        assert result.total_per_unit_cop is None


# ─────────────────────────────────────────────────────────────────────────────
# TestValidacionSchema
# ─────────────────────────────────────────────────────────────────────────────

class TestValidacionSchema:
    """
    Valores negativos y cero deben fallar en la capa Pydantic.
    El calculator mismo no valida — ese rol es del schema.
    """

    def test_weight_grams_negativo_falla(self):
        """weight_grams < 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.quote import QuoteCalculateRequest

        with pytest.raises(ValidationError):
            QuoteCalculateRequest(
                piece_name="Test",
                filament_id=1,
                printer_id=1,
                weight_grams=Decimal("-1"),
                print_time_hours=Decimal("1"),
            )

    def test_weight_grams_cero_falla(self):
        """weight_grams = 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.quote import QuoteCalculateRequest

        with pytest.raises(ValidationError):
            QuoteCalculateRequest(
                piece_name="Test",
                filament_id=1,
                printer_id=1,
                weight_grams=Decimal("0"),
                print_time_hours=Decimal("1"),
            )

    def test_print_time_negativo_falla(self):
        """print_time_hours < 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.quote import QuoteCalculateRequest

        with pytest.raises(ValidationError):
            QuoteCalculateRequest(
                piece_name="Test",
                filament_id=1,
                printer_id=1,
                weight_grams=Decimal("100"),
                print_time_hours=Decimal("-1"),
            )

    def test_purchase_price_negativo_falla(self):
        """purchase_price < 0 → ValidationError (Field ge=0)."""
        from pydantic import ValidationError
        from app.schemas.printer import PrinterCreate

        with pytest.raises(ValidationError):
            PrinterCreate(
                name="Test",
                model="Test",
                purchase_price=Decimal("-1"),
                power_consumption_watts=Decimal("100"),
                estimated_lifespan_hours=Decimal("1000"),
            )

    def test_estimated_lifespan_cero_falla_en_schema(self):
        """estimated_lifespan_hours = 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.printer import PrinterCreate

        with pytest.raises(ValidationError):
            PrinterCreate(
                name="Test",
                model="Test",
                purchase_price=Decimal("100"),
                power_consumption_watts=Decimal("100"),
                estimated_lifespan_hours=Decimal("0"),
            )

    def test_estimated_lifespan_negativo_falla_en_schema(self):
        """estimated_lifespan_hours < 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.printer import PrinterCreate

        with pytest.raises(ValidationError):
            PrinterCreate(
                name="Test",
                model="Test",
                purchase_price=Decimal("100"),
                power_consumption_watts=Decimal("100"),
                estimated_lifespan_hours=Decimal("-500"),
            )

    def test_margin_mayor_100_falla(self):
        """margin_percent > 100 → ValidationError (Field le=100)."""
        from pydantic import ValidationError
        from app.schemas.quote import QuoteCalculateRequest

        with pytest.raises(ValidationError):
            QuoteCalculateRequest(
                piece_name="Test",
                filament_id=1,
                printer_id=1,
                weight_grams=Decimal("100"),
                print_time_hours=Decimal("1"),
                margin_percent=Decimal("101"),
            )

    def test_filamento_price_per_kg_negativo_falla(self):
        """price_per_kg < 0 → ValidationError (Field gt=0)."""
        from pydantic import ValidationError
        from app.schemas.filament import FilamentCreate

        with pytest.raises(ValidationError):
            FilamentCreate(
                brand="Test",
                type="PLA",
                color="Blanco",
                price_per_kg=Decimal("-10"),
            )


# ─────────────────────────────────────────────────────────────────────────────
# TestCalculoCompleto
# ─────────────────────────────────────────────────────────────────────────────

class TestCalculoCompleto:
    """Cálculo end-to-end con valores reales verificados."""

    def test_pieza_tipica_100g_2h(self, filament, printer, app_settings):
        """
        Pieza típica con todos los componentes:
            material:      100g × $0.025/g         = $2.500
            electricidad:  350W × 2h / 1000 × $0.15= $0.105 → $0.11
            depreciación:  $800 / 5000h × 2h       = $0.320
            mantenimiento: ($0.01+$0.01)/h × 2h    = $0.040
            labor:         0.5h × $5/h             = $2.500
            base_cost      = $5.465
            fallos 5%:     $5.465 × 0.05           = $0.27325 → $0.27
            subtotal_raw   = $5.73825 → $5.74
            margen 30%:    $5.73825 × 0.3          = $1.72148 → $1.72
            total_raw      = $7.45973  → $7.46
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0.5"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.material_cost == Decimal("2.50")
        assert result.electricity_cost == Decimal("0.11")
        assert result.depreciation_cost == Decimal("0.32")
        assert result.maintenance_cost == Decimal("0.04")
        assert result.labor_cost == Decimal("2.50")
        assert result.failure_cost == Decimal("0.27")
        assert result.total_price == Decimal("7.46")
        assert result.total_per_unit == Decimal("7.46")

    def test_resultado_siempre_positivo(self, filament, printer, app_settings):
        """El total nunca debe ser negativo."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("1"),
            print_time_hours=Decimal("0.1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert result.total_price >= Decimal("0")
        assert result.total_per_unit >= Decimal("0")

    def test_incrementar_peso_incrementa_costo(self, filament, printer, app_settings):
        """A mayor peso, mayor costo. Monotonicidad del costo de material."""
        r100 = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        r200 = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("200"),
            print_time_hours=Decimal("0"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert r200.material_cost > r100.material_cost
        assert r200.total_price > r100.total_price

    def test_incrementar_tiempo_incrementa_costos_operativos(self, filament, printer, app_settings):
        """A mayor tiempo, mayores costos eléctrico, depreciación y mantenimiento."""
        r1h = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        r5h = calculate_cost(
            filament, printer, app_settings,
            weight_grams=Decimal("0"),
            print_time_hours=Decimal("5"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        assert r5h.electricity_cost > r1h.electricity_cost
        assert r5h.depreciation_cost > r1h.depreciation_cost
        assert r5h.maintenance_cost > r1h.maintenance_cost
