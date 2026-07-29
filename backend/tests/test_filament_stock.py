"""
Tests del servicio de stock por bobinas (issue #214).

Funciones puras sobre un objeto tipo `InventoryItem` (se usa un stub simple
para no depender de la sesión de BD).
"""

from decimal import Decimal

import pytest

from app.services import filament_stock as fs


class _Item:
    """Stub mínimo con los atributos que toca el servicio."""

    def __init__(self, **kw):
        self.category = "Filamento"
        self.weight_per_roll = Decimal("1000")
        self.quantity = Decimal("0")
        self.min_quantity = Decimal("0")
        self.sealed_spools = 0
        self.open_remaining_g = None
        self.min_spools = 0
        for k, v in kw.items():
            setattr(self, k, v)


def test_normalize_from_counts_deriva_gramos():
    it = _Item(sealed_spools=3, open_remaining_g=Decimal("300"), min_spools=2)
    fs.normalize_from_counts(it)
    assert it.quantity == Decimal("3300")
    assert it.min_quantity == Decimal("2000")
    assert it.open_remaining_g == Decimal("300")


def test_normalize_carga_overflow_de_bobina_abierta():
    it = _Item(sealed_spools=1, open_remaining_g=Decimal("1200"))
    fs.normalize_from_counts(it)
    assert it.sealed_spools == 2
    assert it.open_remaining_g == Decimal("200")
    assert it.quantity == Decimal("2200")


def test_normalize_open_cero_queda_none():
    it = _Item(sealed_spools=2, open_remaining_g=Decimal("0"))
    fs.normalize_from_counts(it)
    assert it.open_remaining_g is None
    assert it.quantity == Decimal("2000")


def test_derive_counts_from_grams():
    it = _Item(quantity=Decimal("2300"), min_quantity=Decimal("1500"))
    fs.derive_counts_from_grams(it)
    assert it.sealed_spools == 2
    assert it.open_remaining_g == Decimal("300")
    assert it.min_spools == 2  # ceil(1500/1000)


def test_derive_multiplo_exacto_open_none():
    it = _Item(quantity=Decimal("2000"))
    fs.derive_counts_from_grams(it)
    assert it.sealed_spools == 2
    assert it.open_remaining_g is None


def test_deduct_con_rollover():
    it = _Item(sealed_spools=3, open_remaining_g=Decimal("300"))
    fs.normalize_from_counts(it)
    short = fs.deduct_grams(it, Decimal("400"))
    assert short == 0
    assert it.sealed_spools == 2
    assert it.open_remaining_g == Decimal("900")
    assert it.quantity == Decimal("2900")


def test_deduct_shortfall_floorea_en_cero():
    it = _Item(sealed_spools=0, open_remaining_g=Decimal("500"))
    fs.normalize_from_counts(it)
    short = fs.deduct_grams(it, Decimal("800"))
    assert short == Decimal("300")
    assert it.quantity == Decimal("0")


def test_deduct_salvaguarda_conteos_sin_inicializar():
    # gramos presentes pero sealed=0/open=None (dato pre-backfill)
    it = _Item(quantity=Decimal("1500"), sealed_spools=0, open_remaining_g=None)
    short = fs.deduct_grams(it, Decimal("200"))
    assert short == 0
    assert it.quantity == Decimal("1300")
    assert it.sealed_spools == 1
    assert it.open_remaining_g == Decimal("300")


def test_sin_weight_per_roll_es_gramos_planos():
    it = _Item(weight_per_roll=None, quantity=Decimal("500"))
    fs.normalize_from_counts(it)  # no-op
    assert it.quantity == Decimal("500")
    short = fs.deduct_grams(it, Decimal("200"))
    assert short == 0
    assert it.quantity == Decimal("300")


def test_available_grams():
    it = _Item(sealed_spools=1, open_remaining_g=Decimal("250"))
    fs.normalize_from_counts(it)
    assert fs.available_grams(it) == Decimal("1250")


def test_add_sealed_spools():
    it = _Item(sealed_spools=1, open_remaining_g=Decimal("400"))
    fs.normalize_from_counts(it)
    fs.add_sealed_spools(it, 2)
    assert it.sealed_spools == 3
    assert it.quantity == Decimal("3400")


@pytest.mark.parametrize("qty,expected_sealed,expected_open", [
    (Decimal("0"), 0, None),
    (Decimal("999"), 0, Decimal("999")),
    (Decimal("1000"), 1, None),
    (Decimal("1001"), 1, Decimal("1")),
])
def test_derive_bordes(qty, expected_sealed, expected_open):
    it = _Item(quantity=qty)
    fs.derive_counts_from_grams(it)
    assert it.sealed_spools == expected_sealed
    assert it.open_remaining_g == expected_open
