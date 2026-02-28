"""
Servicio de generación de PDFs de cotización para TurtleForge Cost.

Genera documentos PDF con diseño de marca The Collector's Forge: tipografía
Trajan Pro, paleta Carbón / Hierro / Bronce / Rojo Forja / Dorado, encabezado
con logo y línea decorativa bronce, tabla de ítems con cabecera oscura y fila
de total en rojo forja.

Soporta dos tipos de cotización:
    - TFC-XXXX: cotizaciones de costo de impresión (generate_quote_pdf).
    - COT-XXXX: cotizaciones de cliente multi-producto (generate_client_quote_pdf),
                con soporte opcional de IVA (include_iva / iva_percent).

El documento se genera en memoria usando un buffer BytesIO.
"""

import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from app.models.company import Company
from app.models.quote import Quote
from app.models.client_quote import ClientQuote

# ── Rutas de recursos estáticos ───────────────────────────────────────────────
LOGO_PATH  = Path(__file__).parent.parent / "static" / "logo.png"
_FONTS_DIR = Path(__file__).parent.parent / "static" / "fonts"

# ── Registro de fuentes Trajan Pro ────────────────────────────────────────────
# Fallback a Helvetica si los archivos no están disponibles.
_FONT_REGULAR = "Helvetica"
_FONT_BOLD    = "Helvetica-Bold"

try:
    pdfmetrics.registerFont(TTFont("Trajan", str(_FONTS_DIR / "TrajanPro-Regular.ttf")))
    _FONT_REGULAR = "Trajan"
except Exception:
    pass

try:
    pdfmetrics.registerFont(TTFont("Trajan-Bold", str(_FONTS_DIR / "TrajanPro-Bold.otf")))
    _FONT_BOLD = "Trajan-Bold"
except Exception:
    pass

# ── Paleta de marca The Collector's Forge (defaults) ──────────────────────────
_CARBON    = colors.HexColor("#1A1A1A")   # Negro Carbón     — fondo oscuro, texto principal
_IRON      = colors.HexColor("#3C3C3C")   # Hierro Oscuro    — texto secundario
_BRONZE    = colors.HexColor("#B67E3A")   # Bronce Envejecido — líneas decorativas, acentos
_FORGE_RED = colors.HexColor("#A33221")   # Rojo Forja       — fila total
_GOLD      = colors.HexColor("#D1A054")   # Dorado Tenue     — texto en cabecera tabla
_CREAM     = colors.HexColor("#FDF8F0")   # Crema            — fondo alterno de filas
_SEPARATOR = colors.HexColor("#E8E4DF")   # Separador suave  — bordes de tabla
_WHITE     = colors.white

# Términos de pago por defecto (usados si company.pdf_terms está vacío)
_DEFAULT_TERMS = [
    "• Una vez aprobada la cotización, el cliente debe realizar el pago del 50% del monto total.",
    "• Antes de realizar el envío, el cliente debe cancelar el 50% restante.",
    "• No se despacha ningún pedido sin haber recibido el pago completo correspondiente.",
    "• Los gastos de envío corren por cuenta del cliente.",
]


def _palette_dict(company: Optional["Company"]) -> dict:
    """
    Convierte la lista pdf_palette de la empresa en un dict {name: hex}.

    Usa nombres canónicos para mapear los 4 roles fijos de la paleta ReportLab:
        primary    → fondo cabecera tabla (_CARBON)
        accent     → líneas decorativas  (_BRONZE)
        highlight  → fila Total          (_FORGE_RED)
        table_text → texto cabecera      (_GOLD)

    Los colores extra definidos por la empresa se incluyen igualmente en el dict
    pero no afectan a ReportLab (solo están disponibles en templates Liquid).

    Args:
        company: Instancia ORM de Company (puede ser None).

    Returns:
        dict {name_lower: hex_string}.
    """
    palette_list = getattr(company, "pdf_palette", None) or []
    return {
        entry["name"].lower(): entry["hex"]
        for entry in palette_list
        if isinstance(entry, dict) and entry.get("name") and entry.get("hex")
    }


