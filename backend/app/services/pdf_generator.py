"""
Servicio de generación de PDFs para las cotizaciones de impresión 3D.

Este módulo implementa la función que genera el documento PDF de una
cotización usando la biblioteca ReportLab. El PDF resultante incluye:

- Encabezado con el título "Cotización de Impresión 3D".
- Información general: nombre de la pieza, cliente y fecha.
- Detalles técnicos: filamento, impresora, peso, tiempo y cantidad.
- Tabla de desglose de costos con todos los componentes del precio.
- Pie de página con la fecha de generación y notas adicionales.

El documento se genera en memoria usando un buffer BytesIO, evitando
la necesidad de escribir archivos temporales en disco.
"""

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
    """
    Genera el PDF de una cotización de impresión 3D y lo devuelve como bytes.

    Construye el documento en memoria con ReportLab Platypus, organizando el
    contenido en secciones: información general, detalles técnicos de la
    impresión y tabla de desglose de costos. El estilo visual usa una paleta
    de azul oscuro (#1a1a2e, #16213e) consistente con la identidad de la app.

    Args:
        quote: Instancia ORM de la cotización con todos los costos calculados.
        filament: Instancia ORM del filamento utilizado en la cotización.
            Se usa para mostrar marca, tipo y color en los detalles.
        printer: Instancia ORM de la impresora utilizada en la cotización.
            Se usa para mostrar nombre y modelo en los detalles.

    Returns:
        bytes: Contenido binario del archivo PDF generado, listo para enviarse
            como respuesta HTTP con Content-Type 'application/pdf'.
    """
    # Buffer en memoria para evitar escritura en disco
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    elements = []

    # Estilo personalizado para el título principal del documento
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=20,
        spaceAfter=20,
        textColor=colors.HexColor("#1a1a2e"),
    )
    # Estilo para los subtítulos de sección (Detalles, Desglose de Costos)
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=10,
        textColor=colors.HexColor("#16213e"),
    )

    # Sección 1: Título del documento
    elements.append(Paragraph("Cotización de Impresión 3D", title_style))
    elements.append(Spacer(1, 10))

    # Sección 2: Información general de la cotización
    info_data = [
        ["Pieza:", quote.piece_name],
        ["Fecha:", quote.created_at.strftime("%d/%m/%Y %H:%M")],
    ]
    # Insertar el nombre del cliente en segunda posición si fue proporcionado
    if quote.client_name:
        info_data.insert(1, ["Cliente:", quote.client_name])
    # Agregar la descripción al final si fue proporcionada
    if quote.description:
        info_data.append(["Descripción:", quote.description])

    info_table = Table(info_data, colWidths=[2 * inch, 4 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),   # Columna de etiquetas en negrita
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),         # Columna de valores en normal
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # Sección 3: Detalles técnicos de la impresión
    elements.append(Paragraph("Detalles de Impresión", subtitle_style))
    details_data = [
        ["Filamento:", f"{filament.brand} {filament.type} - {filament.color}"],
        ["Impresora:", f"{printer.name} ({printer.model})"],
        ["Peso de material:", f"{quote.weight_grams} g"],
        ["Tiempo de impresión:", f"{quote.print_time_hours} h"],
        ["Cantidad:", str(quote.quantity)],
    ]
    # Agregar tiempo de preparación solo si es mayor que cero
    if quote.preparation_time_hours > 0:
        details_data.append(["Tiempo preparación:", f"{quote.preparation_time_hours} h"])
    # Agregar tiempo de post-procesado solo si es mayor que cero
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

    # Sección 4: Tabla de desglose de costos
    elements.append(Paragraph("Desglose de Costos", subtitle_style))
    currency = "$"
    cost_data = [
        ["Concepto", "Costo"],                                                           # Encabezado
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
    # Si hay más de una unidad, mostrar el total con la cantidad; si no, solo "TOTAL"
    if quote.quantity > 1:
        cost_data.append([
            f"Total ({quote.quantity} unidades)",
            f"{currency} {quote.total_price:.2f}",
        ])
    else:
        cost_data.append(["TOTAL", f"{currency} {quote.total_price:.2f}"])

    cost_table = Table(cost_data, colWidths=[3.5 * inch, 2.5 * inch])
    cost_table.setStyle(TableStyle([
        # Encabezado de la tabla con fondo azul oscuro y texto blanco
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        # Cuerpo de la tabla (filas de conceptos)
        ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        # Línea separadora encima de la fila de subtotal (fila 7, índice base 0)
        ("LINEABOVE", (0, 7), (-1, 7), 1, colors.grey),
        # Fila de total con fondo azul claro y texto en negrita (última fila)
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8f0fe")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("LINEABOVE", (0, -1), (-1, -1), 2, colors.HexColor("#1a1a2e")),
        # Alineación y espaciado general
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
    ]))
    elements.append(cost_table)
    elements.append(Spacer(1, 20))

    # Sección 5: Pie de página con aclaraciones legales y fecha de generación
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

    # Agregar notas adicionales de la cotización si existen
    if quote.notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Notas: {quote.notes}", styles["Normal"]))

    # Compilar el documento y escribir en el buffer
    doc.build(elements)
    return buffer.getvalue()
