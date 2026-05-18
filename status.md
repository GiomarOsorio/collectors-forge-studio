# Estado del proyecto — Collector's Forge Studio

**Última actualización**: 2026-05-18
**Working dir**: `/home/tavo/Documentos/Github/collectors-forge-studio`
**Main**: 40+ PRs merged, sin PRs abiertos.
**Próximo**: visual regression baselines + CI gate (`chore/visual-baselines`) — pausada hasta que Giomar quiera. Ver "Pendiente" abajo.

---

## Estado del frontend

### Rutas canónicas (sin sufijo `/v2`)

| URL canónica | Componente | Notas |
|---|---|---|
| `/` | `StudioHomePage` | Lanzador de apps |
| `/inventory` | `InventoryPage` | Tabs: Filamentos · Insumos · Herr · Consumibles · Compras |
| `/inventory/purchases` | `InventoryPurchasesPage` | Tabla de pedidos |
| `/inventory/prints` | `InventoryPrintsPage` | Disponible para venta |
| `/inventory/io` | `InventoryImportExportPage` | Import/Export CSV |
| `/cost` | `CostPage` | Dashboard con tabs Cotizaciones / Historial |
| `/cost/calculator` | `CalculatorPage` | Calculadora de costos (con multi-filamento, insumos extra, post-proc) |
| `/cost/manual` | `ManualQuotePage` | Nueva cotización manual |
| `/cost/printers` | `PrintersPage` | Gestión de impresoras |
| `/cost/history` | `HistoryPage` | Historial de cotizaciones internas |
| `/cost/settings` | `CostSettingsPage` | Tarifa eléctrica & ajustes calc |
| `/settings` | `SettingsPage` | Cuenta + Usuarios (admin) vía drawers |
| `/slicer` | `SlicerPage` | Tabs Subir / Historial + drawer detalle |
| `/maintenance` | `MaintenancePage` | Dashboard + Historial + CRUD logs |
| `/queue` | `QueuePage` | Tabs Activa / Historial + VaultPicker |
| `/vault` | `VaultPage` | Galería de modelos `.3mf` / `.gcode.3mf` |
| `/vault/upload` | `VaultUploadPage` | Subir modelo (admin) — dual slot |
| `/company` | `CompanyPage` | Admin: Perfil/Marca/Templates vía drawers |
| `/company/templates/new` | `CompanyTemplateEditorPage` | Editor Liquid (admin) |
| `/company/templates/:id` | `CompanyTemplateEditorPage` | Editor Liquid (admin) |

Rutas legacy con sufijo `/v2` (e.g. `/inventory/v2`, `/cost/calculator/v2`) y rutas viejas (`/inventory/stock`, `/slicer/upload`, etc.) **siguen funcionando** como redirects de cortesía vía `<RedirectPreservingSearch>`, preservando query params. No aparecen en sidebar pero un bookmark viejo no se rompe.

### Apps cubiertas

- **Inventario**: 5 tabs internos con drawers de form (FilamentFormDrawer, ItemFormDrawer, PurchaseOrderFormDrawer)
- **Cost**: dashboard con cotizaciones cliente + historial impresiones; sub-rutas para calc avanzada, nuevo, impresoras, historial, ajustes
- **Slicer**: tabs Subir + Historial, drawer de detalle, integración con OrcaSlicer + MakerWorld + parser .3mf
- **Queue**: tabs Activa + Historial, VaultPickerDrawer para encolar modelos `.gcode.3mf`
- **Mantenimiento**: dashboard de impresoras + historial de logs, CRUD inline en drawers, edición de `current_hours`
- **Vault**: galería con thumbnails + dual upload `.3mf` editable / `.gcode.3mf` laminado, `print_ready_only` query
- **Compañía** (admin): drawers para perfil/marca/templates; editor Liquid en ruta dedicada
- **Settings**: drawers para cuenta + gestión de usuarios admin

### Patrón compartido v2

