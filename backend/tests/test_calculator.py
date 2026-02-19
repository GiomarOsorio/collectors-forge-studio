"""
Tests unitarios del motor de cálculo de costos de impresión 3D.

Verifica cada componente del desglose de costos de forma aislada
usando objetos mock de Filament, Printer y AppSettings.
Los valores esperados se calculan manualmente con la misma fórmula
documentada en calculator.py para servir de especificación viva.

Referencia de fixtures (ver conftest.py):
    filament:     PLA Bambu $25/kg, densidad 1.24
    printer:      P1S, $800, 5000h vida, 350W, boquilla $5/500h, placa $20/2000h
    app_settings: tarifa $0.15/kWh, fallos 5%, mano de obra $5/h, margen 30%
"""

import pytest
from app.services.calculator import calculate_cost


# ── Parámetros base de impresión usados en la mayoría de tests ─────────────────
BASE_WEIGHT = 100.0          # gramos de filamento
BASE_PRINT_TIME = 2.0        # horas de impresión
BASE_PREP_TIME = 0.5         # horas de preparación
BASE_POST_TIME = 0.0         # horas de post-procesado
BASE_QUANTITY = 1


class TestMaterialCost:
    """Costo de material: gramos × (precio_kg / 1000)."""

    def test_material_cost_basico(self, filament, printer, app_settings):
        """100g × $0.025/g = $2.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.material_cost == pytest.approx(2.50, abs=0.01)

    def test_material_cost_peso_alto(self, filament, printer, app_settings):
        """500g × $0.025/g = $12.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=500.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.material_cost == pytest.approx(12.50, abs=0.01)

    def test_material_cost_con_filamentos_adicionales(self, filament, printer, app_settings):
        """
        Filamento principal: 80g × $0.025 = $2.00
        Filamento adicional: 20g × $0.030 = $0.60
        Total material: $2.60
        """
        additional = [{"price_per_kg": 30.0, "weight_grams": 20.0}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=80.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1, additional_filaments=additional,
        )
        assert result.material_cost == pytest.approx(2.60, abs=0.01)


class TestElectricityCost:
    """Costo eléctrico: (watts × horas / 1000) × tarifa_kWh."""

    def test_electricity_cost_basico(self, filament, printer, app_settings):
        """
        350W × 2h = 700Wh = 0.7 kWh × $0.15 = $0.105
        El calculador redondea a 2 decimales → round(0.105, 2) = 0.10
        (Python usa banker's rounding: redondea al par más cercano)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=2.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.electricity_cost == pytest.approx(0.10, abs=0.001)

    def test_electricity_cost_sin_tiempo(self, filament, printer, app_settings):
        """Sin tiempo de impresión el costo eléctrico es 0."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.electricity_cost == 0.0


class TestDepreciationCost:
    """Depreciación: (precio_impresora / vida_útil) × horas_impresión."""

    def test_depreciation_basico(self, filament, printer, app_settings):
        """
        $800 / 5000h = $0.16/h
        $0.16 × 2h = $0.32
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=2.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.depreciation_cost == pytest.approx(0.32, abs=0.01)

    def test_depreciation_sin_tiempo(self, filament, printer, app_settings):
        """Sin tiempo de impresión no hay depreciación."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.depreciation_cost == 0.0


class TestMaintenanceCost:
    """
    Mantenimiento: (boquilla/vida_boquilla + placa/vida_placa + otros) × horas.
    Boquilla: $5/500h = $0.01/h
    Placa:    $20/2000h = $0.01/h
    Otros:    $0/h
    Total: $0.02/h
    """

    def test_maintenance_basico(self, filament, printer, app_settings):
        """$0.02/h × 2h = $0.04."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=2.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.maintenance_cost == pytest.approx(0.04, abs=0.001)

    def test_maintenance_con_otros(self, filament, printer, app_settings):
        """Agregamos $0.05/h de otros mantenimientos: total $0.07/h × 2h = $0.14."""
        printer.other_maintenance_per_hour = 0.05
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=2.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.maintenance_cost == pytest.approx(0.14, abs=0.001)


class TestLaborCost:
    """Mano de obra: (preparación + post-procesado) × costo_hora."""

    def test_labor_solo_preparacion(self, filament, printer, app_settings):
        """0.5h preparación × $5/h = $2.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=0.0,
            preparation_time_hours=0.5, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.labor_cost == pytest.approx(2.50, abs=0.01)

    def test_labor_preparacion_y_post(self, filament, printer, app_settings):
        """(0.5h + 1.0h) × $5/h = $7.50."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=0.0,
            preparation_time_hours=0.5, post_processing_time_hours=1.0,
            quantity=1,
        )
        assert result.labor_cost == pytest.approx(7.50, abs=0.01)

    def test_labor_sin_tiempo_manual(self, filament, printer, app_settings):
        """El tiempo de impresión no cuenta para mano de obra."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=10.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.labor_cost == 0.0


