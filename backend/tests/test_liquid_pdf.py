"""
Tests unitarios para el servicio de renderizado Liquid+WeasyPrint (liquid_pdf.py).

Estrategia:
    - python-liquid y weasyprint NO están instalados en el entorno de desarrollo.
    - Las funciones puras (_build_palette, _check_required_vars, _build_cot_context,
      _build_sample_context, _fmt_cop) se testean directamente sin mocks de libs.
    - validate_template y render_client_quote_pdf se testean inyectando mocks en el
      namespace del módulo (create=True) para simular las libs sin instalarlas.

Cubre:
    - _fmt_cop: formateo de pesos colombianos.
    - _build_palette: paleta por defecto y desde empresa.
    - _check_required_vars: advertencias cuando faltan variables clave.
    - _build_cot_context: construcción completa del contexto Liquid.
    - _build_sample_context: contexto de muestra para preview.
    - validate_template: válido, inválido, sin libs.
    - render_client_quote_pdf: bytes PDF con libs mockeadas.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.services.liquid_pdf import (
    _DEFAULT_PALETTE,
    _LIQUID_AVAILABLE,
    _WEASYPRINT_AVAILABLE,
    _build_cot_context,
    _build_palette,
    _build_sample_context,
    _check_required_vars,
    _fmt_cop,
    validate_template,
)

# ── Flags de disponibilidad de libs externas ─────────────────────────────────
_AMBAS_DISPONIBLES = _LIQUID_AVAILABLE and _WEASYPRINT_AVAILABLE

# ── Helper para parchear atributos que pueden no existir en el módulo ─────────
# Cuando python-liquid / weasyprint no están instalados, LiquidEnvironment y
# WeasyprintHTML no se definen en el módulo. Usamos create=True para crearlos.
import app.services.liquid_pdf as _liquid_pdf_module


# ── Helpers de fixtures ───────────────────────────────────────────────────────

def _make_client_quote(**overrides):
    """
    Crea un mock de ClientQuote con los atributos mínimos para _build_cot_context.
    Cualquier atributo puede sobreescribirse.
    """
    cq = MagicMock()
    cq.id = 1
    cq.client_name = "Empresa de Prueba"
    cq.description = "Pedido de prueba"
    cq.notes = None
    cq.quote_date = date(2026, 2, 27)
    cq.expiry_date = date(2026, 3, 29)
    cq.items = [
        {"name": "Figura Dragon", "quantity": 2, "unit_price": 10.0},
    ]
    cq.subtotal = Decimal("20.00")
    cq.include_iva = False
    cq.iva_percent = Decimal("19.00")
    for k, v in overrides.items():
        setattr(cq, k, v)
    return cq


def _make_company(**overrides):
    """
    Crea un mock de Company con los atributos utilizados por liquid_pdf.
    Cualquier atributo puede sobreescribirse.
    """
    c = MagicMock()
    c.name = "Collector's Forge Studio"
    c.slogan = "Impresión 3D de calidad"
    c.address = "Medellín, Colombia"
    c.phone = "+57 300 000 0000"
    c.contact_email = "hola@empresa.com"
    c.nit = "900.000.000-0"
    c.logo_key = None
    c.pdf_palette = None
    c.pdf_terms = None
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


# ─────────────────────────────────────────────────────────────────────────────
# TestFmtCop
# ─────────────────────────────────────────────────────────────────────────────

class TestFmtCop:
    """Verifica el formateo de valores como pesos colombianos."""

    def test_formato_basico(self):
        """Valor simple se formatea correctamente con prefijo '$ '."""
        assert _fmt_cop(1000) == "$ 1.000"

    def test_millones(self):
        """Valor con separadores de miles: 1.234.567."""
        assert _fmt_cop(1234567) == "$ 1.234.567"

    def test_cero(self):
        """Cero se formatea como '$ 0'."""
        assert _fmt_cop(0) == "$ 0"

    def test_redondeo(self):
        """Valor con decimales se redondea al entero más cercano."""
        assert _fmt_cop(999.7) == "$ 1.000"

    def test_valor_pequeno(self):
        """Valor menor a mil no lleva separador de miles."""
        assert _fmt_cop(500) == "$ 500"


# ─────────────────────────────────────────────────────────────────────────────
# TestBuildPalette
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildPalette:
    """Verifica la construcción de la paleta de colores desde la empresa."""

    def test_sin_company_usa_palette_default(self):
        """Sin company, debe usarse _DEFAULT_PALETTE."""
        palette_dict, colors_list = _build_palette(None)
        assert palette_dict == {
            "primary": "#1A1A1A",
            "accent": "#B67E3A",
            "highlight": "#A33221",
            "table_text": "#D1A054",
        }
        assert colors_list == _DEFAULT_PALETTE

    def test_company_sin_pdf_palette_usa_default(self):
        """Company con pdf_palette=None debe caer al default."""
        company = _make_company(pdf_palette=None)
        palette_dict, colors_list = _build_palette(company)
        assert palette_dict["primary"] == "#1A1A1A"
        assert colors_list == _DEFAULT_PALETTE

    def test_company_con_pdf_palette_custom(self):
        """Company con pdf_palette custom devuelve colores propios."""
        custom = [
            {"name": "primary", "hex": "#FF0000"},
            {"name": "accent", "hex": "#0000FF"},
        ]
        company = _make_company(pdf_palette=custom)
        palette_dict, colors_list = _build_palette(company)
        assert palette_dict["primary"] == "#FF0000"
        assert palette_dict["accent"] == "#0000FF"
        assert colors_list == custom

    def test_palette_dict_claves_en_minusculas(self):
        """Las claves del dict de paleta deben estar en minúsculas."""
        custom = [{"name": "PRIMARY", "hex": "#ABCDEF"}]
        company = _make_company(pdf_palette=custom)
        palette_dict, _ = _build_palette(company)
        assert "primary" in palette_dict
        assert "PRIMARY" not in palette_dict

    def test_entradas_invalidas_son_ignoradas(self):
        """Entradas sin 'name' o sin 'hex' se descartan silenciosamente."""
        custom = [
            {"name": "ok", "hex": "#123456"},
            {"name": "", "hex": "#000000"},   # name vacío
            {"hex": "#FFFFFF"},               # sin name
            {"name": "noHex"},                # sin hex
        ]
        company = _make_company(pdf_palette=custom)
        palette_dict, _ = _build_palette(company)
        assert "ok" in palette_dict
        assert len(palette_dict) == 1


# ─────────────────────────────────────────────────────────────────────────────
# TestCheckRequiredVars
# ─────────────────────────────────────────────────────────────────────────────

class TestCheckRequiredVars:
    """Verifica la detección de variables recomendadas ausentes."""

    def test_todas_las_variables_presentes_sin_warnings(self):
        """Template con las 3 variables recomendadas → lista vacía."""
        content = "{{ quote_number }} {% for item in items %}{{ item.name }}{% endfor %} {{ total_fmt }}"
        warnings = _check_required_vars(content)
        assert warnings == []

    def test_todas_ausentes_genera_tres_warnings(self):
        """Template sin ninguna variable recomendada → 3 advertencias."""
        warnings = _check_required_vars("<p>Hola mundo</p>")
        assert len(warnings) == 3

    def test_solo_quote_number_ausente(self):
        """Falta únicamente quote_number → 1 advertencia con ese nombre."""
        content = "{% for item in items %}x{% endfor %} {{ total_fmt }}"
        warnings = _check_required_vars(content)
        assert len(warnings) == 1
        assert "quote_number" in warnings[0]

    def test_solo_items_ausente(self):
        """Falta únicamente items → 1 advertencia con ese nombre."""
        content = "{{ quote_number }} {{ total_fmt }}"
        warnings = _check_required_vars(content)
        assert len(warnings) == 1
        assert "items" in warnings[0]

    def test_solo_total_fmt_ausente(self):
        """Falta únicamente total_fmt → 1 advertencia con ese nombre."""
        content = "{{ quote_number }} {% for item in items %}x{% endfor %}"
        warnings = _check_required_vars(content)
        assert len(warnings) == 1
        assert "total_fmt" in warnings[0]

    def test_template_vacio_genera_tres_warnings(self):
        """Template vacío → 3 advertencias (una por cada variable requerida)."""
        warnings = _check_required_vars("")
        assert len(warnings) == 3


# ─────────────────────────────────────────────────────────────────────────────
# TestBuildCotContext
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildCotContext:
    """Verifica la construcción del contexto Liquid para una cotización."""

    def test_retorna_claves_esperadas(self):
        """El contexto debe incluir todas las claves definidas en el docstring."""
        claves_esperadas = {
            "quote_number", "quote_date", "expiry_date", "generated_date",
            "client_name", "description", "notes", "items",
            "subtotal_fmt", "iva_str", "total_fmt", "include_iva",
            "pdf_terms", "company", "palette", "colors",
        }
        ctx = _build_cot_context(_make_client_quote(), None, 4000.0)
        assert claves_esperadas.issubset(ctx.keys())

    def test_quote_number_formato_cot_cuatro_digitos(self):
        """quote_number debe seguir el formato 'COT-XXXX'."""
        cq = _make_client_quote(id=7)
        ctx = _build_cot_context(cq, None, 4000.0)
        assert ctx["quote_number"] == "COT-0007"

    def test_iva_no_aplica_cuando_include_iva_false(self):
        """Con include_iva=False, iva_str debe ser 'No Aplica'."""
        cq = _make_client_quote(include_iva=False)
        ctx = _build_cot_context(cq, None, 4000.0)
        assert ctx["iva_str"] == "No Aplica"

    def test_iva_calculado_cuando_include_iva_true(self):
        """Con include_iva=True, iva_str debe ser un valor formateado distinto de 'No Aplica'."""
        cq = _make_client_quote(
            include_iva=True,
            iva_percent=Decimal("19.00"),
            subtotal=Decimal("10.00"),
        )
        ctx = _build_cot_context(cq, None, 4000.0)
        assert ctx["iva_str"] != "No Aplica"
        assert ctx["iva_str"].startswith("$")

    def test_total_incluye_iva_cuando_activo(self):
        """Con include_iva=True, total_fmt > subtotal_fmt."""
        cq = _make_client_quote(
            include_iva=True,
            iva_percent=Decimal("19.00"),
            subtotal=Decimal("10.00"),
            items=[{"name": "X", "quantity": 1, "unit_price": 10.0}],
        )
        ctx = _build_cot_context(cq, None, 4000.0)
        # subtotal = 10 * 4000 = 40000, IVA 19% = 7600, total = 47600
        assert "47.600" in ctx["total_fmt"]

    def test_company_none_usa_valores_defecto(self):
        """Sin company, el ctx['company']['name'] debe ser 'Collector's Forge Studio'."""
        ctx = _build_cot_context(_make_client_quote(), None, 4000.0)
        assert ctx["company"]["name"] == "Collector's Forge Studio"
        assert ctx["company"]["address"] == "Medellín, Colombia"

    def test_company_real_propaga_nombre(self):
        """Con company, ctx['company']['name'] refleja el nombre de la empresa."""
        company = _make_company(name="Mi Empresa Custom")
        ctx = _build_cot_context(_make_client_quote(), company, 4000.0)
        assert ctx["company"]["name"] == "Mi Empresa Custom"

    def test_pdf_terms_de_company(self):
        """Con company.pdf_terms, ctx['pdf_terms'] debe ser el texto personalizado."""
        company = _make_company(pdf_terms="Pago contra entrega.")
        ctx = _build_cot_context(_make_client_quote(), company, 4000.0)
        assert ctx["pdf_terms"] == "Pago contra entrega."

    def test_pdf_terms_vacio_sin_company(self):
        """Sin company, pdf_terms debe ser cadena vacía."""
        ctx = _build_cot_context(_make_client_quote(), None, 4000.0)
        assert ctx["pdf_terms"] == ""

    def test_paleta_custom_de_company(self):
        """La paleta en el contexto refleja pdf_palette de la empresa."""
        company = _make_company(pdf_palette=[
            {"name": "primary", "hex": "#FF0000"},
        ])
        ctx = _build_cot_context(_make_client_quote(), company, 4000.0)
        assert ctx["palette"]["primary"] == "#FF0000"

    def test_items_formateados_en_cop(self):
        """Los ítems deben incluir unit_price_fmt y line_total_fmt formateados."""
        cq = _make_client_quote(
            items=[{"name": "Pieza X", "quantity": 2, "unit_price": 5.0}]
        )
        # unit_price=5 USD * 4000 = 20000 COP, line_total = 40000
        ctx = _build_cot_context(cq, None, 4000.0)
        assert len(ctx["items"]) == 1
        item = ctx["items"][0]
        assert item["name"] == "Pieza X"
        assert "20.000" in item["unit_price_fmt"]
        assert "40.000" in item["line_total_fmt"]

    def test_usd_rate_uno_usa_precio_directo(self):
        """Con usd_rate=1.0, los precios se pasan tal cual (sin conversión)."""
        cq = _make_client_quote(
            items=[{"name": "Item", "quantity": 1, "unit_price": 25000.0}]
        )
        ctx = _build_cot_context(cq, None, 1.0)
        assert "25.000" in ctx["items"][0]["unit_price_fmt"]

    def test_quote_date_formato_dd_mm_yyyy(self):
        """quote_date debe formatearse como 'DD-MM-YYYY'."""
        cq = _make_client_quote(quote_date=date(2026, 2, 27))
        ctx = _build_cot_context(cq, None, 1.0)
        assert ctx["quote_date"] == "27-02-2026"

    def test_expiry_date_formato_dd_mm_yyyy(self):
        """expiry_date debe formatearse como 'DD-MM-YYYY'."""
        cq = _make_client_quote(expiry_date=date(2026, 3, 29))
        ctx = _build_cot_context(cq, None, 1.0)
        assert ctx["expiry_date"] == "29-03-2026"


