# TurtleForge Studio

Plataforma web para gestión integral de un negocio de impresión 3D. Calcula costos de impresión, gestiona inventario, emite cotizaciones PDF en HTML/Liquid, registra mantenimientos y controla la cola de trabajo.

---

## Aplicaciones

| App | Ruta | Color | Descripción |
|---|---|---|---|
| **Cost** | `/cost/` | `#3FAF4C` | Calculadora de costos — filamentos, impresoras, insumos, margen, PDF |
| **Archive** | `/inventory/` | `#3B82F6` | Stock unificado, alertas de mínimos, pedidos de compra con tracking |
| **Slicer** | `/slicer/` | `#F59E0B` | Laminado STL con OrcaSlicer, extracción de .gcode y .3mf |
| **Mantenimiento** | `/maintenance/` | `#8B5CF6` | Historial de mantenimiento por impresora, descuento automático de inventario |
| **Queue** | `/queue/` | `#14B8A6` | Cola de impresión con descuento atómico de inventario al marcar como listo |
| **Compañía** | `/company/` | `#6366F1` | Perfil, paleta de colores PDF y templates Liquid personalizados |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Python 3.11 · FastAPI 0.115 · SQLAlchemy 2.0 async · asyncpg |
| **Base de datos** | PostgreSQL 16 · Alembic (migraciones) |
| **PDF** | ReportLab (fallback) · WeasyPrint + python-liquid (templates Liquid) |
| **Frontend** | React 19 · Vite 7 · TailwindCSS 4 · Axios · React Router DOM |
| **Auth** | JWT (python-jose) · bcrypt 4.0.1 (passlib) |
| **Contenedores** | Podman 5.x + Quadlet (systemd) — *no Docker* |
| **Exposición** | Cloudflare Tunnel → `3d.turtlenode.dev` |
| **CI/CD** | GitHub Actions (tests en Ubuntu) + self-hosted runner (deploy) |

---

## Documentación

| Documento | Descripción |
|---|---|
| **[Arquitectura](docs/arquitectura.md)** | Diagrama de contenedores, estructura de archivos, modelos de datos, flujos principales |
| **[Despliegue](docs/despliegue.md)** | Instalación desde cero, CI/CD, reinicio, backup, rollback, migración a otro servidor |
| **[Desarrollo](docs/desarrollo.md)** | Setup local, tests, convenciones, cómo agregar una nueva app |
| **[Base de datos](docs/base-de-datos.md)** | Historial de migraciones, esquema completo de tablas, comandos útiles |
| **[API](docs/api.md)** | Referencia completa de todos los endpoints REST |
| **[Templates Liquid](docs/templates-liquid.md)** | Variables disponibles, CSS compatible con WeasyPrint, template de referencia |

---

## Inicio rápido — producción

```bash
# 1. Clonar
git clone git@github.com:GiomarOsorio/Calculator3D.git ~/Calculator3D
cd ~/Calculator3D

# 2. Configurar variables de entorno
cp .env.example ~/Calculator3DENV
nano ~/Calculator3DENV
# Completar: SECRET_KEY, POSTGRES_PASSWORD, ADMIN_PASSWORD, TUNNEL_TOKEN

# 3. Desplegar (construye imágenes + aplica migraciones + inicia servicios)
./deploy.sh
```

La app queda disponible en `https://3d.turtlenode.dev` (con tunnel) o `http://localhost:3000` (sin tunnel).

Ver **[docs/despliegue.md](docs/despliegue.md)** para la guía completa, incluyendo instalación del self-hosted runner, configuración de Cloudflare, backup y rollback.

---

## Inicio rápido — desarrollo local

```bash
# Backend (SQLite, sin PostgreSQL)
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # usa SQLite por defecto
alembic upgrade head
uvicorn app.main:app --reload
# API en http://localhost:8000 · Swagger en http://localhost:8000/docs

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
# UI en http://localhost:5173 (proxy /api → :8000)
```

Credenciales por defecto: `admin` / `admin123`

Ver **[docs/desarrollo.md](docs/desarrollo.md)** para convenciones, tests, migraciones y flujo de trabajo.

---

## Fórmula de cálculo de costos

El motor (`backend/app/services/calculator.py`) opera en precisión `Decimal` pura:

```
1. Material       = Σ(gramos × precio_por_kg / 1000)         [todos los filamentos]
2. Electricidad   = (watts × horas / 1000) × tarifa_kWh
3. Depreciación   = (precio_impresora / vida_útil) × horas
4. Mantenimiento  = (nozzle/vida + placa/vida + otros) × horas
5. Mano de obra   = (t_prep + t_post) × costo_hora
─────────────────────────────────────────────────────────────
   Base           = sum(1..5)
6. Fallos         = Base × (tasa_fallos / 100)
   Subtotal       = Base + Fallos
7. Insumos        = Σ(cantidad × precio_por_unidad)
   Subtotal final = Subtotal + Insumos
8. Margen         = Subtotal_final × (margen / 100)
─────────────────────────────────────────────────────────────
   Precio/unidad  = (Subtotal_final + Margen) / cantidad
   Precio total   = Precio/unidad × cantidad
   Precio en COP  = Precio/unidad × tasa_USD_COP
```

---

## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `SECRET_KEY` | Clave JWT (**requerida**) | — |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL (**requerida**) | — |
| `ADMIN_PASSWORD` | Contraseña admin inicial (**requerida**) | — |
| `ADMIN_USERNAME` | Usuario admin | `admin` |
| `ADMIN_EMAIL` | Email admin | `admin@calculator3d.local` |
| `TUNNEL_TOKEN` | Token Cloudflare Tunnel | — (opcional) |
| `POSTGRES_USER` | Usuario PostgreSQL | `turtleforge` |
| `POSTGRES_DB` | Nombre de la base de datos | `turtleforge` |
| `POSTGRES_HOST` | Host PostgreSQL | `calculator3d-postgres` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del JWT | `1440` (24h) |

Generar `SECRET_KEY`:
```bash
openssl rand -hex 32
```

---

## Comandos rápidos de operación

```bash
# Estado de todos los servicios
systemctl --user status calculator3d-{postgres,backend,frontend,slicer,tunnel}

# Logs en tiempo real
journalctl --user -u calculator3d-backend -f

# Reiniciar backend
systemctl --user restart calculator3d-backend

# Conectar a PostgreSQL
podman exec -it calculator3d-postgres psql -U turtleforge -d turtleforge

# Backup de la base de datos
podman exec calculator3d-postgres pg_dump -U turtleforge -Fc turtleforge \
  > ~/backups/turtleforge-$(date +%Y%m%d).dump

# Aplicar migraciones manualmente
podman exec calculator3d-backend alembic upgrade head

# Ver todos los contenedores
podman ps
```
