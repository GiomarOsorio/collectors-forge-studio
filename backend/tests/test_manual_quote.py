"""
Tests unitarios para la cotización manual y la lógica de portadores de datos.

Verifica que _FakeFilament, _FakePrinter y _FakeSettings construyen objetos
compatibles con calculate_cost(), que el schema QuoteManualRequest valida
correctamente los campos, y que la integración produce resultados esperados.

Como _FakeFilament/_FakePrinter/_FakeSettings están definidos en el router
(módulo de aplicación), los tests aquí los replican directamente para poder
probar la lógica sin necesidad de levantar FastAPI.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.quote import QuoteManualRequest
from app.services.calculator import calculate_cost


# ── Portadores de datos (réplica local de los definidos en el router) ──────────

class _FakeFilament:
    """Portador de datos de filamento para cotización manual."""
    def __init__(self, price_per_kg):
        self.price_per_kg = price_per_kg


class _FakePrinter:
    """Portador de datos de impresora para cotización manual."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeSettings:
    """Portador de configuración con posibles sobreescrituras."""
    def __init__(self, electricity_rate, failure_rate_percent, labor_cost_per_hour, default_margin_percent):
        self.electricity_rate       = electricity_rate
        self.failure_rate_percent   = failure_rate_percent
        self.labor_cost_per_hour    = labor_cost_per_hour
        self.default_margin_percent = default_margin_percent


def _make_printer(**overrides):
    """Crea un _FakePrinter con valores por defecto para tests."""
    defaults = dict(
        power_consumption_watts=Decimal("350"),
        purchase_price=Decimal("800"),
        estimated_lifespan_hours=Decimal("5000"),
        nozzle_price=Decimal("5"),
        nozzle_lifespan_hours=Decimal("500"),
        buildplate_price=Decimal("20"),
        buildplate_lifespan_hours=Decimal("2000"),
        other_maintenance_per_hour=Decimal("0"),
    )
    defaults.update(overrides)
    return _FakePrinter(**defaults)