def _resolve_colors(company: Optional["Company"]) -> dict:
    """
    Resuelve los colores de marca desde la paleta dinámica de la empresa.

    Lee pdf_palette (JSONB [{name, hex}]) y mapea los nombres canónicos:
        primary → _CARBON, accent → _BRONZE, highlight → _FORGE_RED,
        table_text → _GOLD.
    Si faltan, usa los defaults de la paleta de marca.

    Args:
        company: Instancia ORM de Company (puede ser None).

    Returns:
        dict con claves _CARBON, _BRONZE, _FORGE_RED, _GOLD (ReportLab colors).
    """
    p = _palette_dict(company)
    return {
        "_CARBON":    colors.HexColor(p.get("primary",    "#1A1A1A")),
        "_BRONZE":    colors.HexColor(p.get("accent",     "#B67E3A")),
        "_FORGE_RED": colors.HexColor(p.get("highlight",  "#A33221")),
        "_GOLD":      colors.HexColor(p.get("table_text", "#D1A054")),
        # Colores fijos no personalizables por la empresa
        "_IRON":  _IRON,
        "_CREAM": _CREAM,
        "_WHITE": _WHITE,
    }

# Padding nulo para tablas de layout sin sangría
_NO_PAD = [
    ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING",   (0, 0), (-1, -1), 0),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ("TOPPADDING",    (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
]


from app.services.formatters import _fmt_cop  # centralizado en formatters.py


def _fmt_usd(value: float) -> str:
    """Formatea como dólares: $ 1,234.56"""
    return f"$ {value:,.2f}"


def _make_doc(buffer: io.BytesIO) -> SimpleDocTemplate:
    """Crea el documento PDF con márgenes estándar TurtleForge."""
    return SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.6 * inch, bottomMargin=0.75 * inch,
        leftMargin=1.0 * inch, rightMargin=1.0 * inch,
    )


def _make_styles(suffix: str = "", c: Optional[dict] = None) -> dict:
    """
    Crea los estilos tipográficos con la paleta de marca The Collector's Forge.

    Args:
        suffix: Sufijo para evitar conflictos de nombre entre documentos.
        c:      dict de colores resueltos (_resolve_colors). Si None usa defaults.

    Returns:
        dict con los estilos indexados por clave corta.
    """
    if c is None:
        c = {"_CARBON": _CARBON, "_BRONZE": _BRONZE, "_FORGE_RED": _FORGE_RED, "_GOLD": _GOLD}

    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name + suffix, parent=base["Normal"], **kw)

    return {
        "base":   base,
        # Encabezado empresa
        "sCo":    ps("Co",    fontSize=14, fontName=_FONT_BOLD,        textColor=c["_CARBON"], alignment=2),
        "sCoS":   ps("CoS",   fontSize=9,  fontName="Helvetica",       textColor=_IRON,        alignment=2),
        # Bloque cliente
        "sCl":    ps("Cl",    fontSize=11, fontName=_FONT_BOLD,        textColor=c["_CARBON"], alignment=2),
        "sClS":   ps("ClS",   fontSize=9,  fontName="Helvetica",       textColor=_IRON,        alignment=2),
        # Título cotización
        "sTit":   ps("Tit",   fontSize=20, fontName=_FONT_BOLD,        textColor=c["_CARBON"]),
        # Bloque fechas
        "sILab":  ps("ILab",  fontSize=8,  fontName="Helvetica-Bold",  textColor=_IRON),
        "sIVal":  ps("IVal",  fontSize=10, fontName="Helvetica",       textColor=c["_CARBON"]),
        # Cabecera tabla ítems (texto dorado sobre fondo carbón)
        "sTH":    ps("TH",    fontSize=9,  fontName=_FONT_BOLD,        textColor=c["_GOLD"]),
        "sTHR":   ps("THR",   fontSize=9,  fontName=_FONT_BOLD,        textColor=c["_GOLD"],   alignment=2),
        # Celdas de datos
        "sTC":    ps("TC",    fontSize=9,  fontName="Helvetica",       textColor=c["_CARBON"]),
        "sTCR":   ps("TCR",   fontSize=9,  fontName="Helvetica",       textColor=c["_CARBON"], alignment=2),
        # Totales — fila subtotal
        "sTotL":  ps("TotL",  fontSize=9,  fontName="Helvetica",       textColor=_CARBON,    alignment=2),
        "sTotV":  ps("TotV",  fontSize=9,  fontName="Helvetica",       textColor=_CARBON,    alignment=2),
        # Totales — fila IVA
        "sIvaL":  ps("IvaL",  fontSize=9,  fontName="Helvetica",       textColor=_IRON,      alignment=2),
        "sIvaV":  ps("IvaV",  fontSize=9,  fontName="Helvetica",       textColor=_IRON,      alignment=2),
        # Totales — fila Total (fondo rojo forja, texto blanco)
        "sTBL":   ps("TBL",   fontSize=11, fontName=_FONT_BOLD,        textColor=_WHITE,     alignment=2),
        "sTBV":   ps("TBV",   fontSize=11, fontName=_FONT_BOLD,        textColor=_WHITE,     alignment=2),
        # Notas y pie de página
        "sNote":  ps("Note",  fontSize=8,  fontName="Helvetica",       textColor=_IRON),
        "sNoteR": ps("NoteR", fontSize=8,  fontName="Helvetica",       textColor=_IRON,      alignment=2),
        "sTermT": ps("TermT", fontSize=8,  fontName="Helvetica-Bold",  textColor=_CARBON),
        "sTermI": ps("TermI", fontSize=8,  fontName="Helvetica",       textColor=_IRON),
    }


