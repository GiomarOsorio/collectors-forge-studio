# Calculator3D

Calculadora de costos de impresión 3D con interfaz web. Permite calcular el precio real de una pieza impresa en 3D considerando todos los factores: material, electricidad, depreciación del equipo, mantenimiento, mano de obra, tasa de fallos y margen de ganancia.

## Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación para Desarrollo](#instalación-para-desarrollo)
- [Despliegue en Producción](#despliegue-en-producción)
- [Configuración de Cloudflare Tunnel](#configuración-de-cloudflare-tunnel)
- [Configuración de Quadlet (systemd)](#configuración-de-quadlet-systemd)
- [Migración de Base de Datos](#migración-de-base-de-datos)
- [Uso de la Aplicación](#uso-de-la-aplicación)
- [Fórmula de Cálculo](#fórmula-de-cálculo)
- [API Endpoints](#api-endpoints)
- [Variables de Entorno](#variables-de-entorno)

---

## Características

- **Calculadora de costos** con desglose completo: material, electricidad, depreciación, mantenimiento, mano de obra, fallos y margen
- **Base de datos de filamentos** (marca, tipo, color, precio por kg, densidad)
- **Gestión de impresoras** con depreciación y costos de mantenimiento (boquilla, placa, etc.)
- **Historial de cotizaciones** con búsqueda y detalle
- **Exportación a PDF** de cotizaciones para enviar a clientes
- **Autenticación JWT** con usuarios y roles (admin)
- **Interfaz web moderna** responsive con TailwindCSS
- **Contenedorizado** con Podman (compatible con Docker)
- **Cloudflare Tunnel** integrado para acceso seguro desde internet
- **Base de datos migrable** de SQLite a PostgreSQL cambiando una sola línea

---

## Arquitectura

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│   Frontend   │     │     Backend      │     │  Database   │
│   React +    │────▶│    FastAPI +     │────▶│   SQLite    │
│   Nginx      │ API │   SQLAlchemy     │     │  (archivo)  │
│  :80 (3000)  │     │     :8000        │     └────────────┘
└──────────────┘     │   + ReportLab    │──▶ PDF
       ▲             └──────────────────┘
       │
┌──────────────┐
│  Cloudflare  │
│   Tunnel     │  ◀── 3d.turtlenode.dev
│ (cloudflared)│
└──────────────┘
```

**Flujo de red:**

```
Internet → Cloudflare Access → Cloudflare Tunnel → Nginx (frontend) → FastAPI (backend) → SQLite
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Backend** | Python + FastAPI | 3.11 / 0.115.0 |
| **ORM** | SQLAlchemy (async) | 2.0.35 |
| **Migraciones** | Alembic | 1.13.2 |
| **Base de datos** | SQLite (migrable a PostgreSQL) | - |
| **Autenticación** | JWT (python-jose + passlib/bcrypt) | - |
| **PDF** | ReportLab | 4.2.2 |
| **Frontend** | React + Vite | 19 / 7.x |
| **CSS** | TailwindCSS | 4.x |
| **Iconos** | Lucide React | - |
| **HTTP Client** | Axios | - |
| **Contenedores** | Podman (compatible Docker) | 5.x |
| **Tunnel** | Cloudflare Tunnel (cloudflared) | latest |
| **Servidor web** | Nginx (frontend container) | alpine |

---

## Estructura del Proyecto

```
Calculator3D/
├── backend/
│   ├── app/
│   │   ├── main.py                 # Punto de entrada FastAPI
│   │   ├── config.py               # Configuración desde variables de entorno
│   │   ├── database.py             # Conexión SQLAlchemy async
│   │   ├── models/                 # Modelos SQLAlchemy (tablas)
│   │   │   ├── user.py             # Usuarios y autenticación
│   │   │   ├── filament.py         # Filamentos (marca, tipo, precio)
│   │   │   ├── printer.py          # Impresoras 3D (depreciación, mantenimiento)
│   │   │   ├── settings.py         # Configuración por usuario
│   │   │   └── quote.py            # Cotizaciones guardadas
│   │   ├── schemas/                # Schemas Pydantic (validación)
│   │   │   ├── user.py             # Schemas de auth y tokens
│   │   │   ├── filament.py         # Schemas CRUD filamentos
│   │   │   ├── printer.py          # Schemas CRUD impresoras
│   │   │   ├── settings.py         # Schemas configuración
│   │   │   └── quote.py            # Schemas cálculo y cotizaciones
│   │   ├── routers/                # Endpoints API REST
│   │   │   ├── auth.py             # Login, registro, perfil
│   │   │   ├── filaments.py        # CRUD filamentos
│   │   │   ├── printers.py         # CRUD impresoras
│   │   │   ├── settings.py         # Configuración
│   │   │   └── quotes.py           # Cálculo, historial, PDF
│   │   └── services/               # Lógica de negocio
│   │       ├── auth.py             # JWT, bcrypt, middleware auth
│   │       ├── calculator.py       # Motor de cálculo de costos
│   │       └── pdf_generator.py    # Generador de PDF con ReportLab
│   ├── Containerfile               # Imagen del backend (Python 3.11)
│   ├── requirements.txt            # Dependencias Python
│   ├── .env                        # Variables locales (no se sube a git)
│   └── .env.example                # Plantilla de variables
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Componente raíz con routing
│   │   ├── main.jsx                # Entry point React
│   │   ├── index.css               # TailwindCSS imports
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Contexto de autenticación
│   │   ├── components/
│   │   │   └── Layout.jsx          # Layout principal con sidebar
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Página de login
│   │   │   ├── CalculatorPage.jsx  # Calculadora principal
│   │   │   ├── FilamentsPage.jsx   # Gestión de filamentos
│   │   │   ├── PrintersPage.jsx    # Gestión de impresoras
│   │   │   ├── HistoryPage.jsx     # Historial de cotizaciones
│   │   │   └── SettingsPage.jsx    # Configuración
│   │   └── services/
│   │       └── api.js              # Cliente API (Axios + interceptors)
│   ├── nginx.conf                  # Config Nginx para producción
│   ├── Containerfile               # Imagen multi-stage (build + nginx)
│   ├── vite.config.js              # Config Vite con proxy al backend
│   └── package.json                # Dependencias Node.js
├── quadlet/                        # Archivos Quadlet para systemd
│   ├── calculator3d.network        # Red de contenedores
│   ├── calculator3d-data.volume    # Volumen persistente para DB
│   ├── calculator3d-backend.container
│   ├── calculator3d-frontend.container
│   └── calculator3d-tunnel.container
├── podman-compose.yml              # Compose para levantar todo
├── deploy.sh                       # Script de despliegue automático
├── .env.example                    # Variables de entorno (plantilla)
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
- La base de datos SQLite (`calculator3d.db`)
- Un usuario admin (por defecto: `admin` / `admin123`)
- La impresora BambuLab P1S Combo pre-configurada

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

Abre `http://localhost:5173` en el navegador e inicia sesión con:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

> **Importante:** Cambia la contraseña del admin en producción.

---

## Despliegue en Producción

### Requisitos

- Una PC/servidor con Linux (Debian, Ubuntu, Fedora, etc.)
- Podman 4.0+ instalado (`sudo apt install podman` o `sudo dnf install podman`)
- Git

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
ADMIN_USERNAME=admin
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

### Opción B: Podman Compose

```bash
# Construir y levantar
podman-compose up -d --build

# Ver logs
podman-compose logs -f

# Detener
podman-compose down
```

### Opción C: Contenedores manuales

```bash
# Construir imágenes
podman build -t calculator3d-backend -f backend/Containerfile backend/
podman build -t calculator3d-frontend -f frontend/Containerfile frontend/

# Crear red y volumen
podman network create calculator3d
podman volume create calculator3d-data

# Backend
podman run -d --name calculator3d-backend \
    --network calculator3d \
    -v calculator3d-data:/app/data:Z \
    -e DATABASE_URL="sqlite+aiosqlite:///./data/calculator3d.db" \
    -e SECRET_KEY="$(openssl rand -hex 32)" \
    -e ADMIN_USERNAME="admin" \
    -e ADMIN_PASSWORD="tu-password" \
    -e ADMIN_EMAIL="tu@email.com" \
    --restart unless-stopped \
    calculator3d-backend

# Frontend
podman run -d --name calculator3d-frontend \
    --network calculator3d \
    -p 3000:80 \
    --restart unless-stopped \
    calculator3d-frontend
```

### Comandos útiles

```bash
# Ver contenedores
podman ps

# Ver logs
podman logs -f calculator3d-backend
podman logs -f calculator3d-frontend

# Reiniciar
podman restart calculator3d-backend calculator3d-frontend

# Detener todo
podman stop calculator3d-backend calculator3d-frontend calculator3d-tunnel

# Eliminar todo (los datos del volumen se mantienen)
podman rm -f calculator3d-backend calculator3d-frontend calculator3d-tunnel
```

---

## Configuración de Cloudflare Tunnel

Cloudflare Tunnel permite exponer la aplicación a internet de forma segura sin abrir puertos en tu router.

### 1. Crear el Tunnel

1. Ir a [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Menú izquierdo: **Networks** > **Tunnels**
3. Click en **Create a tunnel**
4. Seleccionar tipo: **Cloudflared**
5. Nombre del tunnel: `calculator3d`
6. Copiar el **token** que aparece (es un string largo que empieza con `eyJ...`)

### 2. Configurar el Public Hostname

En la configuración del tunnel, agregar un **Public Hostname**:

| Campo | Valor |
|-------|-------|
| Subdomain | `3d` |
| Domain | `turtlenode.dev` |
| Type | `HTTP` |
| URL | `calculator3d-frontend:80` |

### 3. Configurar el token

Agregar el token al archivo `.env` del servidor:

```env
TUNNEL_TOKEN=eyJhIjoiNGY...tu-token-completo
```

### 4. Levantar el tunnel

Si usas `deploy.sh`, el tunnel se levanta automáticamente si detecta `TUNNEL_TOKEN` en el `.env`.

Si lo quieres levantar manualmente:

```bash
podman run -d --name calculator3d-tunnel \
    --network calculator3d \
    -e TUNNEL_TOKEN="tu-token" \
    --restart unless-stopped \
    docker.io/cloudflare/cloudflared:latest tunnel run
```

### 5. Proteger con Cloudflare Access (opcional pero recomendado)

Para agregar una capa extra de autenticación antes de que lleguen a tu app:

1. En Zero Trust Dashboard: **Access** > **Applications** > **Add an application**
2. Tipo: **Self-hosted**
3. Application domain: `3d.turtlenode.dev`
4. Configurar política de acceso (ej: solo tu email, o un grupo)
5. Método de autenticación: **One-time PIN** (te envía un código por email)

Esto significa que nadie puede siquiera ver la pantalla de login sin pasar Cloudflare Access primero.

---

## Configuración de Quadlet (systemd)

Quadlet permite gestionar los contenedores como servicios de systemd. Ideal para servidores de producción.

### Instalación

```bash
# Copiar archivos Quadlet al directorio de usuario
mkdir -p ~/.config/containers/systemd
cp quadlet/*.container quadlet/*.network quadlet/*.volume ~/.config/containers/systemd/

# Editar el token del tunnel
nano ~/.config/containers/systemd/calculator3d-tunnel.container
# Cambiar TUNNEL_TOKEN=PONER-TU-TOKEN-AQUI por tu token real

# Editar credenciales del backend
nano ~/.config/containers/systemd/calculator3d-backend.container
# Cambiar SECRET_KEY y ADMIN_PASSWORD

# Recargar systemd
systemctl --user daemon-reload

# Iniciar los servicios
systemctl --user start calculator3d-backend
systemctl --user start calculator3d-frontend
systemctl --user start calculator3d-tunnel

# Habilitar inicio automático
systemctl --user enable calculator3d-backend
systemctl --user enable calculator3d-frontend
systemctl --user enable calculator3d-tunnel

# Habilitar linger (para que los servicios arranquen sin login)
loginctl enable-linger $USER
```

### Comandos Quadlet

```bash
# Ver estado
systemctl --user status calculator3d-backend
systemctl --user status calculator3d-frontend
systemctl --user status calculator3d-tunnel

# Ver logs
journalctl --user -u calculator3d-backend -f
journalctl --user -u calculator3d-frontend -f

# Reiniciar
systemctl --user restart calculator3d-backend

# Detener
systemctl --user stop calculator3d-backend calculator3d-frontend calculator3d-tunnel
```

---

## Migración de Base de Datos

### SQLite: Mover de una PC a otra

La base de datos SQLite es un archivo único dentro del volumen de Podman. Para migrarla:

#### 1. Exportar desde la PC origen

```bash
# Encontrar la ubicación del volumen
podman volume inspect calculator3d-data | grep mountpoint

# Copiar el archivo de base de datos
# El mountpoint típico es algo como /var/lib/containers/storage/volumes/calculator3d-data/_data/
sudo cp $(podman volume inspect calculator3d-data --format '{{.Mountpoint}}')/calculator3d.db ./calculator3d-backup.db
```

O de forma más simple:

```bash
# Copiar directamente desde el contenedor
podman cp calculator3d-backend:/app/data/calculator3d.db ./calculator3d-backup.db
```

#### 2. Transferir a la PC destino

```bash
# Opción 1: SCP (red local)
scp calculator3d-backup.db usuario@192.168.1.XXX:~/calculator3d-backup.db

# Opción 2: USB / medio físico
# Simplemente copia el archivo calculator3d-backup.db
```

#### 3. Importar en la PC destino

```bash
# Asegurarse de que el volumen existe
podman volume create calculator3d-data

# Copiar la base de datos al volumen
sudo cp calculator3d-backup.db $(podman volume inspect calculator3d-data --format '{{.Mountpoint}}')/calculator3d.db

# O copiar directamente al contenedor (si ya está corriendo)
podman cp calculator3d-backup.db calculator3d-backend:/app/data/calculator3d.db

# Reiniciar el backend para que tome los cambios
podman restart calculator3d-backend
```

### SQLite a PostgreSQL: Migración completa

Cuando necesites multi-usuario simultáneo o más rendimiento:

#### 1. Instalar PostgreSQL en el servidor

```bash
# Debian/Ubuntu
sudo apt install postgresql postgresql-client

# Crear base de datos
sudo -u postgres createuser calculator3d
sudo -u postgres createdb calculator3d -O calculator3d
sudo -u postgres psql -c "ALTER USER calculator3d PASSWORD 'tu-password-postgres';"
```

#### 2. Exportar datos de SQLite

```bash
# Copiar la DB desde el contenedor
podman cp calculator3d-backend:/app/data/calculator3d.db ./calculator3d.db

# Exportar a SQL
sqlite3 calculator3d.db .dump > dump.sql
```

#### 3. Cambiar la URL de conexión

En el archivo `.env` o en las variables de entorno del contenedor, cambiar:

```env
# Antes (SQLite)
DATABASE_URL=sqlite+aiosqlite:///./data/calculator3d.db

# Después (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://calculator3d:tu-password@localhost:5432/calculator3d
```

> **Nota:** Para PostgreSQL async necesitas instalar `asyncpg` en lugar de `aiosqlite`. Agrega `asyncpg` al `requirements.txt` y reconstruye la imagen.

#### 4. Agregar asyncpg al backend

```bash
# En requirements.txt agregar:
asyncpg==0.29.0

# Reconstruir imagen
podman build -t calculator3d-backend -f backend/Containerfile backend/
```

#### 5. Recrear tablas e importar datos

La forma más limpia es:
1. Iniciar la app con PostgreSQL (las tablas se crean automáticamente al arrancar)
2. Usar un script para migrar los datos, o re-ingresarlos desde la interfaz

Para una migración automática de datos, puedes usar una herramienta como `pgloader`:

```bash
sudo apt install pgloader
pgloader calculator3d.db postgresql://calculator3d:tu-password@localhost/calculator3d
```

### Respaldo automático (recomendado)

Crea un cron job para respaldar la base de datos periódicamente:

```bash
# Editar crontab
crontab -e

# Agregar respaldo diario a las 2:00 AM
0 2 * * * podman cp calculator3d-backend:/app/data/calculator3d.db /home/tu-usuario/backups/calculator3d-$(date +\%Y\%m\%d).db
```

---

## Uso de la Aplicación

### 1. Configuración inicial

Después de instalar y acceder por primera vez:

1. **Iniciar sesión** con `admin` / `admin123` (cambiar contraseña recomendado)
2. Ir a **Configuración** y ajustar:
   - Tarifa eléctrica de tu zona ($/kWh)
   - Tasa de fallos estimada (%)
   - Costo de tu hora de trabajo ($)
   - Margen de ganancia por defecto (%)
   - Moneda
3. Ir a **Impresoras** y verificar/ajustar los datos de la BambuLab P1S Combo:
   - Precio de compra real
   - Consumo eléctrico promedio (watts)
   - Vida útil estimada
   - Costos de boquillas y placa
4. Ir a **Filamentos** y agregar tus filamentos con precios reales

### 2. Calcular el costo de una pieza

1. Ir a **Calculadora**
2. Completar:
   - Nombre de la pieza
   - Cliente (opcional)
   - Seleccionar filamento e impresora
   - **Peso del filamento (g):** lo obtienes del slicer (BambuStudio, OrcaSlicer, etc.)
   - **Tiempo de impresión (h):** también del slicer
   - Tiempo de preparación y post-procesado (opcional)
   - Cantidad de piezas
   - Margen de ganancia (se auto-completa con el default)
3. Click en **Calcular Costo**
4. Ver el desglose completo
5. Click en **Guardar Cotización** para guardarla en el historial

### 3. Exportar cotización a PDF

1. Ir a **Historial**
2. Click en el icono de PDF en la cotización deseada
3. Se descarga un PDF profesional con el desglose para enviar al cliente

---

## Fórmula de Cálculo

```
Costo de material     = gramos × (precio_por_kg / 1000)
Costo de electricidad = (watts × horas_impresión) / 1000 × tarifa_kWh
Depreciación          = (precio_impresora / vida_útil_horas) × horas_impresión
Mantenimiento         = (costo_boquilla/vida_boquilla + costo_placa/vida_placa + otros) × horas
Mano de obra          = (horas_preparación + horas_post_procesado) × costo_hora_trabajo

Subtotal base         = material + electricidad + depreciación + mantenimiento + mano_de_obra
Costo de fallos       = subtotal_base × (tasa_fallos / 100)
Subtotal              = subtotal_base + costo_de_fallos
Margen                = subtotal × (margen_porcentaje / 100)

Precio por unidad     = subtotal + margen
Precio total          = precio_por_unidad × cantidad
```

> Todos los precios son **sin IVA**.

---

## API Endpoints

La documentación interactiva de la API está disponible en `http://localhost:8000/docs` (Swagger UI).

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Iniciar sesión (retorna JWT) |
| `POST` | `/api/auth/register` | Crear usuario (solo admin) |
| `GET` | `/api/auth/me` | Obtener usuario actual |

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

### Configuración

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/settings/` | Obtener configuración |
| `PUT` | `/api/settings/` | Actualizar configuración |

### Cotizaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/quotes/calculate` | Calcular sin guardar (preview) |
| `POST` | `/api/quotes/` | Calcular y guardar |
| `GET` | `/api/quotes/` | Listar historial |
| `GET` | `/api/quotes/{id}` | Obtener detalle |
| `GET` | `/api/quotes/{id}/pdf` | Descargar PDF |
| `DELETE` | `/api/quotes/{id}` | Eliminar |

### Health Check

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/health` | Estado de la API |

---

## Variables de Entorno

| Variable | Descripción | Default | Requerida |
|----------|-------------|---------|-----------|
| `DATABASE_URL` | URL de conexión a la DB | `sqlite+aiosqlite:///./calculator3d.db` | No |
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
# Ejemplo resultado: a1b2c3d4e5f6...64-caracteres-hexadecimales
```

---

## Licencia

Proyecto privado. Todos los derechos reservados.
