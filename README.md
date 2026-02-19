# Calculator3D

Calculadora de costos de impresión 3D con interfaz web. Calcula el precio real de una pieza considerando todos los factores: material, electricidad, depreciación del equipo, mantenimiento, mano de obra, insumos adicionales, tasa de fallos y margen de ganancia. Incluye conversión automática USD → COP y tarifas de electricidad EPM en tiempo real.

## Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación para Desarrollo](#instalación-para-desarrollo)
- [Despliegue en Producción](#despliegue-en-producción)
- [CI/CD con GitHub Actions](#cicd-con-github-actions)
- [Configuración de Cloudflare Tunnel](#configuración-de-cloudflare-tunnel)
- [Configuración de Quadlet (systemd)](#configuración-de-quadlet-systemd)
- [Migración de Base de Datos](#migración-de-base-de-datos)
- [Uso de la Aplicación](#uso-de-la-aplicación)
- [Fórmula de Cálculo](#fórmula-de-cálculo)
- [API Endpoints](#api-endpoints)
- [Variables de Entorno](#variables-de-entorno)

---

## Características

- **Calculadora de costos** con desglose completo: material, electricidad, depreciación, mantenimiento, mano de obra, insumos, fallos y margen
- **Insumos adicionales** — catálogo de materiales no plásticos (argollas, switches, imanes, etc.) comprados por paquete con precio/unidad calculado automáticamente
- **Multi-filamento / multicolor** — soporte para piezas que usan más de un filamento/color
- **Conversión USD → COP** automática en los resultados con tasa de cambio en tiempo real (open.er-api.com) + markup configurable
- **Tarifa EPM automática** — descarga el PDF oficial de EPM cada 24 h, extrae las tarifas de los 6 estratos, las guarda en historial por mes y las convierte a USD/kWh
- **Base de datos de filamentos** (marca, tipo, color, precio por kg, densidad)
- **Gestión de impresoras** con depreciación y costos de mantenimiento (boquilla, placa, etc.)
- **Historial de cotizaciones** con búsqueda y detalle
- **Exportación a PDF** de cotizaciones para enviar a clientes
- **Autenticación JWT** con usuarios y roles (admin)
- **Interfaz web moderna** responsive con TailwindCSS
- **Contenedorizado** con Podman (compatible con Docker)
- **CI/CD automático** con GitHub Actions self-hosted runner
- **Cloudflare Tunnel** integrado para acceso seguro desde internet
- **Base de datos migrable** de SQLite a PostgreSQL cambiando una sola línea

---

## Arquitectura

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│   Frontend   │     │     Backend      │     │  Database  │
│   React +    │────▶│    FastAPI +     │────▶│   SQLite   │
│   Nginx      │ API │   SQLAlchemy     │     │  (archivo) │
│  :80 (3000)  │     │     :8000        │     └────────────┘
└──────────────┘     │   + ReportLab    │──▶ PDF
       ▲             │   + pdfplumber   │──▶ EPM scraping
       │             │   + httpx        │──▶ exchange rate
┌──────────────┐     └──────────────────┘
│  Cloudflare  │
│   Tunnel     │  ◀── 3d.turtlenode.dev
│ (cloudflared)│
└──────────────┘
```

**Flujo de red:**

```
Internet → Cloudflare Access → Cloudflare Tunnel → Nginx (frontend) → FastAPI (backend) → SQLite
```

**Flujo CI/CD:**

```
git push → GitHub → GitHub Actions → self-hosted runner (laptop) → git pull + deploy.sh
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Backend** | Python + FastAPI | 3.11 / 0.115.x |
| **ORM** | SQLAlchemy (async) | 2.0.x |
| **Base de datos** | SQLite con aiosqlite (migrable a PostgreSQL) | - |
| **Autenticación** | JWT (python-jose + passlib/bcrypt) | bcrypt 4.0.1 |
| **PDF** | ReportLab | 4.2.x |
| **Scraping PDF** | pdfplumber | 0.11.4 |
| **HTTP async** | httpx | - |
| **Frontend** | React + Vite | 19 / 7.x |
| **CSS** | TailwindCSS | 4.x |
| **Iconos** | Lucide React | - |
| **HTTP Client** | Axios | - |
| **Contenedores** | Podman (compatible Docker) | 5.x |
| **Tunnel** | Cloudflare Tunnel (cloudflared) | latest |
| **Servidor web** | Nginx (frontend container) | alpine |
| **CI/CD** | GitHub Actions + self-hosted runner | - |

---

## Estructura del Proyecto

```
Calculator3D/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: auto-deploy en push a main
├── backend/
│   ├── app/
│   │   ├── main.py                 # Punto de entrada FastAPI + migraciones SQLite
│   │   ├── config.py               # Configuración desde variables de entorno
│   │   ├── database.py             # Conexión SQLAlchemy async
│   │   ├── models/                 # Modelos SQLAlchemy (tablas BD)
│   │   │   ├── user.py             # Usuarios y autenticación
│   │   │   ├── filament.py         # Filamentos (marca, tipo, precio/kg)
│   │   │   ├── printer.py          # Impresoras 3D (depreciación, mantenimiento)
│   │   │   ├── settings.py         # Configuración por usuario
│   │   │   ├── quote.py            # Cotizaciones guardadas (incluye insumos y multifilamento)
│   │   │   ├── supply.py           # Insumos adicionales (argollas, switches, etc.)
│   │   │   └── electricity_tariff.py  # Historial de tarifas EPM por mes y estrato
│   │   ├── schemas/                # Schemas Pydantic (validación de datos)
│   │   │   ├── user.py             # Schemas de auth y tokens
│   │   │   ├── filament.py         # Schemas CRUD filamentos
│   │   │   ├── printer.py          # Schemas CRUD impresoras
│   │   │   ├── settings.py         # Schemas configuración
│   │   │   ├── quote.py            # Schemas cálculo (incluye FilamentItem, SupplyItemRef)
│   │   │   └── supply.py           # Schemas CRUD insumos (con pack_qty y pack_price)
│   │   ├── routers/                # Endpoints API REST
│   │   │   ├── auth.py             # Login, registro, perfil
│   │   │   ├── filaments.py        # CRUD filamentos
│   │   │   ├── printers.py         # CRUD impresoras
│   │   │   ├── settings.py         # Configuración + tarifas EPM + tasa de cambio
│   │   │   ├── quotes.py           # Cálculo (con insumos y multifilamento), historial, PDF
│   │   │   └── supplies.py         # CRUD insumos con cálculo automático de precio/unidad
│   │   └── services/               # Lógica de negocio
│   │       ├── auth.py             # JWT, bcrypt, middleware auth
│   │       ├── calculator.py       # Motor de cálculo (material + insumos + multifilamento)
│   │       ├── pdf_generator.py    # Generador de PDF con ReportLab
│   │       ├── exchange_rate.py    # Tasa USD/COP en tiempo real (open.er-api.com, caché 1h)
│   │       └── tariff_scraper.py   # Scraping PDF EPM: todos los estratos, caché 24h
│   ├── Containerfile               # Imagen del backend (Python 3.11)
│   ├── requirements.txt            # Dependencias Python
│   └── .env.example                # Plantilla de variables de entorno
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Componente raíz con routing (incluye /supplies)
│   │   ├── main.jsx                # Entry point React
│   │   ├── index.css               # TailwindCSS imports
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Contexto de autenticación JWT
│   │   ├── components/
│   │   │   └── Layout.jsx          # Layout principal con sidebar (7 secciones)
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Página de login
│   │   │   ├── CalculatorPage.jsx  # Calculadora (multifilamento + insumos + COP)
│   │   │   ├── FilamentsPage.jsx   # Gestión de filamentos
│   │   │   ├── PrintersPage.jsx    # Gestión de impresoras
│   │   │   ├── HistoryPage.jsx     # Historial de cotizaciones con PDF
│   │   │   ├── SuppliesPage.jsx    # Catálogo de insumos con compra por paquete
│   │   │   └── SettingsPage.jsx    # Configuración + EPM por mes/estrato + USD/COP
│   │   └── services/
│   │       └── api.js              # Cliente API (Axios + interceptors + todas las funciones)
│   ├── nginx.conf                  # Config Nginx para producción
│   ├── Containerfile               # Imagen multi-stage (build + nginx)
│   ├── index.html                  # HTML raíz (título: Calculator3D)
│   ├── vite.config.js              # Config Vite con proxy al backend
│   └── package.json                # Dependencias Node.js
├── quadlet/                        # Archivos Quadlet para systemd (producción)
│   ├── calculator3d.network
│   ├── calculator3d-data.volume
│   ├── calculator3d-backend.container
│   ├── calculator3d-frontend.container
│   └── calculator3d-tunnel.container
├── deploy.sh                       # Script de despliegue (build + run con Podman)
├── .env.example                    # Plantilla de variables de entorno
└── .gitignore
```

---

## Instalación para Desarrollo

### Requisitos previos

- Python 3.9+ (recomendado 3.11)
- Node.js 18+ (recomendado 20)
- npm 8+

### 1. Clonar el repositorio

```bash
git clone git@github.com:GiomarOsorio/Calculator3D.git
cd Calculator3D
```

### 2. Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate    # Linux/Mac
# venv\Scripts\activate     # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (o dejar los defaults para desarrollo)

# Ejecutar
uvicorn app.main:app --reload --port 8000
```

El backend estará en `http://localhost:8000`. La documentación Swagger automática estará en `http://localhost:8000/docs`.

Al iniciar por primera vez se crea automáticamente:
- La base de datos SQLite (`calculator3d.db`) con todas las tablas
- Un usuario admin (por defecto: `admin` / `admin123`)
- La impresora BambuLab P1S Combo pre-configurada
- Migraciones automáticas de columnas nuevas en cada arranque

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar (en modo desarrollo con proxy al backend)
npm run dev
```

El frontend estará en `http://localhost:5173`. El proxy de Vite redirige `/api/*` al backend automáticamente.

### 4. Acceder

Abre `http://localhost:5173` e inicia sesión con:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

> **Importante:** Cambia la contraseña del admin en producción.

---

## Despliegue en Producción

### Requisitos

- PC/servidor con Linux (Ubuntu, Debian, Fedora, etc.)
- Podman 4.0+ instalado
- Git y SSH configurado con GitHub

### Opción A: Script automático (recomendado)

```bash
# 1. Clonar
git clone git@github.com:GiomarOsorio/Calculator3D.git
cd Calculator3D

# 2. Configurar
cp .env.example .env
nano .env
```

Completar el archivo `.env`:

```env
# Generar con: openssl rand -hex 32
SECRET_KEY=tu-clave-secreta-aqui

# Credenciales del admin
ADMIN_USERNAME=turtleAdmin
ADMIN_PASSWORD=tu-password-seguro
ADMIN_EMAIL=tu@email.com

# Token de Cloudflare Tunnel (ver sección Cloudflare)
TUNNEL_TOKEN=tu-token-aqui
```

```bash
# 3. Desplegar
./deploy.sh
```

La aplicación estará disponible en:
- **Local:** `http://localhost:3000`
- **Internet:** `https://3d.turtlenode.dev` (si configuraste el tunnel)

### Comandos útiles

```bash
# Ver contenedores activos
podman ps

# Ver logs en tiempo real
podman logs -f calculator3d-backend
podman logs -f calculator3d-frontend
podman logs -f calculator3d-tunnel

# Reiniciar un contenedor
podman restart calculator3d-backend

# Detener todo
podman stop calculator3d-backend calculator3d-frontend calculator3d-tunnel

# Eliminar contenedores (los datos del volumen se mantienen)
podman rm -f calculator3d-backend calculator3d-frontend calculator3d-tunnel
```

---

## CI/CD con GitHub Actions

El proyecto incluye un pipeline de despliegue automático basado en un **self-hosted runner** de GitHub Actions instalado en la laptop de producción.

### Cómo funciona

1. Se hace `git push` a la rama `main`
2. GitHub detecta el push y activa el workflow (`.github/workflows/deploy.yml`)
3. El runner en la laptop (que escucha conexiones salientes a GitHub) recibe el trabajo
4. El runner ejecuta `git pull origin main` y luego `./deploy.sh`
5. El resultado aparece en la pestaña **Actions** del repositorio en GitHub

> El runner se conecta **hacia** GitHub (TCP 443 saliente), no necesita puertos abiertos ni tocar el túnel de Cloudflare.

### Setup del runner (una sola vez)

#### 1. Obtener el token de registro

En GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux → x64**

Copia el token que aparece en el comando `./config.sh` (válido durante 1 hora).

#### 2. Instalar el runner en la laptop de producción

```bash
ssh turtle@192.168.8.211

# Descargar la última versión del runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L "$(curl -s https://api.github.com/repos/actions/runner/releases/latest \
  | grep -o 'https://.*linux-x64-[0-9.]*.tar.gz' | head -1)"
tar xzf runner.tar.gz

# Configurar (pega tu token de GitHub aquí)
./config.sh --url https://github.com/GiomarOsorio/Calculator3D \
            --token TU_TOKEN_AQUI \
            --name laptop-turtle \
            --unattended

# Instalar como servicio systemd y arrancar
sudo ./svc.sh install
sudo ./svc.sh start
```

#### 3. Verificar que funciona

```bash
sudo ./svc.sh status
# Active: active (running) ✓
```

A partir de aquí, cada `git push origin main` dispara un deploy automático. Los logs completos están disponibles en GitHub → **Actions**.

### Notas de costos

| Runner | Quién pone el hardware | Costo en repo privado |
|---|---|---|
| `ubuntu-latest` (GitHub-hosted) | GitHub | Consume minutos del plan (2,000/mes gratis) |
| `self-hosted` (tu laptop) | Tú | **Gratis, sin límite de minutos** |

---

## Configuración de Cloudflare Tunnel

Cloudflare Tunnel permite exponer la aplicación a internet sin abrir puertos en el router.

### 1. Crear el Tunnel

1. Ir a [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. **Networks** → **Tunnels** → **Create a tunnel**
3. Tipo: **Cloudflared** — Nombre: `calculator3d`
4. Copiar el **token** (string largo empezando con `eyJ...`)

### 2. Configurar el Public Hostname

| Campo | Valor |
|-------|-------|
| Subdomain | `3d` |
| Domain | `turtlenode.dev` |
| Type | `HTTP` |
| URL | `calculator3d-frontend:80` |

### 3. Agregar el token al `.env`

```env
TUNNEL_TOKEN=eyJhIjoiNGY...tu-token-completo
```

El tunnel se levanta automáticamente con `deploy.sh` si detecta `TUNNEL_TOKEN`.

### 4. Proteger con Cloudflare Access (recomendado)

1. **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Application domain: `3d.turtlenode.dev`
3. Política de acceso: solo tu email o grupo
4. Método: **One-time PIN** por email

Esto agrega autenticación antes de que se muestre siquiera la pantalla de login.

---

## Configuración de Quadlet (systemd)

Quadlet gestiona los contenedores como servicios systemd. Ideal para servidores de producción donde no se quiere usar `deploy.sh` manualmente.

```bash
# Copiar archivos Quadlet
mkdir -p ~/.config/containers/systemd
cp quadlet/*.container quadlet/*.network quadlet/*.volume ~/.config/containers/systemd/

# Editar credenciales y tokens en los .container
nano ~/.config/containers/systemd/calculator3d-backend.container
nano ~/.config/containers/systemd/calculator3d-tunnel.container

# Recargar y arrancar
systemctl --user daemon-reload
systemctl --user start calculator3d-backend calculator3d-frontend calculator3d-tunnel

# Habilitar inicio automático
systemctl --user enable calculator3d-backend calculator3d-frontend calculator3d-tunnel
loginctl enable-linger $USER
```

### Comandos Quadlet

```bash
# Estado
systemctl --user status calculator3d-backend

# Logs
journalctl --user -u calculator3d-backend -f

# Reiniciar
systemctl --user restart calculator3d-backend
```

---

## Migración de Base de Datos

### SQLite: Mover de una PC a otra

```bash
# Exportar desde el contenedor
podman cp calculator3d-backend:/app/data/calculator3d.db ./calculator3d-backup.db

# Transferir por red local
scp calculator3d-backup.db turtle@192.168.8.211:~/

# Importar en la PC destino
podman cp calculator3d-backup.db calculator3d-backend:/app/data/calculator3d.db
podman restart calculator3d-backend
```

### SQLite a PostgreSQL

```env
# Cambiar en .env
DATABASE_URL=postgresql+asyncpg://calculator3d:password@localhost:5432/calculator3d
```

Agrega `asyncpg` a `requirements.txt`, reconstruye la imagen y arranca. Las tablas se crean automáticamente. Para migrar datos usa `pgloader`:

```bash
pgloader calculator3d.db postgresql://calculator3d:password@localhost/calculator3d
```

### Respaldo automático (recomendado)

```bash
# Crontab: respaldo diario a las 2:00 AM
crontab -e
0 2 * * * podman cp calculator3d-backend:/app/data/calculator3d.db \
  /home/turtle/backups/calculator3d-$(date +\%Y\%m\%d).db
```

---

## Uso de la Aplicación

### 1. Configuración inicial

1. **Iniciar sesión** con las credenciales configuradas en `.env`
2. Ir a **Configuración**:
   - Ajustar tarifa eléctrica, tasa de fallos, costo de mano de obra y margen
   - Usar el botón **"Aplicar tarifa EPM"** para cargar la tarifa oficial automáticamente (elige mes y estrato con los dropdowns)
   - Ver la tasa de cambio USD → COP actualizada en tiempo real
3. Ir a **Impresoras** y verificar los datos de la BambuLab P1S Combo
4. Ir a **Filamentos** y agregar tus filamentos con precios reales
5. Ir a **Insumos** y registrar los materiales adicionales que usas

### 2. Registrar insumos

Los insumos son materiales no plásticos que se agregan a las piezas (argollas, switches, imanes, insertos, etc.).

1. Ir a **Insumos** → **Nuevo Insumo**
2. Completar:
   - **Nombre:** ej. "Argolla metálica 25mm"
   - **Unidad base:** "unidad", "pieza", "cm" o "gramo"
   - **Unidades en el paquete:** cuántas unidades trae el paquete que compraste (ej. 50)
   - **Precio del paquete (USD):** lo que pagaste por ese paquete (ej. $5.00)
3. El sistema calcula automáticamente el **precio por unidad** ($0.10 en el ejemplo)

### 3. Calcular el costo de una pieza

1. Ir a **Calculadora**
2. Completar datos básicos (nombre, cliente, filamento principal, impresora, peso, tiempos, margen)
3. **Si la pieza es multicolor:** en la sección "Filamentos adicionales", agrega cada color extra con su peso en gramos
4. **Si necesita insumos:** en la sección "Insumos adicionales", selecciona el insumo y cuántas unidades lleva cada pieza
5. Click en **Calcular Costo** — el desglose incluye:
   - Material (todos los filamentos sumados)
   - Electricidad, depreciación, mantenimiento, mano de obra
   - Absorción de fallos
   - Insumos adicionales (si aplica)
   - Margen de ganancia
   - **Precio en COP** con tasa de cambio en tiempo real
6. Click en **Guardar Cotización** para guardarla en el historial

### 4. Exportar cotización a PDF

1. Ir a **Historial**
2. Click en el icono de PDF de la cotización deseada
3. Se descarga un PDF profesional para enviar al cliente

---

## Fórmula de Cálculo

```
# Filamentos (principal + adicionales multicolor)
Costo de material     = Σ (gramos_filamento × precio_por_kg / 1000)

# Impresora
Costo de electricidad = (watts × horas_impresión) / 1000 × tarifa_kWh
Depreciación          = (precio_impresora / vida_útil_horas) × horas_impresión
Mantenimiento         = (precio_boquilla/vida_boquilla + precio_placa/vida_placa + otros) × horas

# Mano de obra
Mano de obra          = (horas_preparación + horas_post_procesado) × costo_hora_trabajo

# Subtotal antes de fallos
Subtotal base         = material + electricidad + depreciación + mantenimiento + mano_de_obra

# Absorción de fallos (impresiones que no salen bien)
Costo de fallos       = subtotal_base × (tasa_fallos / 100)
Subtotal_con_fallos   = subtotal_base + costo_de_fallos

# Insumos adicionales (se agregan DESPUÉS de fallos: los insumos físicos solo van en piezas exitosas)
Costo de insumos      = Σ (precio_por_unidad × cantidad_por_pieza)
Subtotal              = subtotal_con_fallos + costo_de_insumos

# Precio final
Margen                = subtotal × (margen_porcentaje / 100)
Precio por unidad     = subtotal + margen
Precio total          = precio_por_unidad × cantidad
Precio en COP         = precio_por_unidad × tasa_USD_COP
```

> Todos los precios son **sin IVA**.

---

## API Endpoints

La documentación interactiva completa está disponible en `http://localhost:8000/docs` (Swagger UI).

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Iniciar sesión (retorna JWT) |
| `POST` | `/api/auth/register` | Crear usuario |
| `GET` | `/api/auth/me` | Usuario autenticado actual |

### Filamentos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/filaments/` | Listar todos |
| `GET` | `/api/filaments/{id}` | Obtener uno |
| `POST` | `/api/filaments/` | Crear |
| `PUT` | `/api/filaments/{id}` | Actualizar |
| `DELETE` | `/api/filaments/{id}` | Eliminar |

### Impresoras

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/printers/` | Listar todas |
| `GET` | `/api/printers/{id}` | Obtener una |
| `POST` | `/api/printers/` | Crear |
| `PUT` | `/api/printers/{id}` | Actualizar |
| `DELETE` | `/api/printers/{id}` | Eliminar |

### Insumos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/supplies/` | Listar catálogo |
| `POST` | `/api/supplies/` | Crear (calcula `price_per_unit = pack_price / pack_qty`) |
| `PUT` | `/api/supplies/{id}` | Actualizar (recalcula si cambian campos del paquete) |
| `DELETE` | `/api/supplies/{id}` | Eliminar |

### Cotizaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/quotes/calculate` | Calcular sin guardar (preview) |
| `POST` | `/api/quotes/` | Calcular y guardar en historial |
| `GET` | `/api/quotes/` | Listar historial |
| `GET` | `/api/quotes/{id}` | Obtener detalle |
| `GET` | `/api/quotes/{id}/pdf` | Descargar PDF |
| `DELETE` | `/api/quotes/{id}` | Eliminar |

### Configuración

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/settings/` | Obtener configuración del usuario |
| `PUT` | `/api/settings/` | Actualizar configuración |
| `GET` | `/api/settings/exchange-rate` | Tasa USD/COP actual con markup (caché 1h) |
| `GET` | `/api/settings/electricity-tariff` | Tarifa EPM del mes actual — todos los estratos (caché 24h, guarda en BD) |
| `GET` | `/api/settings/electricity-tariffs` | Historial de tarifas EPM guardadas en BD, agrupado por mes |

### Health Check

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/health` | Estado de la API |

---

## Variables de Entorno

| Variable | Descripción | Default | Requerida |
|----------|-------------|---------|-----------|
| `DATABASE_URL` | URL de conexión a la BD | `sqlite+aiosqlite:///./data/calculator3d.db` | No |
| `SECRET_KEY` | Clave secreta para firmar JWT | - | **Sí (producción)** |
| `ALGORITHM` | Algoritmo JWT | `HS256` | No |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del token en minutos | `1440` (24h) | No |
| `ADMIN_USERNAME` | Usuario admin inicial | `admin` | No |
| `ADMIN_PASSWORD` | Contraseña admin inicial | `admin123` | **Sí (producción)** |
| `ADMIN_EMAIL` | Email del admin | `admin@calculator3d.local` | No |
| `TUNNEL_TOKEN` | Token de Cloudflare Tunnel | - | Solo si usas tunnel |

### Generar SECRET_KEY segura

```bash
openssl rand -hex 32
```

---

## Licencia

Proyecto privado. Todos los derechos reservados.
