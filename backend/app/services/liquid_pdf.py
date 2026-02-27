"""
Servicio de renderizado de templates Liquid a PDF con WeasyPrint.

Permite a cada empresa personalizar el diseño del PDF de cotización COT-XXXX
usando plantillas HTML escritas en sintaxis Liquid (python-liquid).

Flujo:
    1. El template Liquid se renderiza con el contexto de la cotización.
    2. El HTML resultante se convierte a PDF con WeasyPrint.
    3. El PDF se retorna como bytes para enviarse como respuesta HTTP.

Variables disponibles en el contexto Liquid:
    quote_number   — Número formateado "COT-0001"
    quote_date     — Fecha de emisión "DD-MM-YYYY"
    expiry_date    — Fecha de vencimiento "DD-MM-YYYY"
    client_name    — Nombre del cliente
    description    — Descripción de la cotización (puede ser "")
    notes          — Notas adicionales (puede ser "")
    items          — Lista de ítems [{name, quantity, unit_price_fmt, line_total_fmt}]
    subtotal_fmt   — Subtotal formateado "$ 1.234.567"
    iva_str        — IVA formateado o "No Aplica"
    total_fmt      — Total formateado "$ 1.234.567"
    include_iva    — Boolean
    pdf_terms      — Texto de términos de pago (vacío si no configurado)
    company        — {name, slogan, address, phone, email, nit, logo_url}
    palette        — dict {nombre: hex} de la paleta de la empresa
                     Ej: {{ palette.primary }}, {{ palette.accent }}, {{ palette.mi_color }}
    colors         — lista [{name, hex}] de la paleta de la empresa
                     Ej: {% for c in colors %}{{ c.name }}: {{ c.hex }}{% endfor %}
"""

import base64
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

try:
    from liquid import Environment as LiquidEnvironment
    _LIQUID_AVAILABLE = True
except ImportError:
    _LIQUID_AVAILABLE = False

try:
    from weasyprint import HTML as WeasyprintHTML
    _WEASYPRINT_AVAILABLE = True
except ImportError:
    _WEASYPRINT_AVAILABLE = False

_STATIC_DIR = Path(__file__).parent.parent / "static"

# ── Paleta por defecto (se usa en el template ejemplo y en previews sin empresa) ─
_DEFAULT_PALETTE = [
    {"name": "primary",    "hex": "#1A1A1A"},
    {"name": "accent",     "hex": "#B67E3A"},
    {"name": "highlight",  "hex": "#A33221"},
    {"name": "table_text", "hex": "#D1A054"},
]

