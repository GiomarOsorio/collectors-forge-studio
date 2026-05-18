# Arquitectura del Sistema — Collector's Forge Studio

## Visión general

Collector's Forge Studio es una plataforma multi-aplicación para gestión de un negocio de impresión 3D. Está compuesta por varios microservicios en contenedores Podman, expuestos a internet a través de un Cloudflare Tunnel.

---

## Diagrama de contenedores

```
                          Internet
                             │
                    ┌────────▼────────┐
                    │  Cloudflare CDN  │
                    │  + DDoS Shield   │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │ Cloudflare Tunnel│
                    │  (cloudflared)   │
                    │   cfs-tunnel     │
                    └────────┬────────┘
                             │ HTTP interno
              ───────────────┼───────────────────────────
              Red: cfs (bridge)
                             │
                    ┌────────▼────────┐
                    │    Frontend      │
                    │  React + Nginx   │
                    │   cfs-frontend   │
                    │   :80 (3000)     │
                    └────────┬────────┘
                          /api/*
              ───────────────┼─────────────────
                             │
              ┌──────────────▼─────────────────┐
              │            Backend              │
              │          FastAPI                │
              │         cfs-backend             │
              │            :8000                │
              │                                 │
              │  • Routers (Auth, Quotes, etc.) │
              │  • Calculator (Decimal engine)  │
              │  • PDF Generator (ReportLab)    │
              │  • Liquid PDF (WeasyPrint)      │
              │  • Exchange Rate (open.er-api)  │
              │  • Tariff Scraper (EPM PDF)     │
              └──────┬───────────┬─────────────┘
                     │           │
         ┌───────────▼──┐    ┌───▼──────────┐
         │  PostgreSQL  │    │    Slicer      │
         │      16       │    │  OrcaSlicer   │
         │  cfs-postgres │    │  cfs-slicer   │
         │     :5432     │    │     :8001     │
         └───────────────┘    └──────┬────────┘
                                     │ volumen compartido
                             ┌────────▼────────┐
                             │   slicer_jobs/  │
                             │  (Podman volume) │
                             └─────────────────┘
```

**Tracker** (microservicio auxiliar):
```
cfs-tracker (:8002)
  └─ Escanea tracking de pedidos cada N minutos
  └─ Escribe estado en PostgreSQL (purchase_orders)
  └─ Accedido por backend: POST /inventory/purchases/scan-tracking
```

---

## Aplicaciones (apps)

Cada "app" es una sección de la SPA React con su propio layout y rutas:

| App | Color | Ruta base | Descripción |
|-----|-------|-----------|-------------|
| Cost | `#2DD4BF` | `/cost/` | Calculadora de costos de impresión |
| Inventario | `#3B82F6` | `/inventory/` | Inventario y pedidos de compra |
| Slicer | `#F59E0B` | `/slicer/` | Laminado STL / extracción G-code |
| Mantenimiento | `#8B5CF6` | `/maintenance/` | Registro de mantenimiento |
| Queue | `#14B8A6` | `/queue/` | Cola de impresión |
| Vault | `#F43F5E` | `/vault/` | Biblioteca de modelos `.3mf` / `.gcode.3mf` |
| Compañía | `#6366F1` | `/company/` | Perfil, branding y templates PDF |
| Settings | `#2DD4BF` | `/settings/` | Configuración global (electricidad, gastos fijos, etc.) |

La pantalla de inicio (`/`) es el **Collector's Forge Studio**, que muestra todas las apps como un panel estilo Okta. Los layouts viejos (`AppSwitcherDrawer`, `*Layout.jsx` por app) fueron eliminados en Fase 9 — todas las apps comparten `AppLayout.jsx` con el sidebar driven by `frontend/src/config/sidebar.js`.

Las rutas legacy `/xxx/v2` siguen funcionando como redirects de cortesía vía `<RedirectPreservingSearch>` en `App.jsx` (preserva query params).

---

## Estructura de archivos