class TestFailureCost:
    """Factor de fallos: base_cost × (tasa_fallos / 100)."""

    def test_failure_cost_calculado_correctamente(self, filament, printer, app_settings):
        """
        Base con solo material 100g = $2.50
        Fallos al 5%: $2.50 × 0.05 = $0.125
        El calculador redondea: round(0.125, 2) = 0.12 (banker's rounding)
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.failure_cost == pytest.approx(0.12, abs=0.001)

    def test_failure_cost_cero_con_tasa_cero(self, filament, printer, app_settings):
        """Con tasa de fallos 0% el costo de fallos es 0."""
        app_settings.failure_rate_percent = 0.0
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=2.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.failure_cost == 0.0


class TestMarginAndTotal:
    """Margen y totales: subtotal × margen% / 100, total = subtotal + margen."""

    def test_margin_por_defecto_de_settings(self, filament, printer, app_settings):
        """Sin pasar margin_percent usa el de app_settings (30%)."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.margin_percent == 30.0

    def test_margin_personalizado_sobreescribe_settings(self, filament, printer, app_settings):
        """Pasar margin_percent=50 sobreescribe el 30% de settings."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1, margin_percent=50.0,
        )
        assert result.margin_percent == 50.0

    def test_total_es_subtotal_mas_margen(self, filament, printer, app_settings):
        """total_price = subtotal + margin_amount (redondeado a 2 decimales)."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        expected_total = round(result.subtotal + result.margin_amount, 2)
        assert result.total_price == pytest.approx(expected_total, abs=0.01)

    def test_total_per_unit_es_total_dividido_cantidad(self, filament, printer, app_settings):
        """Con 3 piezas, total_per_unit = total_price / 3."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=2.0,
            preparation_time_hours=0.5, post_processing_time_hours=0.0,
            quantity=3,
        )
        assert result.total_per_unit == pytest.approx(result.total_price / 3, abs=0.01)
        assert result.quantity == 3


class TestSuppliesCost:
    """Insumos adicionales sumados al subtotal antes del margen."""

    def test_supplies_costo_sumado(self, filament, printer, app_settings):
        """
        1 argolla × $0.10 = $0.10 de insumos.
        supplies_cost en el resultado debe ser $0.10.
        """
        supplies = [{"name": "Argolla", "unit": "unidad", "price_per_unit": 0.10, "quantity": 1}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1, supplies=supplies,
        )
        assert result.supplies_cost == pytest.approx(0.10, abs=0.001)

    def test_supplies_detalle_correcto(self, filament, printer, app_settings):
        """El desglose de insumos incluye nombre, cantidad y subtotal."""
        supplies = [{"name": "Imán", "unit": "pieza", "price_per_unit": 0.25, "quantity": 4}]
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=0.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1, supplies=supplies,
        )
        assert len(result.supplies_detail) == 1
        assert result.supplies_detail[0]["name"] == "Imán"
        assert result.supplies_detail[0]["quantity"] == 4
        assert result.supplies_detail[0]["subtotal"] == pytest.approx(1.00, abs=0.001)

    def test_sin_supplies_costo_cero(self, filament, printer, app_settings):
        """Sin insumos, supplies_cost es 0."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=1.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.supplies_cost == 0.0
        assert result.supplies_detail == []


class TestCOPConversion:
    """Conversión a pesos colombianos (COP)."""

    def test_conversion_cop_cuando_se_provee_tasa(self, filament, printer, app_settings):
        """Con tasa 4300 COP/USD, total_price_cop = total_price × 4300."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1, usd_to_cop_rate=4300.0,
        )
        assert result.usd_to_cop_rate == 4300.0
        assert result.total_price_cop == pytest.approx(result.total_price * 4300, abs=1.0)
        assert result.total_per_unit_cop == pytest.approx(result.total_per_unit * 4300, abs=1.0)

    def test_conversion_cop_none_sin_tasa(self, filament, printer, app_settings):
        """Sin tasa de cambio, los campos COP son None."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=0.0,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.usd_to_cop_rate is None
        assert result.total_price_cop is None
        assert result.total_per_unit_cop is None


class TestCalculoCompleto:
    """Test de integración del cálculo completo con valores reales."""

    def test_calculo_tipico_pieza_simple(self, filament, printer, app_settings):
        """
        Pieza típica:
        - 100g PLA @ $25/kg → material $2.50
        - 2h print, 350W → 0.7kWh × $0.15 = $0.105 electricidad
        - depreciación: $800/5000 × 2h = $0.32
        - mantenimiento: ($5/500 + $20/2000) × 2h = $0.04
        - labor: 0.5h × $5 = $2.50
        - base = 2.50 + 0.105 + 0.32 + 0.04 + 2.50 = 5.465
        - fallos 5%: 5.465 × 0.05 = 0.273
        - subtotal: 5.738
        - margen 30%: 5.738 × 0.30 = 1.721
        - total ≈ $7.46
        """
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=100.0, print_time_hours=2.0,
            preparation_time_hours=0.5, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.material_cost == pytest.approx(2.50, abs=0.01)
        assert result.electricity_cost == pytest.approx(0.10, abs=0.001)  # round(0.105, 2) = 0.10
        assert result.depreciation_cost == pytest.approx(0.32, abs=0.01)
        assert result.maintenance_cost == pytest.approx(0.04, abs=0.001)
        assert result.labor_cost == pytest.approx(2.50, abs=0.01)
        assert result.total_price > result.subtotal
        assert result.total_price > 0

    def test_resultado_es_positivo_siempre(self, filament, printer, app_settings):
        """El costo total siempre debe ser positivo."""
        result = calculate_cost(
            filament, printer, app_settings,
            weight_grams=1.0, print_time_hours=0.1,
            preparation_time_hours=0.0, post_processing_time_hours=0.0,
            quantity=1,
        )
        assert result.total_price > 0
        assert result.total_per_unit > 0
