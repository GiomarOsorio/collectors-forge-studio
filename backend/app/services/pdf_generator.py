"""
Servicio de generación de PDFs de cotización para TurtleForge Cost.

Genera un documento PDF orientado al cliente con formato profesional:
encabezado con logo, bloque de cliente, número de cotización, fechas de
emisión y vencimiento (30 días), tabla de ítems con precio unitario e
importe en COP (o USD como respaldo) y sección de totales.

El documento se genera en memoria usando un buffer BytesIO.
"""

import io
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
)

from typing import Optional

from app.models.quote import Quote
from app.models.client_quote import ClientQuote

# Logo: backend/app/static/logo.png (1536×1024 px, aspect 1.5)
LOGO_PATH = Path(__file__).parent.parent / "static" / "logo.png"

# ── Paleta de colores ─────────────────────────────────────────────────────────
_DARK    = colors.HexColor("#1f2937")   # texto / fondo header de tabla
_GRAY    = colors.HexColor("#6b7280")   # texto secundario
_BORDER  = colors.HexColor("#d1d5db")   # bordes
_ROW_ALT = colors.HexColor("#f9fafb")   # fondo fila de ítem
_GRN_BG  = colors.HexColor("#f0fdf4")   # fondo fila Total
_GRN_TXT = colors.HexColor("#166534")   # texto fila Total

# Comandos de estilo comunes para tablas sin padding exterior
_NO_PAD = [
    ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING",   (0, 0), (-1, -1), 0),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ("TOPPADDING",    (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
]


def _fmt_cop(value: float) -> str:
    """Formatea como pesos colombianos: $ 1.234.567"""
    return "$ " + f"{round(value):,}".replace(",", ".")


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


def _make_styles(suffix: str = "") -> dict:
    """
    Crea los estilos tipográficos comunes para los PDFs.

    Args:
        suffix: Sufijo para evitar conflictos de nombre entre documentos.

    Returns:
        dict con los estilos indexados por clave corta.
    """
    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name + suffix, parent=base["Normal"], **kw)

    return {
        "base":   base,
        "sCo":    ps("Co",    fontSize=13, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2),
        "sCoS":   ps("CoS",   fontSize=10, fontName="Helvetica",      textColor=_GRAY,    alignment=2),
        "sCl":    ps("Cl",    fontSize=11, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2),
        "sClS":   ps("ClS",   fontSize=9,  fontName="Helvetica",      textColor=_GRAY,    alignment=2),
        "sTit":   ps("Tit",   fontSize=22, fontName="Helvetica-Bold", textColor=_DARK),
        "sILab":  ps("ILab",  fontSize=9,  fontName="Helvetica-Bold", textColor=_GRAY),
        "sIVal":  ps("IVal",  fontSize=10, fontName="Helvetica",      textColor=_DARK),
        "sTH":    ps("TH",    fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white),
        "sTHR":   ps("THR",   fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white,   alignment=2),
        "sTC":    ps("TC",    fontSize=10, fontName="Helvetica",      textColor=_DARK),
        "sTCR":   ps("TCR",   fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2),
        "sTotL":  ps("TotL",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2),
        "sTotV":  ps("TotV",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2),
        "sTBL":   ps("TBL",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2),
        "sTBV":   ps("TBV",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2),
        "sNote":  ps("Note",  fontSize=8,  fontName="Helvetica",      textColor=_GRAY),
        "sNoteR": ps("NoteR", fontSize=8,  fontName="Helvetica",      textColor=_GRAY,    alignment=2),
        "sTermT": ps("TermT", fontSize=8,  fontName="Helvetica-Bold", textColor=_DARK),
        "sTermI": ps("TermI", fontSize=8,  fontName="Helvetica",      textColor=_GRAY),
    }