# ── Template por defecto ───────────────────────────────────────────────────────
DEFAULT_COT_TEMPLATE = """\
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  /*
   * Paleta de colores: usa {{ palette.nombre }} para referenciar cualquier color
   * definido en Compañía → Configuración.
   *
   * Colores canónicos de este template:
   *   {{ palette.primary }}    — fondo cabecera tabla e ítems resaltados
   *   {{ palette.accent }}     — líneas decorativas HR
   *   {{ palette.highlight }}  — fondo fila Total
   *   {{ palette.table_text }} — texto en cabecera tabla (sobre fondo oscuro)
   *
   * Puedes añadir tantos colores propios como necesites y usarlos aquí.
   */
  :root {
    --primary:    {{ palette.primary    | default: "#1A1A1A" }};
    --accent:     {{ palette.accent     | default: "#B67E3A" }};
    --highlight:  {{ palette.highlight  | default: "#A33221" }};
    --table-text: {{ palette.table_text | default: "#D1A054" }};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1A1A1A; padding: 40px; }

  /* Encabezado */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .header-logo img { height: 70px; width: auto; }
  .header-logo-placeholder { font-size: 20px; font-weight: bold; color: var(--primary); }
  .header-company { text-align: right; }
  .header-company .name { font-size: 16px; font-weight: bold; color: var(--primary); }
  .header-company .sub  { font-size: 9px; color: #666; margin-top: 2px; }
  .hr-accent { border: none; border-top: 2px solid var(--accent); margin: 10px 0; }

  /* Bloque cliente */
  .client-block { text-align: right; margin-bottom: 16px; }
  .client-block .label { font-size: 9px; color: #666; }
  .client-block .name  { font-size: 13px; font-weight: bold; color: var(--primary); }
  .client-block .desc  { font-size: 9px; color: #666; margin-top: 2px; }

  /* Título */
  .quote-title { font-size: 22px; font-weight: bold; color: var(--primary); margin-bottom: 12px; }

  /* Fechas */
  .dates { display: flex; gap: 40px; margin-bottom: 16px; }
  .dates .block .lbl { font-size: 8px; font-weight: bold; color: #666; text-transform: uppercase; }
  .dates .block .val { font-size: 11px; color: var(--primary); }

  /* Tabla de ítems */
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: var(--primary); }
  thead th { color: var(--table-text); font-size: 9px; font-weight: bold;
             padding: 8px; text-align: left; }
  thead th.right { text-align: right; }
  tbody tr:nth-child(even) { background: #FDF8F0; }
  tbody td { padding: 8px; font-size: 9px; color: #1A1A1A;
             border: 0.5px solid #E8E4DF; }
  tbody td.right { text-align: right; }

  /* Totales */
  .totals { margin-top: 0; }
  .totals table { width: 50%; margin-left: auto; }
  .totals td { padding: 5px 10px; border: 0.5px solid #E8E4DF; }
  .totals .lbl { text-align: right; font-size: 9px; }
  .totals .val { text-align: right; font-size: 9px; }
  .totals .total-row td { background: var(--highlight); color: #fff;
                          font-weight: bold; font-size: 12px; border-top: 1px solid var(--accent); }

  /* Pie */
  .footer { margin-top: 20px; }
  .footer .terms-title { font-size: 8px; font-weight: bold; color: #1A1A1A; margin-bottom: 4px; }
  .footer .terms-item  { font-size: 8px; color: #666; margin-bottom: 2px; }
  .footer .hr-thin { border: none; border-top: 0.5px solid var(--accent); margin: 10px 0 6px; }
  .footer .stamp { font-size: 8px; color: #999; }
</style>
</head>
<body>

<!-- ENCABEZADO -->
<div class="header">
  <div class="header-logo">
    {% if company.logo_url %}
      <img src="{{ company.logo_url }}" alt="Logo">
    {% else %}
      <div class="header-logo-placeholder">{{ company.name }}</div>
    {% endif %}
  </div>
  <div class="header-company">
    <div class="name">{{ company.name }}</div>
    {% if company.slogan %}<div class="sub">{{ company.slogan }}</div>{% endif %}
    <div class="sub">{{ company.address | default: "Medellín, Colombia" }}</div>
  </div>
</div>
<hr class="hr-accent">

<!-- CLIENTE -->
{% if client_name %}
<div class="client-block">
  <div class="label">Cliente:</div>
  <div class="name">{{ client_name | upcase }}</div>
  {% if description %}<div class="desc">{{ description }}</div>{% endif %}
</div>
{% endif %}

<!-- TÍTULO -->
<div class="quote-title">Número de cotización &nbsp; {{ quote_number }}</div>

<!-- FECHAS -->
<div class="dates">
  <div class="block">
    <div class="lbl">Fecha de cotización:</div>
    <div class="val">{{ quote_date }}</div>
  </div>
  <div class="block">
    <div class="lbl">Válida hasta:</div>
    <div class="val">{{ expiry_date }}</div>
  </div>
</div>

<!-- TABLA DE ÍTEMS -->
<table>
  <thead>
    <tr>
      <th>DESCRIPCIÓN</th>
      <th>CANTIDAD</th>
      <th class="right">PRECIO UNITARIO</th>
      <th class="right">IMPORTE</th>
    </tr>
  </thead>
  <tbody>
    {% for item in items %}
    <tr>
      <td>{{ item.name }}</td>
      <td>{{ item.quantity }}</td>
      <td class="right">{{ item.unit_price_fmt }}</td>
      <td class="right">{{ item.line_total_fmt }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>

<!-- TOTALES -->
<div class="totals">
  <table>
    <tr>
      <td class="lbl">Subtotal</td>
      <td class="val">{{ subtotal_fmt }}</td>
    </tr>
    <tr>
      <td class="lbl">IVA</td>
      <td class="val">{{ iva_str }}</td>
    </tr>
    <tr class="total-row">
      <td class="lbl">Total</td>
      <td class="val">{{ total_fmt }}</td>
    </tr>
  </table>
</div>

<!-- PIE -->
<div class="footer">
  <p style="font-size:8px;color:#666;margin-bottom:12px;">Precios sin IVA.</p>
  {% if notes %}<p style="font-size:8px;color:#666;margin-bottom:12px;">Notas: {{ notes }}</p>{% endif %}
  {% if pdf_terms %}
    <div class="terms-title">Términos de pago y envío:</div>
    <div class="terms-item">{{ pdf_terms }}</div>
  {% else %}
    <div class="terms-title">Términos de pago y envío:</div>
    <div class="terms-item">• Una vez aprobada la cotización, el cliente debe realizar el pago del 50% del monto total.</div>
    <div class="terms-item">• Antes de realizar el envío, el cliente debe cancelar el 50% restante.</div>
    <div class="terms-item">• No se despacha ningún pedido sin haber recibido el pago completo correspondiente.</div>
    <div class="terms-item">• Los gastos de envío corren por cuenta del cliente.</div>
  {% endif %}
  <hr class="hr-thin">
  <div class="stamp">
    Cotización generada el {{ generated_date }} · TurtleForge Cost · Medellín, Colombia
  </div>
</div>

</body>
</html>
"""