def _make_settings(**overrides):
    """Crea _FakeSettings con valores por defecto para tests."""
    defaults = dict(
        electricity_rate=Decimal("0.15"),
        failure_rate_percent=Decimal("5"),
        labor_cost_per_hour=Decimal("5"),
        default_margin_percent=Decimal("30"),
    )
    defaults.update(overrides)
    return _FakeSettings(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# TestFakeFilament
# ─────────────────────────────────────────────────────────────────────────────

class TestFakeFilament:
    """_FakeFilament es compatible con calculate_cost."""

    def test_price_per_kg_accesible(self):
        """El atributo price_per_kg se establece correctamente."""
        f = _FakeFilament(price_per_kg=Decimal("25"))
        assert f.price_per_kg == Decimal("25")

    def test_compatible_con_calculate_cost(self):
        """calculate_cost acepta _FakeFilament sin excepciones."""
        filament  = _FakeFilament(price_per_kg=Decimal("25"))
        printer   = _make_printer()
        settings  = _make_settings()
        result = calculate_cost(
            filament, printer, settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
        )
        # material_cost = 100g × $25/1000 = $2.50
        assert result.material_cost == Decimal("2.50")


# ─────────────────────────────────────────────────────────────────────────────
# TestFakePrinter
# ─────────────────────────────────────────────────────────────────────────────

class TestFakePrinter:
    """_FakePrinter transmite todos los atributos correctamente a calculate_cost."""

    def test_atributos_accesibles(self):
        """Todos los atributos del constructor son accesibles como atributos."""
        p = _make_printer()
        assert p.power_consumption_watts   == Decimal("350")
        assert p.purchase_price            == Decimal("800")
        assert p.estimated_lifespan_hours  == Decimal("5000")
        assert p.nozzle_price              == Decimal("5")
        assert p.nozzle_lifespan_hours     == Decimal("500")
        assert p.buildplate_price          == Decimal("20")
        assert p.buildplate_lifespan_hours == Decimal("2000")
        assert p.other_maintenance_per_hour == Decimal("0")

    def test_depreciacion_correcta(self):
        """Depreciación = $800 / 5000h × 2h = $0.32."""
        filament = _FakeFilament(price_per_kg=Decimal("0"))  # sin costo material
        printer  = _make_printer()
        settings = _make_settings(
            electricity_rate=Decimal("0"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
        )
        result = calculate_cost(
            filament, printer, settings,
            weight_grams=Decimal("0.001"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("0"),
        )
        # $800 / 5000 × 2 = $0.32
        assert result.depreciation_cost == Decimal("0.32")


# ─────────────────────────────────────────────────────────────────────────────
# TestFakeSettings
# ─────────────────────────────────────────────────────────────────────────────

class TestFakeSettings:
    """_FakeSettings expone los atributos de configuracion correctamente."""

    def test_atributos_accesibles(self):
        """Los cuatro atributos son accesibles después de construir."""
        s = _make_settings()
        assert s.electricity_rate       == Decimal("0.15")
        assert s.failure_rate_percent   == Decimal("5")
        assert s.labor_cost_per_hour    == Decimal("5")
        assert s.default_margin_percent == Decimal("30")

    def test_sobreescritura_tarifa_electrica(self):
        """Una sobreescritura de electricity_rate se refleja en el cálculo."""
        filament = _FakeFilament(price_per_kg=Decimal("0"))
        printer  = _make_printer(power_consumption_watts=Decimal("1000"))
        # Con tarifa 0 la electricidad debe ser 0
        settings_cero = _make_settings(
            electricity_rate=Decimal("0"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
        )
        result_cero = calculate_cost(
            filament, printer, settings_cero,
            weight_grams=Decimal("0.001"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("0"),
        )
        assert result_cero.electricity_cost == Decimal("0.00")

        # Con tarifa 0.30 y 1 kW durante 1h → $0.30
        settings_alta = _make_settings(
            electricity_rate=Decimal("0.30"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
        )
        result_alta = calculate_cost(
            filament, printer, settings_alta,
            weight_grams=Decimal("0.001"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("0"),
        )
        assert result_alta.electricity_cost == Decimal("0.30")


# ─────────────────────────────────────────────────────────────────────────────
# TestQuoteManualRequestSchema
# ─────────────────────────────────────────────────────────────────────────────

class TestQuoteManualRequestSchema:
    """Validacion del schema QuoteManualRequest con Pydantic v2."""

    def _base(self, **overrides):
        """Construye un payload válido mínimo con opción de sobreescribir campos."""
        data = dict(
            piece_name="Prueba",
            price_per_kg=Decimal("25"),
            power_consumption_watts=Decimal("180"),
            purchase_price=Decimal("700"),
            estimated_lifespan_hours=Decimal("5000"),
            weight_grams=Decimal("35"),
            print_time_hours=Decimal("2"),
        )
        data.update(overrides)
        return data

    def test_payload_minimo_valido(self):
        """Un payload con solo los campos obligatorios no lanza ValidationError."""
        req = QuoteManualRequest(**self._base())
        assert req.piece_name          == "Prueba"
        assert req.price_per_kg        == Decimal("25")
        assert req.weight_grams        == Decimal("35")
        assert req.print_time_hours    == Decimal("2")

    def test_defaults_razonables(self):
        """Los campos opcionales tienen defaults correctos."""
        req = QuoteManualRequest(**self._base())
        assert req.quantity                   == 1
        assert req.nozzle_price               == Decimal("0")
        assert req.nozzle_lifespan_hours      == Decimal("500")
        assert req.buildplate_price           == Decimal("0")
        assert req.buildplate_lifespan_hours  == Decimal("2000")
        assert req.other_maintenance_per_hour == Decimal("0")
        assert req.preparation_time_hours     == Decimal("0")
        assert req.post_processing_time_hours == Decimal("0")
        assert req.margin_percent             is None
        assert req.electricity_rate           is None
        assert req.failure_rate_percent       is None
        assert req.labor_cost_per_hour        is None

    def test_price_per_kg_negativo_rechazado(self):
        """price_per_kg <= 0 debe fallar la validación."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(price_per_kg=Decimal("-1")))

    def test_price_per_kg_cero_rechazado(self):
        """price_per_kg = 0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(price_per_kg=Decimal("0")))

    def test_weight_grams_cero_rechazado(self):
        """weight_grams = 0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(weight_grams=Decimal("0")))

    def test_print_time_hours_cero_rechazado(self):
        """print_time_hours = 0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(print_time_hours=Decimal("0")))

    def test_estimated_lifespan_hours_cero_rechazado(self):
        """estimated_lifespan_hours = 0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(estimated_lifespan_hours=Decimal("0")))

    def test_power_consumption_watts_cero_rechazado(self):
        """power_consumption_watts = 0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(power_consumption_watts=Decimal("0")))

    def test_purchase_price_cero_valido(self):
        """purchase_price = 0 es válido (ge=0); impresora gratuita o amortizada."""
        req = QuoteManualRequest(**self._base(purchase_price=Decimal("0")))
        assert req.purchase_price == Decimal("0")

    def test_margin_percent_rango_valido(self):
        """margin_percent entre 0 y 100 es válido."""
        req_cero = QuoteManualRequest(**self._base(margin_percent=Decimal("0")))
        req_100  = QuoteManualRequest(**self._base(margin_percent=Decimal("100")))
        assert req_cero.margin_percent == Decimal("0")
        assert req_100.margin_percent  == Decimal("100")

    def test_margin_percent_negativo_rechazado(self):
        """margin_percent negativo debe fallar."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(margin_percent=Decimal("-1")))

    def test_margin_percent_mayor_100_rechazado(self):
        """margin_percent > 100 debe fallar."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(margin_percent=Decimal("100.01")))

    def test_failure_rate_percent_valido(self):
        """failure_rate_percent entre 0 y 100 es válido como sobreescritura."""
        req = QuoteManualRequest(**self._base(failure_rate_percent=Decimal("15")))
        assert req.failure_rate_percent == Decimal("15")

    def test_failure_rate_percent_negativo_rechazado(self):
        """failure_rate_percent negativo debe fallar."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(failure_rate_percent=Decimal("-0.1")))

    def test_quantity_minimo_uno(self):
        """quantity < 1 debe fallar (ge=1)."""
        with pytest.raises(ValidationError):
            QuoteManualRequest(**self._base(quantity=0))

    def test_filament_name_default(self):
        """filament_name tiene 'Material' como default."""
        req = QuoteManualRequest(**self._base())
        assert req.filament_name == "Material"

    def test_filament_name_personalizado(self):
        """filament_name se puede personalizar."""
        req = QuoteManualRequest(**self._base(filament_name="PLA Bambu"))
        assert req.filament_name == "PLA Bambu"


# ─────────────────────────────────────────────────────────────────────────────
# TestCotizacionManualIntegracion
# ─────────────────────────────────────────────────────────────────────────────

class TestCotizacionManualIntegracion:
    """
    Integración completa: QuoteManualRequest → _Fake* → calculate_cost.

    Simula exactamente el flujo que ejecuta el endpoint /calculate/manual.
    """

    def test_calculo_completo_sin_margen_explicito(self):
        """
        Cotización manual con margen None usa el default de settings (30%).

        Filamento: PLA $25/kg
        Impresora: 350W, $800, 5000h, boquilla $5/500h, placa $20/2000h
        Settings:  electricidad $0.15/kWh, fallos 5%, mano de obra $5/h, margen 30%
        Pieza: 100g, 2h de impresión

        Costos esperados (con ROUND_HALF_UP):
            material     = 100 × 0.025 = $2.50
            electricidad = 0.35kW × 2h × 0.15 = $0.105 → $0.11 (display)
            depreciación = 800/5000 × 2 = $0.32
            mantenimiento = (5/500 + 20/2000 + 0) × 2 = (0.01 + 0.01) × 2 = $0.04
            mano de obra  = 0 (no hay prep/post)

            NOTA: el motor calcula en precisión completa y solo redondea al final.
            base interna   = 2.50 + 0.105 + 0.32 + 0.04 = $2.965 (sin redondeo)
            fallos internos = 2.965 × 0.05 = $0.14825
            subtotal interno = 2.965 + 0.14825 = $3.11325 → $3.11
            margen interno  = 3.11325 × 0.30 = $0.933975 → $0.93
            total = 3.11325 + 0.933975 = $4.047225 → $4.05
        """
        req = QuoteManualRequest(
            piece_name="Pieza de Prueba",
            price_per_kg=Decimal("25"),
            power_consumption_watts=Decimal("350"),
            purchase_price=Decimal("800"),
            estimated_lifespan_hours=Decimal("5000"),
            nozzle_price=Decimal("5"),
            nozzle_lifespan_hours=Decimal("500"),
            buildplate_price=Decimal("20"),
            buildplate_lifespan_hours=Decimal("2000"),
            other_maintenance_per_hour=Decimal("0"),
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("2"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=None,
        )

        filament = _FakeFilament(price_per_kg=req.price_per_kg)
        printer  = _FakePrinter(
            power_consumption_watts=req.power_consumption_watts,
            purchase_price=req.purchase_price,
            estimated_lifespan_hours=req.estimated_lifespan_hours,
            nozzle_price=req.nozzle_price,
            nozzle_lifespan_hours=req.nozzle_lifespan_hours,
            buildplate_price=req.buildplate_price,
            buildplate_lifespan_hours=req.buildplate_lifespan_hours,
            other_maintenance_per_hour=req.other_maintenance_per_hour,
        )
        settings = _FakeSettings(
            electricity_rate=Decimal("0.15"),
            failure_rate_percent=Decimal("5"),
            labor_cost_per_hour=Decimal("5"),
            default_margin_percent=Decimal("30"),
        )

        result = calculate_cost(
            filament, printer, settings,
            weight_grams=req.weight_grams,
            print_time_hours=req.print_time_hours,
            preparation_time_hours=req.preparation_time_hours,
            post_processing_time_hours=req.post_processing_time_hours,
            quantity=req.quantity,
            margin_percent=req.margin_percent,
        )

        assert result.material_cost     == Decimal("2.50")
        assert result.electricity_cost  == Decimal("0.11")
        assert result.depreciation_cost == Decimal("0.32")
        assert result.maintenance_cost  == Decimal("0.04")
        assert result.labor_cost        == Decimal("0.00")
        assert result.failure_cost      == Decimal("0.15")
        assert result.subtotal          == Decimal("3.11")   # base 2.965 + failure 0.14825 = 3.11325 → 3.11
        assert result.margin_percent    == Decimal("30")
        assert result.margin_amount     == Decimal("0.93")   # 3.11325 × 0.30 = 0.933975 → 0.93
        assert result.total_price       == Decimal("4.05")   # 3.11325 + 0.933975 = 4.0473 → 4.05

    def test_sobreescritura_tarifa_electrica_afecta_resultado(self):
        """
        Sobreescribir electricity_rate en la solicitud debe cambiar el costo eléctrico.
        Con tarifa $0.30/kWh (doble del default), la electricidad debe ser el doble.
        """
        req_base = dict(
            piece_name="Prueba",
            price_per_kg=Decimal("0"),  # sin material
            power_consumption_watts=Decimal("1000"),
            purchase_price=Decimal("0"),
            estimated_lifespan_hours=Decimal("5000"),
            weight_grams=Decimal("0.001"),
            print_time_hours=Decimal("1"),
        )

        # Settings con tarifa normal
        settings_normal = _FakeSettings(
            electricity_rate=Decimal("0.15"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
            default_margin_percent=Decimal("0"),
        )
        # Settings con tarifa doble (sobreescritura)
        settings_doble = _FakeSettings(
            electricity_rate=Decimal("0.30"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
            default_margin_percent=Decimal("0"),
        )
        filament = _FakeFilament(price_per_kg=Decimal("0"))
        printer  = _FakePrinter(
            power_consumption_watts=Decimal("1000"),
            purchase_price=Decimal("0"),
            estimated_lifespan_hours=Decimal("5000"),
            nozzle_price=Decimal("0"),
            nozzle_lifespan_hours=Decimal("500"),
            buildplate_price=Decimal("0"),
            buildplate_lifespan_hours=Decimal("2000"),
            other_maintenance_per_hour=Decimal("0"),
        )
        kwargs = dict(
            weight_grams=Decimal("0.001"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("0"),
        )
        result_normal = calculate_cost(filament, printer, settings_normal, **kwargs)
        result_doble  = calculate_cost(filament, printer, settings_doble,  **kwargs)

        # 1kW × 1h × $0.15 = $0.15; × $0.30 = $0.30
        assert result_normal.electricity_cost == Decimal("0.15")
        assert result_doble.electricity_cost  == Decimal("0.30")

    def test_cotizacion_manual_con_margen_explicito(self):
        """Margen explícito del 50% reemplaza el default de settings."""
        filament = _FakeFilament(price_per_kg=Decimal("40"))
        printer  = _FakePrinter(
            power_consumption_watts=Decimal("180"),
            purchase_price=Decimal("700"),
            estimated_lifespan_hours=Decimal("5000"),
            nozzle_price=Decimal("0"),
            nozzle_lifespan_hours=Decimal("500"),
            buildplate_price=Decimal("0"),
            buildplate_lifespan_hours=Decimal("2000"),
            other_maintenance_per_hour=Decimal("0"),
        )
        settings = _FakeSettings(
            electricity_rate=Decimal("0"),
            failure_rate_percent=Decimal("0"),
            labor_cost_per_hour=Decimal("0"),
            default_margin_percent=Decimal("20"),  # default ignorado
        )
        result = calculate_cost(
            filament, printer, settings,
            weight_grams=Decimal("100"),
            print_time_hours=Decimal("1"),
            preparation_time_hours=Decimal("0"),
            post_processing_time_hours=Decimal("0"),
            quantity=1,
            margin_percent=Decimal("50"),  # sobreescribe el default
        )
        # material = 100 × 40/1000 = $4.00; subtotal ≈ $4.xx; margen = 50%
        assert result.margin_percent == Decimal("50")
        # El total debe ser mayor que el subtotal
        assert result.total_price > result.subtotal