# ─────────────────────────────────────────────────────────────────────────────
# TestBuildSampleContext
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildSampleContext:
    """Verifica la construcción del contexto de muestra para preview/validación."""

    def test_retorna_quote_number_fijo(self):
        """El contexto de muestra usa COT-0001 como número de cotización."""
        ctx = _build_sample_context(None)
        assert ctx["quote_number"] == "COT-0001"

    def test_retorna_tres_items(self):
        """El contexto de muestra incluye 3 ítems de ejemplo."""
        ctx = _build_sample_context(None)
        assert len(ctx["items"]) == 3

    def test_contiene_claves_requeridas(self):
        """El contexto de muestra contiene todas las claves necesarias."""
        ctx = _build_sample_context(None)
        for clave in ["quote_number", "items", "total_fmt", "company", "palette"]:
            assert clave in ctx, f"Clave faltante: {clave}"

    def test_sin_company_usa_datos_ficticios(self):
        """Sin company, el contexto usa datos predefinidos de Collector's Forge Studio."""
        ctx = _build_sample_context(None)
        assert ctx["company"]["name"] == "Collector's Forge Studio"

    def test_con_company_propaga_nombre(self):
        """Con company, el nombre de la empresa se refleja en el contexto."""
        company = _make_company(name="Empresa Real")
        ctx = _build_sample_context(company)
        assert ctx["company"]["name"] == "Empresa Real"

    def test_paleta_default_sin_company(self):
        """Sin company, la paleta usa los valores default."""
        ctx = _build_sample_context(None)
        assert ctx["palette"]["primary"] == "#1A1A1A"

    def test_paleta_custom_con_company(self):
        """Con company, la paleta refleja pdf_palette de la empresa."""
        company = _make_company(pdf_palette=[{"name": "primary", "hex": "#AABBCC"}])
        ctx = _build_sample_context(company)
        assert ctx["palette"]["primary"] == "#AABBCC"

    def test_include_iva_es_false_por_defecto(self):
        """El contexto de muestra tiene include_iva=False."""
        ctx = _build_sample_context(None)
        assert ctx["include_iva"] is False

    def test_pdf_terms_vacio_sin_company(self):
        """Sin company, pdf_terms es cadena vacía."""
        ctx = _build_sample_context(None)
        assert ctx["pdf_terms"] == ""

    def test_pdf_terms_de_company(self):
        """Con company, pdf_terms refleja el texto de la empresa."""
        company = _make_company(pdf_terms="Términos personalizados.")
        ctx = _build_sample_context(company)
        assert ctx["pdf_terms"] == "Términos personalizados."


