# Pantallas pendientes de diseño — Collector's Forge Studio

**Última actualización**: 2026-05-16
**Para**: Claude Design (agent diseñador)
**Audiencia**: tú vas a diseñar estas pantallas en el mismo estilo que las existentes (inventory / slicer / queue / maintenance / vault / company / settings) usando los tokens y patrones ya establecidos.

---

## Cómo leer este doc

Cada pantalla tiene:

1. **Propósito** — 1 línea de qué hace.
2. **Acceso** — `público` / `usuario` / `admin`.
3. **Endpoints backend** — refs a `services/api.js`.
4. **Modelo de datos** — campos del backend con `*` para required.
5. **Layout desktop** — estructura visual completa.
6. **Layout mobile** — variante responsive.
7. **Estados** — loading / empty / error.
8. **Interacciones** — qué pasa al click/drop/submit.
9. **Notas** — qué patrones aplicables, gotchas, decisiones.

Si una pantalla es **un formulario**, sigue el patrón **FilamentFormDrawer** (ver sección compartida). Si es un **listado**, usa el patrón **InventoryPage tabs+drawer**.

---

# 0. Patrones compartidos (USAR EN TODO)

Ya están implementados en `frontend/src/components/ui/` y `frontend/src/components/`. Diseña asumiendo que existen.

## 0.1 Tokens CSS

```css
/* App accents */
--app-cost:      #2DD4BF  /* teal — finance, dinero */
--app-inventory: #3B82F6  /* azul — stock, materiales */
--app-slicer:    #F59E0B  /* amber — laminado */
--app-mtto:      #8B5CF6  /* violet — mantenimiento */
--app-queue:     #14B8A6  /* deep-teal — cola */
--app-vault:    #F43F5E  /* rose — archivo */
--app-company:   #6366F1  /* indigo — admin / branding */

/* Brand */
--forge-teal:    #2DD4BF
--forge-amber:   #FBBF24
--forge-rose:    #F43F5E

/* Surfaces */
--forge-black:   #0F1219  /* fondo principal */
--surf-sidebar:  #0A0E16
--surf-card:     #111520
--surf-card-2:   #161B27
--surf-hover:    #1A2030
--border-soft:   #1C2230
--border:        #222630
--border-strong: #303642

/* Text */
--tech-white:    #E4E8ED
--steel:         #94A0AE
--gunmetal:      #7A8494
--gunmetal-dim:  #5A6573

/* Type */
--font-sans:     'Space Grotesk', system-ui, sans-serif
--font-mono:     'JetBrains Mono', monospace
```

## 0.2 MobileAppHeader (todos los mobile)

Componente `MobileAppHeader` en `components/MobileAppHeader.jsx`. Aparece arriba en TODAS las pantallas mobile (excepto `/login`). Props:

- `appName` — eyebrow text (ej. "Inventario", "Cost")
- `appIcon` — Lucide component
- `appAccent` — hex del app
- `title` — título dinámico (nombre de tab/sección)
- `onMenu` — abre la sidebar mobile (vía `useOutletContext().openSidebar`)
- `onSearch` — opcional, abre un overlay de búsqueda

Render:
```
[hamburger 36×36 border]  [icon-badge 18×18 + "AppName" eyebrow]   [search? 36×36] [bell 36×36]
                          [Título grande 18px]
```

## 0.3 FilamentFormDrawer pattern (USAR EN TODOS LOS FORMULARIOS)

**Patrón establecido en `frontend/src/pages/inventory/InventoryPage.jsx::FilamentFormDrawer`.**

Cuando una pantalla tiene un **formulario para crear/editar** un recurso, NO uses modal centrado. Usa el siguiente patrón:

- **Desktop**: `DetailDrawer` (width 520, slide-in derecho con eyebrow + footer slot)
- **Mobile**: `MobileSheet` (bottom sheet, full height, con footer sticky inline)

### Estructura del form

```
[Header drawer]
  eyebrow: "App · nuevo" o "Editando · <nombre>"
  title:   "Agregar <recurso>" o "<nombre actual>"
  [Pencil icon button si aplica]  [Close X]

[Body scrollable, padding 18px]
  "Los campos marcados con * son obligatorios."

  ─ SECCIÓN 1 (eyebrow tipo "Identificación") ─
  [Field 2-col grid]
  [Field]            [Field *]
  [Field]            [Field *]

  ─ SECCIÓN 2 ─
  ...

  ─ SECCIÓN N ─
  [Textarea full-width "Notas"]

[Footer drawer (sticky)]
  [Cancelar]  [+ Agregar]  o  [Pencil Guardar cambios]
```

### Field row

```
LABEL EN MAYÚSCULAS *    [→ "Requerido" red si error]
[input full-width, h-9, border]
```

- Required marker: `*` en rosa (`text-rose-400`)
- Error message: align right del label, rosa, font normal
- Input class: `bg-surf-card · border-border-strong · rounded-md · px-2.5 py-1.5 · text-tech-white · focus:border-app-accent`

### Validación

- Inline por campo (mensaje rojo al lado del label)
- Submit deshabilitado si hay errors
- Toast success al guardar + insert/update optimista al estado local (sin re-fetch)

### Modos

- `create`: arranca con defaults (ej. `weight_per_roll: 1000`)
- `edit`: prefilled desde el raw backend object
- Auto-fill inteligente cuando aplique (ej. densidad por tipo de material)

## 0.4 DetailDrawer / MobileSheet primitives

```jsx
<DetailDrawer
  open
  onClose
  eyebrow="ID-XXXX"          // mono uppercase pequeño
  title="Nombre del item"     // h2 big
  width={460}                 // default
  onEdit={() => {}}           // si se provee, renderiza Pencil antes del X
  footer={<>...buttons...</>} // sticky bottom
>
  {children}
</DetailDrawer>

<MobileSheet
  open
  onClose
  title="Nombre"
  height="full"               // 92vh max
  onEdit={() => {}}           // mismo behavior
>
  {children}
  {/* No tiene footer prop — wrap inline:
      <div className="sticky bottom-0 ...">{footerButtons}</div> */}
</MobileSheet>
```

## 0.5 StatusPill — tonos disponibles

```js
const STATUS_PRESETS = {
  active:    'verde'  ,  // OK / activo
  printing:  'azul'   ,  // imprimiendo / en proceso
  pending:   'gris'   ,  // pendiente / sin acción
  paused:    'amber'  ,  // pausado
  done:      'verde'  ,  // completado
  warn:      'amber'  ,  // advertencia / stock bajo
  danger:    'rojo'   ,  // error / fallo / crítico
  info:      'morado' ,  // info / borrador
  neutral:   'steel'  ,  // sin categoría
};

<StatusPill tone="printing" icon={Cpu} size="sm|lg">EN PROCESO</StatusPill>
```

Usa el tone SEMÁNTICO, no el color visual literal. Si algo es "en camino" → tone `printing` (azul), no inventes uno nuevo.

## 0.6 EmptyState v2

```jsx
<EmptyState
  icon={IconLucide}
  accent="#8B5CF6"  // accent del app
  title="Sin pedidos"
  hint="Crea uno para empezar a llevar control."
  action={<button className="btn btn-primary btn-sm">+ Nuevo</button>}
/>
```

## 0.7 KPI strip (desktop)

4-5 tiles horizontales arriba de la lista. Cada uno:
- `label` mayúsculas (mono 9px)
- `value` grande (mono 22px)
- `unit` opcional (mono 11px)
- `sub` (texto pequeño)
- `accent` color del KPI (puede ser distinto al app)
- `icon` opcional
- `sparkline` opcional para series temporales

## 0.8 Sidebar context

La página ACTIVA en la sidebar global muestra sus sub-items debajo del listado de apps (sección "INVENTARIO" / "COST" / etc). Cada item de sidebar.js usa `Layers` o ícono específico, label corto.

