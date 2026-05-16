# Estado de trabajo — port Claude Design v2

**Última actualización**: 2026-05-16
**Working dir**: `/home/tavo/Documentos/Github/collectors-forge-studio`
**Rama activa**: variable según fase en curso
**Main**: limpio, 12 PRs merged hasta ahora

---

## Lo que ya está en `main`

### Infraestructura

- **Fase 0 — Primitives v2** (PR #2): `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState` v2 — todos en `frontend/src/components/ui/`. `DetailDrawer` refresh con `eyebrow` + `footer` + `onEdit` props. Tab title "Collector's Forge Studio". 38 tests cubriendo los primitives.
- **Sidebar v2** (PR #4): refactor 1:1 con `claude design/sidebar.jsx` — flat apps list (sin dropdown por app), accent left-bar en activo, sección secundaria con sub-items del app activo, gear ⚙️ en footer en lugar de dropdown Configuración. Drag & drop preservado.
- **MobileAppHeader compartido** (PR #7): en `components/MobileAppHeader.jsx` — hamburger + eyebrow + título + search opcional + bell. Aplicado en las 7 apps v2.
- **AppLayout** (PR #6): mobile shell renderiza `StudioSidebar` como drawer + expone `openSidebar()` vía `useOutletContext()`.

### Inventory (Fase 1)

Mergeado a lo largo de 7 PRs (#3, #5, #6, #8, #11 deploy fixes, #12):

- 5 tabs internas (Filamentos, Insumos, Herramientas, Consumibles, Compras)
- KPIs desktop: Capital, Material, Consumo 14d (con sparkline), Stock bajo, Próx. compras
- Mobile: hero status (capital + sparkline) + mini KPI strip (Material / Stock bajo / Compras) **siempre visibles** en todos los tabs
- Mobile header: hamburger + "Inventario" + tabLabel + Search + Bell
- FilamentRow mobile sin overflow (fix Xiaomi Mi 10T / 12 Pro)
- FilamentCard grid + FilamentTable con `Color · Batch`, sort `lowFirst|recent|material|valueDesc|weightDesc`
- StatusPill para PO badges (en camino azul, procesando amber, completado verde, etc.)
- PurchaseCard con line item chips (≤6 + overflow indicator)
- EmptyState v2 reemplazando empty states inline (6 lugares)
- Drawer footer 1:1 design: "Agregar a compras" + "Reasignar batch" (RefreshCw)
- **FilamentFormDrawer**: drawer derecho desktop / bottom sheet mobile (reemplaza modal centrado)
  - Create + Edit modes con PUT/POST a `/inventory/items/`
  - 5 secciones: Identificación / Stock / Técnico / Proveedor & costo / Notas
  - Todos los campos del modelo backend: name, color_name, color_hex, filament_type, description, weight_per_roll, quantity, min_quantity, needs_purchase, filament_diameter (default 1.75), filament_density (auto-fill por tipo), filament_brand, batch, supplier_name, supplier_contact, price_per_kg, location, notes
  - Optimistic update tras save (cache local en `filamentsRawById`)
- Sidebar limpio sin refs a "(clásica)" — rutas legacy siguen activas pero ocultas

### Deploy

- `--no-cache` en frontend podman build (deploy.sh)
- `npm ci --ignore-scripts` en Containerfile (husky abortaba sin .git)
- Verificación explícita `ls -la node_modules/@dnd-kit/` después de npm ci
- Version pinned 0.4.2

---

## Backlog conocido

| # | Item | Notas |
|---|---|---|
| 1 | **PR #12 no visible en prod** (FilamentFormDrawer + Edit + más campos) | Reportado por Giomar — el merge a main funcionó, el deploy completó, pero el cambio no se ve en la app. Verificar primero: hard reload (Ctrl+Shift+R) para bustear cache de browser. Si persiste, revisar logs del container `cfs-frontend`. |
| 2 | **Reasignar batch** | Botón visible en el drawer pero solo muestra toast "llega pronto". Necesita UI: selector de batches existentes para el mismo color/material O crear batch nuevo. |
| 3 | **Add modal para Insumos / Herramientas / Consumibles** | Por ahora `+ Agregar` en esas categorías muestra toast "llega pronto". Cada categoría necesita su propio form (campos distintos al filamento). |
| 4 | **Notificaciones (bell)** | Botón visual en MobileAppHeader + desktop header. Sin funcionalidad — necesita endpoint backend + dropdown/sheet de notifs. |
| 5 | **Search overlay mobile** | Solo Inventory lo implementa. Cost / Slicer / Queue / Maintenance / Vault / Compañía pueden agregarlo cuando necesiten. |
| 6 | **Historial reciente del filamento** | Section en el drawer-body, hoy con texto "pendiente". Necesita endpoint que retorne consumos desde quotes + queue + adjustes. |
| 7 | **Templates de WeasyPrint** | No tocados en este sprint, siguen funcionando como antes. |
| 8 | **Borrar pages/routes legacy** | `/inventory/stock`, `/inventory/filaments`, etc. siguen activos en `App.jsx` aunque ya no se referencian. Limpieza más invasiva — hacer cuando confirmemos que v2 cubre 100% de uso. |
| 9 | **Visual regression baselines** | Fase 8 — generar con `npm run e2e:update-snapshots`, commit `tests-e2e/__screenshots__/`, remove `continue-on-error` + `--grep-invert` del workflow. |

---

## Plan restante — Fases 2 a 8

| # | Fase | Source design | Rama propuesta |
|---|---|---|---|
| **2** | **Slicer v2** ← **EN CURSO** | `claude design/slicer.jsx` + `slicer-mobile.jsx` + `Slicer.html` + `Slicer móvil.html` | `feat/design-v2-slicer` |
| 3 | Queue v2 | `claude design/queue.jsx` + `queue-mobile.jsx` + screenshots `queue*.png` | `feat/design-v2-queue` |
| 4 | Maintenance v2 | `claude design/maintenance.jsx` + `maintenance-mobile.jsx` + `maint*.png` | `feat/design-v2-maintenance` |
| 5 | Vault v2 | `claude design/vault.jsx` + `vault-mobile.jsx` + `vault-thumbs.jsx` (helper) + `vault*.png` | `feat/design-v2-vault` |
| 6 | Company v2 | `claude design/company.jsx` + `company-mobile.jsx` + `company*.png` | `feat/design-v2-company` |
| 7 | Settings v2 (**NUEVA** app) | `claude design/settings.jsx` + `settings-mobile.jsx` + `settings*.png` | `feat/design-v2-settings` |
| 8 | Visual baselines + CI gate | — | `chore/visual-baselines` |

---

## Workflow obligatorio

```
1. git checkout main && git pull origin main
2. git checkout -b <prefix>/<descripcion>
3. <cambios + commits — el pre-commit hook valida automáticamente>
4. git push -u origin <rama>
5. gh pr create --base main
6. Esperar CI verde:  lint · test-backend · test-frontend · e2e-frontend
7. Merge solo cuando los 4 estén en verde
```

**NUNCA** push directo a `main`. Si CI falla, fix + new commit (no force-push a main).

---

## Reglas críticas (memorias del agente)

| Regla | Detalle |
|---|---|
| **No dev server** | `npm run dev` / `uvicorn` congelan la terminal de Giomar — siempre darle el comando para que lo corra él |
| **Migrar BD** | Cada PR que toca `backend/alembic/versions/` debe incluir `podman exec -it cfs-backend alembic upgrade head` |
| **Respetar design** | Cuando hay archivo en `claude design/`, implementar **1:1 sin proponer alternativas**. Es trabajo de otro agente |
| **Branch + PR** | Nunca push directo a main. Siempre rama → PR → CI → merge |
| **Sin "clásicas"** | Si v2 cubre la funcionalidad, eliminar refs en sidebar y links. Las rutas siguen activas hasta confirmar que v2 cubre 100% |
| **GitHub Free** | No branch protection nativa. Si upgradean a Pro, aplicar ruleset de `docs/branch-protection.md` |

---

## Contexto técnico para retomar

### Stack
- Frontend: React 19 + Vite 7 + TailwindCSS 4 (`@theme` tokens en `src/index.css`)
- Backend: FastAPI + SQLAlchemy async + PostgreSQL (asyncpg)
- Tests: Vitest + Playwright (frontend), pytest (backend)
- CI: self-hosted runner en server de Giomar
- Deploy: podman + quadlet en server Linux

### Primitives disponibles (todos en `components/ui/`)

**v1 (pre-Fase 0)**: `Button`, `Card`, `Chip`, `Input`, `KPI`, `Sparkline`, `Swatch`

**v2 (Fase 0)**: `PageShell`, `PageHeader`, `KPITile`, `StatusPill` (+ `STATUS_PRESETS`), `DropZone`, `ProgressBar`, `SearchField`, `ToolbarRow`, `EmptyState`

**Drawer/sheet**: `DetailDrawer` (eyebrow + footer + onEdit), `MobileSheet` (onEdit)

**Header mobile**: `components/MobileAppHeader.jsx` — props `appName`, `appIcon`, `appAccent`, `title`, `onMenu` (requerido), `onSearch` (opcional)

### Rutas v2 montadas en `App.jsx`
- `/` → `StudioHomePage`
- `/inventory/v2` → `InventoryPage` ✅ Fase 1
- `/cost/v2` → `CostPage` ⏳ Fase TBD
- `/cost/calculator/v2` → `CalculatorPageV2`
- `/slicer/v2` → `SlicerPage` ⏳ **Fase 2 en curso**
- `/queue/v2` → `QueuePageV2`
- `/maintenance/v2` → `MaintenancePageV2`
- `/vault/v2` → `VaultPageV2`
- `/company/v2` → `CompanyPageV2`
- `/settings/account|company|users` → `CuentaPage|EmpresaPage|UsuariosPage`

### Mobile responsive
- `useIsMobile()` hook → `(max-width: 1023px)`
- Mobile shell tiene FAB + MobileBottomNav fija
- `AppLayout` mobile expone `openSidebar` vía `useOutletContext()` — cada page debe consumirlo y pasarlo a `MobileAppHeader.onMenu`
- Desktop shell tiene StudioSidebar fija + DetailDrawer derecho

### Auth bypass para tests/dev
- `frontend/src/context/AuthContext.jsx` exporta `DEV_BYPASS_TOKEN` y `DEV_BYPASS_USER`
- Pantalla `/login` muestra botón "Bypass dev" cuando `import.meta.env.DEV`
- Helper en `tests-e2e/helpers/auth.js` (`loginAsDev`)
- API mock en `tests-e2e/helpers/apiMock.js` (intercepta `/api/**`)

### CI/CD
- 4 jobs en `.github/workflows/deploy.yml`: `lint` / `test-backend` / `test-frontend` / `e2e-frontend`
- E2E tiene `continue-on-error: true` y excluye visual regression con `--grep-invert`
- Visual baselines pendientes (Fase 8) — generar con `npm run e2e:update-snapshots`
- Backend coverage gate ≥80%
- Deploy job: `needs: [lint, test-backend, test-frontend]`, corre solo en push a main

---

## Comandos útiles

```bash
# Frontend
cd frontend
npm install                        # husky se auto-instala
npm test -- --run                  # Vitest (137 pass / 26 skip esperado)
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
podman exec -it cfs-backend alembic upgrade head   # migrar BD prod

# Deploy en server
ssh server "cd ~/collectors-forge-studio && git pull origin main && ./deploy.sh"
```

---

## Archivos importantes a revisar al retomar

**Source-of-truth del design**: `claude design/`
- `components.jsx` — primitives shared (ya portados en Fase 0)
- `<app>.jsx` + `<app>-mobile.jsx` — designs por app
- `<App>.html` + `<App> móvil.html` — HTML previews standalone
- `screenshots/` — capturas de cada app desktop + mobile

**Configuración del proyecto**:
- `CLAUDE.md` — contexto general del proyecto
- `docs/propuesta-ui-bambuddy.md` — plan original del refactor
- `docs/branch-protection.md` — workaround GitHub Free
- `frontend/src/index.css` — tokens CSS + utility classes
- `frontend/src/components/ui/index.js` — barrel de primitives

**Tests existentes**:
- `frontend/src/__tests__/` — Vitest unit
- `frontend/tests-e2e/` — Playwright E2E + visual
- `backend/tests/` — pytest
