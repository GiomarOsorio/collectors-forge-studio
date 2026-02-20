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
from datetime import datetime, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
)

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


def _fmt_cop(value: float) -> str:
    """Formatea como pesos colombianos: $ 1.234.567"""
    return "$ " + f"{round(value):,}".replace(",", ".")


def _fmt_usd(value: float) -> str:
    """Formatea como dólares: $ 1,234.56"""
    return f"$ {value:,.2f}"


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
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.6 * inch, bottomMargin=0.75 * inch,
        leftMargin=1.0 * inch, rightMargin=1.0 * inch,
    )
    styles = getSampleStyleSheet()
    elements = []

    # ── Estilos tipográficos ──────────────────────────────────────────────────
    def ps(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    sCo    = ps("Co",    fontSize=13, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2)
    sCoS   = ps("CoS",   fontSize=10, fontName="Helvetica",      textColor=_GRAY,    alignment=2)
    sCl    = ps("Cl",    fontSize=11, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2)
    sClS   = ps("ClS",   fontSize=9,  fontName="Helvetica",      textColor=_GRAY,    alignment=2)
    sTit   = ps("Tit",   fontSize=22, fontName="Helvetica-Bold", textColor=_DARK)
    sILab  = ps("ILab",  fontSize=9,  fontName="Helvetica-Bold", textColor=_GRAY)
    sIVal  = ps("IVal",  fontSize=10, fontName="Helvetica",      textColor=_DARK)
    sTH    = ps("TH",    fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white)
    sTHR   = ps("THR",   fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white,   alignment=2)
    sTC    = ps("TC",    fontSize=10, fontName="Helvetica",      textColor=_DARK)
    sTCR   = ps("TCR",   fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTotL  = ps("TotL",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTotV  = ps("TotV",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTBL   = ps("TBL",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2)
    sTBV   = ps("TBV",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2)
    sNote  = ps("Note",  fontSize=8,  fontName="Helvetica",      textColor=_GRAY)
    sNoteR = ps("NoteR", fontSize=8,  fontName="Helvetica",      textColor=_GRAY,    alignment=2)

    # ── 1. HEADER: logo (izquierda) + empresa (derecha) ───────────────────────
    # Logo 1536×1024 px → aspect 1.5 → 1.8" × 1.2"
    logo_cell = (
        Image(str(LOGO_PATH), width=1.8 * inch, height=1.2 * inch)
        if LOGO_PATH.exists()
        else Paragraph("<b>TurtleForge</b>", styles["Normal"])
    )
    company_cell = [
        Paragraph("TurtleForge Studio", sCo),
        Spacer(1, 4),
        Paragraph("Medellín, Colombia", sCoS),
    ]
    hdr_tbl = Table(
        [[logo_cell, "", company_cell]],
        colWidths=[1.9 * inch, 2.2 * inch, 2.4 * inch],
    )
    hdr_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 20))

    # ── 2. BLOQUE CLIENTE (alineado a la derecha) ─────────────────────────────
    if quote.client_name:
        client_cell: list = [
            Paragraph("Cliente:", sClS),
            Paragraph(quote.client_name.upper(), sCl),
        ]
        if quote.description:
            client_cell += [Spacer(1, 3), Paragraph(quote.description, sClS)]
        client_tbl = Table(
            [["", client_cell]],
            colWidths=[3.3 * inch, 3.2 * inch],
        )
        client_tbl.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(client_tbl)
        elements.append(Spacer(1, 18))

    # ── 3. TÍTULO ─────────────────────────────────────────────────────────────
    elements.append(Paragraph(f"Número de cotización  TFC-{quote.id:04d}", sTit))
    elements.append(Spacer(1, 14))

    # ── 4. FILA DE FECHAS: emisión + vencimiento (30 días) ───────────────────
    fecha_str = quote.created_at.strftime("%d-%m-%Y")
    venc_str  = (quote.created_at + timedelta(days=30)).strftime("%d-%m-%Y")
    info_tbl = Table(
        [[
            [Paragraph("Fecha de cotización:", sILab), Paragraph(fecha_str, sIVal)],
            [Paragraph("Vencimiento:", sILab),          Paragraph(venc_str,  sIVal)],
        ]],
        colWidths=[3.25 * inch, 3.25 * inch],
    )
    info_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 16))

    # ── 5. TABLA DE ÍTEMS ─────────────────────────────────────────────────────
    use_cop = quote.total_price_cop is not None
    fmt     = _fmt_cop if use_cop else _fmt_usd
    u_price = (quote.total_per_unit_cop or quote.total_per_unit) if use_cop else quote.total_per_unit
    t_price = quote.total_price_cop if use_cop else quote.total_price

    qty_lbl = f"{quote.quantity} {'Unidad' if quote.quantity == 1 else 'Unidades'}"

    # Anchos: descripción, cantidad, precio unitario, importe
    cols = [2.9 * inch, 1.1 * inch, 1.3 * inch, 1.2 * inch]

    items_tbl = Table(
        [
            [Paragraph("DESCRIPCIÓN",    sTH),  Paragraph("CANTIDAD",        sTH),
             Paragraph("PRECIO UNITARIO", sTH),  Paragraph("IMPORTE",         sTHR)],
            [Paragraph(quote.piece_name, sTC),  Paragraph(qty_lbl,           sTC),
             Paragraph(fmt(u_price),     sTC),  Paragraph(fmt(t_price),      sTCR)],
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

    # ── 6. TOTALES (alineados a la derecha, espejo de columnas de la tabla) ───
    # Columnas: [espacio izq = desc+cant] [etiqueta = precio unit] [valor = importe]
    L  = cols[0] + cols[1]   # 4.2"  — celda vacía izquierda
    R1 = cols[2]              # 1.35" — etiqueta
    R2 = cols[3]              # 0.95" — valor

    tot_tbl = Table(
        [
            ["", Paragraph("Subtotal", sTotL),  Paragraph(fmt(t_price), sTotV)],
            ["", Paragraph("Sin IVA",  sNoteR), Paragraph("—",           sNoteR)],
            ["", Paragraph("Total",    sTBL),   Paragraph(fmt(t_price),  sTBV)],
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
    elements.append(tot_tbl)
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements.append(Paragraph("Precios sin IVA.", sNote))
    if quote.notes:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Notas: {quote.notes}", sNote))
    elements.append(Spacer(1, 14))

    # Términos y condiciones de pago
    sTermTitle = ps("TermTitle", fontSize=8, fontName="Helvetica-Bold", textColor=_DARK)
    sTermItem  = ps("TermItem",  fontSize=8, fontName="Helvetica",      textColor=_GRAY)
    elementos_terminos = [
        Paragraph("Términos de pago y envío:", sTermTitle),
        Spacer(1, 4),
        Paragraph("• Una vez aprobada la cotización, el cliente debe realizar el pago del 50% del monto total.", sTermItem),
        Paragraph("• Antes de realizar el envío, el cliente debe cancelar el 50% restante.", sTermItem),
        Paragraph("• No se despacha ningún pedido sin haber recibido el pago completo correspondiente.", sTermItem),
        Paragraph("• Los gastos de envío corren por cuenta del cliente.", sTermItem),
    ]
    for elem in elementos_terminos:
        elements.append(elem)

    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        f"Cotización generada el {datetime.utcnow().strftime('%d-%m-%Y')} · TurtleForge Cost · Medellín, Colombia",
        sNote,
    ))

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
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.6 * inch, bottomMargin=0.75 * inch,
        leftMargin=1.0 * inch, rightMargin=1.0 * inch,
    )
    styles = getSampleStyleSheet()
    elements = []

    # ── Estilos tipográficos ──────────────────────────────────────────────────
    def ps(name, **kw):
        return ParagraphStyle(name + "_cq", parent=styles["Normal"], **kw)

    sCo    = ps("Co",    fontSize=13, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2)
    sCoS   = ps("CoS",   fontSize=10, fontName="Helvetica",      textColor=_GRAY,    alignment=2)
    sCl    = ps("Cl",    fontSize=11, fontName="Helvetica-Bold", textColor=_DARK,    alignment=2)
    sClS   = ps("ClS",   fontSize=9,  fontName="Helvetica",      textColor=_GRAY,    alignment=2)
    sTit   = ps("Tit",   fontSize=22, fontName="Helvetica-Bold", textColor=_DARK)
    sILab  = ps("ILab",  fontSize=9,  fontName="Helvetica-Bold", textColor=_GRAY)
    sIVal  = ps("IVal",  fontSize=10, fontName="Helvetica",      textColor=_DARK)
    sTH    = ps("TH",    fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white)
    sTHR   = ps("THR",   fontSize=9,  fontName="Helvetica-Bold", textColor=colors.white,   alignment=2)
    sTC    = ps("TC",    fontSize=10, fontName="Helvetica",      textColor=_DARK)
    sTCR   = ps("TCR",   fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTotL  = ps("TotL",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTotV  = ps("TotV",  fontSize=10, fontName="Helvetica",      textColor=_DARK,    alignment=2)
    sTBL   = ps("TBL",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2)
    sTBV   = ps("TBV",   fontSize=12, fontName="Helvetica-Bold", textColor=_GRN_TXT, alignment=2)
    sNote  = ps("Note",  fontSize=8,  fontName="Helvetica",      textColor=_GRAY)

    # ── 1. HEADER: logo (izquierda) + empresa (derecha) ───────────────────────
    logo_cell = (
        Image(str(LOGO_PATH), width=1.8 * inch, height=1.2 * inch)
        if LOGO_PATH.exists()
        else Paragraph("<b>TurtleForge</b>", styles["Normal"])
    )
    company_cell = [
        Paragraph("TurtleForge Studio", sCo),
        Spacer(1, 4),
        Paragraph("Medellín, Colombia", sCoS),
    ]
    hdr_tbl = Table(
        [[logo_cell, "", company_cell]],
        colWidths=[1.9 * inch, 2.2 * inch, 2.4 * inch],
    )
    hdr_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 20))

    # ── 2. BLOQUE CLIENTE (alineado a la derecha) ─────────────────────────────
    client_cell: list = [
        Paragraph("Cliente:", sClS),
        Paragraph(client_quote.client_name.upper(), sCl),
    ]
    if client_quote.description:
        client_cell += [Spacer(1, 3), Paragraph(client_quote.description, sClS)]
    client_tbl = Table(
        [["", client_cell]],
        colWidths=[3.3 * inch, 3.2 * inch],
    )
    client_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(client_tbl)
    elements.append(Spacer(1, 18))

    # ── 3. TÍTULO ─────────────────────────────────────────────────────────────
    elements.append(Paragraph(f"Número de cotización  COT-{client_quote.id:04d}", sTit))
    elements.append(Spacer(1, 14))

    # ── 4. FILA DE FECHAS: emisión + vencimiento ──────────────────────────────
    fecha_str = client_quote.quote_date.strftime("%d-%m-%Y")
    venc_str  = client_quote.expiry_date.strftime("%d-%m-%Y")
    info_tbl = Table(
        [[
            [Paragraph("Fecha de cotización:", sILab), Paragraph(fecha_str, sIVal)],
            [Paragraph("Válida hasta:", sILab),        Paragraph(venc_str,  sIVal)],
        ]],
        colWidths=[3.25 * inch, 3.25 * inch],
    )
    info_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 16))

    # ── 5. TABLA DE ÍTEMS ─────────────────────────────────────────────────────
    items = json.loads(client_quote.items)
    cols = [2.6 * inch, 1.1 * inch, 1.3 * inch, 1.5 * inch]

    rows = [
        [
            Paragraph("DESCRIPCIÓN",     sTH),
            Paragraph("CANTIDAD",        sTH),
            Paragraph("PRECIO UNITARIO", sTH),
            Paragraph("IMPORTE",         sTHR),
        ]
    ]
    for idx, item in enumerate(items):
        qty       = item["quantity"]
        unit_p    = item["unit_price"]
        line_tot  = qty * unit_p
        bg = _ROW_ALT if idx % 2 == 0 else colors.white
        rows.append([
            Paragraph(item["name"],           sTC),
            Paragraph(str(qty),               sTC),
            Paragraph(_fmt_usd(unit_p),       sTC),
            Paragraph(_fmt_usd(line_tot),     sTCR),
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
    tot_tbl = Table(
        [
            ["", Paragraph("Subtotal", sTotL),  Paragraph(_fmt_usd(subtotal_val), sTotV)],
            ["", Paragraph("Sin IVA",  sNote),   Paragraph("—",                    sNote)],
            ["", Paragraph("Total",    sTBL),    Paragraph(_fmt_usd(subtotal_val), sTBV)],
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
    elements.append(tot_tbl)
    elements.append(Spacer(1, 24))

    # ── 7. PIE DE PÁGINA ──────────────────────────────────────────────────────
    elements.append(Paragraph("Precios sin IVA.", sNote))
    if client_quote.notes:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Notas: {client_quote.notes}", sNote))
    elements.append(Spacer(1, 14))

    sTermTitle = ps("TermTitle", fontSize=8, fontName="Helvetica-Bold", textColor=_DARK)
    sTermItem  = ps("TermItem",  fontSize=8, fontName="Helvetica",      textColor=_GRAY)
    for elem in [
        Paragraph("Términos de pago y envío:", sTermTitle),
        Spacer(1, 4),
        Paragraph("• Una vez aprobada la cotización, el cliente debe realizar el pago del 50% del monto total.", sTermItem),
        Paragraph("• Antes de realizar el envío, el cliente debe cancelar el 50% restante.", sTermItem),
        Paragraph("• No se despacha ningún pedido sin haber recibido el pago completo correspondiente.", sTermItem),
        Paragraph("• Los gastos de envío corren por cuenta del cliente.", sTermItem),
    ]:
        elements.append(elem)

    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        f"Cotización generada el {datetime.utcnow().strftime('%d-%m-%Y')} · TurtleForge Cost · Medellín, Colombia",
        sNote,
    ))

    doc.build(elements)
    return buffer.getvalue()
