# Estado de trabajo — port Claude Design v2

**Última actualización**: 2026-05-16
**Working dir**: `/home/tavo/Documentos/Github/collectors-forge-studio`
**Main**: limpio (21 PRs merged hasta ahora — pendiente confirmar #19/#20/#21)

---

## Lo que ya está en `main`

### Infraestructura

- **Fase 0 — Primitives v2** (PR #2): `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState` v2 — todos en `frontend/src/components/ui/`. `DetailDrawer` refresh con `eyebrow` + `footer` + `onEdit` props.
- **Sidebar v2** (PR #4): refactor 1:1 con `claude design/sidebar.jsx` — flat apps list (sin dropdown por app), accent left-bar en activo, sección secundaria con sub-items del app activo, gear ⚙️ en footer.
- **MobileAppHeader compartido** (PR #7): en `components/MobileAppHeader.jsx` — hamburger + eyebrow + título + search opcional + bell. Aplicado en las 7 apps v2.
- **AppLayout** (PR #6): mobile shell renderiza `StudioSidebar` como drawer + expone `openSidebar()` vía `useOutletContext()`.
- **StudioHomePage** (PR Slicer): MobileAppHeader agregado a `/` (mobile).

### Inventory (Fase 1) — completo

PRs #3, #5, #6, #8, #12, #15, #16, #17, #21:

- 5 tabs internas (Filamentos, Insumos, Herramientas, Consumibles, Compras)
- KPIs desktop: Capital, Material, Consumo 14d (sparkline), Stock bajo, Próx. compras
- Mobile: hero status + mini KPI strip **siempre visibles** en todos los tabs
- Mobile header completo (hamburger + título dinámico + search + bell)
- FilamentRow mobile sin overflow (Xiaomi Mi 10T fix)
- FilamentCard grid + FilamentTable con `Color · Batch`, sort `lowFirst|recent|material|valueDesc|weightDesc`
- StatusPill para PO badges (en camino azul, procesando amber, completado verde, etc.)
- PurchaseCard con line item chips (≤6 + overflow indicator)
- EmptyState v2 reemplazando empty states inline (6 lugares)
- Drawer body con "Agregar a compras" + "Reasignar batch" INLINE (1:1 design, no en footer)
- **FilamentFormDrawer**: drawer derecho desktop / bottom sheet mobile
  - Create + Edit modes con PUT/POST a `/inventory/items/`
  - 5 secciones: Identificación / Stock / Técnico / Proveedor & costo / Notas
  - Todos los campos del modelo backend (name, description, color_*, filament_type, weight_per_roll, quantity, min_quantity, filament_diameter (1.75 default), filament_density (auto-fill por tipo), supplier_*, etc.)
  - Optimistic update tras save (`filamentsRawById` cache local)
  - **`if (!open) return null`** — guard que previene drawer zombi visible
- `DetailDrawer` + `MobileSheet` primitives ahora **`return null` cuando `open=false`** (fix bulletproof contra regresiones)
- `DetailDrawer` usa **CSS Grid** (`gridTemplateRows: 'auto 1fr auto'`) en lugar de flex — footer SIEMPRE visible
- 6 tests REGRESIÓN nuevos que garantizan que estos bugs no vuelven

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
  - Detección por extensión, toast feedback, callback inserta job + switch a Historial
- Mobile FAB → `setTab('subir')` (no más nav externa)
- Desktop header "Subir modelo" → button con `setTab` (no más Link)
- Drawer footer "Ver detalle" Link a `/slicer/jobs/:id` → quitado
- Sidebar item `'/slicer/upload'` → quitado (sidebar.js)

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

- 143 tests Vitest (137 + 6 nuevos de REGRESIÓN sobre drawers)
- Cobertura: primitives v1+v2, drawer abierto/cerrado/ciclo, layout grid, mobile responsive, adapter, AppLayout shell mobile/desktop
- Playwright E2E con 2 projects (desktop-chrome + mobile-iphone12) — sigue con `continue-on-error: true` hasta Fase 8

---

## Backlog conocido

| # | Item | Notas |
|---|---|---|
| 1 | **Soporte QHD/4K** | Layouts diseñados para ≤1280px. Pantallas más grandes desperdician espacio. Ver `claude design/pending-screens.md` sección 0.9 para spec del designer. |
| 2 | **Reasignar batch** | Botón en drawer hace toast "llega pronto". Necesita UI: selector de batches existentes o crear batch nuevo. |
| 3 | **Add modal Insumos / Herramientas / Consumibles** | Por ahora `+ Agregar` en esas categorías toast "llega pronto". Cada categoría necesita su form. |
| 4 | **Notificaciones (bell)** | Botón visual en MobileAppHeader + desktop header. Sin funcionalidad — necesita endpoint backend + dropdown. |
| 5 | **Search overlay mobile** | Solo Inventory lo implementa. Cost / Slicer / Queue / Maintenance / Vault / Compañía pueden agregarlo. |
| 6 | **Historial reciente del filamento** | Section en drawer hoy con texto "pendiente". Necesita endpoint que retorne consumos desde quotes + queue. |
| 7 | **Borrar pages/routes legacy** | `/inventory/stock`, `/inventory/filaments`, `/slicer/upload`, `/slicer/jobs/:id`, etc. siguen activos en `App.jsx` aunque sidebar ya no los referencia. Limpieza más invasiva — hacer cuando confirmemos que v2 cubre 100% de uso. |
| 8 | **Visual regression baselines** | Fase 8 — generar con `npm run e2e:update-snapshots`, commit `tests-e2e/__screenshots__/`, remover `continue-on-error` + `--grep-invert` del workflow. |
| 9 | **Slicer live editor** | El design v2 tiene preview canvas + settings inline + estimate live (paradigma "live editor"). No implementado, requiere endpoints backend nuevos para slice tiempo real. |

---

## Plan restante — Fases 3 a 8

| # | Fase | Source design | Rama propuesta |
|---|---|---|---|
| 3 | Queue v2 | `claude design/queue.jsx` + `queue-mobile.jsx` + screenshots | `feat/design-v2-queue` |
| 4 | Maintenance v2 | `claude design/maintenance.jsx` + `maintenance-mobile.jsx` + `maint*.png` | `feat/design-v2-maintenance` |
| 5 | Vault v2 | `claude design/vault.jsx` + `vault-mobile.jsx` + `vault-thumbs.jsx` | `feat/design-v2-vault` |
| 6 | Company v2 | `claude design/company.jsx` + `company-mobile.jsx` | `feat/design-v2-company` |
| 7 | Settings v2 (**NUEVA**) | `claude design/settings.jsx` + `settings-mobile.jsx` | `feat/design-v2-settings` |
| 8 | Visual baselines + CI gate | — | `chore/visual-baselines` |

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
**Drawer/sheet**: `DetailDrawer` (eyebrow + footer + onEdit + `return null` cuando closed), `MobileSheet` (onEdit + `return null` cuando closed)
**Header mobile**: `components/MobileAppHeader.jsx`

### Rutas v2 montadas en `App.jsx`
- `/` → `StudioHomePage` ✅ (con MobileAppHeader)
- `/inventory/v2` → `InventoryPage` ✅ Fase 1
- `/cost/v2` → `CostPage` ⏳ no v2 design todavía
- `/cost/calculator/v2` → `CalculatorPageV2`
- `/slicer/v2` → `SlicerPage` ✅ Fase 2
- `/queue/v2` → `QueuePageV2` ⏳ Fase 3
- `/maintenance/v2` → `MaintenancePageV2` ⏳ Fase 4
- `/vault/v2` → `VaultPageV2` ⏳ Fase 5
- `/company/v2` → `CompanyPageV2` ⏳ Fase 6
- `/settings/account|company|users` → `CuentaPage|EmpresaPage|UsuariosPage` ⏳ Fase 7

### Mobile responsive
- `useIsMobile()` hook → `(max-width: 1023px)`
- Mobile shell tiene FAB + MobileBottomNav fija
- `AppLayout` mobile expone `openSidebar` vía `useOutletContext()` — cada page lo consume + pasa a `MobileAppHeader.onMenu`
- Desktop shell tiene StudioSidebar fija + DetailDrawer derecho
- **QHD/4K (≥1440px)**: aún no optimizado — ver backlog item #1 + `pending-screens.md` sección 0.9

### Auth bypass para tests/dev
- `frontend/src/context/AuthContext.jsx` exporta `DEV_BYPASS_TOKEN` + `DEV_BYPASS_USER`
- `/login` muestra botón "Bypass dev" cuando `import.meta.env.DEV`
- Helpers en `tests-e2e/helpers/auth.js` + `apiMock.js`

### CI/CD
- 4 jobs en `.github/workflows/deploy.yml`: `lint` / `test-backend` / `test-frontend` / `e2e-frontend`
- E2E `continue-on-error: true` con `--grep-invert "visual regression"`
- Backend coverage gate ≥80%
- Deploy job: `needs: [lint, test-backend, test-frontend]`, solo en push a main

---

## Comandos útiles

```bash
# Frontend
cd frontend
npm install                        # husky se auto-instala
npm test -- --run                  # Vitest (143 pass / 26 skip esperado)
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
- **`pending-screens.md`** — spec de 22 pantallas pendientes de diseñar para Claude Design (incluye patrones compartidos + QHD/4K)

**Configuración**:
- `CLAUDE.md` — contexto general
- `docs/propuesta-ui-bambuddy.md` — plan original
- `docs/branch-protection.md` — workaround GitHub Free
- `frontend/src/index.css` — tokens CSS + utility classes
- `frontend/src/components/ui/index.js` — barrel de primitives

**Tests**:
- `frontend/src/__tests__/` — Vitest unit (143 pass)
- `frontend/tests-e2e/` — Playwright E2E + visual
- `backend/tests/` — pytest (402+)