```
collectors-forge-studio/
├── .github/
│   └── workflows/deploy.yml          # CI/CD: tests → deploy
│
├── backend/                          # Servicio API principal
│   ├── app/
│   │   ├── main.py                   # FastAPI app + lifespan + routers
│   │   ├── config.py                 # Settings (pydantic-settings, .env)
│   │   ├── database.py               # Engine async + Base ORM + get_db()
│   │   ├── limiter.py                # Rate limiting (slowapi)
│   │   │
│   │   ├── models/                   # SQLAlchemy ORM
│   │   │   ├── __init__.py           # Re-exporta todos los modelos
│   │   │   ├── company.py            # Company (UUID PK singleton, logo, pdf_palette JSONB)
│   │   │   ├── company_template.py   # CompanyTemplate (Liquid HTML)
│   │   │   ├── user.py               # User (oidc_sub, role admin/operator/viewer)
│   │   │   ├── model_file.py         # ModelFile (Vault .3mf en MinIO, uploaded_by FK→users)
│   │   │   ├── printer.py            # Printer (depreciación, mantenimiento)
│   │   │   ├── filament.py           # Filament (legacy, migrado a inventory)
│   │   │   ├── supply.py             # Supply (legacy, migrado a inventory)
│   │   │   ├── inventory.py          # InventoryItem (stock unificado)
│   │   │   ├── purchase_order.py     # PurchaseOrder + PurchaseOrderItem
│   │   │   ├── printed_item.py       # PrintedItem (impresiones 3D con foto)
│   │   │   ├── quote.py              # Quote (costo impresión, JSONB details)
│   │   │   ├── client_quote.py       # ClientQuote (multi-producto, COT-XXXX)
│   │   │   ├── settings.py           # AppSettings (por empresa)
│   │   │   ├── electricity_tariff.py # Historial tarifas EPM por mes/estrato
│   │   │   ├── slicing_job.py        # SlicingJob (STL/gcode procesados)
│   │   │   ├── maintenance.py        # MaintenancePrinter/Log/LogItem
│   │   │   └── queue.py              # PrintQueueItem (cola de impresión)
│   │   │
│   │   ├── schemas/                  # Pydantic v2 (request/response)
│   │   │   ├── company.py            # CompanyResponse, CompanyUpdate
│   │   │   ├── company_template.py   # Template CRUD + ValidateResponse
│   │   │   ├── user.py               # UserCreate, UserResponse, Token
│   │   │   ├── printer.py            # PrinterCreate/Update/Response
│   │   │   ├── quote.py              # QuoteRequest, QuoteCostBreakdown
│   │   │   ├── client_quote.py       # ClientQuoteCreate/Response
│   │   │   ├── inventory.py          # InventoryItem CRUD
│   │   │   ├── purchase_order.py     # PurchaseOrder + tracking fields
│   │   │   ├── printed_item.py       # PrintedItem CRUD + sell
│   │   │   ├── maintenance.py        # Log + summary schemas
│   │   │   ├── queue.py              # QueueItem + status update
│   │   │   └── slicer.py             # SlicingJob schemas
│   │   │
│   │   ├── routers/                  # Endpoints FastAPI
│   │   │   ├── auth.py               # GET /auth/me, POST /auth/logout (blacklist JWT)
│   │   │   ├── oidc.py               # GET /auth/oidc/login, /callback, /logout
│   │   │   ├── vault.py              # /vault/ — Vault de modelos .3mf (MinIO)
│   │   │   ├── company.py            # GET/PUT /company/, POST /company/logo
│   │   │   ├── company_templates.py  # CRUD + /validate + /preview
│   │   │   ├── users.py              # GET/PATCH /users/, PUT /users/me
│   │   │   ├── printers.py           # CRUD /printers/
│   │   │   ├── filaments.py          # CRUD /filaments/ (legacy)
│   │   │   ├── supplies.py           # CRUD /supplies/ (legacy)
│   │   │   ├── inventory.py          # /inventory/items/ + /purchases/ + /prints/
│   │   │   ├── purchase_orders.py    # Pedidos de compra + arrive + tracking
│   │   │   ├── printed_items.py      # /inventory/prints/ (CRUD + imagen + venta)
│   │   │   ├── quotes.py             # /quotes/ cálculo + historial + PDF
│   │   │   ├── client_quotes.py      # /client-quotes/ + PDF (Liquid/ReportLab)
│   │   │   ├── settings.py           # /settings/ + exchange-rate + tariff
│   │   │   ├── slicer.py             # /slicer/upload-gcode + stl + makerworld
│   │   │   ├── maintenance.py        # /maintenance/logs/ + /summary/
│   │   │   └── queue.py              # /queue/ cola activa + history
│   │   │
│   │   ├── services/                 # Lógica de negocio pura
│   │   │   ├── auth.py               # JWT create/verify, blacklist, get_current_user
│   │   │   ├── vault_storage.py      # MinIO: upload/download/delete via aiobotocore
│   │   │   ├── vault_metadata.py     # Fetch metadata MakerWorld/Printables/OG
│   │   │   ├── calculator.py         # Motor de cálculo (Decimal puro)
│   │   │   ├── pdf_generator.py      # ReportLab → PDF (fallback)
│   │   │   ├── liquid_pdf.py         # python-liquid + WeasyPrint → PDF
│   │   │   ├── exchange_rate.py      # Tasa USD/COP (open.er-api.com, caché 1h)
│   │   │   ├── tariff_scraper.py     # PDF EPM → tarifas por estrato (caché 24h)
│   │   │   ├── slicer_parser.py      # Parse .gcode/.3mf (pdfplumber)
│   │   │   └── makerworld_fetcher.py # Scraping API + HTML MakerWorld
│   │   │
│   │   └── static/                   # Archivos estáticos servidos por FastAPI
│   │       ├── logo.png              # Logo por defecto
│   │       ├── fonts/                # Fuentes para ReportLab
│   │       │   ├── TrajanPro-Bold.otf
│   │       │   └── TrajanPro-Regular.ttf
│   │       └── companies/            # Logos de la empresa (UUID como nombre)
│   │           └── {uuid}.{ext}
│   │
│   ├── alembic/                      # Migraciones de base de datos
│   │   ├── env.py                    # Configuración Alembic async
│   │   ├── script.py.mako            # Template para nuevas migraciones
│   │   └── versions/                 # Historial de migraciones (ver docs/base-de-datos.md)
│   │
│   ├── tests/                        # Suite de tests
│   │   ├── conftest.py               # Fixtures MagicMock (sin DB real)
│   │   ├── test_calculator.py        # Motor de cálculo
│   │   ├── test_pdf_generator.py     # ReportLab PDF
│   │   ├── test_manual_quote.py      # Cotizaciones manuales
│   │   ├── test_integration_http.py  # 21 tests HTTP con httpx
│   │   ├── test_queue.py             # Cola de impresión
│   │   ├── test_slicer_parser.py     # Parser G-code
│   │   ├── test_slicer_router_helpers.py
│   │   ├── test_exchange_rate.py
│   │   ├── test_tariff_scraper.py
│   │   ├── test_makerworld_fetcher.py
│   │   └── test_printed_item_schemas.py
│   │
│   ├── Containerfile                 # Imagen Python 3.11-slim + WeasyPrint deps
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── pytest.ini
│   └── .coveragerc
│
├── frontend/                         # SPA React
│   ├── src/
│   │   ├── App.jsx                   # Router raíz + PrivateRoute + AppRoutes
│   │   ├── main.jsx                  # Entry point React
│   │   ├── index.css                 # TailwindCSS v4 + clases custom tf-*
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # JWT: login, logout, user state
│   │   │   └── DirtyStateContext.jsx # Rastreo de forms sin guardar
│   │   │
│   │   ├── components/
│   │   │   ├── AppLayout.jsx         # Shell global (mobile: drawer; desktop: sidebar + main)
│   │   │   ├── StudioSidebar.jsx     # Sidebar unificada con todas las apps
│   │   │   ├── MobileAppHeader.jsx   # Header mobile compartido (hamburger + título + search)
│   │   │   ├── MobileBottomNav.jsx   # Bottom nav fija en mobile
│   │   │   ├── Dashboard.jsx         # Widgets del StudioHomePage
│   │   │   ├── Breadcrumb.jsx        # Migas en headers desktop
│   │   │   ├── EmptyState.jsx        # Empty state legacy (el primitive vive en components/ui/)
│   │   │   ├── ConfirmDialog.jsx     # Modal de confirmación global
│   │   │   ├── HoverCard.jsx         # Hover cards reutilizables
│   │   │   ├── SkeletonLoader.jsx    # Skeletons compartidos
│   │   │   ├── ModelViewer3D.jsx     # Visor 3D de modelos STL
│   │   │   ├── slicer/               # Componentes específicos del Slicer
│   │   │   ├── widgets/              # Widgets del dashboard (LowStock, etc.)
│   │   │   └── ui/                   # Primitives compartidos (Button, Card, KPI,
│   │   │                              # StatusPill, DetailDrawer, MobileSheet, EmptyState,
│   │   │                              # DropZone, ProgressBar, SearchField, ToolbarRow,
│   │   │                              # Chip, Input, Sparkline, Swatch, etc.)
│   │   │
│   │   ├── config/
│   │   │   ├── apps.js               # Definición de las apps (id, nombre, ruta, color)
│   │   │   ├── sidebar.js            # Sidebar config (apps + items secundarios)
│   │   │   ├── materials.js          # Tipos de filamento (PLA/PETG/ABS/...)
│   │   │   └── maintenance.js        # 12 tipos de mantenimiento BambuLab P2S
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── AuthSuccess.jsx       # Callback OIDC
│   │   │   ├── StudioHomePage.jsx    # Panel de apps (estilo Okta)
│   │   │   ├── CalculatorPage.jsx    # Calculadora de costos (multi-filamento, insumos extra)
│   │   │   ├── ManualQuotePage.jsx   # Cotización manual multi-producto
│   │   │   ├── PrintersPage.jsx      # Gestión de impresoras
│   │   │   ├── HistoryPage.jsx       # Historial de cotizaciones internas
│   │   │   ├── CostSettingsPage.jsx  # Tarifa eléctrica & ajustes calc
│   │   │   ├── company/
│   │   │   │   ├── CompanyPage.jsx              # Dashboard con drawers integrados
│   │   │   │   └── CompanyTemplateEditorPage.jsx # Editor Liquid + validar + preview
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryPage.jsx            # Tabs internos (Filamentos/Insumos/Herr/Cons/Compras)
│   │   │   │   ├── InventoryPrintsPage.jsx      # Impresiones con fotos
│   │   │   │   ├── InventoryPurchasesPage.jsx   # Tabla de pedidos
│   │   │   │   └── InventoryImportExportPage.jsx # Bulk CSV import/export
│   │   │   ├── cost/
│   │   │   │   └── CostPage.jsx                 # Dashboard (Cotizaciones / Historial / Calc)
│   │   │   ├── maintenance/
│   │   │   │   └── MaintenancePage.jsx          # Dashboard + Historial + CRUD logs vía drawers
│   │   │   ├── queue/
│   │   │   │   └── QueuePage.jsx                # Tabs Activa / Historial + VaultPicker
│   │   │   ├── settings/
│   │   │   │   └── SettingsPage.jsx             # Cuenta + Usuarios (admin) vía drawers
│   │   │   ├── slicer/
│   │   │   │   └── SlicerPage.jsx               # Tabs Subir / Historial + drawer detalle
│   │   │   └── vault/
│   │   │       ├── VaultPage.jsx                # Galería .3mf / .gcode.3mf
│   │   │       └── VaultUploadPage.jsx          # Dual upload (admin)
│   │   │
│   │   ├── services/
│   │   │   └── api.js                # Axios + interceptors + todas las funciones API
│   │   │
│   │   └── utils/
│   │       └── apiError.js           # Helper para extraer mensaje de error de Axios
│   │
│   ├── nginx.conf                    # Config Nginx (proxy API, SPA fallback, headers)
│   ├── Containerfile                 # Multi-stage: Node build → Nginx serve
│   ├── vite.config.js                # Vite + proxy /api → localhost:8000
│   └── package.json
│
├── slicer/                           # Microservicio OrcaSlicer
│   ├── app.py                        # FastAPI pequeño: /slice, /health, /cli-help
│   ├── Containerfile                 # Ubuntu 24.04 + OrcaSlicer AppImage
│   └── requirements.txt
│
├── tracker/                          # Microservicio de tracking de pedidos
│   ├── app.py                        # Escanea tracking URLs y actualiza DB
│   ├── Containerfile
│   └── requirements.txt
│
├── quadlet/                          # Definiciones systemd (Podman Quadlet)
│   ├── cfs.network
│   ├── cfs-data.volume
│   ├── cfs-pgdata.volume
│   ├── cfs-slicer-jobs.volume
│   ├── cfs-postgres.container
│   ├── cfs-backend.container
│   ├── cfs-frontend.container
│   ├── cfs-slicer.container
│   └── cfs-tunnel.container
│
├── deploy.sh                         # Script de despliegue completo
├── podman-compose.yml                # Alternativa a Quadlet (desarrollo/staging)
└── .env.example                      # Plantilla de variables de entorno
```

