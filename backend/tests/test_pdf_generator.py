"""
Tests unitarios para el generador de PDFs de cotización (pdf_generator.py).

Estrategia:
    - Se parchea SimpleDocTemplate para capturar la lista de elements sin
      generar el PDF real. Los objetos Paragraph y Table son instancias reales
      de ReportLab, lo que permite inspeccionar su contenido.
    - _extraer_textos() recorre recursivamente elements, filas de Table y
      listas anidadas extrayendo el texto de cada Paragraph.

Tests cubren:
    - "Medellín, Colombia" aparece en el encabezado de la empresa.
    - Bloque de cliente con etiqueta "Cliente:" antes del nombre.
    - El bloque de cliente NO aparece cuando client_name es None.
    - Descripción del cliente se incluye cuando está presente.
    - Cuatro términos de pago aparecen en el pie de página.
    - Línea de generación incluye "Medellín, Colombia".
    - generate_quote_pdf retorna bytes cuando se llama sin mock.
    - Formato de número de cotización: TFC-XXXX.
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from reportlab.platypus import Paragraph, Table

from app.services.pdf_generator import generate_quote_pdf, generate_client_quote_pdf


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extraer_textos_celda(celda):
    """
    Extrae textos de una celda de tabla, que puede ser:
    - Paragraph: retorna su texto.
    - lista de elementos: recursivo.
    - str: retorna el string.
    - otro (Spacer, Image, etc.): se ignora.
    """
    textos = []
    if isinstance(celda, Paragraph):
        textos.append(celda.text)
    elif isinstance(celda, list):
        for item in celda:
            textos.extend(_extraer_textos_celda(item))
    elif isinstance(celda, str):
        textos.append(celda)
    return textos


def _extraer_textos(elements):
    """
    Recorre la lista de elements de ReportLab y extrae todos los textos de
    Paragraph, incluyendo los contenidos en filas de Table.
    """
    textos = []
    for elem in elements:
        if isinstance(elem, Paragraph):
            textos.append(elem.text)
        elif isinstance(elem, Table):
            for fila in elem._cellvalues:
                for celda in fila:
                    textos.extend(_extraer_textos_celda(celda))
        elif isinstance(elem, list):
            textos.extend(_extraer_textos(elem))
    return textos


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_quote(**overrides):
    """
    Crea un mock de Quote con los atributos mínimos requeridos por
    generate_quote_pdf. Cualquier atributo puede sobreescribirse.
    """
    q = MagicMock(spec=[
        "id", "piece_name", "client_name", "description", "notes",
        "quantity", "total_price", "total_price_cop",
        "total_per_unit", "total_per_unit_cop", "created_at",
    ])
    q.id                = 1
    q.piece_name        = "Soporte de prueba"
    q.client_name       = None
    q.description       = None
    q.notes             = None
    q.quantity          = 1
    q.total_price       = Decimal("4.06")
    q.total_price_cop   = None
    q.total_per_unit    = Decimal("4.06")
    q.total_per_unit_cop = None
    q.created_at        = datetime(2024, 6, 15, 12, 0, 0)
    for k, v in overrides.items():
        setattr(q, k, v)
    return q


def _capturar_elements(quote):
    """
    Llama a generate_quote_pdf con un SimpleDocTemplate mockeado y devuelve
    la lista de elements que se habrían pasado a doc.build().
    """
    capturados = []

    with patch("app.services.pdf_generator.SimpleDocTemplate") as MockDoc:
        instancia = MagicMock()
        MockDoc.return_value = instancia
        instancia.build.side_effect = lambda elems: capturados.extend(elems)
        generate_quote_pdf(quote)

    return capturados


# ─────────────────────────────────────────────────────────────────────────────
# TestEncabezadoEmpresa
# ─────────────────────────────────────────────────────────────────────────────

class TestEncabezadoEmpresa:
    """Verifica que el encabezado contiene la ubicación correcta de la empresa."""

    def test_medellin_colombia_en_encabezado(self):
        """'Medellín, Colombia' debe aparecer en el encabezado de la empresa."""
        elements = _capturar_elements(_make_quote())
        textos   = _extraer_textos(elements)
        assert any("Medellín, Colombia" in t for t in textos), (
            f"'Medellín, Colombia' no encontrado en los textos: {textos}"
        )

    def test_nombre_empresa_en_encabezado(self):
        """'TurtleForge Studio' debe aparecer en el encabezado."""
        elements = _capturar_elements(_make_quote())
        textos   = _extraer_textos(elements)
        assert any("TurtleForge Studio" in t for t in textos)

    def test_medellin_en_linea_generacion(self):
        """La línea de generación al pie también incluye 'Medellín, Colombia'."""
        elements = _capturar_elements(_make_quote())
        # Solo Paragraphs directos (no en tablas) para encontrar la línea de pie
        paras = [e for e in elements if isinstance(e, Paragraph)]
        assert any("Medellín, Colombia" in p.text for p in paras), (
            "La línea de generación al pie no contiene 'Medellín, Colombia'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# TestBloqueCliente
# ─────────────────────────────────────────────────────────────────────────────

class TestBloqueCliente:
    """Verifica el bloque de información del cliente en el PDF."""

    def test_etiqueta_cliente_presente_con_nombre(self):
        """Cuando hay client_name, debe aparecer la etiqueta 'Cliente:' en el PDF."""
        quote    = _make_quote(client_name="Juan Pérez")
        elements = _capturar_elements(quote)
        textos   = _extraer_textos(elements)
        assert any("Cliente:" in t for t in textos), (
            f"Etiqueta 'Cliente:' no encontrada. Textos: {textos}"
        )

    def test_nombre_cliente_en_mayusculas(self):
        """El nombre del cliente debe aparecer en mayúsculas en el PDF."""
        quote    = _make_quote(client_name="Juan Pérez")
        elements = _capturar_elements(quote)
        textos   = _extraer_textos(elements)
        assert any("JUAN PÉREZ" in t for t in textos), (
            "El nombre del cliente no aparece en mayúsculas"
        )

    def test_sin_cliente_no_aparece_etiqueta(self):
        """Sin client_name, la etiqueta 'Cliente:' no debe aparecer."""
        quote    = _make_quote(client_name=None)
        elements = _capturar_elements(quote)
        textos   = _extraer_textos(elements)
        assert not any("Cliente:" in t for t in textos), (
            "La etiqueta 'Cliente:' aparece aunque client_name es None"
        )

    def test_descripcion_cliente_incluida(self):
        """La descripción del cliente se agrega al bloque cuando está presente."""
        quote    = _make_quote(client_name="Empresa XYZ", description="Pedido urgente")
        elements = _capturar_elements(quote)
        textos   = _extraer_textos(elements)
        assert any("Pedido urgente" in t for t in textos), (
            "La descripción del cliente no aparece en el PDF"
        )

    def test_descripcion_omitida_si_es_none(self):
        """Sin description, el texto 'None' no debe aparecer en el PDF."""
        quote    = _make_quote(client_name="Empresa XYZ", description=None)
        elements = _capturar_elements(quote)
        textos   = _extraer_textos(elements)
        assert not any("None" in t for t in textos)


# ─────────────────────────────────────────────────────────────────────────────
# TestTerminosPago
# ─────────────────────────────────────────────────────────────────────────────

class TestTerminosPago:
    """Verifica que los cuatro términos de pago aparecen en el pie del PDF."""

    _TERMINOS_ESPERADOS = [
        "pago del 50% del monto total",
        "50% restante",
        "No se despacha ningún pedido",
        "gastos de envío corren por cuenta del cliente",
    ]

    def test_terminos_titulo_presente(self):
        """El título 'Términos de pago y envío:' debe estar en el PDF."""
        elements = _capturar_elements(_make_quote())
        paras    = [e for e in elements if isinstance(e, Paragraph)]
        assert any("Términos de pago y envío:" in p.text for p in paras), (
            "El título de términos de pago no se encontró"
        )

    @pytest.mark.parametrize("fragmento", _TERMINOS_ESPERADOS)
    def test_termino_presente(self, fragmento):
        """Cada término de pago debe aparecer como Paragraph directo en elements."""
        elements = _capturar_elements(_make_quote())
        paras    = [e for e in elements if isinstance(e, Paragraph)]
        assert any(fragmento in p.text for p in paras), (
            f"Fragmento no encontrado en el PDF: '{fragmento}'"
        )

    def test_cuatro_terminos_presentes(self):
        """Los cuatro términos de pago deben estar presentes simultáneamente."""
        elements = _capturar_elements(_make_quote())
        paras    = [e for e in elements if isinstance(e, Paragraph)]
        todos_textos = [p.text for p in paras]
        for fragmento in self._TERMINOS_ESPERADOS:
            assert any(fragmento in t for t in todos_textos), (
                f"Término ausente: '{fragmento}'"
            )


# ─────────────────────────────────────────────────────────────────────────────
# TestNumeroCotizacion
# ─────────────────────────────────────────────────────────────────────────────

class TestNumeroCotizacion:
    """Verifica que el número de cotización sigue el formato TFC-XXXX."""

    def test_formato_tfc_cuatro_digitos(self):
        """El número de cotización debe tener el formato 'TFC-0001' (4 dígitos)."""
        quote    = _make_quote(id=1)
        elements = _capturar_elements(quote)
        paras    = [e for e in elements if isinstance(e, Paragraph)]
        assert any("TFC-0001" in p.text for p in paras), (
            "El número TFC-0001 no aparece en el PDF"
        )

    def test_formato_id_mayor(self):
        """Un id mayor como 42 genera 'TFC-0042'."""
        quote    = _make_quote(id=42)
        elements = _capturar_elements(quote)
        paras    = [e for e in elements if isinstance(e, Paragraph)]
        assert any("TFC-0042" in p.text for p in paras)


# ─────────────────────────────────────────────────────────────────────────────
# TestGeneracionRealPDF
# ─────────────────────────────────────────────────────────────────────────────

class TestGeneracionRealPDF:
    """Verifica que generate_quote_pdf produce un PDF válido (sin mock)."""

    def test_retorna_bytes(self):
        """generate_quote_pdf retorna un objeto bytes."""
        quote  = _make_quote()
        result = generate_quote_pdf(quote)
        assert isinstance(result, bytes)

    def test_bytes_no_vacios(self):
        """El PDF generado no debe estar vacío."""
        result = generate_quote_pdf(_make_quote())
        assert len(result) > 0

    def test_encabezado_pdf_valido(self):
        """El PDF debe comenzar con la firma estándar '%PDF'."""
        result = generate_quote_pdf(_make_quote())
        assert result[:4] == b"%PDF"

    def test_pdf_con_cliente_valido(self):
        """El PDF se genera sin errores cuando hay client_name y description."""
        quote  = _make_quote(client_name="Empresa Test", description="Descripción de prueba")
        result = generate_quote_pdf(quote)
        assert result[:4] == b"%PDF"

    def test_pdf_con_cop_valido(self):
        """El PDF se genera correctamente cuando hay precios en COP."""
        quote = _make_quote(
            total_price_cop=Decimal("16000"),
            total_per_unit_cop=Decimal("16000"),
        )
        result = generate_quote_pdf(quote)
        assert result[:4] == b"%PDF"

    def test_pdf_con_notas_valido(self):
        """El PDF se genera correctamente cuando hay notas adicionales."""
        quote  = _make_quote(notes="Entregar en empaque especial.")
        result = generate_quote_pdf(quote)
        assert result[:4] == b"%PDF"

    def test_pdf_multiples_unidades(self):
        """El PDF se genera correctamente con quantity > 1."""
        quote  = _make_quote(quantity=5)
        result = generate_quote_pdf(quote)
        assert result[:4] == b"%PDF"


# ─────────────────────────────────────────────────────────────────────────────
# TestClienteQuotePDF
# ─────────────────────────────────────────────────────────────────────────────

def _make_client_quote(**overrides):
    """
    Crea un mock de ClientQuote con los atributos mínimos requeridos por
    generate_client_quote_pdf. Cualquier atributo puede sobreescribirse.
    """
    import json as _json
    from datetime import date

    cq = MagicMock(spec=[
        "id", "client_name", "description", "quote_date", "expiry_date",
        "items", "subtotal", "include_iva", "iva_percent", "notes",
    ])
    cq.id           = 1
    cq.client_name  = "Empresa de Prueba"
    cq.description  = None
    cq.quote_date   = date(2024, 6, 15)
    cq.expiry_date  = date(2024, 6, 30)
    cq.items        = _json.dumps([{"name": "Figura Dragon", "quantity": 2, "unit_price": 15.0}])
    cq.subtotal     = Decimal("30.00")
    cq.include_iva  = False
    cq.iva_percent  = Decimal("19.00")
    cq.notes        = None
    for k, v in overrides.items():
        setattr(cq, k, v)
    return cq


class TestClienteQuotePDF:
    """Verifica la generación de PDFs COT-XXXX con generate_client_quote_pdf."""

    def test_retorna_bytes(self):
        """generate_client_quote_pdf retorna bytes."""
        result = generate_client_quote_pdf(_make_client_quote())
        assert isinstance(result, bytes)

    def test_encabezado_pdf_valido(self):
        """El PDF generado debe comenzar con '%PDF'."""
        result = generate_client_quote_pdf(_make_client_quote())
        assert result[:4] == b"%PDF"

    def test_numero_cot_en_pdf(self):
        """El número COT-0001 debe aparecer en el PDF."""
        cq = _make_client_quote(id=1)
        with patch("app.services.pdf_generator.SimpleDocTemplate") as MockDoc:
            capturados = []
            instancia  = MagicMock()
            MockDoc.return_value = instancia
            instancia.build.side_effect = lambda elems: capturados.extend(elems)
            generate_client_quote_pdf(cq)
        paras = [e for e in capturados if isinstance(e, Paragraph)]
        assert any("COT-0001" in p.text for p in paras)

    def test_iva_no_aplica_por_defecto(self):
        """Con include_iva=False, la fila IVA debe mostrar 'No Aplica'."""
        cq = _make_client_quote(include_iva=False)
        with patch("app.services.pdf_generator.SimpleDocTemplate") as MockDoc:
            capturados = []
            instancia  = MagicMock()
            MockDoc.return_value = instancia
            instancia.build.side_effect = lambda elems: capturados.extend(elems)
            generate_client_quote_pdf(cq)
        textos = _extraer_textos(capturados)
        assert any("No Aplica" in t for t in textos), (
            f"'No Aplica' no encontrado en textos: {textos}"
        )

    def test_iva_aplicado_cuando_activo(self):
        """Con include_iva=True, la fila IVA debe mostrar un valor calculado (no 'No Aplica')."""
        cq = _make_client_quote(include_iva=True, iva_percent=Decimal("19.00"))
        with patch("app.services.pdf_generator.SimpleDocTemplate") as MockDoc:
            capturados = []
            instancia  = MagicMock()
            MockDoc.return_value = instancia
            instancia.build.side_effect = lambda elems: capturados.extend(elems)
            # subtotal=30 USD, rate=4000 → subtotal_cop=120000, IVA=22800
            generate_client_quote_pdf(cq, usd_rate=4000.0)
        textos = _extraer_textos(capturados)
        assert not any(t == "No Aplica" for t in textos), (
            "Con IVA activo no debe aparecer 'No Aplica'"
        )
        # El IVA calculado (19% de 120000 = 22800) debe estar formateado en COP
        assert any("22.800" in t or "22800" in t for t in textos), (
            f"Valor de IVA no encontrado en textos: {textos}"
        )

    def test_pdf_con_iva_activo_retorna_bytes(self):
        """El PDF se genera sin errores con include_iva=True."""
        cq     = _make_client_quote(include_iva=True)
        result = generate_client_quote_pdf(cq, usd_rate=4200.0)
        assert result[:4] == b"%PDF"
