# Estado de trabajo — port Claude Design v2

**Última actualización**: 2026-05-17
**Working dir**: `/home/tavo/Documentos/Github/collectors-forge-studio`
**Main**: 37 PRs merged (último: #37 Fase 7 Settings v2). PRs abiertos esperando merge: #36 (stock fix por min_quantity) + #37 (Settings v2 con drawers).
**Próximo**: **Fase 9 — Eliminar TODA referencia a V1** (Fase 8 PAUSADA por decisión de Giomar). Ver sección "Fase 9" abajo para el plan completo.

---

## Lo que ya está en `main`

### Infraestructura

- **Fase 0 — Primitives v2** (PR #2): `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState` v2 — todos en `frontend/src/components/ui/`. `DetailDrawer` refresh con `eyebrow` + `footer` + `onEdit` props.
- **Sidebar v2** (PR #4): refactor 1:1 con `claude design/sidebar.jsx` — flat apps list (sin dropdown por app), accent left-bar en activo, sección secundaria con sub-items del app activo, gear ⚙️ en footer.
- **MobileAppHeader compartido** (PR #7): en `components/MobileAppHeader.jsx` — hamburger + eyebrow + título + search opcional + bell. Aplicado en las 7 apps v2.
- **AppLayout** (PR #6): mobile shell renderiza `StudioSidebar` como drawer + expone `openSidebar()` vía `useOutletContext()`.
- **StudioHomePage**: MobileAppHeader agregado a `/` (mobile).

### Inventory (Fase 1) — completo + iteraciones

PRs #3, #5, #6, #8, #12, #15, #16, #17, #21, #23, #24:

- 5 tabs internas (Filamentos, Insumos, Herramientas, Consumibles, Compras)
- KPIs desktop: Capital, Material, Consumo 14d (sparkline), Stock bajo, Próx. compras
- Mobile: hero status + mini KPI strip **siempre visibles** en todos los tabs
- Mobile header completo (hamburger + título dinámico + search + bell)
- FilamentRow mobile sin overflow (Xiaomi Mi 10T fix)
- FilamentCard grid + FilamentTable con `Color · Batch`, sort `lowFirst|recent|material|valueDesc|weightDesc`
- StatusPill para PO badges (en camino azul, procesando amber, completado verde, etc.)
- PurchaseCard con line item chips (≤6 + overflow indicator)
- EmptyState v2 reemplazando empty states inline (6 lugares)
- Drawer body con "Agregar a compras" + "Reasignar batch" INLINE (1:1 design)
- **`FilamentFormDrawer`**: drawer derecho desktop / bottom sheet mobile
  - Create + Edit modes con PUT/POST a `/inventory/items/`
  - 5 secciones: Identificación / Stock / Técnico / Proveedor & costo / Notas
  - Todos los campos del modelo + `sale_price` nuevo
  - **Precios de filamento en USD** (la calculadora los maneja así)
  - `fmtUSD()` formatter (`$25.00` con 2 decimales)
  - Optimistic update tras save (`filamentsRawById` cache local)
  - **`if (!open) return null`** — guard que previene drawer zombi
- **`ItemFormDrawer`** (NUEVO, PR #24) para Insumo/Herramienta/Consumible
  - Mismo patrón que FilamentFormDrawer
  - Secciones: Identificación / Stock / Costo & venta / Proveedor / Notas
  - Sección extra "Vida útil (h)" cuando `category=Consumible`
  - Wiring: mobile FAB / desktop + button / empty state / view drawer Pencil
- Removido link "Editar en vista clásica" del view drawer (último ref a UI vieja desde v2)
- **`sale_price` field** en TODAS las categorías (filamento: USD/kg; resto: COP/unidad)
  - Backend: nueva columna nullable + migración Alembic `k5l6m7n8o9p0`
  - Schemas Pydantic actualizados
- **Bug cursor jump FIXEADO** (PR #24): `FormFieldRow`/`FormSectionTitle` extraídos a module-level. Test REGRESIÓN-guard nuevo (`formFieldFocus.test.jsx`) documenta el bad/good pattern
- `DetailDrawer` + `MobileSheet` primitives ahora **`return null` cuando `open=false`** (fix bulletproof contra regresiones drawer-zombi)
- `DetailDrawer` usa **posicionamiento absoluto** (header/body/footer con `position:absolute` + alturas fijas) — bypass total de quirks flex/grid
- `DetailDrawer` + `MobileSheet` usan **`createPortal` a `document.body`** — evita bugs de `position:fixed` dentro de parents con `transform`
- 9 tests REGRESIÓN-guard nuevos garantizan que estos bugs no vuelven

### Queue (Fase 3) — visual refresh

PR #27:

- `statusBadge` → `{label, tone, icon}` apto para `StatusPill` (printing/done/danger/pending)
- `QueueCard` / `QueueRow` / `QueueDrawerBody` usan `StatusPill` (sin pills inline con hex hardcoded)
- Split `QueueDrawerBody` en cuerpo (info read-only) + `QueueDrawerFooter` (acciones primarias)
- `DetailDrawer` v2 con `eyebrow="COLA · POSICIÓN #N"` + `footer` slot (Iniciar / Marcar listo / Cancelar / Eliminar)
- `MobileSheet` con footer sticky inline (patrón Slicer/Filament)
- `EmptyState` v2 para "Cola vacía" / "Sin historial" (mobile + desktop)
- **PENDIENTE para Fase 5**: el botón "Agregar a cola" todavía navega a `/cost/quotes` (stub temporal). Debería abrir un picker de Vault que liste modelos con `.gcode.3mf` y los meta en cola con `weight_g` + `time_h` ya resueltos. Spec en `pending-screens.md` sección 20.1.

### Slicer (Fase 2) — visual refresh + nuevo upload inline

PR #13:

- `StatusPill` consistente (3 lugares: JobCard, JobRow, JobDrawerBody)
- `EmptyState` v2 reemplaza estados inline
- `DropZone` como hero del Upload tab (.3mf/.gcode/.stl)
- `DetailDrawer` con v2 API (eyebrow `JOB-XXXX` + footer slot con Calculator / Eliminar)
- `MobileSheet` con footer sticky inline
- **`SlicerUploadPanel` inline** — reemplaza al wizard externo `/slicer/upload`:
  - `.3mf / .gcode` → `uploadGcode(file)` (parse inmediato)
  - `STL` → `uploadStl(file)` (background OrcaSlicer)
  - MakerWorld URL → `fetchMakerworld(url)` (auto-fetch)
- Mobile FAB → `setTab('subir')` (no más nav externa)
- Desktop header "Subir modelo" → button con `setTab`
- Sidebar item `/slicer/upload` → quitado

### Deploy

Múltiples PRs (#9, #10, #11, #14, #18, #19, #20):

- `--no-cache --pull=always` en frontend podman build
- `npm ci --ignore-scripts` (husky aborta sin .git en container)
- `rm -rf node_modules` ANTES de `npm ci` (descarta contaminación host)
- `COPY . .` antes de `npm ci` (un solo layer cacheable)
- `podman rmi -f cfs-frontend` + `image prune --filter label` antes del build
- LABEL `stage=cfs-frontend-build` en Containerfile
- Debug prints (package.json version, `node require.resolve`, `cat` package.json del module)
- **`vite.config.js`**: `manualChunks` agrupa `@dnd-kit/*` en `vendor-dnd` + `optimizeDeps.include` + **`resolve.alias` con paths absolutos** a los `dist/index.js` de cada `@dnd-kit` package (fix definitivo del bug intermitente de Rollup auto-resolución en alpine)

### Testing

- **147 tests Vitest** (cobertura primitives v1+v2, drawer abierto/cerrado/ciclo, layout absolute + portal, mobile responsive, adapter, AppLayout shell, formFieldFocus REGRESIÓN)
- Playwright E2E con 2 projects (desktop-chrome + mobile-iphone12) — sigue con `continue-on-error: true` hasta Fase 8

---

## Backlog conocido

| # | Item | Notas |
|---|---|---|
| 1 | **Soporte QHD/4K** | Layouts diseñados para ≤1280px. Spec en `claude design/pending-screens.md` sección 0.9. |
| 2 | **Reasignar batch** | Botón en drawer hace toast "llega pronto". Necesita UI: selector de batches existentes o crear batch nuevo. |
| 3 | ~~Compras form drawer~~ | ✅ COMPLETADO en PR #26 (PurchaseOrderFormDrawer). Borrar de este backlog. |
| 4 | **Notificaciones (bell)** | Botón visual en MobileAppHeader + desktop header. Sin funcionalidad — necesita endpoint backend + dropdown. |
| 5 | **Search overlay mobile** | Solo Inventory lo implementa. Cost / Slicer / Queue / Maintenance / Vault / Compañía pueden agregarlo. |
| 6 | **Historial reciente del filamento** | Section en drawer hoy con texto "pendiente". Necesita endpoint que retorne consumos desde quotes + queue. |
| 7 | **Consumo 14d sparkline** | `CONSUMPTION_PLACEHOLDER` hardcoded en el código. Necesita endpoint backend de historial de uso. |
| 8 | **Borrar pages/routes legacy** | Absorbido por **Fase 9** Chunk B. Ver sección "Fase 9" abajo. |
| 9 | **Visual regression baselines** | **Fase 8 PAUSADA por Giomar (2026-05-17)** — generar con `npm run e2e:update-snapshots`, commit `tests-e2e/__screenshots__/`, remover `continue-on-error` + `--grep-invert` del workflow. Se hace **después de Fase 9** porque cambios de rutas/nombres invalidarían cualquier baseline previo. |
| 10 | **Slicer live editor** | El design v2 tiene preview canvas + settings inline + estimate live (paradigma "live editor"). No implementado, requiere endpoints backend nuevos para slice tiempo real. |
| 11 | **Queue → Vault picker** | Botón "Agregar a cola" hoy redirige a `/cost/quotes` (stub). Debe abrir un drawer/sheet con lista de modelos del Vault que tengan `.gcode.3mf` y crear el `PrintQueueItem` con `weight_g` + `time_h` + `filament_type` ya resueltos. **Se aborda en Fase 5** porque requiere cambios en el modelo `ModelFile` (soportar `print_file` además del `source_file`) + nuevo endpoint `getVaultPrintReady()` + columnas `vault_model_id` y `print_file_snapshot_path` en `PrintQueueItem`. Spec: `pending-screens.md` sección 20.1. |
| 12 | **Vault `.gcode.3mf`** | Hoy `ModelFile` solo guarda `.3mf` editable. Para que el picker de Queue (item #11) funcione, el Vault necesita aceptar también el paquete laminado `.gcode.3mf` y parsear su header (peso, tiempo, modelo impresora, filamento). Migración + UI Upload con dos slots (editable / laminado). Parte de Fase 5. Spec: `pending-screens.md` sección 20. |

---

## Plan restante — Fases 9 → 8

| # | Fase | Estado | Rama propuesta |
|---|---|---|---|
| 3 | Queue v2 | ✅ merged | — |
| 4 | Maintenance v2 (+ CRUD logs + horas inline) | ✅ merged | — |
| 5 | Vault v2 (visual + `.gcode.3mf` + picker Queue) | ✅ merged (3 chunks) | — |
| 6 | Company v2 (Profile/Branding/Templates list drawers) | ✅ merged | — |
| 7 | Settings v2 (NUEVA app v2) | ✅ merged (PR #37) | — |
| **9** | **Eliminar TODA referencia a V1** | 🔵 **PRÓXIMO** | `feat/fase-9-eliminar-v1` (3 chunks recomendados, ver abajo) |
| 8 | Visual baselines + CI gate | ⏸ **PAUSADA por Giomar** — hacer después de Fase 9 | `chore/visual-baselines` |

---

## Fase 9 — Eliminar TODA referencia a V1

**Objetivo**: dejar el código en un estado donde no exista vestigio de que alguna vez hubo una V1. Sufijos `V2` en nombres, rutas `/v2`, redirects `Navigate`, archivos legacy todavía vivos, comentarios "reemplaza V1 …" — todo fuera.

### Inventario al 2026-05-17 (post-Fase 7)

**A) Archivos con sufijo `V2` en el nombre** (8) — el V1 original ya está borrado, el sufijo quedó como cicatriz:
- `frontend/src/pages/queue/QueuePageV2.jsx`
- `frontend/src/pages/maintenance/MaintenancePageV2.jsx`
- `frontend/src/pages/vault/VaultPageV2.jsx`
- `frontend/src/pages/vault/VaultUploadPageV2.jsx`
- `frontend/src/pages/company/CompanyPageV2.jsx`
- `frontend/src/pages/settings/SettingsPageV2.jsx`
- `frontend/src/pages/cost/CalculatorPageV2.jsx`
- `frontend/src/pages/cost/CostPage.jsx` *(NO tiene sufijo V2 pero ES la versión v2 de Cost. El "V1" original convive como `QuotesPage.jsx`/`CalculatorPage.jsx`/etc bajo `pages/` raíz)*

**Renombrar a `XxxPage.jsx`** sin sufijo. Actualizar imports + lazy() en `App.jsx` + cualquier ref interna.

**B) Páginas V1 todavía activas como rutas primarias** (no son redirects — son la única implementación):

*Cost (8 páginas V1 vivas, ninguna migrada del todo):*
- `pages/CalculatorPage.jsx` → `/cost/calculator` (V2 al lado en `/cost/calculator/v2`, decidir cuál se queda)
- `pages/QuotesPage.jsx` → `/cost/quotes` (V2 `CostPage` al lado en `/cost/v2`, decidir cuál se queda)
- `pages/ManualQuotePage.jsx` → `/cost/manual` (sin V2)
- `pages/PrintersPage.jsx` → `/cost/printers` (sin V2 — solo refresh visual hizo falta en PR #31)
- `pages/HistoryPage.jsx` → `/cost/history` (sin V2)
- `pages/SettingsPage.jsx` → `/cost/settings` (sin V2 — diferente a `SettingsPageV2` que es global)

*Inventario tabs V1 (todas reemplazadas por tabs internos de `/inventory/v2`):*
- `InventoryStockPage.jsx` → `/inventory/stock`
- `InventoryFilamentsPage.jsx` → `/inventory/filaments`
- `InventorySuppliesPage.jsx` → `/inventory/supplies`
- `InventoryToolsPage.jsx` → `/inventory/tools`
- `InventoryConsumablesPage.jsx` → `/inventory/consumables`
- `InventoryPurchasesPage.jsx` → `/inventory/purchases` (¡todavía referenciada por el wrapper Compras de v2!)
- `InventoryPrintsPage.jsx` → `/inventory/prints` (sin equivalente v2 — galería de impresiones para venta)
- `InventoryImportExportPage.jsx` → `/inventory/io` (sin equivalente v2)

*Slicer V1 (parcialmente reemplazado por SlicerPage v2):*
- `SlicerUploadPage.jsx` → `/slicer/upload` (V2 lo absorbe vía tab "Subir" en `SlicerPage`)
- `SlicerHistoryPage.jsx` → `/slicer/history` (V2 lo absorbe vía tab "Historial")
- `SlicerJobDetailPage.jsx` → `/slicer/jobs/:id` (V2 usa drawer — esta ruta dedicada queda como vestigio)

*Queue V1:*
- `QueuePage.jsx` → `/queue/legacy` (renombrado a "legacy" pero el archivo sigue vivo)
- `QueueHistoryPage.jsx` → `/queue/history` (V2 tiene tab Historial pero la ruta directa sigue)

*Otras pages V1 sin V2:*
- `AccountPage.jsx` — ¿está montada? Ver `App.jsx`. Probablemente legacy de antes del refactor de auth.
- `FilamentsPage.jsx`, `SuppliesPage.jsx` — pages root, probables legacy nunca usados.
- `InventoryCategoriesPage.jsx` — admin para gestionar las 7 categorías seed. Sin equivalente v2.
- `CompanyTemplateEditorPage.jsx` — editor Liquid grande, intencionalmente sigue como ruta dedicada (no entró a Company v2 por su tamaño).

**C) Rutas `/v2` explícitas** (12) — renombrar a `/` para que la URL canónica no diga "v2":
- `/inventory/v2` → `/inventory/`
- `/cost/v2` → `/cost/`
- `/cost/calculator/v2` → `/cost/calculator` (chocaría con V1 si no se borra primero)
- `/slicer/v2` → `/slicer/`
- `/queue/v2` → `/queue/`
- `/maintenance/v2` → `/maintenance/`
- `/vault/v2` → `/vault/`
- `/vault/upload/v2` → `/vault/upload`
- `/company/v2` → `/company/`
- `/settings/v2` → `/settings/`

**D) Redirects `Navigate to .../v2`** (~12 en `App.jsx`) — se vuelven `Navigate to ...` planos o desaparecen una vez se renombren las rutas v2.

**E) Comentarios y docstrings con menciones a V1** — sweep textual:
- `// V1 ... reemplazada por v2`
- `/** ... v2 (Claude Design v2) */`
- "Fase N" en docstrings (ya no son fases pendientes — son la única forma)
- Comentarios `// PENDIENTE Fase N` y "chunk B/C" en archivos
- `claude design/pending-screens.md` referencias a "V1"

**F) Refs en `claude design/` y docs**:
- `pending-screens.md` menciona "V1" como contraste — actualizar para que solo describa el estado actual
- Eliminar líneas como "PENDIENTE para Fase 5" / "PR #N" — no son tracking, son cicatriz
- `CLAUDE.md` no debería tener nada de "v2" si v2 ya no existe como concepto

**G) Sidebar (`config/sidebar.js`)** — links apuntan a `/inventory/v2`, `/cost/v2`, etc. Renombrar tras (C).

### Scope decisions necesarias antes de implementar

Estas 4 decisiones definen qué entra al PR y qué no:

1. **¿`CalculatorPage` (V1) vs `CalculatorPageV2`? ¿Cuál es la calculadora canónica?**
   - Si V2 → borrar `CalculatorPage.jsx`, montar V2 en `/cost/calculator`.
   - Si V1 → borrar `CalculatorPageV2.jsx`, dejar la V1 como está (renombrar nada).
   - Si ambas tienen funcionalidad distinta → consolidar en una sola antes de Fase 9.

2. **¿`QuotesPage` (V1) vs `CostPage` (V2)? ¿Cuál se queda como `/cost/`?**
   - `CostPage` es V2 visual pero ¿tiene todas las acciones de V1?

3. **¿Renombrar rutas `/v2` → `/`?**
   - Si SÍ → bookmarks externos viejos rompen, hay que poner redirects `Navigate` que duren un tiempo razonable (¿forever? Está bien si el redirect es liviano).
   - Si NO → el sufijo `/v2` se queda como cicatriz pero las URLs no se rompen.

4. **¿Borrar páginas V1 sin reemplazo (`InventoryPrintsPage`, `InventoryImportExportPage`, `InventoryCategoriesPage`, `CompanyTemplateEditorPage`, `ManualQuotePage`, `HistoryPage`, `AccountPage`, `FilamentsPage`, `SuppliesPage`)?**
   - Si SÍ → pierden funcionalidad.
   - Si NO → quedan como "rutas legacy aceptadas, no son V1 en disputa".

### Chunking recomendado

Por tamaño y blast radius:

**Chunk A — Rename de archivos `XxxPageV2` → `XxxPage`** (8 archivos + imports en App.jsx + sidebar):
- Bajo riesgo, sin cambio de rutas, sin cambio de funcionalidad
- Tests Vitest se mantienen
- ~30 minutos
- Rama: `chore/fase-9-rename-v2-suffix`

**Chunk B — Borrar páginas V1 sin V2 al lado + redirects** (decisión #4):
- Borra `InventoryStock/Filaments/Supplies/Tools/Consumables/Purchases` V1 + redirects a `/inventory/v2`
- Borra `SlicerUpload/History/JobDetail` V1 + redirects a `/slicer/v2`
- Borra `QueuePage` (legacy) y `QueueHistoryPage` + redirects a `/queue/v2`
- Borra `CompanyTemplateEditorPage` legacy si lo migras o redirige
- Mantener V1 que no tienen reemplazo solo si decisión #4 es NO
- Rama: `chore/fase-9-borrar-v1-pages`

**Chunk C — Renombrar rutas `/v2` → `/` + actualizar sidebar + redirects de cortesía** (decisión #3):
- `App.jsx`: 12 `Route path="v2"` → `Route index`
- `sidebar.js`: 12 `to: '/xxx/v2'` → `to: '/xxx/'`
- Mantener `Route path="v2"` con `<Navigate to="../" replace />` para bookmarks viejos
- Sweep textual final de comentarios "v2" / "Fase N" / "PENDIENTE"
- Update `App.jsx` docstring header con la lista de rutas nueva
- Update `pending-screens.md` y `CLAUDE.md` para que no hablen de "V1"
- Rama: `chore/fase-9-canonical-routes`

### Riesgos / cuidados

- **Bookmarks externos**: si los redirects se quitan tras Chunk C, los enlaces viejos rompen. Decisión #3 + considerar dejar redirects permanentes.
- **CalculatorPage V1 vs V2**: ambas tienen Quote endpoints, hay que verificar que ninguna funcionalidad de V1 quedó fuera de V2 antes de borrarla.
- **Tests** que usen rutas `/v2` literales (tests E2E Playwright sobre todo) — sweep antes de hacer rename.
- **Backlog #3** (Compras form drawer) está marcado "EN CURSO" pero ya se hizo en PR #26. Limpiar este item del backlog también es parte de Fase 9.
- **Backlog #8** ("Borrar pages/routes legacy") es exactamente lo que Fase 9 ataca — borrar ese item del backlog tras completar.

### Salida esperada

Al terminar Fase 9, alguien que abra el repo por primera vez no debería poder deducir que alguna vez existió una "V1" del proyecto. URLs canónicas (`/inventory/`, `/queue/`, etc.), nombres de archivos sin sufijos, comentarios sin tracking de fases, sidebar limpia. Solo queda el design v2 como "el design".

---

## Workflow obligatorio

```
1. git checkout main && git pull origin main
2. git checkout -b <prefix>/<descripcion>
3. <cambios + commits — pre-commit hook valida>
4. git push -u origin <rama>
5. gh pr create --base main
6. Esperar CI verde:  lint · test-backend · test-frontend · e2e-frontend
7. Merge solo cuando los 4 estén verde
```

**NUNCA** push directo a `main`. Si CI falla, fix + new commit.

---

## Reglas críticas (memorias del agente)

| Regla | Detalle |
|---|---|
| **No dev server** | `npm run dev` / `uvicorn` congelan la terminal de Giomar — siempre darle el comando |
| **Migrar BD** | Cada PR que toca `backend/alembic/versions/` debe incluir `podman exec -it cfs-backend alembic upgrade head` |
| **Respetar design** | Cuando hay archivo en `claude design/`, implementar **1:1 sin proponer alternativas** |
| **Branch + PR** | Nunca push directo a main. Siempre rama → PR → CI → merge |
| **Sin "clásicas"** | Si v2 cubre la funcionalidad, eliminar refs en sidebar y links |
| **Tests REGRESIÓN** | Agregar tests que cubran el bug arreglado (no solo el happy path). Cubrir estados `open=false` / vacío / error |
| **Helpers a module-level** | NUNCA definir sub-componentes dentro de un componente. ESLint `react-hooks/static-components` lo captura |
| **USD vs COP** | Filamentos: USD (la calculadora los usa así). Insumos/Herramientas/Consumibles: COP (compras locales) |

---

## Contexto técnico para retomar

### Stack
- Frontend: React 19 + Vite 7 + TailwindCSS 4 (`@theme` tokens en `src/index.css`)
- Backend: FastAPI + SQLAlchemy async + PostgreSQL (asyncpg)
- Tests: Vitest + Playwright (frontend), pytest (backend)
- CI: self-hosted runner en server de Giomar
- Deploy: podman + quadlet en server Linux

### Primitives disponibles (todos en `components/ui/`)

**v1**: `Button`, `Card`, `Chip`, `Input`, `KPI`, `Sparkline`, `Swatch`
**v2**: `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState`
**Drawer/sheet**: `DetailDrawer` (eyebrow + footer + onEdit + `return null` cuando closed + `createPortal` + absolute positioning), `MobileSheet` (onEdit + `return null` cuando closed + `createPortal`)
**Header mobile**: `components/MobileAppHeader.jsx`
**Form helpers (Inventory)**: `FormFieldRow`, `FormSectionTitle`, `FORM_INPUT_CLS` (module-level en `pages/inventory/InventoryPage.jsx`)

### Formatters disponibles (`utils/inventoryAdapter.js`)

- `fmtCOP(n)` — `$ 25.000` (es-CO, no decimales si >1000) — para Insumos/Herr/Cons locales
- `fmtUSD(n)` — `$25.00` (en-US, 2 decimales) — para precios de Filamento (calculadora)
- `fmtKg(g)`, `fmtG(g)`, `fmtPct(n)`

### Rutas v2 montadas en `App.jsx` (estado post-Fase 7)
- `/` → `StudioHomePage` ✅ (con MobileAppHeader)
- `/inventory/v2` → `InventoryPage` ✅ Fase 1 (Filamentos + Insumos/Herr/Cons + Compras editables vía drawers)
- `/cost/v2` → `CostPage` ✅ (convive con `QuotesPage` V1 en `/cost/quotes` — decisión Fase 9 #2)
- `/cost/calculator/v2` → `CalculatorPageV2` ✅ (convive con V1 en `/cost/calculator` — decisión Fase 9 #1)
- `/slicer/v2` → `SlicerPage` ✅ Fase 2 (V1 `SlicerUpload/History/JobDetail` siguen vivas — Fase 9 Chunk B)
- `/queue/v2` → `QueuePageV2` ✅ Fase 3 (+ Vault picker en chunk C de Fase 5)
- `/maintenance/v2` → `MaintenancePageV2` ✅ Fase 4 (V1 borradas, redirects activos)
- `/vault/v2` + `/vault/upload/v2` → `VaultPageV2` + `VaultUploadPageV2` ✅ Fase 5 (V1 borradas)
- `/company/v2` → `CompanyPageV2` ✅ Fase 6 (V1 Profile/Branding/Templates list borradas; `CompanyTemplateEditorPage` sigue en `/company/templates/new` y `/:id`)
- `/settings/v2` → `SettingsPageV2` ✅ Fase 7 (V1 CuentaPage/EmpresaPage/UsuariosPage borradas)

**Páginas V1 todavía vivas como rutas primarias** (Fase 9 Chunk B):
- Cost: `/cost/calculator`, `/cost/quotes`, `/cost/manual`, `/cost/printers`, `/cost/history`, `/cost/settings`
- Inventario tabs: `/inventory/stock|filaments|supplies|tools|consumables|purchases|prints|io`
- Slicer: `/slicer/upload`, `/slicer/history`, `/slicer/jobs/:id`
- Queue: `/queue/legacy` (renamed), `/queue/history`
- Otras: `AccountPage`, `FilamentsPage`, `SuppliesPage`, `InventoryCategoriesPage` — todas root/legacy sin V2

### Mobile responsive
- `useIsMobile()` hook → `(max-width: 1023px)`
- Mobile shell tiene FAB + MobileBottomNav fija
- `AppLayout` mobile expone `openSidebar` vía `useOutletContext()`
- Desktop shell tiene StudioSidebar fija + DetailDrawer derecho
- **QHD/4K (≥1440px)**: aún no optimizado — ver backlog #1 + `pending-screens.md` 0.9

### Auth bypass para tests/dev
- `frontend/src/context/AuthContext.jsx` exporta `DEV_BYPASS_TOKEN` + `DEV_BYPASS_USER`
- `/login` muestra botón "Bypass dev" cuando `import.meta.env.DEV`

### CI/CD
- 4 jobs en `.github/workflows/deploy.yml`: `lint` / `test-backend` / `test-frontend` / `e2e-frontend`
- E2E `continue-on-error: true` con `--grep-invert "visual regression"`
- Backend coverage gate ≥80%
- Deploy job: `needs: [lint, test-backend, test-frontend]`, solo en push a main

---

## Migraciones BD pendientes en servidor

Si Giomar no ha corrido la última:

```bash
podman exec -it cfs-backend alembic upgrade head
```

Aplica hasta `k5l6m7n8o9p0` (head actual: `sale_price` column).

---

## Comandos útiles

```bash
# Frontend
cd frontend
npm install                        # husky se auto-instala
npm test -- --run                  # Vitest (147 pass / 26 skip esperado)
npm run lint                       # ESLint (0 errors, warns OK)
npm run build                      # verify build
npm run e2e                        # Playwright (requiere dev server)
npm run e2e:update-snapshots       # genera baselines visual

# Git workflow
git checkout main && git pull
git checkout -b feat/design-v2-<app>
git commit -m "feat(<app>): ..."   # pre-commit hook valida
git push -u origin <rama>
gh pr create --base main

# Backend
cd backend
python3 -m pytest tests/ -v        # 402+ tests
podman exec -it cfs-backend alembic upgrade head

# Deploy en server (manual)
ssh server "cd ~/collectors-forge-studio && git pull origin main && ./deploy.sh"
```

---

## Archivos importantes

**Source-of-truth del design**: `claude design/`
- `components.jsx` — primitives shared (ya portados en Fase 0)
- `<app>.jsx` + `<app>-mobile.jsx` — designs por app
- `<App>.html` + `<App> móvil.html` — HTML previews
- `screenshots/` — capturas
- **`pending-screens.md`** — spec de 22 pantallas pendientes para Claude Design (incluye patrones compartidos + QHD/4K)

**Configuración**:
- `CLAUDE.md` — contexto general
- `docs/propuesta-ui-bambuddy.md` — plan original
- `docs/branch-protection.md` — workaround GitHub Free
- `frontend/src/index.css` — tokens CSS + utility classes
- `frontend/src/components/ui/index.js` — barrel de primitives

**Tests**:
- `frontend/src/__tests__/` — Vitest unit (147 pass)
- `frontend/tests-e2e/` — Playwright E2E + visual
- `backend/tests/` — pytest (402+)
