# Calculator3D — Contexto del Proyecto

## Descripción General
- **Repo**: github.com/GiomarOsorio/Calculator3D (privado)
- **Propósito**: App web para calcular costos reales de impresión 3D (material, electricidad, depreciación, mantenimiento, mano de obra, tasa de fallo, margen)
- **Usuario**: GiomarOsorio (Giomar), habla español, UI en español
- **Impresora**: BambuLab P2S Combo (oct 2025 — volumen 256³mm, DynaSense, pantalla 5", AMS 2 Pro, $799)
- **Contexto de negocio**: Negocio en inicio, sin IVA por ahora

## Arquitectura
- **Backend**: FastAPI (Python 3.11 en contenedor, 3.9 en Mac dev) + SQLAlchemy async + PostgreSQL (asyncpg)
- **Frontend**: React 19 + Vite 7 + TailwindCSS 4 + Axios + React Router DOM
- **Auth**: JWT (python-jose + passlib/bcrypt) + futura integración Cloudflare Access
- **PDF**: ReportLab (generación en memoria) + WeasyPrint (templates Liquid personalizados)
- **Contenedores**: Podman + Quadlet (systemd), NO Docker
- **Deploy**: PC Linux separada (no la Mac dev), via Cloudflare Tunnel en `3d.turtledev.dev`

## Archivos Clave
- Backend entry: `backend/app/main.py`
- Motor de costos: `backend/app/services/calculator.py`
- Generador PDF: `backend/app/services/pdf_generator.py`
- PDF Liquid: `backend/app/services/liquid_pdf.py`
- Modelo Company: `backend/app/models/company.py`
- Página cotización manual: `frontend/src/pages/ManualQuotePage.jsx`
- Frontend entry: `frontend/src/App.jsx`
- API service: `frontend/src/services/api.js`
- Deploy: `deploy.sh`, `podman-compose.yml`, `quadlet/`
- Containerfiles: `backend/Containerfile`, `frontend/Containerfile`, `frontend/nginx.conf`
- CI/CD: `.github/workflows/deploy.yml`

## Convenciones
- Toda la documentación de código en español (docstrings, JSDoc, comentarios)
- README en español
- Backend usa `Optional[str]` (NO `str | None`) para compatibilidad con Python 3.9 en Mac dev
- `bcrypt` fijado a `4.0.1` (incompatibilidad con passlib en bcrypt 5.0)
- `email-validator` declarado explícitamente en requirements.txt

## Base de Datos
- PostgreSQL con asyncpg
- Alembic para migraciones; head actual: `f5a6b7c8d9e1` (merge palette+categories)
- Migrar en servidor: `alembic upgrade head` dentro del contenedor backend
- **asyncpg + DateTime**: rechaza `datetime` timezone-aware en `TIMESTAMP WITHOUT TIME ZONE`. Usar `.replace(tzinfo=None)` o `DateTime(timezone=True)`.
- **ALTER TYPE JSONB**: DROP DEFAULT → ALTER TYPE JSONB USING col::jsonb → SET DEFAULT '[]'::jsonb
- **UNIQUE constraint**: Si tabla tiene UNIQUE, un UPDATE masivo falla si ya existe fila con ese valor. Patrón: `DELETE FROM t WHERE col IS NULL AND EXISTS (...)` antes del UPDATE.
- Si aparece "Multiple head revisions": crear merge migration con `down_revision = (head1, head2)`

## Multi-tenant (company_id)
- Modelo `Company` (UUID PK) en `backend/app/models/company.py`
- `company_id` presente en: User, Filament, Printer, Supply, AppSettings, Quote
- Todos los routers filtran por `current_user.company_id`
- Empresa por defecto UUID `00000000-0000-0000-0000-000000000001` creada en `main.py`
- **Empresa default**: "The Collector Forge"
- AppSettings: UNIQUE en `company_id` (no en `user_id`); `user_id` ahora nullable

## Estructura de Apps (TurtleForge Studio)
| App | Ruta | Color | Ícono |
|-----|------|-------|-------|
| Studio Home | `/` | — | — |
| Cost | `/cost/*` | — | — |
| Inventario | `/inventory/*` | — | — |
| Slicer | `/slicer/*` | amber #F59E0B | Cpu |
| Cola | `/queue/*` | teal #14B8A6 | ListOrdered |
| Compañía | `/company/*` | indigo #6366F1 | Building2 |
| Mantenimiento | `/maintenance/*` | violeta #8B5CF6 | Wrench |

- `StudioHomePage.jsx` dentro de `StudioLayout.jsx` — panel estilo Okta
- `AppSwitcherDrawer.jsx`: cajón z-50 para cambiar entre apps (advierte si hay datos sin guardar)
- `DirtyStateContext.jsx`: Set-based registry de formularios sucios (`setDirty/clearDirty/isDirty`)
- Login redirige a `/` (StudioHomePage)

## Modelos y Migraciones (orden cronológico)
1. Base tables (users, printers, filaments, supplies, quotes)
2. `b1c2d3e4f5a6` — inventory_items + purchase_orders
3. `c2d3e4f5a6b7` — inventario unificado (filamentos e insumos → inventory_items)
4. `c3d4e5f6a7b8` — maintenance (MaintenancePrinter, MaintenanceLog, MaintenanceLogItem)
5. `d1e2f3a4b5c6` — printed_items
6. `d3e4f5a6b7c8` — slicing_jobs
7. `d5e6f7a8b9c0` — print_queue
8. `e4f5a6b7c8d0` — inventory_categories (7 seed: Filamento is_system+decimals, 6 sin decimales)
9. `e6f7a8b9c0d1` — (rama palette_jsonb)
10. `f4a1b9c2d8e7` — multi-tenant company_id
11. `f7a8b9c0d1e2` — company_pdf_settings (5 campos color + CompanyTemplate)
12. `f5a6b7c8d9e1` — **merge migration** (head actual, une e4f5... con palette_jsonb)

## Cotización Manual (ClientQuote)
- Endpoint: `POST /api/client-quotes/`
- Modelo: `ClientQuote` en `backend/app/models/client_quote.py`
- Schema: `ClientQuoteCreate` con items `[{name, quantity, unit_price}]`
- Frontend: `/cost/manual` → `ManualQuotePage.jsx`
- Historial: `/cost/quotes` → `QuotesPage.jsx` (COT-XXXX, PDF descargable)
- PDF: `generate_client_quote_pdf()` en `pdf_generator.py`

## App Cola de Impresión
- Rutas: `/queue/` (activa), `/queue/history` (historial)
- Modelo: `PrintQueueItem` — status: pending|printing|done|cancelled, position
- `quote_id` FK → quotes (ondelete="SET NULL")
- Al marcar done: descuenta filamento, adicionales, insumos; suma horas a `printer.current_hours`
- `supplies_detail` JSONB: `{supply_id, name, unit, price_per_unit, quantity}`
- `additional_filaments_detail` JSONB: `{filament_id, name, weight_grams, material_cost}`

## App Compañía / PDF Templates
- Rutas: `/company/profile`, `/company/branding`, `/company/templates`
- 5 campos color en Company: `pdf_color_primary/accent/highlight/table_text` + `pdf_terms`
- `CompanyTemplate` — template Liquid HTML para PDF de cotizaciones
- `liquid_pdf.py` — python-liquid render + WeasyPrint PDF
- Router: `company_templates.py` — CRUD + `/validate` + `/{id}/preview` + `/default-template`
- `client_quotes.py`: despacha a WeasyPrint si hay CompanyTemplate `is_default=True`
- WeasyPrint deps en Containerfile: `libpango`, `libpangocairo`, `libgdk-pixbuf`, `libcairo2`
- **WeasyPrint CSS**: NO soporta flex/grid/position:absolute. Usar `<table>` para layouts multi-columna.
- **Templates**: van en `/company/templates` (UI/DB), NO en código Python. Si Giomar pide modificar el template, retornar el HTML corregido como texto para copy-paste.

## App Mantenimiento
- Rutas: `/maintenance/dashboard`, `/maintenance/logs`, `/maintenance/printers`
- 3 modelos: `MaintenancePrinter`, `MaintenanceLog`, `MaintenanceLogItem`
- Descuento atómico de inventario al crear un log
- Dashboard: tarjetas por impresora con badges 🟢🟡🔴 por tipo de mantenimiento
- Config tipos: `frontend/src/config/maintenance.js` (12 tipos basados en wiki BambuLab P2S)

## App Slicer
- Rutas: `/slicer/upload`, `/slicer/history`
- 3 flujos: `.gcode/.3mf` (parse inmediato), STL (OrcaSlicer background), URL MakerWorld
- "Usar en Calculadora" → `/cost/calculator?weight_grams=X&print_time_hours=Y&filament_type=Z`
- `CalculatorPage` lee URL params con `useSearchParams`, convierte horas→minutos
- OrcaSlicer nightly: `slicer/Containerfile` (Ubuntu 24.04 + AppImage --appimage-extract)
- nginx: `client_max_body_size 250M`; api.js slicer usa `/slicer/` (NO `/api/slicer/`)
- MakerWorld fetcher: httpx + try API `/api/v1/design-service/design/{id}` → HTML `__NEXT_DATA__`
- `_es_3mf_proyecto()`: detecta ZIP con modelo pero sin .gcode

## Inventario / Categorías
- `InventoryItem` + `PurchaseOrder` + `PrintedItem` + `InventoryCategory`
- 7 categorías seed: Filamento (is_system, allows_decimals=True), 6 sin decimales
- `InventoryStockPage` con sort por columnas, paginación 15 items, step dinámico por categoría
- `InventoryFilamentsPage` + `InventorySuppliesPage` son wrappers de `InventoryStockPage`
- Imágenes de impresiones: `POST /{id}/image` → `/app/static/prints/`, StaticFiles en `/static`

## Calculator (Motor de Cálculo)
- Calcula en precisión completa `Decimal`, solo redondea al retornar
- `electricity` interno = 0.105 (no 0.11)
- Nunca usar float en tests — siempre `Decimal` con valores pre-calculados

## Testing
- **Correr tests**: `backend/venv/bin/python3 -m pytest backend/tests/ -v` (402 tests, todos pasan)
- `tests/conftest.py` — fixtures MagicMock (sin DB real — no detecta bugs asyncpg)
- CI requiere coverage ≥ 80% (`--cov-fail-under=80`)
- Frontend: Vitest + React Testing Library (`npm test` en `/frontend`)
- **IMPORTANTE**: Tests usan MagicMock — bugs de asyncpg/PostgreSQL NO son capturados por tests

## CI/CD (`deploy.yml`)
- Un solo workflow: job `test` → job `deploy`
- `deploy` tiene `needs: test` — bloqueado si tests fallan
- `deploy` solo corre en push a `main`; `test` corre en push a main Y en PRs
- Runner deploy: self-hosted en la PC Linux
- Si el runner está offline: `cd ~/actions-runner && sudo ./svc.sh start`

## Git / GPG
- Email: giosorio30@gmail.com — Nombre: Giomar Gustavo Osorio Guevara
- GPG signing activo (`commit.gpgsign=true`), clave `E27EC9BF82C8078A`
- gpg-agent: `allow-loopback-pinentry` + TTL 7 días
- Si expira la caché GPG: `echo "test" | gpg --sign > /dev/null`

## Problemas Conocidos / Patrones de Fix
- **asyncpg + datetime**: siempre `.replace(tzinfo=None)` en columnas `TIMESTAMP WITHOUT TIME ZONE`
- **bcrypt 5.0**: no compatible con passlib → pinear `bcrypt==4.0.1`
- **email-validator**: declarar explícitamente, no usar extra de pydantic
- **str | None en Python 3.9**: usar `Optional[str]` de `typing`
- **UNIQUE en migración con datos existentes**: DELETE duplicados antes de `create_unique_constraint`
- **ALTER TYPE JSONB**: DROP DEFAULT → ALTER → SET DEFAULT '[]'::jsonb
- **InventoryStockPage**: `parseInt()` al guardar IDs desde `<select>` HTML (retorna string)
- **Multiple head revisions Alembic**: crear merge migration con `down_revision = (head1, head2)`

## Cloudflare
- Tunnel: gratis
- Bot Fight Mode / challenge page: gratis (plan free)
- Turnstile: gratis hasta 1M req/mes
- Access (auth futura): gratis hasta 50 usuarios

## Documentación
- `docs/arquitectura.md` — diagrama contenedores, estructura archivos, modelos, flujos
- `docs/despliegue.md` — instalación, CI/CD, backup, rollback
- `docs/desarrollo.md` — setup local, tests, convenciones, agregar nueva app
- `docs/base-de-datos.md` — migraciones Alembic, esquema completo de tablas
- `docs/api.md` — referencia completa endpoints REST
- `docs/templates-liquid.md` — variables Liquid, CSS WeasyPrint, template de referencia