Cuando agreges una nueva pantalla, registrarla en `frontend/src/config/sidebar.js` dentro del `items[]` del app correspondiente.

---

# Pantallas pendientes

22 pantallas agrupadas por app.

---

## 1. Login — `/login`

**Propósito**: Autenticación SSO via OIDC/Authentik + botón "Bypass dev" en `import.meta.env.DEV`.
**Acceso**: público (única ruta sin AppLayout/sidebar).
**Endpoints backend**: `POST /api/auth/oidc/login` (redirect), `POST /api/auth/dev-bypass`.

### Layout (single, mobile + desktop)

Pantalla full-screen con fondo dark + gradient sutil. Centrado vertical y horizontal.

```
┌─────────────────────────────┐
│                             │
│       [Logo grande 80px]    │
│   Collector's Forge Studio  │
│   "Cotiza, lamina, imprime" │
│                             │
│   ┌─────────────────────┐   │
│   │ [Iniciar sesión]    │   │  ← primary teal, full width
│   │ con SSO             │   │
│   └─────────────────────┘   │
│                             │
│   ┌─────────────────────┐   │
│   │ Bypass dev (solo    │   │  ← ghost, solo si DEV
│   │ desarrollo local)   │   │
│   └─────────────────────┘   │
│                             │
│   v0.4 · es-CO              │
└─────────────────────────────┘
```

### Estados

- **Loading**: spinner full-screen mientras se redirige a Authentik
- **Error**: toast rojo con mensaje (ej. "credenciales inválidas")

### Notas

- Gradient de fondo: igual al `MobileHeroStatus` del Inventory (radial sutil teal/blue)
- En mobile: padding generoso (24px), logo más pequeño (60px)
- Botón SSO con ícono lucide `Shield` o `Key`

---

## 2. Cost — Cotizaciones — `/cost/v2` (CostPage)

**Propósito**: Hub de la app Cost. Lista cotizaciones recientes + estadísticas + accesos a calcular, manual, historial.
**Acceso**: usuario.
**Endpoints backend**: `getClientQuotes()`, `getQuotes()` (de la calculadora).
**Modelo**: `ClientQuote { id, client_name, total, items[], quote_date, expiry_date, status, pdf_url }` y `Quote` (de la calculadora, similar).

### Tabs

1. **Cotizaciones** — ClientQuotes (manuales del cliente)
2. **Historial** — Quotes (de calcular pieza)
3. **Calculadora** — link a `/cost/calculator/v2`

### KPIs desktop (4 tiles, accent teal #2DD4BF)

1. **Capital 30d**: `${total cotizado 30d}` COP
2. **Cotizaciones**: total · sub `${activas} activas`
3. **Ticket promedio**: `${avg}` COP
4. **Por vencer**: count · sub `${vencidas} vencidas` (warn amber si > 0)

### Layout desktop

```
[Header: breadcrumb Cost › <tab> + actions (Nueva cotización · Calcular)]
[KPIs 4-tiles strip]
[Tabs: Cotizaciones · Historial · Calculadora]
[Sticky toolbar: SearchField · sort · count]
[Grid de cards (quote cards)]
[DetailDrawer derecho al click: eyebrow COT-XXXX, footer "Descargar PDF · Duplicar · Eliminar"]
```

### Quote card

```
┌──────────────────────────────┐
│ COT-0184  ●EN BORRADOR       │ ← StatusPill tone=info
│ Cliente: Acme Corp           │
│ 5 ítems · $1.4M COP          │
│ ──────────────────           │
│ Vence en 7 días              │ ← warn amber si <3d
└──────────────────────────────┘
```

### Layout mobile

