"""
Servicio de generación de PDFs de cotización para clientes de impresión 3D.

Genera un documento PDF orientado al cliente: muestra la pieza, cantidad
y precio total en pesos colombianos. No incluye el desglose interno de costos
(materiales, electricidad, depreciación, margen, etc.) para proteger la
información comercial del negocio.

El documento se genera en memoria usando un buffer BytesIO.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.models.quote import Quote


def generate_quote_pdf(quote: Quote) -> bytes:
    """
    Genera el PDF de una cotización orientado al cliente y lo devuelve como bytes.

    El documento muestra únicamente la información relevante para el cliente:
    nombre de la pieza, datos de contacto, cantidad y precio en COP. No incluye
    el desglose interno de costos de producción.

    Args:
        quote: Instancia ORM de la cotización con todos los costos calculados.

    Returns:
        bytes: Contenido binario del archivo PDF, listo para enviarse como
            respuesta HTTP con Content-Type 'application/pdf'.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
    )
    styles = getSampleStyleSheet()
    elements = []

    DARK = colors.HexColor("#1a1a2e")
    ACCENT = colors.HexColor("#16213e")
    LIGHT_BG = colors.HexColor("#f0f4ff")

    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"],
        fontSize=22, spaceAfter=4,
        textColor=DARK,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=11, spaceAfter=20,
        textColor=colors.HexColor("#666666"),
    )
    note_style = ParagraphStyle(
        "Note", parent=styles["Normal"],
        fontSize=8, textColor=colors.grey,
    )

    # Encabezado
    elements.append(Paragraph("Cotización", title_style))
    elements.append(Paragraph("Impresión 3D · Calculator3D", subtitle_style))

    # Información general
    info_rows = [
        ["Pieza:", quote.piece_name],
        ["Fecha:", quote.created_at.strftime("%d/%m/%Y")],
    ]
    if quote.client_name:
        info_rows.insert(1, ["Cliente:", quote.client_name])
    if quote.description:
        info_rows.append(["Descripción:", quote.description])

    info_table = Table(info_rows, colWidths=[1.5 * inch, 5 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (0, 0), (0, -1), ACCENT),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 24))

    # Tabla de precio — muestra USD y COP si está disponible
    usd_unit = f"USD {quote.total_per_unit:.2f}"
    usd_total = f"USD {quote.total_price:.2f}"

    price_data = [
        ["Descripción", "Cant.", "Precio unitario", "Total"],
        [quote.piece_name, str(quote.quantity), usd_unit, usd_total],
    ]

    # Si hay tasa de cambio, añade una fila con precios en COP
    if quote.total_price_cop is not None:
        cop_unit = f"$ {quote.total_per_unit_cop:,.0f} COP"
        cop_total = f"$ {quote.total_price_cop:,.0f} COP"
        price_data.append(["", "", cop_unit, cop_total])

    col_widths = [2.8 * inch, 0.7 * inch, 1.8 * inch, 1.5 * inch]
    price_table = Table(price_data, colWidths=col_widths)

    table_style = [
        # Encabezado
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (1, 0), (-1, 0), "RIGHT"),
        # Fila USD
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("ALIGN", (1, 1), (-1, 1), "RIGHT"),
        ("BACKGROUND", (0, 1), (-1, 1), LIGHT_BG),
        ("FONTNAME", (-1, 1), (-1, 1), "Helvetica-Bold"),
        # Bordes y espaciado
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d0d0d0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]

    # Estilo adicional para la fila COP si existe
    if quote.total_price_cop is not None:
        COP_BG = colors.HexColor("#f0fdf4")
        COP_COLOR = colors.HexColor("#166534")
        table_style += [
            ("BACKGROUND", (0, 2), (-1, 2), COP_BG),
            ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
            ("FONTSIZE", (2, 2), (-1, 2), 12),
            ("TEXTCOLOR", (2, 2), (-1, 2), COP_COLOR),
            ("ALIGN", (1, 2), (-1, 2), "RIGHT"),
        ]

    price_table.setStyle(TableStyle(table_style))
    elements.append(price_table)
    elements.append(Spacer(1, 24))

    # Pie de página
    elements.append(Paragraph("Precios sin IVA.", note_style))
    elements.append(Paragraph(
        f"Cotización generada el {datetime.utcnow().strftime('%d/%m/%Y')} · Calculator3D",
        note_style,
    ))
    if quote.notes:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(f"Notas: {quote.notes}", styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()