_REQUIRED_VARS = ["quote_number", "items", "total_fmt"]


def _fmt_cop(value: float) -> str:
    """Formatea como pesos colombianos: $ 1.234.567"""
    return "$ " + f"{round(value):,}".replace(",", ".")


def _build_palette(company) -> tuple:
    """
    Construye la paleta de colores desde la empresa.

    Lee pdf_palette (JSONB [{name, hex}]) y construye:
        palette — dict {name: hex} para {{ palette.nombre }} en Liquid
        colors  — lista [{name, hex}] para iterar con {% for c in colors %}

    Si la empresa no tiene paleta configurada, usa _DEFAULT_PALETTE.

    Args:
        company: Instancia ORM de Company (puede ser None).

    Returns:
        Tuple (palette_dict, colors_list).
    """
    raw_list = getattr(company, "pdf_palette", None) if company else None
    palette_list = raw_list if raw_list else _DEFAULT_PALETTE

    palette_dict = {
        entry["name"].lower(): entry["hex"]
        for entry in palette_list
        if isinstance(entry, dict) and entry.get("name") and entry.get("hex")
    }
    return palette_dict, palette_list


def _resolve_logo_url(company) -> str:
    """
    Resuelve la URL del logo de la empresa como ruta de archivo absoluta para WeasyPrint.

    Args:
        company: Instancia ORM de Company.

    Returns:
        URI de archivo o cadena vacía si no hay logo.
    """
    if not (company and company.logo_url):
        return ""
    candidate = Path("/app") / company.logo_url.lstrip("/")
    if candidate.exists():
        return candidate.as_uri()
    alt = _STATIC_DIR / company.logo_url.lstrip("/static/")
    if alt.exists():
        return alt.as_uri()
    return ""


def _build_cot_context(client_quote, company, usd_rate: float) -> dict:
    """
    Construye el contexto Liquid para una cotización de cliente.

    Args:
        client_quote: Instancia ORM de ClientQuote.
        company:      Instancia ORM de Company (puede ser None).
        usd_rate:     Tasa USD→COP.

    Returns:
        Diccionario con todas las variables disponibles en el template.
    """
    items_raw = json.loads(client_quote.items)
    items_ctx = []
    for item in items_raw:
        unit_p   = item["unit_price"] * usd_rate
        line_tot = item["quantity"] * unit_p
        items_ctx.append({
            "name":           item["name"],
            "quantity":       int(item["quantity"]) if item["quantity"] == int(item["quantity"]) else item["quantity"],
            "unit_price_fmt": _fmt_cop(unit_p),
            "line_total_fmt": _fmt_cop(line_tot),
        })

    subtotal_val = float(client_quote.subtotal) * usd_rate
    include_iva  = bool(getattr(client_quote, "include_iva", False))
    iva_percent  = float(getattr(client_quote, "iva_percent", Decimal("19.00")))

    if include_iva:
        iva_amount = subtotal_val * iva_percent / 100
        iva_str    = _fmt_cop(iva_amount)
        total_val  = subtotal_val + iva_amount
    else:
        iva_str   = "No Aplica"
        total_val = subtotal_val

    palette_dict, colors_list = _build_palette(company)

    company_ctx = {
        "name":    company.name          if company else "TurtleForge Studio",
        "slogan":  company.slogan        if company else "",
        "address": company.address       if company else "Medellín, Colombia",
        "phone":   company.phone         if company else "",
        "email":   company.contact_email if company else "",
        "nit":     company.nit           if company else "",
        "logo_url": _resolve_logo_url(company),
    }
    pdf_terms = (company.pdf_terms if company else None) or ""

    return {
        "quote_number":   f"COT-{client_quote.id:04d}",
        "quote_date":     client_quote.quote_date.strftime("%d-%m-%Y"),
        "expiry_date":    client_quote.expiry_date.strftime("%d-%m-%Y"),
        "generated_date": datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        "client_name":    client_quote.client_name or "",
        "description":    client_quote.description or "",
        "notes":          client_quote.notes or "",
        "items":          items_ctx,
        "subtotal_fmt":   _fmt_cop(subtotal_val),
        "iva_str":        iva_str,
        "total_fmt":      _fmt_cop(total_val),
        "include_iva":    include_iva,
        "pdf_terms":      pdf_terms,
        "company":        company_ctx,
        "palette":        palette_dict,
        "colors":         colors_list,
    }