---

## Modelo de datos — resumen

### Empresa singleton

La app opera en modo mono-empresa. `Company` (UUID fijo `00000000-0000-0000-0000-000000000001`) existe como singleton para datos de perfil, branding y templates PDF. El `company_id` fue **eliminado** de todas las tablas operativas en la migración `h2i3j4k5l6m7`.

```
Company (UUID PK — singleton)
  └── AppSettings (singleton, LIMIT 1)
  └── CompanyTemplate (templates Liquid para PDF)
```

### Entidades principales

| Entidad | Tabla | Descripción |
|---------|-------|-------------|
| `Company` | `companies` | Empresa singleton: nombre, logo, pdf_palette (JSONB), pdf_terms |
| `CompanyTemplate` | `company_templates` | Template Liquid HTML para PDF de cotizaciones |
| `User` | `users` | Usuario OIDC: `oidc_sub`, `role` (admin/operator/viewer) |
| `Printer` | `printers` | Impresora 3D con parámetros de costo |
| `InventoryItem` | `inventory_items` | Stock unificado: filamentos, insumos, herramientas |
| `PurchaseOrder` | `purchase_orders` | Pedido de compra con tracking internacional |
| `PrintedItem` | `printed_items` | Impresión terminada con foto e inventario |
| `Quote` | `quotes` | Cálculo de costo de impresión guardado |
| `ClientQuote` | `client_quotes` | Cotización multi-producto para cliente (COT-XXXX) |
| `AppSettings` | `app_settings` | Config global singleton (tarifas, margen) |
| `ElectricityTariff` | `electricity_tariffs` | Historial tarifas EPM por mes/estrato |
| `SlicingJob` | `slicing_jobs` | Trabajo de laminado STL/G-code |
| `MaintenancePrinter` | `maintenance_printers` | Impresora registrada para mantenimiento |
| `MaintenanceLog` | `maintenance_logs` | Registro de mantenimiento con items usados |
| `PrintQueueItem` | `print_queue` | Item en cola de impresión (pending/printing/done/cancelled) |
| `ModelFile` | `model_files` | Archivo `.3mf` en MinIO con metadatos de display (Vault) |

