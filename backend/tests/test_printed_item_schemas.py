"""
Tests unitarios para los schemas Pydantic de PrintedItem.

Verifica la validación de:
    - PrintedItemCreate: campos requeridos, longitudes, valores mínimos.
    - PrintedItemUpdate: todos los campos son opcionales.
    - PrintedItemSellRequest: quantity debe ser > 0.
    - PrintedItemImageResponse: almacena image_url correctamente.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.printed_item import (
    PrintedItemCreate,
    PrintedItemUpdate,
    PrintedItemSellRequest,
    PrintedItemImageResponse,
)


# ── Tests de PrintedItemCreate ────────────────────────────────────────────────

class TestPrintedItemCreate:
    """Validación del schema de creación de ítems de impresión."""

    def test_minimo_valido(self):
        """Solo 'name' es obligatorio; el resto usa defaults."""
        item = PrintedItemCreate(name="Llavero Tortuga")
        assert item.name     == "Llavero Tortuga"
        assert item.quantity == 0
        assert item.category   is None
        assert item.unit_price is None
        assert item.material   is None
        assert item.color      is None

    def test_todos_los_campos(self):
        """Todos los campos (excepto imagen) se guardan correctamente."""
        item = PrintedItemCreate(
            name="Figura BambuLab",
            category="Figuras",
            description="Figura de prueba impresa en PLA",
            quantity=5,
            unit_price=Decimal("12.50"),
            material="PLA",
            color="Azul",
        )
        assert item.name        == "Figura BambuLab"
        assert item.category    == "Figuras"
        assert item.quantity    == 5
        assert item.unit_price  == Decimal("12.50")
        assert item.material    == "PLA"
        assert item.color       == "Azul"

    def test_name_vacio_rechazado(self):
        """name vacío (min_length=1) debe fallar la validación."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="")

    def test_name_muy_largo_rechazado(self):
        """name de más de 200 caracteres debe fallar."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="A" * 201)

    def test_name_exactamente_200_caracteres_valido(self):
        """name de exactamente 200 caracteres es válido."""
        item = PrintedItemCreate(name="B" * 200)
        assert len(item.name) == 200

    def test_quantity_negativo_rechazado(self):
        """quantity < 0 debe fallar (ge=0)."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="Pieza", quantity=-1)

    def test_quantity_cero_valido(self):
        """quantity=0 es válido (ge=0, el default)."""
        item = PrintedItemCreate(name="Pieza", quantity=0)
        assert item.quantity == 0

    def test_unit_price_negativo_rechazado(self):
        """unit_price < 0 debe fallar (ge=0)."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="Pieza", unit_price=Decimal("-0.01"))

    def test_unit_price_cero_valido(self):
        """unit_price=0 es válido (ge=0)."""
        item = PrintedItemCreate(name="Pieza", unit_price=Decimal("0"))
        assert item.unit_price == Decimal("0")

    def test_category_max_100_chars(self):
        """category de más de 100 caracteres debe fallar."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="Pieza", category="C" * 101)

    def test_material_max_100_chars(self):
        """material de más de 100 caracteres debe fallar."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="Pieza", material="M" * 101)

    def test_color_max_50_chars(self):
        """color de más de 50 caracteres debe fallar."""
        with pytest.raises(ValidationError):
            PrintedItemCreate(name="Pieza", color="C" * 51)


# ── Tests de PrintedItemUpdate ────────────────────────────────────────────────

class TestPrintedItemUpdate:
    """PrintedItemUpdate: todos los campos son opcionales."""

    def test_sin_campos_es_valido(self):
        """Un objeto vacío es válido; todos los campos son None."""
        update = PrintedItemUpdate()
        assert update.name       is None
        assert update.category   is None
        assert update.quantity   is None
        assert update.unit_price is None
        assert update.material   is None
        assert update.color      is None

    def test_actualizar_solo_nombre(self):
        """Solo el campo name puede actualizarse."""
        update = PrintedItemUpdate(name="Nuevo nombre")
        assert update.name == "Nuevo nombre"
        assert update.quantity is None

    def test_actualizar_solo_precio(self):
        """Solo unit_price puede actualizarse."""
        update = PrintedItemUpdate(unit_price=Decimal("25.00"))
        assert update.unit_price == Decimal("25.00")
        assert update.name is None

    def test_nombre_vacio_rechazado(self):
        """name vacío (min_length=1) debe fallar aunque sea update."""
        with pytest.raises(ValidationError):
            PrintedItemUpdate(name="")

    def test_quantity_negativo_rechazado(self):
        """quantity negativo en update también falla."""
        with pytest.raises(ValidationError):
            PrintedItemUpdate(quantity=-5)

    def test_unit_price_negativo_rechazado(self):
        """unit_price negativo en update también falla."""
        with pytest.raises(ValidationError):
            PrintedItemUpdate(unit_price=Decimal("-1"))


# ── Tests de PrintedItemSellRequest ──────────────────────────────────────────

class TestPrintedItemSellRequest:
    """PrintedItemSellRequest: quantity debe ser mayor que cero."""

    def test_quantity_uno_valido(self):
        """quantity=1 es el mínimo válido (gt=0)."""
        req = PrintedItemSellRequest(quantity=1)
        assert req.quantity == 1

    def test_quantity_grande_valido(self):
        """quantity grande es válido."""
        req = PrintedItemSellRequest(quantity=1000)
        assert req.quantity == 1000

    def test_quantity_cero_rechazado(self):
        """quantity=0 debe fallar (gt=0)."""
        with pytest.raises(ValidationError):
            PrintedItemSellRequest(quantity=0)

    def test_quantity_negativo_rechazado(self):
        """quantity negativo debe fallar."""
        with pytest.raises(ValidationError):
            PrintedItemSellRequest(quantity=-1)

    def test_quantity_requerido(self):
        """quantity es obligatorio; sin él falla la validación."""
        with pytest.raises(ValidationError):
            PrintedItemSellRequest()


# ── Tests de PrintedItemImageResponse ────────────────────────────────────────

class TestPrintedItemImageResponse:
    """PrintedItemImageResponse almacena la URL de la imagen."""

    def test_image_url_almacenada(self):
        """image_url (URL del proxy MinIO) se guarda correctamente."""
        resp = PrintedItemImageResponse(image_url="/api/inventory/prints/7/image?v=1700000000")
        assert resp.image_url == "/api/inventory/prints/7/image?v=1700000000"

    def test_image_url_requerida(self):
        """image_url es obligatoria."""
        with pytest.raises(ValidationError):
            PrintedItemImageResponse()
