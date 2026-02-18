import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.models.quote import Quote
from app.models.filament import Filament
from app.models.printer import Printer


def generate_quote_pdf(
    quote: Quote,
    filament: Filament,
    printer: Printer,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    elements = []

    # Estilo personalizado para título
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=20,
        spaceAfter=20,
        textColor=colors.HexColor("#1a1a2e"),
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=10,
        textColor=colors.HexColor("#16213e"),
    )

    # Título
    elements.append(Paragraph("Cotización de Impresión 3D", title_style))
    elements.append(Spacer(1, 10))

    # Info general
    info_data = [
        ["Pieza:", quote.piece_name],
        ["Fecha:", quote.created_at.strftime("%d/%m/%Y %H:%M")],
    ]
    if quote.client_name:
        info_data.insert(1, ["Cliente:", quote.client_name])
    if quote.description:
        info_data.append(["Descripción:", quote.description])

    info_table = Table(info_data, colWidths=[2 * inch, 4 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # Detalles de impresión
    elements.append(Paragraph("Detalles de Impresión", subtitle_style))
    details_data = [
        ["Filamento:", f"{filament.brand} {filament.type} - {filament.color}"],
        ["Impresora:", f"{printer.name} ({printer.model})"],
        ["Peso de material:", f"{quote.weight_grams} g"],
        ["Tiempo de impresión:", f"{quote.print_time_hours} h"],
        ["Cantidad:", str(quote.quantity)],
    ]
    if quote.preparation_time_hours > 0:
        details_data.append(["Tiempo preparación:", f"{quote.preparation_time_hours} h"])
    if quote.post_processing_time_hours > 0:
        details_data.append(["Tiempo post-procesado:", f"{quote.post_processing_time_hours} h"])

    details_table = Table(details_data, colWidths=[2.5 * inch, 3.5 * inch])
    details_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 20))

    # Desglose de costos
    elements.append(Paragraph("Desglose de Costos", subtitle_style))
    currency = "$"
    cost_data = [
        ["Concepto", "Costo"],
        ["Material", f"{currency} {quote.material_cost:.2f}"],
        ["Electricidad", f"{currency} {quote.electricity_cost:.2f}"],
        ["Depreciación equipo", f"{currency} {quote.depreciation_cost:.2f}"],
        ["Mantenimiento", f"{currency} {quote.maintenance_cost:.2f}"],
        ["Mano de obra", f"{currency} {quote.labor_cost:.2f}"],
        ["Absorción de fallos", f"{currency} {quote.failure_cost:.2f}"],
        ["Subtotal", f"{currency} {quote.subtotal:.2f}"],
        [f"Margen ({quote.margin_percent:.0f}%)", f"{currency} {quote.margin_amount:.2f}"],
        ["Precio por unidad", f"{currency} {quote.total_per_unit:.2f}"],
    ]
    if quote.quantity > 1:
        cost_data.append([
            f"Total ({quote.quantity} unidades)",
            f"{currency} {quote.total_price:.2f}",
        ])
    else:
        cost_data.append(["TOTAL", f"{currency} {quote.total_price:.2f}"])

    cost_table = Table(cost_data, colWidths=[3.5 * inch, 2.5 * inch])
    cost_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        # Body
        ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        # Subtotal row
        ("LINEABOVE", (0, 7), (-1, 7), 1, colors.grey),
        # Total row
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8f0fe")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("LINEABOVE", (0, -1), (-1, -1), 2, colors.HexColor("#1a1a2e")),
        # General
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
    ]))
    elements.append(cost_table)
    elements.append(Spacer(1, 20))

    # Nota al pie
    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.grey,
    )
    elements.append(Paragraph("Precios sin IVA incluido.", note_style))
    elements.append(Paragraph(
        f"Cotización generada el {datetime.utcnow().strftime('%d/%m/%Y')} - Calculator3D",
        note_style,
    ))

    if quote.notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Notas: {quote.notes}", styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()