### Cuota y almacenamiento del Vault

MinIO corre en máquina separada (`turtleStorage`). El backend es el único que accede a MinIO — el frontend nunca toca MinIO directamente. La cuota se configura con `VAULT_QUOTA_GB` (Infisical `/collectorsforge`).

```
Frontend → GET /api/vault/{id}/download → Backend → MinIO (turtleStorage:9000)
```

---

## Flujo de generación de PDF de cotización cliente

```
GET /api/client-quotes/{id}/pdf
          │
          ▼
  ¿Tiene la empresa un CompanyTemplate
   activo (is_default=true) para tipo "cot" o "all"?
          │
    ┌─────┴──────┐
    │ Sí         │ No
    ▼            ▼
python-liquid   ReportLab
+ WeasyPrint    pdf_generator.py
liquid_pdf.py   (fallback con
                 colores de Company)
    │            │
    └─────┬──────┘
          ▼
    PDF bytes → Response(media_type="application/pdf")
```

---

## Flujo de autenticación

```
Usuario hace click en "Iniciar sesión con SSO"
          │
          ▼
GET /api/auth/oidc/login
          │  genera state, nonce, code_verifier (PKCE)
          │  guarda en SessionMiddleware
          ▼
Redirect → Authentik (o proveedor OIDC)
          │  usuario se autentica en el IdP
          ▼
GET /api/auth/oidc/callback?code=...&state=...
          │
          ├─ Intercambia code por tokens (con PKCE)
          ├─ Extrae claims: sub, email, preferred_username
          ├─ Busca User por oidc_sub en DB
          │    └─ Si no existe: JIT provisioning
          │         └─ Primer usuario → role='admin'
          │         └─ Siguientes   → role='operator'
          ├─ Emite JWT local (python-jose, HS256, 24h)
          ▼
Redirect → /auth/success?token=<JWT>
          │
          ▼
Frontend guarda token en localStorage
          │
          ▼
Cada request: Authorization: Bearer <token>
          │
          ▼
Backend: oauth2_scheme → verify_token → current_user
          │
          ▼
Si 401 → frontend dispara 'auth:unauthorized' → redirect /login
```