def _build_sample_context(company=None) -> dict:
    """
    Construye un contexto de muestra para validación y preview de templates.

    Incluye datos ficticios representativos con la paleta real de la empresa
    (o la paleta por defecto si no hay empresa).

    Args:
        company: Instancia ORM de Company (opcional).

    Returns:
        Contexto con datos ficticios y paleta real/default.
    """
    palette_dict, colors_list = _build_palette(company)

    company_ctx = {
        "name":    company.name          if company else "TurtleForge Studio",
        "slogan":  company.slogan        if company else "Impresión 3D de calidad",
        "address": company.address       if company else "Medellín, Colombia",
        "phone":   company.phone         if company else "+57 300 000 0000",
        "email":   company.contact_email if company else "hola@empresa.com",
        "nit":     company.nit           if company else "900.000.000-0",
        "logo_url": _resolve_logo_url(company),
    }
    pdf_terms = (company.pdf_terms if company else None) or ""

    return {
        "quote_number":   "COT-0001",
        "quote_date":     "27-02-2026",
        "expiry_date":    "29-03-2026",
        "generated_date": datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        "client_name":    "Cliente de Ejemplo",
        "description":    "Pedido de muestra para validar el template",
        "notes":          "",
        "items": [
            {"name": "Figura impresa en PLA",  "quantity": 2, "unit_price_fmt": "$ 25.000", "line_total_fmt": "$ 50.000"},
            {"name": "Carcasa personalizada",  "quantity": 1, "unit_price_fmt": "$ 80.000", "line_total_fmt": "$ 80.000"},
            {"name": "Soporte magnético",      "quantity": 3, "unit_price_fmt": "$ 15.000", "line_total_fmt": "$ 45.000"},
        ],
        "subtotal_fmt": "$ 175.000",
        "iva_str":      "No Aplica",
        "total_fmt":    "$ 175.000",
        "include_iva":  False,
        "pdf_terms":    pdf_terms,
        "company":      company_ctx,
        "palette":      palette_dict,
        "colors":       colors_list,
    }


def _check_required_vars(content: str) -> list:
    """
    Advierte si faltan variables clave en el template.

    Args:
        content: Código fuente del template Liquid.

    Returns:
        Lista de mensajes de advertencia.
    """
    return [
        f"Variable recomendada ausente: {{{{ {v} }}}}"
        for v in _REQUIRED_VARS
        if v not in content
    ]


def render_client_quote_pdf(template_content: str, client_quote, company, usd_rate: float) -> bytes:
    """
    Renderiza un template Liquid y genera el PDF de una cotización de cliente.

    Args:
        template_content: Código Liquid HTML del template.
        client_quote:     Instancia ORM de ClientQuote.
        company:          Instancia ORM de Company (puede ser None).
        usd_rate:         Tasa USD→COP.

    Returns:
        bytes: PDF generado por WeasyPrint.

    Raises:
        RuntimeError: Si python-liquid o WeasyPrint no están instalados.
    """
    if not _LIQUID_AVAILABLE:
        raise RuntimeError("python-liquid no está instalado")
    if not _WEASYPRINT_AVAILABLE:
        raise RuntimeError("weasyprint no está instalado")

    env = LiquidEnvironment()
    tpl = env.from_string(template_content)
    ctx = _build_cot_context(client_quote, company, usd_rate)
    html = tpl.render(**ctx)
    base_url = f"file://{_STATIC_DIR}/"
    return WeasyprintHTML(string=html, base_url=base_url).write_pdf()


def validate_template(content: str, company=None) -> dict:
    """
    Valida un template Liquid: comprueba sintaxis y capacidad de renderizar a PDF.

    Genera un PDF de muestra con datos ficticios (incluyendo la paleta real de
    la empresa si está disponible) y lo retorna como base64 para preview inmediato
    sin necesidad de guardar el template.

    Args:
        content: Código Liquid HTML a validar.
        company: Instancia ORM de Company (opcional, para contexto y paleta reales).

    Returns:
        dict con las claves:
            ok              — bool, True si no hay errores.
            errors          — lista de strings con errores detectados.
            warnings        — lista de strings con advertencias.
            preview_pdf_b64 — string base64 del PDF o None si hay errores.
    """
    if not _LIQUID_AVAILABLE:
        return {"ok": False, "errors": ["python-liquid no está instalado en el servidor"], "warnings": [], "preview_pdf_b64": None}
    if not _WEASYPRINT_AVAILABLE:
        return {"ok": False, "errors": ["weasyprint no está instalado en el servidor"], "warnings": [], "preview_pdf_b64": None}

    try:
        env = LiquidEnvironment()
        tpl = env.from_string(content)
        ctx = _build_sample_context(company)
        html = tpl.render(**ctx)
        base_url = f"file://{_STATIC_DIR}/"
        pdf_bytes = WeasyprintHTML(string=html, base_url=base_url).write_pdf()
        warnings = _check_required_vars(content)
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        return {"ok": True, "errors": [], "warnings": warnings, "preview_pdf_b64": pdf_b64}
    except Exception as exc:
        return {"ok": False, "errors": [str(exc)], "warnings": [], "preview_pdf_b64": None}
