"""
Configuración global de pytest para los tests de Calculator3D.

Define los fixtures compartidos entre todos los módulos de test:
objetos mock de Filament, Printer y AppSettings con valores típicos
que representan una configuración real de impresión 3D.
"""

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def filament():
    """
    Filamento de referencia: PLA Bambu a $25/kg, densidad 1.24 g/cm³.
    Precio por gramo: 0.025 USD/g.
    """
    f = MagicMock()
    f.brand = "Bambu"
    f.type = "PLA"
    f.price_per_kg = 25.0
    f.density = 1.24
    return f


@pytest.fixture
def printer():
    """
    Impresora de referencia: BambuLab P1S.
    - Precio: $800 USD
    - Vida útil: 5000 horas → depreciación $0.16/h
    - Consumo: 350 W
    - Boquilla: $5 / 500h → $0.01/h
    - Placa: $20 / 2000h → $0.01/h
    - Otros mantenimiento: $0/h
    """
    p = MagicMock()
    p.name = "BambuLab P1S"
    p.purchase_price = 800.0
    p.estimated_lifespan_hours = 5000.0
    p.power_consumption_watts = 350.0
    p.nozzle_price = 5.0
    p.nozzle_lifespan_hours = 500.0
    p.buildplate_price = 20.0
    p.buildplate_lifespan_hours = 2000.0
    p.other_maintenance_per_hour = 0.0
    return p


@pytest.fixture
def app_settings():
    """
    Configuración de referencia del usuario:
    - Tarifa eléctrica: $0.15/kWh
    - Tasa de fallos: 5%
    - Costo de mano de obra: $5/h
    - Margen por defecto: 30%
    """
    s = MagicMock()
    s.electricity_rate = 0.15
    s.failure_rate_percent = 5.0
    s.labor_cost_per_hour = 5.0
    s.default_margin_percent = 30.0
    return s
