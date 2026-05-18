# Propuesta de UI inspirada en Bambuddy

> **Objetivo**: traer a Collector's Forge Studio (CFS) la ergonomía y densidad de información de [Bambuddy](https://github.com/maziggy/bambuddy), **sin** replicar su profundidad de features (telemetría MQTT, cámaras, AMS, etc.). Foco: navegación, layout, dashboards, atajos y feedback visual.

**Fecha**: 2026-05-13
**Autor**: Giomar + Claude
**Estado**: ✅ **EJECUTADO** — propuesta aprobada con ajustes (2026-05-13) y completada en mayo 2026. Las "Fases" referenciadas abajo son las de esta propuesta original, no las fases del plan de port a Claude Design v2 (que vivió en `status.md` hasta su limpieza post-implementación). El plan v2 también está completo: hoy la app no tiene cicatriz V1/V2, las rutas son canónicas (`/inventory`, `/cost`, `/queue`, etc.) y las pages V1 ya no existen.

## Decisiones tomadas

1. ✅ **Mantener paleta CFS** (`forge-teal #2DD4BF`, `forge-black`, `tech-white`, `steel`, `gunmetal`). No adoptar `bambu-green`.
2. ✅ **Adoptar el layout de bambuddy** (sidebar unificada con drag&drop + badges + colapsable). Reemplaza los 8 layouts por app actuales **de golpe** en fase 2.
3. ✅ **Thumbnails reales del modelo en Vault**: extraer `Metadata/plate_N.png` del `.3mf` en lugar de depender de `thumbnail_url` de MakerWorld. Backfill **automático** en deploy. Sección [§3.11](#311-thumbnails-reales-de-modelos-vault--slicer).
4. ✅ **Sin atajos de teclado**. Sección §3.5 eliminada.
5. ✅ **Orden de apps en sidebar**: igual al `config/apps.js` actual (Cost → Archive → Slicer → Maintenance → Queue → Vault → Company).
6. ✅ **Widgets dashboard**: orden por defecto = Cola → Stock bajo → Cotizaciones → Mantenimiento.

---

## 1. Resumen ejecutivo

Bambuddy hace tres cosas muy bien que CFS aún no:

1. **Una sola sidebar global**, reordenable, con badges en vivo y atajos `1..9`.
2. **Dashboards reconfigurables** por widget (drag, resize 1/4 · 1/2 · full, ocultar).
3. **Feedback ambiental persistente**: banner de update, alertas modales, toasts, hover cards.

CFS hoy:
- Sidebar **por app** (7 layouts) + `AppSwitcherDrawer` que obliga a 2 clics para cambiar de área.
- Sin dashboard real (`StudioHomePage` es un launcher estático).
- Sin atajos de teclado, sin toasts globales, sin badges en navegación.

**Propuesta**: adoptar el modelo bambuddy de sidebar único + dashboards modulares + sistema de notificaciones, conservando paleta `forge-*` y la separación lógica por app (Cost / Archive / Slicer / Queue / Vault / Maintenance / Company).

---

## 2. Comparativa rápida

| Área | Bambuddy | CFS actual | Acción propuesta |
|------|----------|-----------|------------------|
| Sidebar | Unificada, drag&drop, persistida en `localStorage`, badges | 7 layouts, switcher modal | **Adoptar bambuddy 1:1** (estructura) con paleta CFS |
| Thumbnails Vault | Plate render del `.3mf` (`Metadata/plate_N.png`) | URL de MakerWorld (genérico/null) | **Extraer del ZIP** + fallback a URL externa |
| Atajos | `1..9` → navegación, `?` → help | Ninguno | ❌ Descartado |
| Home | Dashboard con widgets dnd-kit, resize, ocultables | Launcher de cards estático | **Convertir** a dashboard |
| Badges | Cola pendiente, uploads, "clear plate" en sidebar | — | Cola pendiente + alertas mantenimiento |
| Notifs | Toast + modal + banner update | `ConfirmDialog` solo | **Agregar** ToastContext global |
| Tema | Toggle dark/light persistente | Solo dark hardcoded | **Postergar** (no prioritario) |
| i18n | i18next, multi-idioma | Solo es-CO | **Postergar** |
| Drawer móvil | Slide-in con backdrop | Hamburger básico | Mejorar gestos |
| Comando rápido | `?` modal con shortcuts | — | ❌ Descartado |
| Estado dirty | — | `DirtyStateContext` ya existe | Mantener, integrar a sidebar nueva |

---

## 3. Cambios concretos por componente

### 3.1 Sidebar global (`AppLayout` → `StudioSidebar`)

**Decisión**: portar el `Layout.tsx` de bambuddy directamente, traducir a `.jsx`, swap de paleta. Mantener estructura: aside fijo + drawer compact en mobile + sección de íconos al pie + drag&drop con `GripVertical`.

**Antes**: cada app monta su propio `AppLayout` con `navItems` distinto. Cambiar de Cost a Inventory = abrir AppSwitcherDrawer + click + remontaje del layout.

**Después**: una sola sidebar con **secciones colapsables** por app + items planos:

```
┌──────────────────────────┐
│ [Logo]  CFS              │
├──────────────────────────┤
│ ▼ Cost                   │
│   • Calculadora          │
│   • Manual               │
│   • Historial            │
│   • Configuración        │
│ ▼ Archive          ●2    │  ← badge stock bajo
│   • Stock                │
│   • Filamentos           │
│   • Insumos              │
│   • Compras              │
│ ▶ Slicer                 │  ← colapsada
│ ▶ Maintenance      ●1    │  ← mantenimiento vencido
│ ▶ Queue            ●5    │  ← cola pendiente
│ ▶ Vault                  │
│ ▶ Company                │
├──────────────────────────┤
│ ⚙ Configuración          │
│ 👤 giomar  ⏻             │
└──────────────────────────┘
```

- Orden por defecto = `config/apps.js` actual: Cost → Archive → Slicer → Maintenance → Queue → Vault → Company.
- Cada sección recuerda su estado expandido/colapsado en `localStorage`.
- Drag&drop para reordenar **apps** (no items internos).
- Indicador de app activa con el color del app (`forge-teal`, `#3B82F6`, etc.).

**Mapeo de clases bambuddy → CFS**:

| Bambuddy | CFS |
|----------|-----|
| `bg-bambu-dark-secondary` | `bg-[#0A0E16]` (mismo `forge-black-secondary`) |
| `bg-bambu-dark-tertiary` | `bg-[#222630]` |
| `bg-bambu-green` (activo) | `bg-forge-teal/15 text-forge-teal` |
| `text-bambu-gray-light` | `text-steel` |
| `text-bambu-gray` | `text-gunmetal` |
| `border-bambu-dark-tertiary` | `border-[#222630]` |
| Logo `bambuddy_logo_dark` | `/logo.png` CFS |

**Archivos a tocar**:
- Nuevo: `frontend/src/components/StudioSidebar.jsx` (port directo de `Layout.tsx`)
- Reemplazar: `AppLayout.jsx` (queda como wrapper delgado + `<Outlet />`)
- Eliminar: `CostLayout.jsx`, `InventoryLayout.jsx`, `SlicerLayout.jsx`, `QueueLayout.jsx`, `MaintenanceLayout.jsx`, `CompanyLayout.jsx`, `VaultLayout.jsx`, `SettingsLayout.jsx`
- Conservar: `AppSwitcherDrawer.jsx` deprecado (puede eliminarse en fase 2)

### 3.2 Studio Home → Dashboard real

**Antes**: `StudioHomePage.jsx` = grid de 8 cards estáticas que solo enlazan.

**Después**: dashboard con widgets reconfigurables (basado en `@dnd-kit/sortable`):

Widgets propuestos (orden por defecto = prioridad):
1. **Cola activa** — siguientes 3 items + botón "Marcar impreso" *(default visible)*
2. **Stock bajo** — items debajo de mínimo (count + lista top 5) *(default visible)*
3. **Cotizaciones recientes** — últimas 5 con monto + cliente *(default visible)*
4. **Mantenimiento pendiente** — badges 🟢🟡🔴 por impresora *(default visible)*
5. **Tarifa EPM actual** — estrato 4 USD/kWh + edad del scrape *(oculto por defecto)*
6. **Tasa USD→COP** — mercado + markup *(oculto por defecto)*
7. **Horas impresora** — current_hours / lifespan con barra *(oculto por defecto)*
8. **Atajos rápidos** — "Nueva cotización", "Slice modelo", "Registrar mantenimiento" *(oculto por defecto)*

Cada widget:
- Tamaño 1/4, 1/2 o full (click cicla)
- Drag handle (`GripVertical`)
- Ocultable (ojo)
- Persistido en `localStorage` por usuario

**Archivos**:
- Reescribir: `frontend/src/pages/StudioHomePage.jsx`
- Nuevo: `frontend/src/components/Dashboard.jsx` (motor genérico)
- Nuevo: `frontend/src/components/widgets/` (carpeta con 8 archivos)
- Dependencia: `@dnd-kit/core` + `@dnd-kit/sortable` (ya existen en bambuddy, agregar a CFS)

### 3.3 Sistema de notificaciones (Toast)

**Antes**: `ConfirmDialog` modal para acciones destructivas, `alert()` o `console.error` para errores.

**Después**:
- `ToastContext` global con `showToast(message, 'success'|'error'|'info'|'warning')`
- Posición bottom-right, stack de hasta 5, auto-dismiss 4s (configurable)
- Reemplazar todos los `alert()` y mensajes inline temporales

**Archivos**:
- Nuevo: `frontend/src/context/ToastContext.jsx`
- Nuevo: `frontend/src/components/Toast.jsx`
- Tocar: `App.jsx` (wrap con ToastProvider)
- Migrar: páginas con feedback inline (Calculator, Settings, etc.)

### 3.4 Badges en sidebar

Calculados con React Query con `refetchInterval` corto (5s para cola, 60s para stock):

| Badge | Fuente | Color |
|-------|--------|-------|
| Cola | `GET /api/queue/?status=pending` count | amber |
| Stock bajo | items con `current_stock < min_stock` | rojo |
| Mantenimiento | impresoras con tipo 🔴 (vencido) | rojo |

Diseño: círculo de 18px en esquina superior derecha del ícono, `99+` si excede.

### 3.5 ~~Atajos de teclado~~ — descartado

No se implementan. Solo `Esc` para cerrar modales (ya existe).

### 3.6 Update banner

Bambuddy chequea `/api/version` vs `/api/check-updates` cada hora. CFS no tiene versionado interno aún.

**Propuesta mínima**: banner persistente cuando el commit SHA del backend ≠ SHA cacheado en frontend (se invalida tras deploy CI/CD). Solo en `main`, dismiss por sesión.

**Postergable** — no bloqueante.

### 3.7 Breadcrumb mejorado

Ya existe `Breadcrumb.jsx`. Mejorar:
- Agregar ícono del app actual
- Última ruta como `<span>` no clickeable
- Mostrar contexto: ej. `Cost › Cotización › COT-0042`

### 3.8 Hover cards (FilamentHoverCard)

Bambuddy muestra mini-tooltip con color/marca/stock al pasar sobre un swatch. En CFS aplicar a:
- Selector de filamento en Calculator → tooltip con stock actual + color hex + costo/g
- Lista de items en QuotesPage → tooltip con desglose rápido

Componente nuevo: `frontend/src/components/HoverCard.jsx`

### 3.9 Empty states ilustrados

Ya existe `EmptyState.jsx`. Bambuddy tiene mensajes específicos por contexto. Acción: revisar las páginas que muestran "Sin datos" y asegurar:
- Ícono grande
- Mensaje en español tono casual
- CTA contextual ("Agregar primer filamento", "Subir primer modelo")

### 3.10 Search global (opcional)

Bambuddy no tiene cmdk pero CFS gana mucho con uno. **Postergar** a fase 2.

### 3.11 Thumbnails reales de modelos (Vault + Slicer)

**Problema**: hoy `ModelFile.thumbnail_url` en Vault apunta a la URL de portada de MakerWorld. Cuando:
- el modelo NO viene de MakerWorld (subido manual o desde Printables),
- MakerWorld responde con genérico/null,
- el archivo `.3mf` se renombra o el modelo se modifica post-slice,

→ se muestra placeholder o el logo BambuLab. Mal feedback visual.

**Cómo lo hace bambuddy** (`backend/app/services/archive.py:495-519`):

```python
def _extract_thumbnail(self, zf: zipfile.ZipFile):
    thumbnail_paths = []
    if self.plate_number:
        thumbnail_paths.append(f"Metadata/plate_{self.plate_number}.png")
    thumbnail_paths.extend([
        "Metadata/plate_1.png",
        "Metadata/thumbnail.png",
        "Metadata/model_thumbnail.png",
    ])
    for thumb_path in thumbnail_paths:
        if thumb_path in zf.namelist():
            self.metadata["_thumbnail_data"] = zf.read(thumb_path)
            self.metadata["_thumbnail_ext"] = ".png"
            break
```

OrcaSlicer/BambuStudio embeden render PNG por placa al guardar el `.3mf` — muestran el modelo con colores reales asignados a cada filamento. Es lo que se ve en la cola de la pantalla de la impresora.

**Propuesta CFS**:

1. **Backend — extraer al subir**:
   - En `routers/vault.py` (POST upload) y `services/slicer_parser.py` (al parsear `.3mf`/`.gcode.3mf`):
     - Abrir ZIP, buscar `Metadata/plate_{N}.png` (N = plate activa, fallback `plate_1.png`, luego `thumbnail.png`, `model_thumbnail.png`).
     - Si existe → guardar bytes en `/app/static/thumbnails/{model_file_id}.png`.
     - Set `ModelFile.local_thumbnail_path = "/static/thumbnails/{id}.png"`.
   - **No** sobrescribir `thumbnail_url` (MakerWorld) — son fuentes distintas.

2. **DB — migración**:
   - Nueva columna `model_files.local_thumbnail_path TEXT NULL`.
   - Alembic revision (descendiente de `h2i3j4k5l6m7`).

3. **Frontend — prioridad de display**:
   ```jsx
   const thumb = modelFile.local_thumbnail_path  // plate render (mejor)
              || modelFile.thumbnail_url          // MakerWorld
              || '/img/model-placeholder.svg';    // fallback
   ```
   - Aplicar en `VaultPage`, lista de `slicing_jobs`, y queue items.

4. **Backfill automático**: en el `lifespan` de FastAPI (`backend/app/main.py`), tras `create_default_data()`, lanzar tarea async que recorre `model_files WHERE local_thumbnail_path IS NULL`, abre el `.3mf` del MinIO, extrae thumbnail. Idempotente. Corre en cada arranque, no-op si nada falta. Background task → no bloquea el startup.

5. **Edge cases**:
   - `.gcode` puro (no ZIP) — no tiene PNG embed. Mantener fallback URL/placeholder.
   - `.3mf` solo modelo (sin slice) — no tiene `plate_N.png`. Mantener fallback.
   - PNG corruptas — try/except, log y skip.

**Archivos**:
- Backend: `backend/app/services/thumbnail_extractor.py` (nuevo, similar al `_extract_thumbnail` de bambuddy)
- Backend: tocar `routers/vault.py` upload handler
- Backend: tocar `services/slicer_parser.py` para slicing jobs
- Backend: nueva migración Alembic
- Frontend: `frontend/src/pages/vault/` (helper `getThumbnail()`)
- Frontend: `frontend/src/pages/slicer/HistoryPage.jsx`

---

## 4. Lo que **NO** se trae de bambuddy

- MQTT / WebSocket en vivo (no aplica — CFS no controla impresoras)
- Cámaras / stream / overlay
- AMS slots / spool management visual (CFS ya tiene su modelo)
- TimelapseEditor, GcodeViewer, ModelViewer (CFS tiene su propio ModelViewer3D)
- LDAP, OIDC providers UI (CFS usa Authentik externo)
- i18n multi-idioma (mantener es-CO)
- Smart plugs, virtual printers, MakerWorld browser (fuera de scope)
- 99 componentes — propuesta CFS = ~15 componentes nuevos

---

## 5. Plan de implementación (fases)

### Fase 1 — Foundation (1-2 días)
- [ ] Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [ ] Crear `ToastContext` + `Toast` + integrar en `App.jsx`
- [ ] Migrar 3-5 `alert()` → toast

### Fase 2 — Sidebar unificada (2-3 días)
- [ ] Construir `StudioSidebar.jsx` con secciones colapsables
- [ ] Adaptar `AppLayout.jsx` para usarla
- [ ] Eliminar los 8 layouts por app
- [ ] Agregar badges (cola, stock bajo, mantenimiento)

### Fase 3 — Dashboard (2-3 días)
- [ ] Motor `Dashboard.jsx` con drag/resize/hide
- [ ] 4 widgets prioritarios: Cola, Stock bajo, Cotizaciones, Mantenimiento
- [ ] Reescribir `StudioHomePage.jsx`
- [ ] Persistencia layout en `localStorage`

### Fase 4 — Thumbnails reales (1-2 días)
- [ ] `services/thumbnail_extractor.py` + tests
- [ ] Migración Alembic `local_thumbnail_path`
- [ ] Integrar en upload Vault + slicer parser
- [ ] Helper frontend `getThumbnail()` + actualizar 3 vistas
- [ ] Backfill auto en `lifespan` (background task idempotente)

### Fase 5 — Pulido (1 día)
- [ ] HoverCard para filamentos
- [ ] Breadcrumb con ícono
- [ ] Revisión de empty states

### Fase 6 — Opcional / postergable
- Update banner
- Search global (cmdk)
- Toggle dark/light
- 4 widgets restantes (EPM, USD, horas, atajos)

---

## 6. Riesgos / consideraciones

1. **Bundle size**: `@dnd-kit/*` agrega ~30KB gz. Aceptable.
2. **Mobile**: el sidebar único debe seguir cabiendo en drawer. La sección colapsada ayuda.
3. **DirtyState**: el actual `DirtyStateContext` advierte al cambiar de app. Con sidebar unificada hay que asegurar que cambiar de sección dispare el mismo warning.
4. **Tests frontend**: ResponsiveForms/Tables tests ya fallan por mocks; este refactor probablemente requiere actualizar fixtures de `api.js` mock.
5. **Migración gradual**: las fases son independientes — cada una puede entrar en su propio PR sin romper el resto.

---

## 7. Decisiones (cerradas)

- ✅ Paleta `forge-*` (no cambia a `bambu-green`)
- ✅ Layout bambuddy adoptado (port directo + swap de clases)
- ✅ Thumbnails reales del `.3mf` (sección 3.11)
- ✅ Eliminar los 8 layouts por app **de golpe** en fase 2 (sin fallback)
- ✅ Orden de apps en sidebar = `config/apps.js` actual
- ✅ Widgets prioritarios = Cola, Stock bajo, Cotizaciones, Mantenimiento (mismo orden)
- ✅ Sin atajos de teclado
- ✅ Backfill thumbnails automático en cada arranque del backend

---

## 8. Referencias

- Bambuddy repo: `/home/tavo/Documentos/Github/bambuddy`
- Sidebar bambuddy: `bambuddy/frontend/src/components/Layout.tsx`
- Dashboard bambuddy: `bambuddy/frontend/src/components/Dashboard.tsx`
- CFS layout actual: `frontend/src/components/AppLayout.jsx`
- CFS home actual: `frontend/src/pages/StudioHomePage.jsx`
