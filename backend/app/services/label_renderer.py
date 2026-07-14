"""
Renderizado de etiquetas PDF para bobinas de filamento (issue #135).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
`backend/app/services/label_renderer.py`. Port casi directo: el renderer
de bambuddy ya está desacoplado del ORM (dataclass `LabelData`), así que
CFS solo necesita construir esa lista desde `Spool`/`InventoryItem` (ver
`_spool_to_label_data` en `routers/spools.py`).

Seis plantillas fijas (las REALES del código de bambuddy, no las 4 del
README viejo — corregidas en su issue #1426 porque `ams_30x15` no cabía
en ningún holder real):

- ``ams_holder_74x33`` — 74×33 mm, holder MakerWorld modelo 752566 (ventana
  visible, variante pequeña). Una etiqueta por página.
- ``ams_holder_75x55`` — 75×55 mm, variante con inserto de cartulina del
  mismo holder. Más espaciosa — swatch + QR + columna de texto completa.
- ``box_40x30``  — 40×30 mm, tamaño común de rollo DK/Brother. Bueno para
  etiquetas de bolsas/cajas de almacenamiento.
- ``box_62x29``  — 62×29 mm, para Brother PT/QL y etiquetas Dymo genéricas.
- ``avery_5160`` — hoja US Letter, 25.4×66.7 mm × 30 por hoja.
- ``avery_l7160`` — hoja A4, 38.1×63.5 mm × 21 por hoja.

Principio de layout (igual que bambuddy): el **código de la bobina**
domina la etiqueta (legible a un brazo de distancia). CFS usa
`label_code` (ej. "SP-0042") en vez del `spool_id` numérico crudo que
pinta bambuddy — único cambio de fondo respecto al original; el resto
del layout/QR/swatch se mantiene igual.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Literal, Optional

import qrcode
from reportlab.lib.colors import Color, HexColor, black
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

TemplateName = Literal[
    "ams_holder_74x33",
    "ams_holder_75x55",
    "box_40x30",
    "box_62x29",
    "avery_5160",
    "avery_l7160",
]


@dataclass
class LabelData:
    """
    Datos por-bobina necesarios para renderizar una etiqueta.

    Desacoplado del modelo SQLAlchemy — el caller arma esta lista desde
    `Spool` + su `InventoryItem` padre (ver `_spool_to_label_data`).
    """

    label_code: str
    name: str
    material: str
    brand: Optional[str] = None
    subtype: Optional[str] = None
    rgba: Optional[str] = None  # "RRGGBB" o "RRGGBBAA" sin '#'; None → gris neutro
    extra_colors: Optional[list] = None  # hex adicionales (sin '#')
    storage_location: Optional[str] = None
    deeplink_url: str = ""  # lo que codifica el QR


# ── Helpers de color ─────────────────────────────────────────────────────────


def _color_from_hex(hex_str: Optional[str], fallback: Color = HexColor(0x808080)) -> Color:
    """
    Parsea un string RRGGBB o RRGGBBAA (sin '#') a un Color de ReportLab.

    Respeta el canal alfa para que bobinas multi-color con overlays
    translúcidos rendericen bien. Cae a `fallback` en None/malformado en
    vez de lanzar excepción — las etiquetas siempre deben poder imprimirse.
    """
    if not hex_str:
        return fallback
    h = hex_str.lstrip("#").strip()
    if len(h) not in (6, 8):
        return fallback
    try:
        r = int(h[0:2], 16) / 255.0
        g = int(h[2:4], 16) / 255.0
        b = int(h[4:6], 16) / 255.0
        a = int(h[6:8], 16) / 255.0 if len(h) == 8 else 1.0
        return Color(r, g, b, alpha=a)
    except ValueError:
        return fallback


def _hex_code_label(rgba: Optional[str]) -> str:
    """Formatea `rgba` como un `#RRGGBB` imprimible (sin canal alfa, mayúsculas)."""
    if not rgba:
        return ""
    h = rgba.lstrip("#").strip()
    if len(h) not in (6, 8):
        return ""
    rgb = h[:6]
    if not all(c in "0123456789abcdefABCDEF" for c in rgb):
        return ""
    return f"#{rgb.upper()}"


# ── Generación de QR ─────────────────────────────────────────────────────────


def _qr_png_bytes(payload: str, *, box_size: int = 4, border: int = 2) -> bytes:
    """Renderiza `payload` como PNG de QR ajustado. Payload vacío → bytes vacíos."""
    if not payload:
        return b""
    qr = qrcode.QRCode(
        version=None,
        # ERROR_CORRECT_L (7% recuperación) en vez de M (15%): un QR de
        # etiqueta solo necesita sobrevivir a un escaneo limpio, no daño
        # físico, y L codifica el mismo payload en una versión menor
        # (módulos más grandes) — eso es lo que lo hace imprimible en
        # impresoras térmicas de 203 dpi, donde M-level sangraba los
        # módulos entre sí en etiquetas pequeñas.
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Dibujo de una etiqueta ───────────────────────────────────────────────────


def _draw_swatch(c: rl_canvas.Canvas, x: float, y: float, w: float, h: float, data: LabelData) -> None:
    """
    Dibuja el swatch de color. Bobinas multi-color usan franjas verticales
    (misma convención que `FilamentSwatch` en el frontend).
    """
    primary = _color_from_hex(data.rgba)
    extras = [_color_from_hex(h) for h in (data.extra_colors or []) if h]
    colors = [primary, *extras]

    if not colors:
        c.setFillColor(HexColor(0x808080))
        c.rect(x, y, w, h, stroke=0, fill=1)
        return

    stripe_w = w / len(colors)
    for i, col in enumerate(colors):
        c.setFillColor(col)
        c.rect(x + i * stripe_w, y, stripe_w, h, stroke=0, fill=1)

    # Borde negro fino para que swatches de color claro sigan visibles sobre blanco.
    c.setStrokeColor(black)
    c.setLineWidth(0.3)
    c.rect(x, y, w, h, stroke=1, fill=0)


def _roomy_qr_size(inner_w: float, inner_h: float) -> float:
    """
    Lado del QR (en puntos) para el layout espacioso.

    Un 12mm de piso mantiene legibles las etiquetas chicas (por debajo,
    los módulos caen bajo ~2 dots a 203dpi en térmicas y el código se
    sangra). Capado además por el alto interior, un máximo absoluto de
    18mm, y ~45% del ancho interior para no invadir la columna de texto.
    """
    return min(max(inner_w * 0.20, 12 * mm), inner_h, 18 * mm, inner_w * 0.45)


def _draw_qr(c: rl_canvas.Canvas, x: float, y: float, size: float, payload: str) -> None:
    """Incrusta un QR cuadrado en (x, y) con lado `size` (en puntos)."""
    png = _qr_png_bytes(payload)
    if not png:
        return
    from reportlab.lib.utils import ImageReader

    img = ImageReader(io.BytesIO(png))
    c.drawImage(img, x, y, width=size, height=size, mask="auto")


def _truncate_to_width(c: rl_canvas.Canvas, text: str, font: str, size: float, max_w: float) -> str:
    """Trunca `text` con elipsis para que quepa en `max_w` puntos."""
    if c.stringWidth(text, font, size) <= max_w:
        return text
    ell = "…"
    while text and c.stringWidth(text + ell, font, size) > max_w:
        text = text[:-1]
    return text + ell if text else ell


def _draw_label(
    c: rl_canvas.Canvas, x: float, y: float, w: float, h: float, data: LabelData, monochrome: bool = False
) -> None:
    """
    Renderiza una etiqueta dentro del box (x, y, w, h). Origen abajo-izquierda.

    Dos layouts según el alto disponible:

    - **Tight** (h < 20mm): swatch a la izquierda, tres líneas de texto a
      la derecha (marca, material+subtipo, código grande). Sin QR — a
      alturas muy chicas no alcanza el ancho para swatch+texto+QR sin
      truncar los campos que el usuario necesita. Rama de seguridad para
      un futuro preset ultra-chico; ninguna de las 6 plantillas actuales
      cae acá.

    - **Roomy** (h >= 20mm — holder AMS, etiqueta de caja, hojas Avery):
      swatch a la izquierda, QR a la derecha, texto multilínea en el
      medio. El código de la bobina anclado abajo-izquierda bajo el
      swatch para que siga legible a distancia.
    """
    pad = 1.2 * mm
    inner_x, inner_y = x + pad, y + pad
    inner_w = w - 2 * pad
    inner_h = h - 2 * pad

    # Borde fino exterior para poder recortar fácil de una hoja en blanco.
    c.setStrokeColor(HexColor(0xCCCCCC))
    c.setLineWidth(0.4)
    c.rect(x, y, w, h, stroke=1, fill=0)

    is_tight = h < 20 * mm

    if is_tight:
        _draw_label_tight(c, x, y, w, h, inner_x, inner_y, inner_w, inner_h, pad, data, monochrome)
    else:
        _draw_label_roomy(c, x, y, w, h, inner_x, inner_y, inner_w, inner_h, pad, data, monochrome)


def _draw_label_tight(
    c: rl_canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    inner_x: float,
    inner_y: float,
    inner_w: float,
    inner_h: float,
    pad: float,
    data: LabelData,
    monochrome: bool = False,
) -> None:
    """Layout tight (h < 20mm). Swatch + marca/material/hex/código, sin QR."""
    # Monocromo: sin swatch de color (ver _draw_label_roomy), el ancho se
    # cede a la columna de texto.
    if monochrome:
        swatch_w = 0.0
    else:
        swatch_w = min(inner_h, inner_w * 0.35)
        swatch_y = inner_y + (inner_h - swatch_w) / 2
        _draw_swatch(c, inner_x, swatch_y, swatch_w, swatch_w, data)

    text_x = inner_x + swatch_w + pad
    text_w = inner_w - swatch_w - pad
    if text_w < 5 * mm:
        return  # Patológico — ni el swatch entra bien.

    c.setFillColor(black)

    brand_size = 6.5
    if data.brand:
        c.setFont("Helvetica-Bold", brand_size)
        brand = _truncate_to_width(c, data.brand, "Helvetica-Bold", brand_size, text_w)
        c.drawString(text_x, y + h - pad - brand_size, brand)

    sub_size = 5
    sub_line = " ".join(filter(None, [data.material, data.subtype]))
    sub_y_baseline = y + h - pad - brand_size - 0.6 - sub_size
    if sub_line:
        c.setFont("Helvetica", sub_size)
        sub_line = _truncate_to_width(c, sub_line, "Helvetica", sub_size, text_w)
        c.drawString(text_x, sub_y_baseline, sub_line)

    hex_code = _hex_code_label(data.rgba)
    if hex_code:
        hex_size = 4.5
        hex_y = sub_y_baseline - 0.4 - hex_size
        if hex_y > inner_y + 13:
            c.setFont("Helvetica", hex_size)
            c.drawString(text_x, hex_y, hex_code)

    # Código de la bobina, grande — el campo clave de un vistazo.
    id_size = 13
    c.setFont("Helvetica-Bold", id_size)
    id_text = _truncate_to_width(c, data.label_code, "Helvetica-Bold", id_size, text_w)
    c.drawString(text_x, inner_y + 0.5, id_text)


def _draw_label_roomy(
    c: rl_canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    inner_x: float,
    inner_y: float,
    inner_w: float,
    inner_h: float,
    pad: float,
    data: LabelData,
    monochrome: bool = False,
) -> None:
    """Layout de etiqueta de caja / Avery. Swatch izquierda, QR derecha, texto medio."""
    # Swatch omitido en monocromo — en una térmica B/N un bloque de color
    # imprime como gris sucio sin transmitir nada; se recupera el espacio
    # para texto y la línea de hex code sigue cargando el color.
    if monochrome:
        swatch_w = 0.0
    else:
        swatch_w = min(inner_w * 0.18, inner_h, 16 * mm)
        _draw_swatch(c, inner_x, inner_y, swatch_w, inner_h, data)

    qr_size = _roomy_qr_size(inner_w, inner_h)
    qr_x = x + w - pad - qr_size
    qr_y = inner_y + (inner_h - qr_size) / 2
    _draw_qr(c, qr_x, qr_y, qr_size, data.deeplink_url)

    text_x = inner_x + swatch_w + 1.5 * mm
    text_w = qr_x - text_x - 1.5 * mm
    if text_w < 8 * mm:
        return

    c.setFillColor(black)

    line1 = data.brand or ""
    line2 = " · ".join(filter(None, [data.material, data.subtype]))
    name = data.name or ""
    hex_code = _hex_code_label(data.rgba)

    cursor_y = y + h - pad

    if line1:
        size = 8
        c.setFont("Helvetica-Bold", size)
        text = _truncate_to_width(c, line1, "Helvetica-Bold", size, text_w)
        cursor_y -= size
        c.drawString(text_x, cursor_y, text)
        cursor_y -= 1.2

    if line2:
        size = 7
        c.setFont("Helvetica", size)
        text = _truncate_to_width(c, line2, "Helvetica", size, text_w)
        cursor_y -= size
        c.drawString(text_x, cursor_y, text)
        cursor_y -= 1.5

    if hex_code:
        size = 6.5
        c.setFont("Helvetica", size)
        cursor_y -= size
        c.drawString(text_x, cursor_y, hex_code)
        cursor_y -= 1.2

    if name and name != line1:
        size = 9
        c.setFont("Helvetica-Bold", size)
        text = _truncate_to_width(c, name, "Helvetica-Bold", size, text_w)
        cursor_y -= size
        c.drawString(text_x, cursor_y, text)
        cursor_y -= 1.2

    if data.storage_location:
        size = 6.5
        c.setFont("Helvetica-Oblique", size)
        text = _truncate_to_width(c, data.storage_location, "Helvetica-Oblique", size, text_w)
        cursor_y -= size
        c.drawString(text_x, cursor_y, text)

    # Código de la bobina — anclado abajo de la columna de texto, grande y bold.
    id_size = 16
    c.setFont("Helvetica-Bold", id_size)
    id_text = _truncate_to_width(c, data.label_code, "Helvetica-Bold", id_size, text_w)
    c.drawString(text_x, inner_y + 0.5, id_text)


# ── Puntos de entrada por plantilla ──────────────────────────────────────────

# (label_w_mm, label_h_mm) para plantillas de una etiqueta por página.
_SINGLE_LABEL_SIZES_MM: dict = {
    "ams_holder_74x33": (74.0, 33.0),
    "ams_holder_75x55": (75.0, 55.0),
    "box_40x30": (40.0, 30.0),
    "box_62x29": (62.0, 29.0),
}

# Parámetros de plantillas de hoja: (page_size, label_w_mm, label_h_mm,
#                                     cols, rows, top_margin_mm, left_margin_mm,
#                                     col_gap_mm, row_gap_mm)
_SHEET_TEMPLATES: dict = {
    "avery_5160": (letter, 66.675, 25.4, 3, 10, 12.7, 4.76, 3.175, 0.0),
    "avery_l7160": (A4, 63.5, 38.1, 3, 7, 15.15, 7.0, 2.5, 0.0),
}


def labels_per_page(template: TemplateName) -> int:
    """
    Cuántas etiquetas caben por página en `template` — expuesto como
    función pura para poder testear la paginación sin renderizar PDFs.
    """
    if template in _SINGLE_LABEL_SIZES_MM:
        return 1
    if template in _SHEET_TEMPLATES:
        _, _, _, cols, rows, *_ = _SHEET_TEMPLATES[template]
        return cols * rows
    raise ValueError(f"Plantilla de etiqueta desconocida: {template!r}")


def _render_single_label_pdf(template: TemplateName, data_list: list, monochrome: bool = False) -> bytes:
    w_mm, h_mm = _SINGLE_LABEL_SIZES_MM[template]
    page_w, page_h = w_mm * mm, h_mm * mm

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setTitle(f"CFS spool labels ({template})")

    for data in data_list:
        _draw_label(c, 0, 0, page_w, page_h, data, monochrome)
        c.showPage()

    c.save()
    return buf.getvalue()


def _render_sheet_pdf(template: TemplateName, data_list: list, monochrome: bool = False) -> bytes:
    page_size, w_mm, h_mm, cols, rows, top_mm, left_mm, col_gap_mm, row_gap_mm = _SHEET_TEMPLATES[template]
    page_w, page_h = page_size

    label_w = w_mm * mm
    label_h = h_mm * mm
    top_margin = top_mm * mm
    left_margin = left_mm * mm
    col_gap = col_gap_mm * mm
    row_gap = row_gap_mm * mm

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=page_size)
    c.setTitle(f"CFS spool labels ({template})")

    per_page = cols * rows
    for page_start in range(0, len(data_list), per_page):
        chunk = data_list[page_start:page_start + per_page]
        for idx, data in enumerate(chunk):
            row = idx // cols
            col = idx % cols
            x = left_margin + col * (label_w + col_gap)
            y = page_h - top_margin - (row + 1) * label_h - row * row_gap
            _draw_label(c, x, y, label_w, label_h, data, monochrome)
        c.showPage()

    c.save()
    return buf.getvalue()


def render_labels(template: TemplateName, data_list: list, *, monochrome: bool = False) -> bytes:
    """
    Renderiza `data_list` a un PDF usando la plantilla indicada.

    `data_list` vacía igual produce un PDF válido (vacío) — el caller
    debe cortocircuitar antes si eso no es deseado.

    `monochrome` quita el swatch de color (imprime como bloque gris sin
    valor en impresoras térmicas B/N) y cede ese espacio al texto; la
    línea de hex code sigue cargando el color.
    """
    if template in _SINGLE_LABEL_SIZES_MM:
        return _render_single_label_pdf(template, data_list, monochrome)
    if template in _SHEET_TEMPLATES:
        return _render_sheet_pdf(template, data_list, monochrome)
    raise ValueError(f"Plantilla de etiqueta desconocida: {template!r}")


__all__ = ["LabelData", "TemplateName", "render_labels", "labels_per_page"]
