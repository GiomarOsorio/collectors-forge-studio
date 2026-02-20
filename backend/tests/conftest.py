"""
Configuración global de pytest para los tests de Calculator3D.

Fixtures con valores Decimal puros — nunca float — para garantizar
aritmética exacta y que _d() no tenga que hacer conversiones.
"""

from decimal import Decimal

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def filament():
    """
    Filamento de referencia: PLA Bambu $25/kg, densidad 1.24 g/cm³.
    Precio por gramo: $0.025 USD/g.
    """
    f = MagicMock()
    f.brand = "Bambu"
    f.type = "PLA"
    f.price_per_kg = Decimal("25")
    f.density = Decimal("1.24")
    return f


@pytest.fixture
def printer():
    """
    Impresora de referencia: BambuLab P1S.

    Costos por hora (calculados externamente para referencia):
        Depreciación:  $800 / 5000h = $0.16/h
        Boquilla:      $5   / 500h  = $0.01/h
        Placa:         $20  / 2000h = $0.01/h
        Electricidad:  350W / 1000  × tarifa
    """
    p = MagicMock()
    p.name = "BambuLab P1S"
    p.purchase_price = Decimal("800")
    p.estimated_lifespan_hours = Decimal("5000")
    p.power_consumption_watts = Decimal("350")
    p.nozzle_price = Decimal("5")
    p.nozzle_lifespan_hours = Decimal("500")
    p.buildplate_price = Decimal("20")
    p.buildplate_lifespan_hours = Decimal("2000")
    p.other_maintenance_per_hour = Decimal("0")
    return p


@pytest.fixture
def app_settings():
    """
    Configuración de referencia del usuario:
        Tarifa eléctrica:  $0.15/kWh
        Tasa de fallos:    5%
        Mano de obra:      $5/h
        Margen por defecto: 30%
    """
    s = MagicMock()
    s.electricity_rate = Decimal("0.15")
    s.failure_rate_percent = Decimal("5")
    s.labor_cost_per_hour = Decimal("5")
    s.default_margin_percent = Decimal("30")
    return s