def _build_header(st: dict) -> list:
    """
    Construye el encabezado del PDF: logo (izq.) + empresa (der.).

    Args:
        st: Diccionario de estilos generado por _make_styles().

    Returns:
        Lista de elementos ReportLab (tabla + spacer).
    """
    logo_cell = (
        Image(str(LOGO_PATH), width=1.8 * inch, height=1.2 * inch)
        if LOGO_PATH.exists()
        else Paragraph("<b>TurtleForge</b>", st["base"]["Normal"])
    )
    company_cell = [
        Paragraph("TurtleForge Studio", st["sCo"]),
        Spacer(1, 4),
        Paragraph("Medellín, Colombia", st["sCoS"]),
    ]
    hdr_tbl = Table(
        [[logo_cell, "", company_cell]],
        colWidths=[1.9 * inch, 2.2 * inch, 2.4 * inch],
    )
    hdr_tbl.setStyle(TableStyle(_NO_PAD))
    return [hdr_tbl, Spacer(1, 20)]


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


def _build_totals(L: float, R1: float, R2: float, subtotal_str: str, st: dict) -> Table:
    """
    Construye la tabla de totales (Subtotal / Sin IVA / Total).

    Args:
        L:           Ancho de la celda vacía izquierda.
        R1:          Ancho de la columna de etiquetas.
        R2:          Ancho de la columna de valores.
        subtotal_str: Valor formateado del subtotal/total.
        st:          Diccionario de estilos.

    Returns:
        Tabla de totales ReportLab.
    """
    tot_tbl = Table(
        [
            ["", Paragraph("Subtotal", st["sTotL"]),  Paragraph(subtotal_str, st["sTotV"])],
            ["", Paragraph("Sin IVA",  st["sNoteR"]), Paragraph("—",          st["sNoteR"])],
            ["", Paragraph("Total",    st["sTBL"]),   Paragraph(subtotal_str, st["sTBV"])],
        ],
        colWidths=[L, R1, R2],
    )
    tot_tbl.setStyle(TableStyle([
        ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (1, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (1, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0, -1), 0),
        ("RIGHTPADDING",  (0, 0), (0, -1), 0),
        ("GRID",          (1, 0), (-1, 1), 0.5, _BORDER),
        ("LINEABOVE",     (1, 2), (-1, 2), 0.8, _BORDER),
        ("BOX",           (1, 2), (-1, 2), 0.5, _BORDER),
        ("BACKGROUND",    (1, 2), (-1, 2), _GRN_BG),
    ]))
    return tot_tbl


def _build_footer(notes: Optional[str], st: dict) -> list:
    """
    Construye el pie de página: notas, términos de pago y sello de fecha.

    Args:
        notes: Notas adicionales opcionales.
        st:    Diccionario de estilos.

    Returns:
        Lista de elementos ReportLab.
    """
    elems: list = [Paragraph("Precios sin IVA.", st["sNote"])]
    if notes:
        elems += [Spacer(1, 6), Paragraph(f"Notas: {notes}", st["sNote"])]
    elems.append(Spacer(1, 14))
    elems += [
        Paragraph("Términos de pago y envío:", st["sTermT"]),
        Spacer(1, 4),
        Paragraph("• Una vez aprobada la cotización, el cliente debe realizar el pago del 50% del monto total.", st["sTermI"]),
        Paragraph("• Antes de realizar el envío, el cliente debe cancelar el 50% restante.", st["sTermI"]),
        Paragraph("• No se despacha ningún pedido sin haber recibido el pago completo correspondiente.", st["sTermI"]),
        Paragraph("• Los gastos de envío corren por cuenta del cliente.", st["sTermI"]),
        Spacer(1, 12),
        Paragraph(
            f"Cotización generada el {datetime.now(timezone.utc).strftime('%d-%m-%Y')} · TurtleForge Cost · Medellín, Colombia",
            st["sNote"],
        ),
    ]
    return elems