def _build_header(st: dict, company: Optional["Company"] = None) -> list:
    """
    Construye el encabezado del PDF: logo (izq.) + empresa (der.) + línea bronce.

    Args:
        st:      Diccionario de estilos generado por _make_styles().
        company: Instancia ORM de Company (opcional).

    Returns:
        Lista de elementos ReportLab (tabla + separador + spacer).
    """
    logo_path: Optional[Path] = None
    if company and company.logo_url:
        candidate = Path("/app") / company.logo_url.lstrip("/")
        if candidate.exists():
            logo_path = candidate
    if logo_path is None and LOGO_PATH.exists():
        logo_path = LOGO_PATH

    # Dimensiones respetando aspect ratio del PNG (344×386 ≈ 0.891 ancho/alto)
    _LOGO_H = 1.2 * inch
    _LOGO_W = _LOGO_H * (344 / 386)
    logo_cell = (
        Image(str(logo_path), width=_LOGO_W, height=_LOGO_H)
        if logo_path
        else Paragraph("<b>TurtleForge</b>", st["base"]["Normal"])
    )

    company_name = (company.name if company and company.name else "TurtleForge Studio")
    company_addr = (company.address if company and company.address else "Medellín, Colombia")

    company_cell: list = [Paragraph(company_name, st["sCo"]), Spacer(1, 4)]
    if company and company.slogan:
        company_cell += [Paragraph(company.slogan, st["sCoS"]), Spacer(1, 2)]
    company_cell.append(Paragraph(company_addr, st["sCoS"]))

    hdr_tbl = Table(
        [[logo_cell, "", company_cell]],
        colWidths=[_LOGO_W + 0.1 * inch, 2.5 * inch, 2.4 * inch],
    )
    hdr_tbl.setStyle(TableStyle(_NO_PAD))
    bronze = _resolve_colors(company)["_BRONZE"]
    return [
        hdr_tbl,
        Spacer(1, 10),
        HRFlowable(width="100%", thickness=1.5, color=bronze, spaceAfter=10),
    ]


def _build_client_block(name: str, description: Optional[str], st: dict) -> list:
    """
    Construye el bloque de cliente alineado a la derecha.

    Args:
        name:        Nombre del cliente.
        description: Descripción opcional.
        st:          Diccionario de estilos.

    Returns:
        Lista de elementos ReportLab (tabla + spacer).
    """
    client_cell: list = [
        Paragraph("Cliente:", st["sClS"]),
        Paragraph(name.upper(), st["sCl"]),
    ]
    if description:
        client_cell += [Spacer(1, 3), Paragraph(description, st["sClS"])]
    client_tbl = Table(
        [["", client_cell]],
        colWidths=[3.3 * inch, 3.2 * inch],
    )
    client_tbl.setStyle(TableStyle(_NO_PAD))
    return [client_tbl, Spacer(1, 18)]