- **Primitives** (`components/ui/`): `Button`, `Card`, `Chip`, `Input`, `KPI`, `Sparkline`, `Swatch`, `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState`.
- **`DetailDrawer`** (desktop): `eyebrow` + `footer` slot + `onEdit` + `return null` cuando closed + `createPortal` + posicionamiento absoluto.
- **`MobileSheet`** (mobile): `onEdit` + `return null` cuando closed + `createPortal` + footer sticky inline.
- **`MobileAppHeader`** (`components/MobileAppHeader.jsx`): hamburger + eyebrow + título + search opcional + bell.
- **Form helpers** module-level: `FormFieldRow`, `FormSectionTitle`, `FORM_INPUT_CLS` (en cada page que tiene drawer). Evitar definirlos dentro del componente padre — bug `cursor jump` capturado en `__tests__/formFieldFocus.test.jsx`.
- **`RedirectPreservingSearch`** (`App.jsx`): `<Navigate>` que conserva el query string al redirigir rutas legacy.

### Stack

- Frontend: React 19 + Vite 7 + TailwindCSS 4 (`@theme` tokens en `src/index.css`)
- Backend: FastAPI + SQLAlchemy async + PostgreSQL (asyncpg)
- Tests: Vitest + Playwright (frontend), pytest (backend)
- CI: self-hosted runner en server de Giomar (`paths-ignore: ['**/*.md']` para skip docs-only)
- Deploy: podman + quadlet en server Linux

### Formatters (`utils/inventoryAdapter.js`)

- `fmtCOP(n)` — `$ 25.000` (es-CO, sin decimales si >1000) — Insumos/Herr/Cons COP
- `fmtUSD(n)` — `$25.00` (en-US, 2 decimales) — Filamentos (calc usa USD)
- `fmtKg(g)`, `fmtG(g)`, `fmtPct(n)`

### Mobile responsive

- `useIsMobile()` → `(max-width: 1023px)`
- Mobile shell: FAB + `MobileBottomNav` fija
- Desktop shell: `StudioSidebar` fija + `DetailDrawer` derecho
- QHD/4K (≥1440px) aún no optimizado — ver `claude design/pending-screens.md` §0.9

### Auth bypass para tests/dev

- `frontend/src/context/AuthContext.jsx` exporta `DEV_BYPASS_TOKEN` + `DEV_BYPASS_USER`
- `/login` muestra botón "Bypass dev" cuando `import.meta.env.DEV`

---

## Reglas críticas

| Regla | Detalle |
|---|---|
| No dev server | `npm run dev` / `uvicorn` congelan la terminal de Giomar — siempre darle el comando |
| Migrar BD | Cada PR que toca `backend/alembic/versions/` debe incluir `podman exec -it cfs-backend alembic upgrade head` |
| Respetar design | Cuando hay archivo en `claude design/`, implementar **1:1 sin proponer alternativas** |
| Branch + PR | Nunca push directo a main. Siempre rama → PR → CI → merge |
| Tests REGRESIÓN | Agregar tests que cubran el bug arreglado (no solo el happy path). Cubrir estados `open=false` / vacío / error |
| Helpers a module-level | NUNCA definir sub-componentes dentro de un componente. ESLint `react-hooks/static-components` lo captura |
| USD vs COP | Filamentos: USD (la calculadora los usa así). Insumos/Herramientas/Consumibles: COP (compras locales) |

---

## CI/CD

4 jobs en `.github/workflows/deploy.yml`:

1. `lint` — ESLint frontend + Python syntax backend
2. `test-backend` — pytest con coverage ≥80% (Postgres real vía Podman)
3. `test-frontend` — Vitest + coverage
4. `e2e-frontend` — Playwright (2 projects: desktop-chrome + mobile-iphone12)
   - Hoy con `continue-on-error: true` y `--grep-invert "visual regression"` hasta que se hagan los baselines

5. `deploy` — `needs: [lint, test-backend, test-frontend]`, solo en push a `main`

---

## Pendiente