- MobileAppHeader (appName "Cost", icon Calculator, accent #2DD4BF)
- Hero card compacta (capital 30d big mono + sparkline)
- Mini KPIs strip (Cotizaciones / Promedio / Vencen)
- Tabs como pills horizontales
- Search en header (overlay)
- Lista de quote rows (compactas, click → MobileSheet)
- FAB teal "+ Nueva"

### DetailDrawer body

- Hero: cliente + status pill + COT-ID
- Stats grid 2×3: Total, Items, Fecha, Vencimiento, Método pago, PDF size
- Lista de items (quantity × name × unit_price)
- Footer: `Descargar PDF` (primary) + `Duplicar` + `Eliminar` (rosa)

### Estado vacío

`EmptyState` con icon `FileText`, action "+ Crear cotización".

### Notas

- Status posibles (mapping a tone): `borrador → info`, `enviada → printing`, `aceptada → done`, `vencida → danger`, `cancelada → neutral`
- ClientQuote vs Quote: ambas se listan pero en tabs distintos
- "Calculadora" tab solo redirige a /cost/calculator/v2 (no contenido propio)

---

## 3. Cost — Calcular pieza — `/cost/calculator/v2` (CalculatorPageV2)

**Propósito**: Calculadora de costo de una pieza individual. Toma weight, time, material, configura márgenes y calcula precio.
**Acceso**: usuario.
**Endpoints backend**: `POST /api/quotes/calculate`, `getCalculatorSettings()`, `getFilaments()`, `getPrinters()`.

### Layout desktop (3-col)

```
[Header: breadcrumb · botones "Guardar como template", "Limpiar"]
┌────────────────┬──────────────────────┬───────────────────┐
│ LEFT RAIL      │ CENTER               │ RIGHT RAIL        │
│ (300px)        │ (flex)               │ (320px)           │
├────────────────┼──────────────────────┼───────────────────┤
│ Parámetros     │ Preview/Resultado    │ Breakdown         │
│ - Peso (g) *   │                      │ - Material        │
│ - Tiempo (h) * │ ┌──────────────────┐ │ - Electricidad    │
│ - Material *   │ │   $ 145.000 COP  │ │ - Depreciación    │
│   (select FK   │ │   ─────────────  │ │ - Mantenimiento   │
│    a Filament) │ │   $ 0.04 / g     │ │ - Mano de obra    │
│ - Impresora *  │ │   $ 25 / hr      │ │ - Tasa fallo      │
│   (select FK)  │ └──────────────────┘ │ - Margen          │
│ - Margen %     │                      │ ────────          │
│ - Tasa fallo % │ [Gráfico stacked bar]│ Total mat: $X     │
│ - Adicionales  │                      │ Total horas: $Y   │
│   + insumos    │                      │ Total mat+hr: $Z  │
│   + multi-     │                      │ + margen: $W      │
│     filamento  │                      │ ─ TOTAL: $145k    │
└────────────────┴──────────────────────┴───────────────────┘
[Footer fijo: "Guardar cotización" primary + "Volver a Cost"]
```

### Modelo de datos (form)

| Campo | Tipo | Required | Default | Notas |
|---|---|---|---|---|
| weight_grams | number | * | desde URL params | g |
| print_time_hours | number | * | desde URL params | horas, soporta decimales |
| filament_id | int | * | — | FK a `inventory_items` (cat=Filamento) |
| printer_id | int | * | — | FK a `printers` |
| margin_pct | number |  | 35 | % |
| failure_rate_pct | number |  | 5 | % |
| supplies | array<{id, qty}> |  | [] | insumos extra |
| additional_filaments | array<{id, weight_grams}> |  | [] | multi-color |
| labor_hours | number |  | 0 | horas mano de obra extra |
| client_name | string |  | "Interno" | si vacío → cotización interna |
| notes | text |  | — |  |

### Layout mobile

Stack vertical, scroll. No 3-col.

```
[MobileAppHeader appName="Cost", title="Calcular pieza", icon Calculator]
[Card "Parámetros" → form colapsable]
[Card "Resultado" big mono price + breakdown]
[Card "Margen y tasa fallo" → sliders]
[Card "Adicionales" → +insumos / +filamentos]
[Sticky action bar: Total + "Guardar"]
```

### Estado

- **Pre-fill**: si viene de Slicer (`useInCalculator()`), URL params traen weight + time + filament_type → pre-llena 3 campos.
- **Computed live**: cualquier change en cualquier input → recalcula breakdown en frontend (sin POST). El POST es solo al guardar.

### Notas

- Material y Printer son selects con search interno (lista corta normalmente)
- Adicionales = filamentos secundarios (multi-color) + insumos por unidad
- El gráfico stacked bar muestra contribución de cada componente al total — usar accent teal para "material", azul para "horas máquina", amber para "labor", morado para "margen"
- Sticky save button en mobile para no perderlo al scroll

---

## 4. Cost — Nueva cotización — `/cost/manual` (ManualQuotePage)

**Propósito**: Crear una cotización para cliente con ítems arbitrarios (no necesariamente de calculadora — puede ser un servicio, una hora de diseño, etc.). Genera PDF.
**Acceso**: usuario.
**Endpoints backend**: `POST /api/client-quotes/` (creates `ClientQuote`), `downloadClientQuotePdf(id)`.

### Modelo

```ts
ClientQuote {
  id: number,
  client_name *: string,
  items *: [{ name: string, quantity: number, unit_price: number, subtotal? }],
  total *: number,  // auto-calc
  quote_date: date (default today),
  expiry_date: date (default +30d),
  payment_terms?: string,
  notes?: text,
  status: 'borrador' | 'enviada' | 'aceptada' | 'vencida' | 'cancelada',
  pdf_url?: string  // generado al guardar
}
```

### Layout desktop — usar FilamentFormDrawer pattern (single-page si abre desde botón "+ Nueva", inline si es página dedicada)

Sugerencia: **convertir en drawer derecho** (igual que `FilamentFormDrawer`) abierto desde el CTA "+ Nueva" de CostPage. Eliminar la página dedicada.

### Form sections

**Sección 1 — Cliente**
- `client_name` * (autocomplete desde quotes anteriores)
- `client_contact` (email/tel)
- `client_id_tax` (NIT/cédula, opcional)

**Sección 2 — Items** (lista editable)
```
┌─────────────────────────────────────────────────────┐
│ # │ Concepto         │ Cantidad │ Precio │ Subtotal │
├───┼──────────────────┼──────────┼────────┼──────────┤
│ 1 │ [text]           │ [number] │ [num]  │ auto     │  [×]
│ 2 │ [text]           │ [number] │ [num]  │ auto     │  [×]
│   │ + Agregar línea  │          │        │          │
└─────────────────────────────────────────────────────┘
Subtotal: $X
IVA (auto): $Y (toggle)
TOTAL:     $Z
```

**Sección 3 — Términos**
- `quote_date` (date picker, default today)
- `expiry_date` (date picker, default +30d)
- `payment_terms` (textarea, ej "50% anticipo, 50% contra entrega")
- `notes` (textarea)

### Footer
- Cancelar
- Guardar como borrador
- **Guardar y descargar PDF** (primary)

### Layout mobile

Bottom sheet con secciones colapsables (acordeón) para no abrumar.

### Estados

- **Validación**: client_name required, al menos 1 item con cantidad>0 y precio>0
- **PDF generation**: al guardar, muestra toast "Generando PDF…" → al terminar, download automático

### Notas

- Plantilla PDF se toma del default registrado en `/company/templates` (Liquid)
- Si no hay template default → usa ReportLab fallback
- Cliente "Interno" tiene meaning especial: no genera cotización formal (para uso interno)

---

## 5. Cost — Cotizaciones (historial de Quote interno) — `/cost/quotes` (QuotesPage)

**Propósito**: Lista de todas las cotizaciones generadas por la calculadora (no las manuales — esas viven en Cost tab cotizaciones).
**Acceso**: usuario.
**Endpoints**: `getQuotes()`.
**Modelo**: `Quote { id, weight_grams, print_time_hours, material, total, breakdown, created_at }`.

### Layout

Igual al CostPage tab "Historial" pero standalone. Probablemente **fusionar con CostPage** en la fase futura — por ahora diseñar como tabla simple:

```
[Header: breadcrumb Cost › Cotizaciones generadas]
[KPI: 1 tile "Total generadas" + 1 "30 días" + 1 "Promedio"]
[Sticky toolbar: search + date range + sort]
[Tabla:
  ID | Fecha | Material | Peso | Tiempo | Total | Acciones
  Q-0145 | 02/05 | PLA | 145g | 2.5h | $32.000 | [👁 Ver] [📋 Duplicar] [PDF]
]
```

### Notas

- Click row → DetailDrawer derecho con breakdown completo (mismo del CalculatorPageV2)
- "Duplicar" → carga la quote en /cost/calculator/v2 con prefill

---

## 6. Cost — Impresoras — `/cost/printers` (PrintersPage)

**Propósito**: CRUD de impresoras registradas. Cada impresora tiene specs eléctricas + depreciación + horómetros + estado.
**Acceso**: usuario.
**Endpoints**: `getPrinters()`, `createPrinter()`, `updatePrinter()`, `deletePrinter()`.

### Modelo

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| name | string | * | ej. "BambuLab P2S #1" |
| brand | string |  | "BambuLab", "Prusa", etc. |
| model | string |  | "P2S Combo", "MK4", etc. |
| price | decimal | * | COP, valor de compra |
| useful_life_hours | int | * | default 5000h |
| current_hours | decimal |  | acumulado, lo actualiza el sistema |
| power_watts | int | * | consumo nominal (ej. 240W para P2S) |
| nozzle_size_mm | decimal |  | default 0.4 |
| build_volume_x_mm | int |  | 256 |
| build_volume_y_mm | int |  | 256 |
| build_volume_z_mm | int |  | 256 |
| acquisition_date | date |  | para depreciación |
| status | enum |  | 'active' \| 'maintenance' \| 'retired' |
| photo_url | string |  | upload |
| notes | text |  |  |

### Layout desktop

```
[Header: breadcrumb Cost › Impresoras + button "+ Agregar impresora"]
[KPIs: Total · Activas · En mantto · Total invertido]
[Grid de printer cards (no tabla, son cards visuales con foto)]
[DetailDrawer al click para ver detalle + editar]
```

### Printer card

```
┌──────────────────────────────────┐
│ [foto 200×120 cover]             │
│ BambuLab P2S Combo #1            │
│ [● ACTIVA]                       │ ← StatusPill done
│ ──────────────────────────────── │
│ 1.234 / 5.000 h          [bar%]  │ ← ProgressBar (amber si >80%)
│ $3.200.000 COP · 240W            │
│ Volumen: 256³ mm                 │
└──────────────────────────────────┘
```

### Form drawer (usar FilamentFormDrawer pattern)

Secciones:
1. **Identificación**: name *, brand, model, photo
2. **Especificaciones**: power_watts *, nozzle_size_mm, build_volume X·Y·Z
3. **Costo y vida útil**: price *, useful_life_hours *, current_hours, acquisition_date
4. **Estado**: status (select), notes

### Mobile

- Lista compacta de printer rows con foto thumbnail 60×60 + name + status pill + hours bar
- FAB "+ Agregar"
- Sheet detail

### Notas

- `current_hours` se actualiza automáticamente al marcar print queue items como done (cliente NO edita manualmente, solo visualiza)
- ProgressBar amber cuando current_hours > 0.8 * useful_life
- Status `retired` → opacity 50% y excluida de selects en calculator

---

## 7. Cost — Tarifa & ajustes — `/cost/settings` (SettingsPage)

**Propósito**: Configuración global de la calculadora: tarifa eléctrica (auto-scrapeada de EPM), márgenes default, factores.
**Acceso**: usuario.
**Endpoints**: `getCalculatorSettings()`, `updateCalculatorSettings()`, `getCurrentTariff()`, `refreshTariff()`.

### Sections

**Sección 1 — Tarifa eléctrica EPM**

```
┌──────────────────────────────────────────────┐
│ TARIFA ELÉCTRICA · EPM Medellín              │
│                                              │
│ Estrato: [3 ▼]                               │
│                                              │
│ Tarifa actual:  $ 0.0245 COP/Wh   [×2 ya inc] │
│ Vigencia:       Mayo 2026                    │
│ Última sync:    hace 2 días                  │
│                                              │
│ [● ACTIVA]  · auto cada 24h                  │
│                                              │
│ [Refrescar ahora]  [Ver histórico]           │
└──────────────────────────────────────────────┘
```

Si última sync >35 días → badge amber "DESACTUALIZADA" + sugerir refresh.

**Sección 2 — Márgenes default**
- Default margin % (slider 0-100, default 35)
- Failure rate % default (slider 0-30, default 5)
- Rush surcharge % (slider 0-50, default 25)
- Design fee fixed (number, default 45000 COP)

**Sección 3 — Mano de obra**
- Hourly machine cost (COP, default 8500)
- Hourly labor cost (COP, default 28000)
- Shipping medium (COP, default 8500)

**Sección 4 — Impuestos**
- IVA % (number, default 19)
- IVA auto (toggle: aplica auto a cotizaciones)
- Round total (toggle: redondea al millar)
- Show breakdown in PDF (toggle)

### Layout

Stack vertical de cards. Cada card es una sección.

Mobile: scroll vertical, cards full-width.

### Notas

- Tarifa eléctrica viene del scraper EPM (ya implementado en backend, `services/tariff_scraper.py`)
- Histórico: drawer derecho con lista de tarifas mensuales por estrato (tabla mini)
- Cualquier cambio dispara optimistic update + toast

---

## 8. Cost — Historial costos — `/cost/history` (HistoryPage)

**Propósito**: Historial de uso real de filamento / horas / costos por job impreso (post-print, no cotizaciones). Sirve para análisis retroactivo.
**Acceso**: usuario.
**Endpoints**: `getPrintHistory()` (TODO en backend).

### Layout

Similar al QueueHistoryPage (ver sección 15) — tabla por fecha con filtros + KPIs arriba.

KPIs:
1. Total impreso 30d (kg)
2. Costo real 30d ($)
3. Tiempo total 30d (h)
4. % de margen real (cotizado vs costo real)

Tabla:
```
Fecha | Cliente | Pieza | Material | Peso real | Tiempo real | Costo real | vs Cotizado
```

### Notas

- Esta página depende de tener data de jobs completados con costo real (queue marcando done con descuento real de filamento)
- KPI "% margen real" = `(cotizado - costo_real) / cotizado` — útil para detectar si los márgenes default están bien

---

## 9. Inventory — Pedidos de compra — `/inventory/purchases` (InventoryPurchasesPage)

**Propósito**: CRUD de órdenes de compra (PO) a proveedores. Tracking de status, ETA, contenido.
**Acceso**: usuario.
**Endpoints**: `getPurchaseOrders()`, `createPurchaseOrder()`, `updatePurchaseOrder()`, `deletePurchaseOrder()`, `markPurchaseOrderReceived(id)`.

### Modelo

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| id | int (auto) |  | PO-XXXX |
| supplier_name | string | * | proveedor |
| supplier_contact | string |  | email/tel/link |
| order_date | date | * | default today |
| expected_arrival | date |  | ETA |
| status | enum | * | `borrador` \| `procesando` \| `en camino` \| `completado` \| `cancelado` |
| tracking_number | string |  | guía |
| tracking_carrier | string |  | "Servientrega", "Coordinadora", etc. |
| total_amount | decimal |  | auto-calc desde items |
| items | array<PurchaseOrderItem> | * | mínimo 1 |
| notes | text |  |  |

`PurchaseOrderItem`:
| Campo | Tipo | Required | Notas |
|---|---|---|---|
| inventory_item_id | int |  | FK opcional (puede ser item nuevo) |
| name | string | * | nombre libre |
| quantity | decimal | * |  |
| unit | string | * | g, kg, unidades, etc. |
| unit_cost | decimal | * | COP |
| subtotal | decimal | auto |  |

### Layout desktop

Igual al "Compras" tab del Inventory v2 actual, pero con MÁS detalle. Use:

- KPI strip (#8B5CF6 morado): Total POs · En ruta · Completadas mes · Total invertido
- Tabs internos: Activas · Completadas · Borradores
- Grid de PurchaseCard (mismo componente del Inventory)
- DetailDrawer derecho con form completo de PO + line items

### Form drawer (FilamentFormDrawer pattern)

Tres secciones:
1. **Proveedor**: name *, contact, tracking_number, tracking_carrier
2. **Fechas y estado**: order_date *, expected_arrival, status *
3. **Items** (tabla editable, como en ManualQuotePage):
   - Cada row: select inventory item (opcional) + name * + quantity * + unit * + unit_cost * + subtotal (auto)
   - "+ Agregar ítem" al final
   - Total al pie

**Footer drawer**:
- Cancelar
- Guardar como borrador
- **Marcar como recibido** (verde, solo si status='en camino' y todos los items tienen inventory_item_id → al click descuenta cantidades del stock automáticamente)
- Eliminar (rosa, solo borradores)

### Estados

- `borrador`: amarillo info, editable
- `procesando`: amber, casi readonly
- `en camino`: azul (printing tone), tracking activo
- `completado`: verde (done), readonly
- `cancelado`: rojo (danger)

### Mobile

- MobileAppHeader (Inventario · Pedidos)
- Mini KPI strip (En ruta / Mes / Total invertido)
- Lista de PurchaseRow compacta (igual al mobile v2)
- FAB "+ Nueva orden"
- Sheet detail con form

### Notas

- **Marcar como recibido** es la acción crítica: dispara `POST /inventory/purchases/{id}/receive` que descuenta del stock y cambia status. Pedir confirmación.
- Si un item del PO NO tiene `inventory_item_id`, ofrecer "Crear item nuevo en inventario" inline antes de recibir
- Filtros desktop: por proveedor, por estado, por rango de fechas

---

## 10. Inventory — Disponible para venta — `/inventory/prints` (InventoryPrintsPage)

**Propósito**: Inventario de PIEZAS YA IMPRESAS listas para vender (productos terminados). Distinto del inventario de materia prima.
**Acceso**: usuario.
**Endpoints**: `getPrintedItems()`, `createPrintedItem()`, `updatePrintedItem()`, `deletePrintedItem()`, `markPrintedItemSold(id)`.

### Modelo `PrintedItem`

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| id | int (auto) |  |  |
| name | string | * | ej. "Soporte celular MagSafe" |
| description | text |  |  |
| sku | string |  | código interno opcional |
| quantity_available | int | * | cuántas tengo en stock |
| quantity_sold | int |  | acumulado vendidas |
| sale_price | decimal | * | COP precio venta |
| cost_basis | decimal |  | costo real de producción |
| photo_url | string |  | foto upload |
| filament_used_id | int |  | FK opcional |
| weight_g | decimal |  |  |
| print_time_h | decimal |  |  |
| tags | array<string> |  | ej. ["regalo", "estrella", "stock"] |
| created_at | date |  | desde cuándo está en stock |

### Layout desktop

```
[Header: breadcrumb Inventario › Disponible + button "+ Agregar producto"]
[KPIs 4-tiles (accent #3B82F6):
  - Total productos
  - Unidades disponibles
  - Valor de inventario ($ sale_price × qty)
  - Margen promedio (% sobre cost_basis)
]
[Toolbar: SearchField · tag filters (chips) · sort (más vendido / menos stock / valor)]
[Grid de PrintedItemCard]
```

### PrintedItemCard

```
┌──────────────────────────────┐
│ [foto 200×140 cover]         │
│ Soporte celular MagSafe      │
│ SKU: SOP-001                 │
│ ─────────────                │
│ Disponible:  12 u            │
│ Precio:      $ 22.000        │
│ Vendidas:    34 (total)      │
│ Margen:      45%             │
└──────────────────────────────┘
```

### Form drawer

Secciones:
1. **Producto**: name *, description, sku, photo, tags
2. **Stock**: quantity_available *, sale_price *, cost_basis
3. **Producción** (opcional): filament_used_id (select FK), weight_g, print_time_h

### Acciones rápidas

- **Marcar como vendida** (en card o detail): `+1 quantity_sold, -1 quantity_available`, dispara `POST /inventory/prints/{id}/sell` con qty
- **Imprimir más** (en detail): pre-llena queue con el job (necesita Vault link)

### Mobile

- Header (appName "Inventario", title "Disponible")
- Hero KPI (Valor de inventario)
- Grid 2-col cards con foto destacada
- FAB
- Sheet detail con foto big + form

### Notas

- "Tags" útiles para filtrar (regalos navidad, modelos populares, etc.)
- Si `quantity_available === 0`, badge "AGOTADO" rojo
- Margen calculado: `((sale_price - cost_basis) / sale_price) * 100`

---

## 11. Inventory — Importar / Exportar — `/inventory/io` (InventoryImportExportPage)

**Propósito**: Bulk operations sobre inventario. Export CSV completo. Import CSV/XLSX para carga masiva.
**Acceso**: usuario.
**Endpoints**: `exportInventoryCSV()` (returns blob), `importInventoryCSV(file)` (returns { created, updated, errors[] }).

### Layout (single, mobile + desktop similar)

```
[Header: breadcrumb Inventario › Importar / Exportar]

┌──── CARD EXPORTAR ─────────────────────────────┐
│ EXPORTAR INVENTARIO                            │
│                                                │
│ Descarga toda tu base como CSV editable en     │
│ Excel/Sheets. Útil para backup o auditoría.    │
│                                                │
│ [select: ☐ Filamentos · ☐ Insumos · ...]      │
│ [select: formato CSV · XLSX]                   │
│                                                │
│ [📥 Descargar (1.234 ítems · 87 KB)]          │
└────────────────────────────────────────────────┘

┌──── CARD IMPORTAR ─────────────────────────────┐
│ IMPORTAR DESDE CSV                             │
│                                                │
│ [DropZone .csv/.xlsx]                          │
│ "Suelta tu archivo aquí"                       │
│ "Plantilla: [descargar template]"              │
│                                                │
│ [Toggle: ☐ Sobrescribir existentes (por SKU)]  │
│                                                │
│ [Botón: Procesar archivo] (disabled hasta drop)│
└────────────────────────────────────────────────┘

[Si hay import en curso:]
┌──── RESULTADO ─────────────────────────────────┐
│ ▶ 145 ítems creados                            │
│ ⚠ 12 ítems actualizados                        │
│ ✖ 3 errores:                                   │
│   - Fila 23: filament_type "PXX" no existe     │
│   - Fila 47: weight_per_roll vacío             │
│   - Fila 89: color_hex "#GGGG" inválido        │
└────────────────────────────────────────────────┘
```

### Estados

- **Idle**: cards de export e import
- **Exporting**: spinner + "Generando CSV…"
- **Imported**: card de resultado con counts + errors expandibles
- **Error global**: toast rojo "No se pudo procesar"

### Notas

- DropZone primitive ya existe — usar con accent=#3B82F6
- Plantilla descargable = CSV vacío con headers correctos
- Errors van inline en una lista colapsable (no toast por cada uno)
- "Sobrescribir por SKU" controla si UPDATE en match o INSERT siempre

---

## 12. Slicer — Detalle de job — `/slicer/jobs/:id` (SlicerJobDetailPage)

**Propósito**: Vista expandida de un slicing job con TODOS los detalles + plates breakdown + 3D preview opcional + acciones.
**Acceso**: usuario.
**Endpoints**: `getSlicingJob(id)`, `deleteSlicingJob(id)`.

### Status actual

El drawer del SlicerPage YA muestra la mayoría de info. Esta página dedicada es **opcional** — podría eliminarse y dejar todo en el drawer. Si se mantiene, debe agregar:

### Layout desktop (si se mantiene)

```
[Breadcrumb: Slicer › Job #042 · plate-23.gcode]
[Header con StatusPill + actions: "Usar en Calculadora · Re-laminar · Eliminar"]

┌────────────────┬─────────────────────────────────────┐
│ LEFT (300px)   │ CENTER (flex)                       │
├────────────────┼─────────────────────────────────────┤
│ Metadata       │ Preview                             │
│ - Fuente       │ [Tabs: Modelo · Capas · G-code]    │
│ - Created      │                                     │
│ - Size         │ ┌─────────────────────────────────┐ │
│ - Filament     │ │                                 │ │
│                │ │   [SVG/Canvas del preview]     │ │
│ Stats          │ │                                 │ │
│ - Time total   │ └─────────────────────────────────┘ │
│ - Weight       │                                     │
│ - Layer height │ Plates (si > 1)                     │
│ - Nozzle       │ ┌───┬───────┬───────┬──────────┐    │
│ - Bed temp     │ │ # │ Time  │ Wgt   │ Filam.   │    │
│ - Dimensions   │ ├───┼───────┼───────┼──────────┤    │
│                │ │ 1 │ 1h12m │ 145g  │ PLA Bla. │    │
│ Métricas       │ │ 2 │ 0h45m │ 98g   │ PLA Bla. │    │
│ - Density      │ └───┴───────┴───────┴──────────┘    │
│ - Filaments    │                                     │
│   used (multi) │                                     │
└────────────────┴─────────────────────────────────────┘
```

### Mobile

Stack vertical:
- MobileAppHeader (appName Slicer · title nombre del archivo · accent F59E0B)
- Preview hero card 200px
- Stats grid 2x3 cards
- Plates list (rows)
- Sticky action bar abajo (Usar en Calc + Eliminar)

### Notas

- Si NO hay backend para preview SVG → mostrar placeholder con icon `Layers`
- Re-laminar = enviar de nuevo al slicer con mismo input (re-run STL→OrcaSlicer)
- Considerar eliminar esta página y consolidar todo en el drawer del SlicerPage (decisión de scope)

---

## 13. Maintenance — Logs — `/maintenance/logs` (MaintenanceLogsPage)

**Propósito**: Historial completo de TODOS los logs de mantenimiento, filtrable por impresora, tipo, fecha. Cada log puede tener items de inventario consumidos.
**Acceso**: usuario.
**Endpoints**: `getMaintenanceLogs()`, `createMaintenanceLog()`, `updateMaintenanceLog()`, `deleteMaintenanceLog()`.

### Modelo `MaintenanceLog`

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| id | int |  |  |
| printer_id | int | * | FK MaintenancePrinter |
| performed_at | datetime | * | default now |
| maintenance_type | enum | * | 12 tipos del wiki BambuLab P2S (ver `config/maintenance.js`) |
| notes | text |  |  |
| items | array<MaintenanceLogItem> |  | inventory consumido |

`MaintenanceLogItem`:
- `inventory_item_id` * (FK)
- `quantity` * (decimal)
- `unit_cost_at_time` (snapshot)

### Layout desktop

```
[Header: breadcrumb Mantto › Logs + button "+ Registrar log"]
[KPIs (accent #8B5CF6):
  - Logs totales (mes)
  - Costo en consumos (mes, $)
  - Promedio entre logs por impresora (días)
  - Próximo programado
]
[Sticky toolbar:
  SearchField (notas)
  · Select impresora · Select tipo · Date range
  · Sort (recientes/costo)
]
[Tabla scroll:
  Fecha | Impresora | Tipo | Items consumidos | Costo | Notas (truncate)
]
[Pagination footer]
```

### Form drawer (FilamentFormDrawer pattern)

Secciones:
1. **Mantenimiento**: printer_id * (select), performed_at *, maintenance_type * (select 12 tipos)
2. **Items consumidos** (tabla editable):
   - Cada row: select inventory_item * + quantity * + unit * (autofill) + costo snapshot
   - "+ Agregar ítem"
   - Total al pie
3. **Notas**: textarea libre

### Mobile

- Header (appName "Mantenimiento", title "Logs")
- Mini KPIs (mes / costo / próximo)
- Lista de log rows compactas
- FAB "+ Registrar"
- Sheet detail con form

### Notas

- 12 tipos del wiki BambuLab P2S → ver `frontend/src/config/maintenance.js` (limpiar nozzle, cambiar pad heatbed, lubricar ejes Z, calibrar bed, etc.)
- Al guardar: descuenta atómicamente los items del inventario
- Cada tipo tiene un color sugerido (rojo crítico, amber periódico, verde rutina)

---

## 14. Maintenance — Impresoras — `/maintenance/printers` (MaintenancePrintersPage)

**Propósito**: Dashboard por impresora con tarjetas que muestran estado de cada tipo de mantenimiento (semáforo 🟢🟡🔴) y próximos vencimientos.
**Acceso**: usuario.
**Endpoints**: `getMaintenancePrinters()`, `createMaintenancePrinter()`, `updateMaintenancePrinter()`, `getMaintenanceStatusByPrinter(id)`.

### Modelo `MaintenancePrinter`

- `id`
- `printer_id` * (FK a `printers` de Cost app — puede haber diferentes)
- `name` (alias display)
- `installed_at` (date)
- `current_hours` (sync con `printer.current_hours`)
- `maintenance_schedule` (jsonb, intervalos por tipo)

### Layout desktop

```
[Header: breadcrumb Mantto › Impresoras + button "+ Registrar impresora"]
[Grid de PrinterCardLarge (accent #8B5CF6, foto si hay)]
```

### PrinterCardLarge

```
┌──────────────────────────────────────────────────┐
│ [foto/icon 80×80]   BambuLab P2S #1              │
│                     Instalada hace 6 meses       │
│                     1.234 / 5.000 h    [bar]     │
│ ───────────────────────────────────────────────  │
│ ESTADO POR TIPO                                  │
│                                                  │
│ 🟢 Boquilla 0.4mm    · 89 días sin cambio        │
│ 🟡 Pad heatbed       · vence pronto              │
│ 🔴 Lubricar ejes Z   · 45 días atrasado          │
│ 🟢 Calibración bed   · OK                        │
│ 🟢 ...                                           │
│                                                  │
│ [+ Registrar log para esta impresora]            │
└──────────────────────────────────────────────────┘
```

### Form drawer

Sección 1 — Impresora
- printer_id * (select desde Cost/Printers)
- name (alias)
- installed_at *

Sección 2 — Programación
- Por cada tipo de mantenimiento: intervalo en días/horas (default desde `maintenance.js`)

### Mobile

- Header (appName "Mantenimiento", title "Impresoras")
- Lista de impresoras cada una con su card grande (1-col)
- Sheet detail con la grilla de tipos

### Notas

- Semáforos calculados: `dias_desde_ultimo_log_de_ese_tipo` vs `intervalo_configurado`
  - 🟢 verde = <80% del intervalo
  - 🟡 amber = 80-100%
  - 🔴 rojo = >100% (overdue)
- Click en un tipo → drawer mini con últimos 5 logs de ese tipo en esa impresora
- "+ Registrar log" prefilled con printer_id

---

## 15. Queue — Historial — `/queue/history` (QueueHistoryPage)

**Propósito**: Lista de jobs completados / cancelados con cálculo del costo real (filamento descontado, horas reales, consumibles usados). Análisis retroactivo.
**Acceso**: usuario.
**Endpoints**: `getQueueHistory()`, `getQueueItem(id)`.

### Modelo `PrintQueueItem` (status = done|cancelled)

Ya conocido del Queue v2 actual:
- `id`, `quote_id` (FK SET NULL), `status`, `position`, `started_at`, `completed_at`
- `printer_id`, `filament_id`, `weight_grams`, `time_seconds`
- `supplies_detail` jsonb, `additional_filaments_detail` jsonb
- `outcome_notes` (texto del operador)

### Layout desktop

```
[Header: breadcrumb Cola › Historial]
[KPIs accent #14B8A6:
  - Completados mes
  - Cancelados mes (warn si >5)
  - Tiempo total mes
  - Costo real total mes
]
[Sticky toolbar:
  SearchField · select impresora · status filter (done/cancelled/all) · date range
]
[Tabla:
  Fecha | Cliente / pieza | Impresora | Filamento | Peso real | Tiempo real | Status | Costo
  click row → DetailDrawer
]
```

### DetailDrawer body

- Hero: status pill + nombre pieza + cliente
- Stats grid: Started/Completed times, duración real, peso real consumido, filamento usado
- Lista de adicionales: insumos consumidos + multi-filamentos
- Outcome notes (textarea, editable)
- Footer: "Usar en Calculadora con datos reales" (carga calc con datos reales)

### Mobile

- Header
- KPIs strip mini (3 tiles)
- Lista de rows con date + nombre + status pill
- Sheet detail con stats

### Estados

- `done`: tone done (verde)
- `cancelled`: tone danger (rojo)

### Notas

- Comparativa con cotización: si `quote_id` existe, mostrar "Cotizado $X vs Real $Y · Δ %" en el card/row
- Outcome notes editable = el operador puede agregar notas post-print

---

## 16. Company — Perfil de empresa — `/company/profile` (CompanyProfilePage)

**Propósito**: Editar datos de la compañía (singleton): nombre, logo, NIT, contacto. Aparece en headers de PDF de cotizaciones.
**Acceso**: **admin**.
**Endpoints**: `getCompany()`, `updateCompany(data)`, `uploadCompanyLogo(file)`.

### Modelo `Company` (singleton, UUID fijo)

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| name | string | * | razón social |
| trade_name | string |  | nombre comercial (display) |
| logo_url | string |  | upload |
| tax_id | string | * | NIT |
| tax_regime | enum |  | "responsable de IVA" / "no responsable" / "régimen simple" |
| address | string |  |  |
| city | string |  | default "Medellín" |
| country | string |  | default "Colombia" |
| phone | string |  |  |
| email | string |  |  |
| website | string |  |  |
| pdf_terms | text |  | términos de pago para pie de PDF |

### Layout

Form simple en una columna (max-width 720px). Una sección "Datos generales" + una "Contacto".

```
[Header: breadcrumb Compañía › Perfil]
[Card con form max-w-3xl mx-auto:
  SECCIÓN — Datos generales
  - Logo (upload box 200×200 con preview)
  - Razón social *
  - Nombre comercial
  - NIT *
  - Régimen tributario (select)

  SECCIÓN — Contacto
  - Email
  - Teléfono
  - Website
  - Dirección
  - Ciudad
  - País

  SECCIÓN — Documentos
  - Términos de pago (textarea, aparece en pie de PDF)

  [Cancelar]  [Guardar cambios]
]
```

### Mobile

Mismo layout pero stack natural, sin max-width. Sticky save button.

### Estados

- Loading inicial
- Saving (button "Guardando…" disabled)
- Toast success al guardar
- Si NO hay company creada (primera vez): mensaje "Configura tu empresa para empezar"

### Notas

- Logo: arrastra-y-suelta con preview. Acepta png/jpg/webp.
- Validación: NIT formato Colombia (números + DV opcional)
- Cambios se reflejan inmediatamente en PDFs siguientes

---

## 17. Company — Marca & Colores — `/company/branding` (CompanyBrandingPage)

**Propósito**: Editar la paleta de colores que usa WeasyPrint en los PDFs (accents, headers, líneas, fondos).
**Acceso**: **admin**.
**Endpoints**: `getCompany()`, `updateCompanyPalette(palette)`.

### Modelo

`Company.pdf_palette` (jsonb): array de `{ name: string, hex: string }`. Ej:
```json
[
  { "name": "primary", "hex": "#2DD4BF" },
  { "name": "accent", "hex": "#F59E0B" },
  { "name": "text", "hex": "#0F1219" },
  { "name": "muted", "hex": "#94A0AE" }
]
```

### Layout desktop

```
[Header: breadcrumb Compañía › Marca & Colores]

┌──── PALETA ──────────────────┐  ┌──── PREVIEW PDF ─────────────┐
│ [name primary]  [hex] [swatch]│ │                              │
│ [name accent ]  [hex] [swatch]│ │  [render iframe del PDF      │
│ [name text   ]  [hex] [swatch]│ │   con paleta aplicada]       │
│ ...                          │ │                              │
│                              │ │                              │
│ [+ Agregar color]            │ │                              │
│                              │ │                              │
│ [Restablecer paleta]         │ │                              │
│ [Guardar paleta]             │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘
```

### Color row

```
┌────────────────────────────────────────────────────┐
│ [drag-handle]  [name input]  [#hex input]  [picker]  [×]│
└────────────────────────────────────────────────────┘
```

### Mobile

- Layout 1-col, no preview lado a lado (preview abajo)
- Cada color es un row full-width

### Notas

- Drag para reordenar
- Preview es un iframe que pide al backend renderizar una mock quote con la paleta — debounce 500ms al editar
- WeasyPrint NO soporta flex/grid → el preview es real renderizado
- "Restablecer" carga la paleta default del CFS (teal/amber/black/steel)

---

## 18. Company — Templates PDF — `/company/templates` (CompanyTemplatesPage)

**Propósito**: Lista de templates Liquid HTML para cotizaciones. Marca uno como `is_default` (se usa al descargar PDF).
**Acceso**: **admin**.
**Endpoints**: `getCompanyTemplates()`, `createCompanyTemplate(data)`, `deleteCompanyTemplate(id)`, `setDefaultCompanyTemplate(id)`.

### Modelo `CompanyTemplate`

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| id | int |  |  |
| name | string | * | ej. "Cotización formal v2" |
| description | text |  |  |
| html_liquid | text | * | Liquid HTML body |
| is_default | bool |  | solo 1 puede ser true |
| created_at | datetime |  |  |
| updated_at | datetime |  |  |

### Layout desktop

```
[Header: breadcrumb Compañía › Templates + button "+ Nuevo template"]
[Grid de TemplateCard]
```

### TemplateCard

```
┌──────────────────────────────────────┐
│ [DEFAULT ★]                          │ ← StatusPill done si is_default
│ Cotización formal v2                 │
│ Plantilla con logo grande y términos │
│ ─────────────────────────────────    │
│ Editado hace 3 días                  │
│ 2.3 KB                               │
│                                      │
│ [Editar] [Preview] [Default] [×]     │
└──────────────────────────────────────┘
```

### Mobile

Lista de template rows, FAB "+ Nuevo".

### Notas

- "Preview" abre un drawer derecho con render PDF en iframe
- "Default" marca este como activo (deshace el anterior)
- Eliminar pide confirmación
- Click card → navega a editor (siguiente)

---

## 19. Company — Editor de template — `/company/templates/new` o `/:id` (CompanyTemplateEditorPage)

**Propósito**: Editor de código Liquid HTML con preview PDF lado a lado en vivo.
**Acceso**: **admin**.
**Endpoints**: `getCompanyTemplate(id)`, `validateCompanyTemplate(html)`, `previewCompanyTemplate(html)`.

### Layout desktop (3-zone)

```
[Header: breadcrumb Compañía › Templates › [nombre] + actions:
  ← Volver  ·  Guardar  ·  Marcar como default  ·  Eliminar (rosa)
]

┌────────────────┬──────────────────┬─────────────────────────────────┐
│ LEFT (260px)   │ CENTER (flex)    │ RIGHT PREVIEW (480px)           │
├────────────────┼──────────────────┼─────────────────────────────────┤
│ Metadata       │ Code editor      │ ┌─────────────────────────────┐ │
│ - Name *       │ (Monaco/CodeMirror│ │                             │ │
│ - Description  │  con Liquid       │ │   [iframe PDF preview]      │ │
│                │  syntax highlight)│ │                             │ │
│ Variables      │                  │ │                             │ │
│ disponibles:   │ {{ company.name }}│ │                             │ │
│ - company.*    │ ...               │ │                             │ │
│ - quote.*      │                  │ │                             │ │
│ - items[]      │ [+ Liquid help]  │ │                             │ │
│ - terms        │                  │ └─────────────────────────────┘ │
│                │                  │  [Refresh preview]              │
│ [Sample data]  │                  │                                 │
└────────────────┴──────────────────┴─────────────────────────────────┘

[Footer fijo: validación errors si los hay]
```

### Modelo

`html_liquid` * — código Liquid + HTML. Validación server-side: `POST /api/company-templates/validate { html }` → `{ ok: true }` o `{ errors: [...] }`.

### Estados

- **Editor**: live edit, debounce 800ms para validar + regenerar preview
- **Validation errors**: pintar inline en editor (línea + mensaje)
- **Preview loading**: spinner sobre iframe mientras se regenera
- **Preview error**: mensaje "WeasyPrint rechazó: {detalle}"

### Mobile

NO recomendado en mobile — pero mínimo:
- Solo editor full-screen
- Botón "Preview" abre full-screen el iframe
- Sin lado a lado

### Notas

- Liquid help: drawer derecho con cheatsheet de variables disponibles + ejemplos
- "Sample data" en left rail: muestra un objeto JSON mock que se usa para el preview (toggle para editar)
- WeasyPrint constraints: NO usa flex/grid/position:absolute → debe haber un linter inline que advierta
- Si edita el template DEFAULT → warning amber "este es el template default — los próximos PDFs usarán esta versión"
- Auto-save cada 30s a borrador local (localStorage, no commit al backend hasta "Guardar")

---

## 20. Vault — Upload .3mf — `/vault/upload` (VaultUploadPage)

**Propósito**: Subir un archivo `.3mf` al Vault con metadata. Solo admin.
**Acceso**: **admin**.
**Endpoints**: `uploadVaultFile(file, metadata)`.

### Modelo `ModelFile`

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| name | string | * | display |
| file (binario) | .3mf | * | min 1KB, max 50MB |
| description | text |  |  |
| creator_name | string |  | quien diseñó el modelo |
| source_url | string |  | link al original (MakerWorld, etc.) |
| source_platform | enum |  | MakerWorld, Printables, Thingiverse, Propio |
| tags | array<string> |  |  |
| filament_recommendation | string |  | ej. "PLA Negro" |

### Layout (single, mobile + desktop similar)

```
[Header: breadcrumb Vault › Subir + button "← Volver al Vault"]

┌──── DROPZONE GIGANTE (max-w-3xl) ───────────────┐
│                                                 │
│   [Icon Upload 48px]                            │
│   "Suelta tu archivo .3mf aquí"                 │
│   "o pulsa para seleccionar"                    │
│   "max 50 MB"                                   │
│                                                 │
└─────────────────────────────────────────────────┘

[Si archivo seleccionado, mostrar form:]
┌──── METADATA ────────────────────────────────────┐
│ SECCIÓN — Identificación                         │
│ - Name * (autofill desde filename)               │
│ - Description                                    │
│                                                  │
│ SECCIÓN — Origen                                 │
│ - Creator name                                   │
│ - Source URL                                     │
│ - Source platform (select)                       │
│                                                  │
│ SECCIÓN — Tags                                   │
│ - Tags input (chips, "+ tag")                    │
│ - Filament recommendation                        │
│                                                  │
│ [Preview thumbnail extraído del .3mf si hay]     │
│                                                  │
│ [Cancelar]  [⬆ Subir y agregar al Vault]        │
└──────────────────────────────────────────────────┘

[Si upload en curso:]
[ProgressBar verde teal 0-100%]
```

### Estados

- **Idle**: solo dropzone
- **Selected**: dropzone colapsada + form abajo
- **Uploading**: ProgressBar + button disabled "Subiendo…"
- **Success**: redirige a `/vault` con toast "Modelo {name} agregado"
- **Error**: mantiene form + toast rojo

### Mobile

Mismo flujo pero stack vertical, sin max-width.

### Notas

- DropZone primitive con accent #F43F5E (vault rose)
- Extracción de thumbnail del ZIP `.3mf` ya está en backend (`thumbnail_extractor.py`) — mostrar preview si la respuesta lo trae
- Tags: chips editables, autocomplete desde tags existentes
- Validación: file ext `.3mf` only, size ≤ 50MB
- Solo admin → si user no es admin, redirect a /vault con toast

---

## 21. Settings — Empresa — `/settings/company` (EmpresaPage)

**Propósito**: ¿Duplicado con `/company/profile`? Necesita clarificación. Si son la misma cosa → eliminar uno. Si son distintos (`/company/profile` es display público y `/settings/company` es admin interno), entonces:
**Acceso**: **admin**.
**Endpoints**: similares a CompanyProfilePage.

### Decisión sugerida

**Consolidar** en `/company/profile` y eliminar `/settings/company` de la sidebar Settings. Mantener solo en sidebar Compañía.

Si NO se consolida, diseñar idéntico al CompanyProfilePage pero con eyebrow "Settings · Empresa" y skin más administrativo.

### Notas

- Esta página probablemente es legacy del settings.jsx anterior — confirmar con Giomar si se mantiene o se borra
- Si se borra: actualizar `App.jsx` para que `/settings/company` redirija a `/company/profile`

---

## 22. Settings — Usuarios — `/settings/users` (UsuariosPage)

**Propósito**: Gestión de usuarios + roles (admin/operator/viewer). Crear, editar, desactivar, asignar rol.
**Acceso**: **admin**.
**Endpoints**: `getUsers()`, `updateUser(id, data)`, `deactivateUser(id)`, `resendInvite(id)`.

### Modelo `User`

| Campo | Tipo | Required | Editable | Notas |
|---|---|---|---|---|
| id | uuid |  | no |  |
| username | string | * | no | viene de OIDC |
| email | string | * | no | viene de OIDC |
| full_name | string |  | no | viene de OIDC |
| role | enum | * | sí | admin / operator / viewer |
| is_active | bool |  | sí | desactivar bloquea login |
| oidc_sub | string | * | no | unique |
| last_login | datetime |  | no |  |
| created_at | datetime |  | no |  |

### Layout desktop

```
[Header: breadcrumb Settings › Usuarios + count "5 activos / 7 total"]
[Toolbar: SearchField · select role · toggle "incluir inactivos"]
[Tabla:
  Avatar | Username | Email | Rol | Last login | Status | Acciones
  giomar | ⭐ ADMIN | giomar@... | admin | hace 5m | ● ACTIVO | [Editar] [...]
  ana | OPERATOR  | ana@...    | oper. | hace 1d | ● ACTIVO | [Editar] [...]
]
```

### Form drawer (al click row o "+ Nuevo")

**Nota**: NO se pueden crear users desde el frontend — el JIT provisioning crea automáticamente al primer login OIDC. Esta página solo EDITA users existentes.

Secciones:
1. **Identidad** (readonly): username, email, full_name, oidc_sub
2. **Permisos**: role (select admin/operator/viewer)
3. **Estado**: is_active (toggle)
4. **Auditoría**: last_login, created_at

### Mobile

- Header
- Lista de user rows compactos (avatar + name + role + status pill)
- Sheet detail con form

### Estados

- ● ACTIVO (verde)
- ◯ INACTIVO (gris, opacity 60%)
- Role badges con StatusPill:
  - admin → `tone="danger"` (rojo) o `info` (morado, más enterprise)
  - operator → `tone="printing"` (azul)
  - viewer → `tone="neutral"`

### Notas

- El user actual NO puede cambiarse a sí mismo el role (evitar lock-out)
- Desactivar pide confirmación "¿Bloquear acceso de {username}?"
- Si admin único existente quiere bajarse de rol → error "debe haber al menos 1 admin"
- "Resend invite" solo aplica si OIDC tiene auto-onboarding (probablemente no se necesita en CFS)

---

# Resumen / matriz de prioridad

| # | Pantalla | Acceso | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Login | público | S | **alta** |
| 2 | Cost — Cotizaciones | usuario | M | **alta** |
| 3 | Cost — Calculadora | usuario | L | **alta** (núcleo del negocio) |
| 4 | Cost — Nueva cotización | usuario | M | alta |
| 5 | Cost — Cotizaciones (historial Quote) | usuario | S | media (puede fusionarse con #2) |
| 6 | Cost — Impresoras | usuario | M | media |
| 7 | Cost — Tarifa & ajustes | usuario | M | media |
| 8 | Cost — Historial costos | usuario | M | baja (depende de backend) |
| 9 | Inventory — Pedidos compra | usuario | M | media |
| 10 | Inventory — Disponible venta | usuario | M | baja |
| 11 | Inventory — Import/Export | usuario | S | baja |
| 12 | Slicer — Detalle job | usuario | S | baja (puede eliminarse) |
| 13 | Maintenance — Logs | usuario | M | media |
| 14 | Maintenance — Impresoras | usuario | M | media |
| 15 | Queue — Historial | usuario | M | media |
| 16 | Company — Perfil | admin | S | alta (necesario para PDFs) |
| 17 | Company — Branding | admin | M | media |
| 18 | Company — Templates | admin | S | media |
| 19 | Company — Editor template | admin | L | baja (3-col code editor complejo) |
| 20 | Vault — Upload | admin | S | media |
| 21 | Settings — Empresa | admin | — | **decidir si se elimina o se mantiene** |
| 22 | Settings — Usuarios | admin | S | media |

Esfuerzo: S (~150 líneas), M (~400 líneas), L (~800+ líneas).

---

# Convenciones del proyecto que debes respetar

- **Español en todo** — labels, copy, comentarios, commits.
- **Layout mobile-first responsive**: hook `useIsMobile()` cortando en 1024px. Cada pantalla decide su layout según ese hook.
- **Tokens CSS exclusivos** — no hard-codear hex fuera de los listed en sección 0.1.
- **Mono font (`JetBrains Mono`)** para números, IDs, fechas, codes. Sans (`Space Grotesk`) para resto.
- **NO usar `flex` o `grid`** en código que vaya a WeasyPrint (templates Liquid PDF). Usar `<table>`.
- **Forms**: siempre el patrón FilamentFormDrawer (drawer derecho desktop / sheet mobile).
- **Lists**: siempre con sticky toolbar arriba (search + filtros + count).
- **Empty states**: usar EmptyState v2 con accent del app.
- **Status badges**: usar StatusPill con tone semántico, no inventar colores.
- **Action buttons primarios**: teal por default (forge-teal #2DD4BF). Excepciones por app accent si aplica.
- **Drag handles**: usar `GripVertical` lucide, opacity 0 default → 60 on hover.
- **Toast**: `react-hot-toast`, top-right, success teal / error rose.

---

# Outputs esperados de tu trabajo

Por cada pantalla que diseñes, entrega:

1. **Archivo JSX inline-styled** (`claude design/<screen>.jsx` + `<screen>-mobile.jsx`) — mismo patrón que `inventory.jsx`/`inventory-mobile.jsx`.
2. **HTML preview standalone** (`claude design/<Screen>.html` + `<Screen> móvil.html`) que cargue el .jsx con React UMD — mismo patrón que `Inventario.html`.
3. **Screenshot** (`claude design/screenshots/<screen>.png` y `<screen>-m.png`).
4. **Comentarios JSDoc en español** en los componentes principales.

Si necesitas data fixtures, agrégalas a `claude design/data.jsx`.
Si creas un primitive nuevo reutilizable, agrégalo a `claude design/components.jsx` y avisa.

Cualquier duda, comenta inline en el .jsx con `// TODO: confirmar con Giomar — ...`.