def _build_totals(
    L: float, R1: float, R2: float,
    subtotal_str: str, st: dict,
    iva_str: str = "No Aplica",
    total_str: Optional[str] = None,
    c: Optional[dict] = None,
) -> Table:
    """
    Construye la tabla de totales (Subtotal / IVA / Total).

    Args:
        L:            Ancho de la celda vacía izquierda.
        R1:           Ancho de la columna de etiquetas.
        R2:           Ancho de la columna de valores.
        subtotal_str: Valor formateado del subtotal.
        st:           Diccionario de estilos.
        iva_str:      Texto del IVA: "No Aplica" o valor formateado.
        total_str:    Valor formateado del total. Si None, usa subtotal_str.
        c:            dict de colores resueltos (_resolve_colors). Si None usa defaults.

    Returns:
        Tabla de totales ReportLab.
    """
    if total_str is None:
        total_str = subtotal_str
    if c is None:
        c = {"_BRONZE": _BRONZE, "_FORGE_RED": _FORGE_RED}

    tot_tbl = Table(
        [
            ["", Paragraph("Subtotal",  st["sTotL"]), Paragraph(subtotal_str, st["sTotV"])],
            ["", Paragraph("IVA",       st["sIvaL"]), Paragraph(iva_str,      st["sIvaV"])],
            ["", Paragraph("Total",     st["sTBL"]),  Paragraph(total_str,    st["sTBV"])],
        ],
        colWidths=[L, R1, R2],
    )
    tot_tbl.setStyle(TableStyle([
        ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (1, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (1, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (0, -1),  0),
        ("RIGHTPADDING",  (0, 0), (0, -1),  0),
        ("GRID",          (1, 0), (-1, 1), 0.5, _SEPARATOR),
        ("LINEABOVE",     (1, 2), (-1, 2), 1.0, c["_BRONZE"]),
        ("BOX",           (1, 2), (-1, 2), 0.5, _SEPARATOR),
        ("BACKGROUND",    (1, 2), (-1, 2), c["_FORGE_RED"]),
    ]))
    return tot_tbl


def _build_footer(notes: Optional[str], st: dict, company: Optional["Company"] = None, c: Optional[dict] = None) -> list:
    """
    Construye el pie de página: notas, términos de pago y sello de fecha.

    Args:
        notes:   Notas adicionales opcionales.
        st:      Diccionario de estilos.
        company: Instancia ORM de Company para leer pdf_terms (opcional).
        c:       dict de colores resueltos (_resolve_colors). Si None usa defaults.

    Returns:
        Lista de elementos ReportLab.
    """
    if c is None:
        c = {"_BRONZE": _BRONZE}

    elems: list = [Paragraph("Precios sin IVA.", st["sNote"])]
    if notes:
        elems += [Spacer(1, 6), Paragraph(f"Notas: {notes}", st["sNote"])]
    elems.append(Spacer(1, 14))

    pdf_terms = getattr(company, "pdf_terms", None) if company else None
    elems.append(Paragraph("Términos de pago y envío:", st["sTermT"]))
    elems.append(Spacer(1, 4))

    if pdf_terms:
        # Términos personalizados: separar por salto de línea
        for line in pdf_terms.splitlines():
            line = line.strip()
            if line:
                elems.append(Paragraph(line, st["sTermI"]))
    else:
        for term in _DEFAULT_TERMS:
            elems.append(Paragraph(term, st["sTermI"]))

    elems += [
        Spacer(1, 12),
        HRFlowable(width="100%", thickness=0.5, color=c["_BRONZE"], spaceAfter=6),
        Paragraph(
            f"Cotización generada el {datetime.now(timezone.utc).strftime('%d-%m-%Y')}"
            f" · TurtleForge Cost · Medellín, Colombia",
            st["sNote"],
        ),
    ]
    return elems


def generate_quote_pdf(quote: Quote, company: Optional["Company"] = None) -> bytes:
    """
    Genera el PDF de una cotización TFC-XXXX con diseño de marca The Collector's Forge.

    El documento incluye: encabezado con logo y línea bronce, bloque de cliente
    (si aplica), número TFC-XXXX en Trajan Pro, fechas de emisión y vencimiento,
    tabla de ítems con cabecera dorada sobre carbón, y sección de totales con
    IVA "No Aplica" en fila rojo forja.

    Args:
        quote:   Instancia ORM de Quote con todos los costos calculados.
        company: Instancia ORM de Company (opcional, para logo y datos de empresa).

    Returns:
        bytes: Contenido binario del PDF listo para enviarse como respuesta HTTP
            con Content-Type 'application/pdf'.
    """
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    c = _resolve_colors(company)
    st = _make_styles("", c)
    elements: list = []

    # ── 1. HEADER ─────────────────────────────────────────────────────────────
    elements += _build_header(st, company)

    # ── 2. BLOQUE CLIENTE (opcional) ──────────────────────────────────────────
    if quote.client_name:
        elements += _build_client_block(quote.client_name, quote.description, st)

    # ── 3. TÍTULO ─────────────────────────────────────────────────────────────
    elements.append(Paragraph(f"Número de cotización  TFC-{quote.id:04d}", st["sTit"]))
    elements.append(Spacer(1, 14))

    # ── 4. FILA DE FECHAS ─────────────────────────────────────────────────────
    fecha_str = quote.created_at.strftime("%d-%m-%Y")
    venc_str  = (quote.created_at + timedelta(days=30)).strftime("%d-%m-%Y")
    info_tbl = Table(
        [[
            [Paragraph("Fecha de cotización:", st["sILab"]), Paragraph(fecha_str, st["sIVal"])],
            [Paragraph("Vencimiento:", st["sILab"]),         Paragraph(venc_str,  st["sIVal"])],
        ]],
        colWidths=[3.25 * inch, 3.25 * inch],
    )
    info_tbl.setStyle(TableStyle(_NO_PAD + [("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 16))

    # ── 5. TABLA DE ÍTEMS ─────────────────────────────────────────────────────
    use_cop = quote.total_price_cop is not None
    fmt     = _fmt_cop if use_cop else _fmt_usd
    u_price = (quote.total_per_unit_cop or quote.total_per_unit) if use_cop else quote.total_per_unit
    t_price = quote.total_price_cop if use_cop else quote.total_price

    qty_lbl = f"{quote.quantity} {'Unidad' if quote.quantity == 1 else 'Unidades'}"
    cols = [2.9 * inch, 1.1 * inch, 1.3 * inch, 1.2 * inch]

    items_tbl = Table(
        [
            [
                Paragraph("DESCRIPCIÓN",     st["sTH"]),
                Paragraph("CANTIDAD",         st["sTH"]),
                Paragraph("PRECIO UNITARIO",  st["sTH"]),
                Paragraph("IMPORTE",          st["sTHR"]),
            ],
            [
                Paragraph(quote.piece_name, st["sTC"]),
                Paragraph(qty_lbl,          st["sTC"]),
                Paragraph(fmt(u_price),     st["sTC"]),
                Paragraph(fmt(t_price),     st["sTCR"]),
            ],
        ],
        colWidths=cols,
    )
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), c["_CARBON"]),
        ("ALIGN",         (2, 0), (-1, -1), "RIGHT"),
        ("BACKGROUND",    (0, 1), (-1, 1), _CREAM),
        ("GRID",          (0, 0), (-1, -1), 0.5, _SEPARATOR),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    elements.append(items_tbl)
    elements.append(Spacer(1, 2))

    # ── 6. TOTALES ────────────────────────────────────────────────────────────
    L  = cols[0] + cols[1]
    R1 = cols[2]
    R2 = cols[3]
    elements.append(_build_totals(L, R1, R2, fmt(t_price), st, "No Aplica", fmt(t_price), c))
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements += _build_footer(quote.notes, st, company, c)

    doc.build(elements)
    return buffer.getvalue()


def generate_client_quote_pdf(
    client_quote: ClientQuote,
    company: Optional["Company"] = None,
    usd_rate: float = 1.0,
) -> bytes:
    """
    Genera el PDF de una cotización de cliente multi-producto COT-XXXX.

    Soporta IVA opcional: si client_quote.include_iva es True, calcula el
    importe de IVA usando client_quote.iva_percent y lo muestra en la fila IVA;
    de lo contrario muestra "No Aplica".

    Args:
        client_quote: Instancia ORM de ClientQuote con los datos de la cotización.
        company:      Instancia ORM de Company (opcional, para logo y empresa).
        usd_rate:     Tasa USD→COP para convertir precios de ítems.

    Returns:
        bytes: Contenido binario del PDF listo para enviarse como respuesta HTTP.
    """
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    c = _resolve_colors(company)
    st = _make_styles("_cq", c)
    elements: list = []

    # ── 1. HEADER ─────────────────────────────────────────────────────────────
    elements += _build_header(st, company)

    # ── 2. BLOQUE CLIENTE ─────────────────────────────────────────────────────
    elements += _build_client_block(client_quote.client_name, client_quote.description, st)

    # ── 3. TÍTULO ─────────────────────────────────────────────────────────────
    elements.append(Paragraph(f"Número de cotización  COT-{client_quote.id:04d}", st["sTit"]))
    elements.append(Spacer(1, 14))

    # ── 4. FILA DE FECHAS ─────────────────────────────────────────────────────
    fecha_str = client_quote.quote_date.strftime("%d-%m-%Y")
    venc_str  = client_quote.expiry_date.strftime("%d-%m-%Y")
    info_tbl = Table(
        [[
            [Paragraph("Fecha de cotización:", st["sILab"]), Paragraph(fecha_str, st["sIVal"])],
            [Paragraph("Válida hasta:", st["sILab"]),        Paragraph(venc_str,  st["sIVal"])],
        ]],
        colWidths=[3.25 * inch, 3.25 * inch],
    )
    info_tbl.setStyle(TableStyle(_NO_PAD + [("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 16))

    # ── 5. TABLA DE ÍTEMS ─────────────────────────────────────────────────────
    items = client_quote.items
    cols = [2.6 * inch, 1.1 * inch, 1.3 * inch, 1.5 * inch]

    rows = [
        [
            Paragraph("DESCRIPCIÓN",     st["sTH"]),
            Paragraph("CANTIDAD",        st["sTH"]),
            Paragraph("PRECIO UNITARIO", st["sTH"]),
            Paragraph("IMPORTE",         st["sTHR"]),
        ]
    ]
    for item in items:
        qty      = item["quantity"]
        unit_p   = item["unit_price"] * usd_rate
        line_tot = qty * unit_p
        rows.append([
            Paragraph(item["name"],       st["sTC"]),
            Paragraph(str(qty),           st["sTC"]),
            Paragraph(_fmt_cop(unit_p),   st["sTC"]),
            Paragraph(_fmt_cop(line_tot), st["sTCR"]),
        ])

    items_tbl = Table(rows, colWidths=cols)
    style_cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), c["_CARBON"]),
        ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ("GRID",          (0, 0), (-1, -1), 0.5, _SEPARATOR),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]
    for idx in range(len(items)):
        if idx % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, idx + 1), (-1, idx + 1), _CREAM))
    items_tbl.setStyle(TableStyle(style_cmds))
    elements.append(items_tbl)
    elements.append(Spacer(1, 2))

    # ── 6. TOTALES con IVA opcional ───────────────────────────────────────────
    L  = cols[0] + cols[1]
    R1 = cols[2]
    R2 = cols[3]
    subtotal_val = float(client_quote.subtotal) * usd_rate
    include_iva  = bool(getattr(client_quote, "include_iva", False))
    iva_percent  = float(getattr(client_quote, "iva_percent", Decimal("19.00")))

    if include_iva:
        iva_amount = subtotal_val * iva_percent / 100
        iva_str    = _fmt_cop(iva_amount)
        total_val  = subtotal_val + iva_amount
        total_str  = _fmt_cop(total_val)
    else:
        iva_str   = "No Aplica"
        total_str = _fmt_cop(subtotal_val)

    elements.append(_build_totals(L, R1, R2, _fmt_cop(subtotal_val), st, iva_str, total_str, c))
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements += _build_footer(client_quote.notes, st, company, c)

    doc.build(elements)
    return buffer.getvalue()