---

## Motor de cálculo (calculator.py)

El motor opera exclusivamente con `Decimal` para evitar errores de punto flotante (IEEE 754). Los valores de la base de datos llegan como `Decimal` (columnas `Numeric`). Los valores de JSON se convierten con `_d(value)` antes de cualquier operación.

```
Fórmula (en orden):

1. material_cost   = Σ(gramos × precio_por_kg / 1000)
2. electricity     = (watts × horas / 1000) × tarifa_kWh
3. depreciation    = (precio_impresora / vida_util) × horas
4. maintenance     = (nozzle/vida + placa/vida + otros) × horas
5. labor           = (t_prep + t_post) × costo_hora
6. base_cost       = sum(1..5)
7. failure_cost    = base_cost × (failure_rate / 100)
8. subtotal        = base_cost + failure_cost
9. supplies_cost   = Σ(qty × price_per_unit)
10. subtotal_final = subtotal + supplies_cost
11. margin_amount  = subtotal_final × (margin / 100)
12. total_per_unit = (subtotal_final + margin_amount) / quantity
```

---

## Sistema de templates Liquid

Los templates de cotización son HTML puro con sintaxis Liquid. Se procesan con `python-liquid` y se convierten a PDF con **WeasyPrint**.

### Restricciones de CSS en WeasyPrint