| Item | Notas |
|---|---|
| **Visual regression baselines + CI gate** | Pausada. Plan: `npm run e2e:update-snapshots` local → commit `tests-e2e/__screenshots__/` → quitar `continue-on-error` + `--grep-invert` del workflow. Después de esto, cualquier PR que cambie pixels de una página bloquea CI hasta actualizar baseline. Rama: `chore/visual-baselines`. |
| Soporte QHD/4K | Layouts diseñados para ≤1280px. Spec en `claude design/pending-screens.md` §0.9 |
| Reasignar batch | Botón en drawer de filamento hace toast "llega pronto". Necesita UI: selector de batches existentes o crear batch nuevo |
| Notificaciones (bell) | Botón visual en MobileAppHeader + desktop header. Sin funcionalidad — necesita endpoint backend + dropdown |
| Search overlay mobile | Solo Inventory lo implementa. Cost / Slicer / Queue / Maintenance / Vault / Compañía pueden agregarlo |
| Historial reciente del filamento | Section en drawer hoy con texto "pendiente". Necesita endpoint que retorne consumos desde quotes + queue |
| Consumo 14d sparkline | `CONSUMPTION_PLACEHOLDER` hardcoded. Necesita endpoint backend de historial de uso |
| Slicer live editor | El design tiene preview canvas + settings inline + estimate live (paradigma "live editor"). No implementado, requiere endpoints backend nuevos para slice tiempo real |
| Calculadora visual refresh | `CalculatorPage` sigue con el layout viejo. El v2 que existió era incompleto (no cubría multi-filamento ni insumos extra) y se borró. Si se quiere visual refresh, hay que portar TODAS las funciones de la actual a un nuevo layout. |

---

## Workflow obligatorio

```
1. git checkout main && git pull origin main
2. git checkout -b <prefix>/<descripcion>
3. <cambios + commits — pre-commit hook valida>
4. git push -u origin <rama>
5. gh pr create --base main
6. Esperar CI verde: lint · test-backend · test-frontend · e2e-frontend
7. Merge solo cuando los 4 estén verdes
```

**NUNCA** push directo a `main`. Si CI falla, fix + new commit.

---

## Comandos útiles

```bash
# Frontend
cd frontend
npm install                        # husky se auto-instala
npm test -- --run                  # Vitest (~149 pass / ~26 skip esperado)
npm run lint                       # ESLint (0 errors, warns OK)
npm run build                      # verify build
npm run e2e                        # Playwright (requiere dev server)
npm run e2e:update-snapshots       # genera baselines visual

# Git workflow
git checkout main && git pull
git checkout -b feat/<descripcion>
git commit -m "feat(<scope>): ..."   # pre-commit hook valida
git push -u origin <rama>
gh pr create --base main

# Backend
cd backend
python3 -m pytest tests/ -v        # ~440 tests
podman exec -it cfs-backend alembic upgrade head

# Deploy en server (manual)
ssh server "cd ~/collectors-forge-studio && git pull origin main && ./deploy.sh"
```

---

## Archivos importantes

**Configuración**:
- `CLAUDE.md` — contexto general
- `docs/propuesta-ui-bambuddy.md` — plan original
- `docs/branch-protection.md` — workaround GitHub Free
- `frontend/src/index.css` — tokens CSS + utility classes
- `frontend/src/components/ui/index.js` — barrel de primitives
- `frontend/src/App.jsx` — rutas canónicas + `RedirectPreservingSearch`
- `frontend/src/config/sidebar.js` — sidebar config (apps + items)

**Source-of-truth del design**: `claude design/`
- `components.jsx` — primitives shared
- `<app>.jsx` + `<app>-mobile.jsx` — designs por app
- `<App>.html` + `<App> móvil.html` — HTML previews
- `screenshots/` — capturas
- `pending-screens.md` — spec de pantallas pendientes + patrones compartidos + QHD/4K

**Tests**:
- `frontend/src/__tests__/` — Vitest unit (~149 pass)
- `frontend/tests-e2e/` — Playwright E2E + visual
- `backend/tests/` — pytest (~440)