def generate_quote_pdf(quote: Quote) -> bytes:
    """
    Genera el PDF de una cotización en formato profesional TurtleForge Cost.

    El documento incluye: encabezado con logo, bloque de cliente (si aplica),
    número de cotización TFC-XXXX, fechas de emisión y vencimiento, tabla de
    ítems con precio unitario e importe, y sección de totales con nota sin IVA.

    Args:
        quote: Instancia ORM de la cotización con todos los costos calculados.

    Returns:
        bytes: Contenido binario del PDF listo para enviarse como respuesta HTTP
            con Content-Type 'application/pdf'.
    """
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    st = _make_styles("")
    elements: list = []

    # ── 1. HEADER ─────────────────────────────────────────────────────────────
    elements += _build_header(st)

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
            [Paragraph("Vencimiento:", st["sILab"]),          Paragraph(venc_str,  st["sIVal"])],
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
            [Paragraph("DESCRIPCIÓN",    st["sTH"]),  Paragraph("CANTIDAD",        st["sTH"]),
             Paragraph("PRECIO UNITARIO", st["sTH"]),  Paragraph("IMPORTE",         st["sTHR"])],
            [Paragraph(quote.piece_name, st["sTC"]),  Paragraph(qty_lbl,           st["sTC"]),
             Paragraph(fmt(u_price),     st["sTC"]),  Paragraph(fmt(t_price),      st["sTCR"])],
        ],
        colWidths=cols,
    )
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), _DARK),
        ("ALIGN",         (2, 0), (-1, -1), "RIGHT"),
        ("BACKGROUND",    (0, 1), (-1, 1), _ROW_ALT),
        ("GRID",          (0, 0), (-1, -1), 0.5, _BORDER),
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
    elements.append(_build_totals(L, R1, R2, fmt(t_price), st))
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements += _build_footer(quote.notes, st)

    doc.build(elements)
    return buffer.getvalue()


def generate_client_quote_pdf(client_quote: ClientQuote) -> bytes:
    """
    Genera el PDF de una cotización de cliente multi-producto.

    El documento incluye: encabezado con logo, bloque de cliente, número COT-XXXX,
    fechas de emisión y vencimiento, tabla de ítems con cantidad, precio unitario
    e importe, sección de totales y términos de pago.

    Args:
        client_quote: Instancia ORM de ClientQuote con los datos de la cotización.

    Returns:
        bytes: Contenido binario del PDF listo para enviarse como respuesta HTTP.
    """
    buffer = io.BytesIO()
    doc = _make_doc(buffer)
    st = _make_styles("_cq")
    elements: list = []

    # ── 1. HEADER ─────────────────────────────────────────────────────────────
    elements += _build_header(st)

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
    items = json.loads(client_quote.items)
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
        unit_p   = item["unit_price"]
        line_tot = qty * unit_p
        rows.append([
            Paragraph(item["name"],        st["sTC"]),
            Paragraph(str(qty),            st["sTC"]),
            Paragraph(_fmt_usd(unit_p),    st["sTC"]),
            Paragraph(_fmt_usd(line_tot),  st["sTCR"]),
        ])

    items_tbl = Table(rows, colWidths=cols)
    style_cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), _DARK),
        ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ("GRID",          (0, 0), (-1, -1), 0.5, _BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]
    for idx in range(len(items)):
        if idx % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, idx + 1), (-1, idx + 1), _ROW_ALT))
    items_tbl.setStyle(TableStyle(style_cmds))
    elements.append(items_tbl)
    elements.append(Spacer(1, 2))

    # ── 6. TOTALES ────────────────────────────────────────────────────────────
    L  = cols[0] + cols[1]
    R1 = cols[2]
    R2 = cols[3]
    subtotal_val = float(client_quote.subtotal)
    elements.append(_build_totals(L, R1, R2, _fmt_usd(subtotal_val), st))
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements += _build_footer(client_quote.notes, st)

    doc.build(elements)
    return buffer.getvalue()
