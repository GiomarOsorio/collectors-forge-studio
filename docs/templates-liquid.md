# Templates Liquid para Cotizaciones PDF — TurtleForge Studio

Los templates de cotización son archivos HTML que usan la sintaxis [Liquid](https://shopify.github.io/liquid/) para insertar datos dinámicos. Se procesan con `python-liquid` y se convierten a PDF con **WeasyPrint**.

Gestión en la UI: **Compañía → Templates PDF**

---

## Variables disponibles

### Empresa (`company`)

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `{{ company.name }}` | string | Nombre de la empresa | `The Collector's Forge` |
| `{{ company.slogan }}` | string | Eslogan | `Forging Legends...` |
| `{{ company.address }}` | string | Dirección postal | `Medellín, Colombia` |
| `{{ company.phone }}` | string | Teléfono | `+57 300 000 0000` |
| `{{ company.email }}` | string | Correo electrónico | `contacto@empresa.com` |
| `{{ company.nit }}` | string | NIT o número fiscal | `900.000.000-1` |
| `{{ company.logo_url }}` | string | URL absoluta del logo | `http://host/static/companies/uuid/logo.png` |

> Todos los campos de empresa pueden estar vacíos. Usar `{% if company.nit %}` antes de mostrarlos.

---

### Cotización

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `{{ quote_number }}` | string | Número de cotización | `COT-0001` |
| `{{ quote_date }}` | string | Fecha de emisión formateada | `27 de Febrero de 2026` |
| `{{ expiry_date }}` | string | Fecha de vencimiento formateada | `29 de Marzo de 2026` |
| `{{ generated_date }}` | string | Fecha/hora de generación del PDF | `27 de Febrero de 2026, 10:30` |

---

### Cliente

| Variable | Tipo | Descripción |
|---|---|---|
| `{{ client_name }}` | string | Nombre del cliente (puede estar vacío) |
| `{{ description }}` | string | Descripción general de la cotización (opcional) |
| `{{ notes }}` | string | Notas adicionales (opcional) |

---

### Ítems

La variable `items` es una lista de líneas de producto.

```liquid
{% for item in items %}
  {{ item.name }}          → Descripción del ítem
  {{ item.quantity }}      → Cantidad (número entero)
  {{ item.unit_price_fmt }} → Precio unitario formateado: "$ 45,000" o "USD 10.50"
  {{ item.line_total_fmt }} → Total de la línea formateado
{% endfor %}
```

---

### Totales

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `{{ subtotal_fmt }}` | string | Subtotal formateado | `$ 120,000` |
| `{{ include_iva }}` | boolean | Si aplica IVA (19%) | `true` / `false` |
| `{{ iva_str }}` | string | IVA formateado (si aplica) | `$ 22,800` |
| `{{ total_fmt }}` | string | Total final formateado | `$ 142,800` |

---

### Paleta de colores (`palette`)

Los colores se configuran en **Compañía → Marca & Colores** y se acceden por nombre:

```liquid
{{ palette.nombre_del_color }}
```

Ejemplo con la paleta por defecto:

| Nombre | Variable | Valor por defecto | Uso típico |
|---|---|---|---|
| `background` | `{{ palette.background }}` | `#1A1A1A` | Fondo de cabecera y tabla |
| `gold` | `{{ palette.gold }}` | `#D1A054` | Número de cotización, cabecera tabla |
| `metal` | `{{ palette.metal }}` | `#B67E3A` | Líneas decorativas, etiquetas |
| `forge` | `{{ palette.forge }}` | `#A33221` | Fila total |
| `text_light` | `{{ palette.text_light }}` | `#FFFFFF` | Texto sobre fondos oscuros |

> Los nombres son completamente personalizables. Los que configures en "Marca & Colores" son los que estarán disponibles aquí. Usa `| default: "#HEX"` como fallback.

---

### Términos de pago (`pdf_terms`)

```liquid
{% if pdf_terms %}
  {{ pdf_terms }}
{% else %}
  Términos por defecto...
{% endif %}
```

`pdf_terms` es texto libre que puede tener múltiples líneas. Usar `white-space: pre-line` en el CSS para respetar los saltos de línea.

---

### Tasa de cambio (datos de muestra)

Solo disponible en preview/validación:

| Variable | Valor de muestra |
|---|---|
| `{{ usd_rate }}` | `4284.51` |

---

## Sintaxis Liquid

### Condicionales

```liquid
{% if company.nit %}
  NIT: {{ company.nit }}
{% endif %}

{% if company.logo_url %}
  <img src="{{ company.logo_url }}" alt="{{ company.name }}">
{% endif %}

{% if include_iva %}
  IVA (19%): {{ iva_str }}
{% else %}
  IVA: No Aplica
{% endif %}
```

### Bucle de ítems

```liquid
{% for item in items %}
  <tr>
    <td>{{ item.name }}</td>
    <td>{{ item.quantity }}</td>
    <td>{{ item.unit_price_fmt }}</td>
    <td>{{ item.line_total_fmt }}</td>
  </tr>
{% endfor %}
```

### Filtros

```liquid
{{ company.name | default: "Mi Empresa" }}
{{ palette.background | default: "#1A1A1A" }}
{{ company.slogan | upcase }}
{{ company.name | downcase }}
{{ quote_number | prepend: "Número: " }}
```

---

## CSS compatible con WeasyPrint

WeasyPrint convierte HTML a PDF pero **no es un navegador completo**. Restricciones importantes:

### ❌ No usar

```css
/* Flexbox no funciona */
display: flex;
justify-content: space-between;
align-items: center;
gap: 18px;

/* Grid no funciona */
display: grid;
grid-template-columns: 1fr 1fr;

/* Gradientes no funcionan */
background: linear-gradient(to right, #1A1A1A, #333);

/* Position absoluta/fija no funciona bien */
position: absolute;
position: fixed;

/* Variables CSS tienen soporte limitado */
var(--mi-color)

/* overflow: hidden con border-radius causa bugs */
overflow: hidden;
border-radius: 8px; /* evitar combinados */
```

### ✅ Usar en su lugar

```css
/* Layouts multi-columna → <table> */
<table width="100%">
  <tr>
    <td>Columna izquierda</td>
    <td style="text-align: right">Columna derecha</td>
  </tr>
</table>

/* Colores directos en lugar de variables */
background-color: {{ palette.background | default: "#1A1A1A" }};

/* @page para control de márgenes */
@page {
  size: A4;
  margin: 0;  /* o margen deseado */
}

/* Padding en el contenido en lugar de margen de página */
.content { padding: 28px 40px; }

/* border-radius sin overflow */
border-radius: 4px;  /* funciona solo, sin overflow: hidden */
```

### Técnica de cabecera a ancho completo

```css
@page { size: A4; margin: 0; }
body { margin: 0; padding: 0; }

.header-band {
  background-color: {{ palette.background | default: "#1A1A1A" }};
  padding: 28px 40px 24px 40px;
  /* No usar display:flex aquí — usar <table> */
}

.content {
  padding: 28px 40px 20px 40px;
}
```

```html
<div class="header-band">
  <table width="100%"><tr>
    <td><!-- Logo + nombre empresa --></td>
    <td style="text-align:right"><!-- Dirección + contacto --></td>
  </tr></table>
</div>

<div class="content">
  <!-- Resto del documento -->
</div>
```

---

## Template de referencia (punto de partida)

Este template ya está optimizado para WeasyPrint. Cópialo en el editor de **Compañía → Templates PDF → Nuevo Template**:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cotización {{ quote_number }}</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 0; font-family: Arial, "Helvetica Neue", sans-serif;
         font-size: 10pt; color: #2A2A2A; background-color: #FFFFFF; line-height: 1.4; }

  /* === CABECERA === */
  .header-band { background-color: {{ palette.background | default: "#1A1A1A" }};
    padding: 28px 40px 24px 40px; }
  .header-tbl { width: 100%; border-collapse: collapse; }
  .header-tbl td { vertical-align: middle; }
  .header-right { text-align: right; color: {{ palette.text_light | default: "#FFFFFF" }};
    font-size: 8.5pt; line-height: 1.6; }
  .header-right .label { display: block; color: {{ palette.metal | default: "#B67E3A" }};
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
  .header-company-name { font-family: Georgia, serif; font-size: 20pt; font-weight: bold;
    color: {{ palette.gold | default: "#D1A054" }}; letter-spacing: 0.5px; margin: 0; }
  .header-slogan { font-family: Georgia, serif; font-size: 8.5pt; font-style: italic;
    color: {{ palette.metal | default: "#B67E3A" }}; margin: 3px 0 0 0; }
  .header-accent { height: 3px; background-color: {{ palette.metal | default: "#B67E3A" }}; }

  /* === CONTENIDO === */
  .content { padding: 28px 40px 20px 40px; }

  /* === NÚMERO DE COTIZACIÓN === */
  .meta-tbl { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .meta-tbl td { vertical-align: middle; }
  .quote-number-block { border: 2px solid {{ palette.gold | default: "#D1A054" }};
    padding: 12px 24px; text-align: center; background-color: #FDFBF7; width: 210px; }
  .quote-number-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 2px;
    color: {{ palette.metal | default: "#B67E3A" }}; margin: 0 0 2px 0; }
  .quote-number-value { font-family: Georgia, serif; font-size: 22pt; font-weight: bold;
    color: {{ palette.gold | default: "#D1A054" }}; margin: 0; letter-spacing: 1px; }
  .quote-dates { text-align: right; font-size: 9pt; color: #555555; line-height: 1.8; }
  .date-label { color: {{ palette.metal | default: "#B67E3A" }}; font-size: 7.5pt;
    text-transform: uppercase; letter-spacing: 0.8px; margin-right: 6px; }

  /* === CLIENTE === */
  .client-block { background-color: #F8F6F1;
    border-left: 4px solid {{ palette.metal | default: "#B67E3A" }};
    padding: 14px 20px; margin-bottom: 26px; }
  .client-block-title { font-size: 7pt; text-transform: uppercase; letter-spacing: 2px;
    color: {{ palette.metal | default: "#B67E3A" }}; margin: 0 0 4px 0; }
  .client-name { font-family: Georgia, serif; font-size: 14pt; font-weight: bold;
    color: {{ palette.background | default: "#1A1A1A" }}; margin: 0 0 2px 0; }
  .client-description { font-size: 9pt; color: #666666; margin: 0; font-style: italic; }

  /* === TABLA DE ÍTEMS === */
  .items-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .items-table thead th { background-color: {{ palette.background | default: "#1A1A1A" }};
    color: {{ palette.gold | default: "#D1A054" }}; font-family: Georgia, serif;
    font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px;
    padding: 10px 14px; border: none; text-align: left; }
  .items-table thead th.col-center { text-align: center; }
  .items-table thead th.col-right  { text-align: right; }
  .items-table tbody td { padding: 10px 14px; border-bottom: 1px solid #E8E4DC; }
  .items-table tbody tr:nth-child(even) td { background-color: #FDFBF7; }
  .items-table .col-desc  { text-align: left; font-weight: bold; color: #2A2A2A; }
  .items-table .col-qty   { text-align: center; color: #555555; width: 60px; }
  .items-table .col-price { text-align: right; color: #555555; width: 110px; white-space: nowrap; }
  .items-table .col-total { text-align: right; font-weight: bold; color: #2A2A2A;
    width: 120px; white-space: nowrap; }

  /* === TOTALES === */
  .totals-tbl { width: 55%; margin-left: auto; border-collapse: collapse;
    border: 1px solid #E8E4DC; border-top: none; margin-bottom: 28px; }
  .totals-tbl td { padding: 9px 16px; border-bottom: 1px solid #EEEAE3; font-size: 9.5pt; }
  .totals-tbl .t-label { color: #777777; }
  .totals-tbl .t-value { text-align: right; font-weight: bold; color: #2A2A2A; }
  .totals-tbl tr.grand td { background-color: {{ palette.forge | default: "#A33221" }};
    border-bottom: none; padding: 13px 16px; }
  .totals-tbl tr.grand .t-label { color: {{ palette.text_light | default: "#FFFFFF" }};
    font-family: Georgia, serif; font-size: 10pt;
    text-transform: uppercase; letter-spacing: 1.5px; }
  .totals-tbl tr.grand .t-value { color: {{ palette.text_light | default: "#FFFFFF" }};
    font-family: Georgia, serif; font-size: 16pt; font-weight: bold; }

  /* === NOTAS === */
  .notes-block { background-color: #FFF9EE;
    border: 1px solid {{ palette.metal | default: "#B67E3A" }};
    padding: 14px 18px; margin-bottom: 24px; }
  .notes-title { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: {{ palette.metal | default: "#B67E3A" }}; margin: 0 0 6px 0; }
  .notes-text { font-size: 9pt; color: #555555; margin: 0; line-height: 1.5; }

  /* === TÉRMINOS === */
  .terms-section { margin-bottom: 20px; }
  .terms-title { font-family: Georgia, serif; font-size: 10pt; font-weight: bold;
    color: {{ palette.background | default: "#1A1A1A" }}; margin: 0 0 8px 0;
    padding-bottom: 6px; border-bottom: 1px solid {{ palette.metal | default: "#B67E3A" }}; }
  .terms-list { margin: 0; padding: 0 0 0 18px; font-size: 8.5pt; color: #666666; line-height: 1.7; }
  .terms-list li { margin-bottom: 3px; }
  .terms-custom { font-size: 8.5pt; color: #666666; line-height: 1.7;
    margin: 0; white-space: pre-line; }

  /* === PIE === */
  .footer-accent { height: 2px; background-color: {{ palette.metal | default: "#B67E3A" }};
    margin: 20px 0 12px 0; }
  .footer-tbl { width: 100%; border-collapse: collapse; font-size: 7.5pt; color: #999999; }
  .footer-brand { font-family: Georgia, serif;
    color: {{ palette.metal | default: "#B67E3A" }}; font-style: italic; }
  .footer-stamp { text-align: right; }
</style>
</head>
<body>

  <!-- CABECERA -->
  <div class="header-band">
    <table class="header-tbl"><tr>
      <td>
        {% if company.logo_url %}
        <img src="{{ company.logo_url }}" alt="{{ company.name | default: 'Logo' }}"
             style="max-height:64px;max-width:160px;display:block;margin-bottom:8px;">
        {% endif %}
        <p class="header-company-name">{{ company.name | default: "Mi Empresa" }}</p>
        {% if company.slogan %}
        <p class="header-slogan">{{ company.slogan }}</p>
        {% endif %}
      </td>
      <td class="header-right">
        {{ company.address | default: "Medellín, Colombia" }}
        {% if company.nit %}
        <span class="label">NIT</span>{{ company.nit }}
        {% endif %}
        {% if company.phone %}
        <span class="label">Teléfono</span>{{ company.phone }}
        {% endif %}
        {% if company.email %}
        <span class="label">Correo</span>{{ company.email }}
        {% endif %}
      </td>
    </tr></table>
  </div>
  <div class="header-accent"></div>

  <div class="content">

    <!-- NÚMERO Y FECHAS -->
    <table class="meta-tbl"><tr>
      <td>
        <div class="quote-number-block">
          <p class="quote-number-label">Cotización No.</p>
          <p class="quote-number-value">{{ quote_number }}</p>
        </div>
      </td>
      <td class="quote-dates">
        <span class="date-label">Emisión</span> <strong>{{ quote_date }}</strong><br>
        <span class="date-label">Válida hasta</span> <strong>{{ expiry_date }}</strong>
      </td>
    </tr></table>

    <!-- CLIENTE -->
    {% if client_name %}
    <div class="client-block">
      <p class="client-block-title">Cliente</p>
      <p class="client-name">{{ client_name }}</p>
      {% if description %}
      <p class="client-description">{{ description }}</p>
      {% endif %}
    </div>
    {% endif %}

    <!-- TABLA DE ÍTEMS -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="col-center">Cant.</th>
          <th class="col-right">P. Unitario</th>
          <th class="col-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        {% for item in items %}
        <tr>
          <td class="col-desc">{{ item.name }}</td>
          <td class="col-qty">{{ item.quantity }}</td>
          <td class="col-price">{{ item.unit_price_fmt }}</td>
          <td class="col-total">{{ item.line_total_fmt }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>

    <!-- TOTALES -->
    <table class="totals-tbl">
      <tr>
        <td class="t-label">Subtotal</td>
        <td class="t-value">{{ subtotal_fmt }}</td>
      </tr>
      {% if include_iva %}
      <tr>
        <td class="t-label">IVA (19%)</td>
        <td class="t-value">{{ iva_str }}</td>
      </tr>
      {% else %}
      <tr>
        <td class="t-label">IVA</td>
        <td class="t-value" style="color:#999;font-weight:normal;font-style:italic;">No Aplica</td>
      </tr>
      {% endif %}
      <tr class="grand">
        <td class="t-label">Total</td>
        <td class="t-value">{{ total_fmt }}</td>
      </tr>
    </table>

    <!-- NOTAS (opcional) -->
    {% if notes %}
    <div class="notes-block">
      <p class="notes-title">Notas</p>
      <p class="notes-text">{{ notes }}</p>
    </div>
    {% endif %}

    <!-- TÉRMINOS -->
    <div class="terms-section">
      <p class="terms-title">Términos y Condiciones</p>
      {% if pdf_terms %}
      <p class="terms-custom">{{ pdf_terms }}</p>
      {% else %}
      <ol class="terms-list">
        <li>El precio cotizado es válido por 30 días calendario a partir de la fecha de emisión.</li>
        <li>Se requiere un anticipo del 50% para iniciar la producción. El saldo restante se cancela contra entrega.</li>
        <li>No se despacha ningún pedido sin haber recibido el pago completo correspondiente.</li>
        <li>Los gastos de envío corren por cuenta del cliente.</li>
      </ol>
      {% endif %}
    </div>

    <!-- PIE -->
    <div class="footer-accent"></div>
    <table class="footer-tbl"><tr>
      <td class="footer-brand">{{ company.name | default: "Mi Empresa" }}</td>
      <td class="footer-stamp">Documento generado el {{ generated_date }}</td>
    </tr></table>

  </div>
</body>
</html>
```

---

## Validación en el editor

El editor de templates (Compañía → Templates PDF → Nuevo/Editar) tiene dos acciones:

### Validar
Envía el contenido al endpoint `POST /company/templates/validate`. El servidor:
1. Parsea la sintaxis Liquid (detecta errores de sintaxis como `{% if sin cerrar %}`)
2. Renderiza el template con datos de muestra
3. Genera un PDF de preview con WeasyPrint
4. Devuelve `{ok, errors, warnings, preview_pdf_b64}`

**Errores** (sintaxis Liquid inválida):
- Tag no cerrado: `unexpected end of template, expected endif`
- Filtro desconocido: `no filter named 'filtro_inventado'`
- Variable con sintaxis incorrecta

**Warnings** (el template es válido pero falta algo):
- `Variable recomendada ausente: {{ total_fmt }}`
- `Variable recomendada ausente: {{ items }}`

### Preview PDF
Si la validación fue exitosa, el botón "Ver Preview" decodifica el PDF en base64 y lo abre en una nueva pestaña. No requiere guardar primero.

---

## Flujo de activación de un template

1. Crear el template en **Compañía → Templates PDF → Nuevo Template**
2. Pegar el HTML/Liquid en el editor
3. Click en **Validar** — verificar que no hay errores
4. Click en **Ver Preview** — revisar el PDF generado
5. Click en **Guardar**
6. En la lista de templates, click en **Usar como default**

A partir de ese momento, todas las descargas de `GET /client-quotes/{id}/pdf` usarán este template en lugar del generador ReportLab por defecto.

---

## Datos de muestra para preview/validación

El backend usa estos datos cuando valida un template sin una cotización real:

```python
company = {
    "name": "The Collector's Forge",
    "slogan": "Forging Legends, One Piece at a Time.",
    "address": "Medellín, Colombia",
    "phone": "+57 300 000 0000",
    "email": "contacto@thecollectorsforge.com",
    "nit": "900.000.000-1",
    "logo_url": "http://host/static/logo.png",
}

quote = {
    "quote_number": "COT-0001",
    "quote_date": "27 de Febrero de 2026",
    "expiry_date": "29 de Marzo de 2026",
    "generated_date": "27 de Febrero de 2026, 10:30",
    "client_name": "Cliente de Muestra",
    "description": "Descripción de muestra",
    "notes": "Notas de muestra",
    "include_iva": False,
    "items": [
        {"name": "Figura personalizada 15cm",   "quantity": 2, "unit_price_fmt": "$ 45,000", "line_total_fmt": "$ 90,000"},
        {"name": "Base con imán integrado",      "quantity": 2, "unit_price_fmt": "$ 15,000", "line_total_fmt": "$ 30,000"},
        {"name": "Pintura y acabado premium",    "quantity": 1, "unit_price_fmt": "$ 25,000", "line_total_fmt": "$ 25,000"},
    ],
    "subtotal_fmt": "$ 145,000",
    "iva_str": "$ 0",
    "total_fmt": "$ 145,000",
    "pdf_terms": "",
}
```