# ─────────────────────────────────────────────────────────────────────────────
# TestValidateTemplate — sin libs instaladas
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateTemplateSinLibs:
    """
    Verifica el comportamiento de validate_template cuando python-liquid
    o weasyprint no están disponibles en el entorno actual.
    """

    def test_sin_liquid_retorna_error(self):
        """
        Si python-liquid no está instalado, validate_template retorna
        ok=False con error descriptivo.
        """
        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", False), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", False):
            result = validate_template("{{ quote_number }}")
        assert result["ok"] is False
        assert len(result["errors"]) > 0
        assert result["preview_pdf_b64"] is None
        assert result["warnings"] == []

    def test_sin_weasyprint_retorna_error(self):
        """
        Si python-liquid está instalado pero weasyprint no, retorna ok=False.
        """
        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", False):
            result = validate_template("{{ quote_number }}")
        assert result["ok"] is False
        assert any("weasyprint" in e.lower() for e in result["errors"])


# ─────────────────────────────────────────────────────────────────────────────
# TestValidateTemplate — con libs mockeadas
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateTemplateConLibsMockeadas:
    """
    Verifica validate_template simulando python-liquid y WeasyPrint
    mediante mocks para no depender de las instalaciones reales.
    """

    def _mock_liquid_env(self, render_output: str = "<html><body>Preview</body></html>"):
        """Crea un mock de LiquidEnvironment que renderiza el string dado."""
        tpl_mock = MagicMock()
        tpl_mock.render.return_value = render_output
        env_mock = MagicMock()
        env_mock.from_string.return_value = tpl_mock
        return env_mock

    def _mock_weasyprint(self, pdf_bytes: bytes = b"%PDF-test"):
        """Crea un mock de WeasyprintHTML que retorna bytes PDF ficticios."""
        html_instance = MagicMock()
        html_instance.write_pdf.return_value = pdf_bytes
        html_class = MagicMock(return_value=html_instance)
        return html_class

    def test_template_valido_retorna_ok_true(self):
        """Template válido con todas las variables → ok=True, sin errors."""
        content = "{{ quote_number }} {% for item in items %}{{ item.name }}{% endfor %} {{ total_fmt }}"
        env_mock = self._mock_liquid_env()
        wp_mock = self._mock_weasyprint()

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_mock):
            result = validate_template(content)

        assert result["ok"] is True
        assert result["errors"] == []
        assert result["preview_pdf_b64"] is not None

    def test_template_valido_sin_variables_recomendadas_genera_warnings(self):
        """Template sin variables recomendadas → ok=True pero con 3 warnings."""
        content = "<p>Contenido estático sin variables</p>"
        env_mock = self._mock_liquid_env(content)
        wp_mock = self._mock_weasyprint()

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_mock):
            result = validate_template(content)

        assert result["ok"] is True
        assert len(result["warnings"]) == 3

    def test_template_valido_preview_pdf_b64_es_base64(self):
        """El preview_pdf_b64 es una cadena base64 decodificable como PDF."""
        import base64
        pdf_bytes = b"%PDF-1.4-FAKE"
        env_mock = self._mock_liquid_env()
        wp_mock = self._mock_weasyprint(pdf_bytes)

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_mock):
            result = validate_template("{{ quote_number }}")

        decoded = base64.b64decode(result["preview_pdf_b64"])
        assert decoded == pdf_bytes

    def test_template_invalido_render_exception_retorna_ok_false(self):
        """Si el render de Liquid lanza excepción → ok=False con mensaje de error."""
        tpl_mock = MagicMock()
        tpl_mock.render.side_effect = Exception("Liquid syntax error")
        env_mock = MagicMock()
        env_mock.from_string.return_value = tpl_mock

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock):
            result = validate_template("{% if sin_cerrar")

        assert result["ok"] is False
        assert len(result["errors"]) > 0
        assert "Liquid syntax error" in result["errors"][0]
        assert result["preview_pdf_b64"] is None

    def test_template_invalido_from_string_exception_retorna_ok_false(self):
        """Si from_string lanza excepción (sintaxis inválida) → ok=False."""
        env_mock = MagicMock()
        env_mock.from_string.side_effect = Exception("Tag '{% if' no cerrado")

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock):
            result = validate_template("{% if sin_cerrar")

        assert result["ok"] is False
        assert result["preview_pdf_b64"] is None

    def test_validate_template_con_company_none_no_falla(self):
        """validate_template con company=None debe ejecutarse sin error."""
        env_mock = self._mock_liquid_env()
        wp_mock = self._mock_weasyprint()

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_mock):
            result = validate_template("{{ quote_number }}", company=None)

        assert "ok" in result
        assert result["ok"] is True

    def test_validate_template_con_company_propaga_paleta(self):
        """validate_template pasa la paleta de la empresa al contexto de muestra."""
        company = _make_company(pdf_palette=[{"name": "primary", "hex": "#ABCDEF"}])
        context_capturado = {}

        tpl_mock = MagicMock()

        def capture_render(**ctx):
            context_capturado.update(ctx)
            return "<html></html>"

        tpl_mock.render.side_effect = capture_render
        env_mock = MagicMock()
        env_mock.from_string.return_value = tpl_mock
        wp_mock = self._mock_weasyprint()

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_mock):
            validate_template("{{ palette.primary }}", company=company)

        assert context_capturado.get("palette", {}).get("primary") == "#ABCDEF"