WeasyPrint no es un navegador completo. Estas propiedades CSS **no funcionan**:

| No soportado | Alternativa |
|---|---|
| `display: flex` | `<table>` o bloques inline |
| `display: grid` | `<table>` |
| `gap` en flex/grid | `padding`/`margin` en celdas |
| `linear-gradient()` | Color sólido |
| `position: fixed/absolute` | No usar |
| `overflow: hidden` con `border-radius` | Simplificar |
| `var(--variable)` | Variables Liquid directamente |

Ver [templates-liquid.md](templates-liquid.md) para la guía completa de variables disponibles.

---

## Red interna (Podman)

Todos los contenedores se comunican en la red `cfs` (bridge). Los nombres de contenedor sirven como hostnames:

| Hostname interno | Puerto | Quién lo usa |
|---|---|---|
| `cfs-postgres` | `5432` | backend, tracker |
| `cfs-backend` | `8000` | frontend (nginx proxy) |
| `cfs-slicer` | `8001` | backend (POST /slicer/*) |
| `cfs-tracker` | `8002` | backend (POST /scan-tracking) |
| `cfs-frontend` | `80` | cloudflared tunnel |

---

## Volúmenes persistentes

| Volumen | Montaje | Contenido |
|---|---|---|
| `cfs-pgdata` | `/var/lib/postgresql/data` | Datos PostgreSQL |
| `cfs-slicer-jobs` | `/slicer_jobs` | Archivos STL/G-code temporales |

> **Nota:** Los binarios de la app (thumbnails del Vault, logo de
> empresa, imágenes de PrintedItem, archivos del Vault `.3mf`) **no se
> guardan en un volumen local** — viven en **MinIO** (`turtleStorage:9000`,
> bucket `cfs-models`) bajo prefijos dedicados (`thumbnails/`,
> `companies/`, `prints/`, archivos del Vault). El backend es el único
> proceso que toca MinIO; al frontend lo expone vía endpoints proxy
> (`GET /api/vault/{id}/thumbnail`, `GET /api/company/logo`,
> `GET /api/inventory/prints/{id}/image`) con `Cache-Control:
> public, max-age=86400`.

---

## CI/CD

```
git push → main   (o workflow_dispatch manual desde GitHub Actions UI)
      │
      ▼
GitHub Actions (self-hosted)
      │
      ├─ Setup Python 3.11
      ├─ pip install requirements.txt
      ├─ alembic upgrade head (PostgreSQL CI)
      ├─ pytest --cov --cov-fail-under=80
      └─ Upload coverage.xml artifact
      │
      ▼ (solo si tests pasan Y es push a main)
Self-hosted runner (Linux PC)
      │
      ├─ git pull origin main
      └─ ./deploy.sh
            │
            ├─ podman build (backend, frontend, slicer)
            ├─ podman pull postgres:16-alpine
            ├─ Instalar Quadlets → systemctl daemon-reload
            ├─ systemctl restart cfs-postgres
            ├─ Esperar PostgreSQL ready (pg_isready)
            ├─ podman run --rm → alembic upgrade head
            ├─ systemctl restart backend, slicer, frontend
            ├─ Verificar /api/health
            └─ systemctl restart cfs-tunnel
```