# ─────────────────────────────────────────────────────────────────────────────
# TestRenderClientQuotePdf — con libs mockeadas
# ─────────────────────────────────────────────────────────────────────────────

class TestRenderClientQuotePdf:
    """
    Verifica render_client_quote_pdf usando mocks de python-liquid y WeasyPrint.
    """

    def test_retorna_bytes_pdf(self):
        """render_client_quote_pdf debe retornar bytes que empiezan con '%PDF'."""
        from app.services.liquid_pdf import render_client_quote_pdf

        pdf_bytes = b"%PDF-1.4-FAKE-CONTENT"
        tpl_mock = MagicMock()
        tpl_mock.render.return_value = "<html><body>Test</body></html>"
        env_mock = MagicMock()
        env_mock.from_string.return_value = tpl_mock
        html_instance = MagicMock()
        html_instance.write_pdf.return_value = pdf_bytes
        wp_class = MagicMock(return_value=html_instance)

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_class):
            result = render_client_quote_pdf(
                "<p>{{ quote_number }}</p>",
                _make_client_quote(),
                None,
                4000.0,
            )

        assert isinstance(result, bytes)
        assert result == pdf_bytes

    def test_sin_liquid_lanza_runtime_error(self):
        """Sin python-liquid, render_client_quote_pdf lanza RuntimeError."""
        from app.services.liquid_pdf import render_client_quote_pdf

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", False):
            with pytest.raises(RuntimeError, match="python-liquid"):
                render_client_quote_pdf(
                    "<p>test</p>",
                    _make_client_quote(),
                    None,
                    4000.0,
                )

    def test_sin_weasyprint_lanza_runtime_error(self):
        """Sin weasyprint, render_client_quote_pdf lanza RuntimeError."""
        from app.services.liquid_pdf import render_client_quote_pdf

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", False):
            with pytest.raises(RuntimeError, match="weasyprint"):
                render_client_quote_pdf(
                    "<p>test</p>",
                    _make_client_quote(),
                    None,
                    4000.0,
                )

    def test_context_es_pasado_al_template(self):
        """El contexto construido por _build_cot_context se pasa al render de Liquid."""
        from app.services.liquid_pdf import render_client_quote_pdf

        context_capturado = {}

        tpl_mock = MagicMock()

        def capture_render(**ctx):
            context_capturado.update(ctx)
            return "<html></html>"

        tpl_mock.render.side_effect = capture_render
        env_mock = MagicMock()
        env_mock.from_string.return_value = tpl_mock

        html_instance = MagicMock()
        html_instance.write_pdf.return_value = b"%PDF-FAKE"
        wp_class = MagicMock(return_value=html_instance)

        cq = _make_client_quote(id=42)

        with patch("app.services.liquid_pdf._LIQUID_AVAILABLE", True), \
             patch("app.services.liquid_pdf._WEASYPRINT_AVAILABLE", True), \
             patch.object(_liquid_pdf_module, "LiquidEnvironment", create=True, return_value=env_mock), \
             patch.object(_liquid_pdf_module, "WeasyprintHTML", create=True, new=wp_class):
            render_client_quote_pdf("<p>{{ quote_number }}</p>", cq, None, 4000.0)

        assert context_capturado.get("quote_number") == "COT-0042"
