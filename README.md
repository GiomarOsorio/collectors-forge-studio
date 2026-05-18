# Collector's Forge Studio

> Plataforma de gestión integral para negocios de impresión 3D — desde el costo del filamento hasta la cotización en manos del cliente.

Calcula costos de impresión con precisión Decimal (material, electricidad, depreciación, mantenimiento, mano de obra, fallos, margen). Gestiona inventario, emite cotizaciones PDF con templates Liquid personalizables, registra mantenimientos y controla la cola de trabajo. Desplegado en contenedores Podman con autenticación SSO vía Authentik.

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
| **Auth** | JWT (python-jose) · OIDC/SSO con PKCE (Authlib) |
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
git clone git@github.com:GiomarOsorio/collectors-forge-studio.git ~/collectors-forge-studio
cd ~/collectors-forge-studio

# 2. Configurar variables de entorno
cp .env.example ~/CollectorsForgeENV
nano ~/CollectorsForgeENV
# Completar: SECRET_KEY, POSTGRES_PASSWORD, SESSION_SECRET_KEY, vars OIDC, TUNNEL_TOKEN

# 3. Desplegar (construye imágenes + aplica migraciones + inicia servicios)
./deploy.sh
```

La app queda disponible en `https://3d.turtlenode.dev` (con tunnel) o `http://localhost:3000` (sin tunnel).

Ver **[docs/despliegue.md](docs/despliegue.md)** para la guía completa, incluyendo instalación del self-hosted runner, configuración de Cloudflare, backup y rollback.

---

## Inicio rápido — desarrollo local

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Completar OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
# API en http://localhost:8000 · Swagger en http://localhost:8000/docs

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
# UI en http://localhost:5173 (proxy /api → :8000)
```

El login se realiza vía SSO con el proveedor OIDC configurado. El primer usuario que inicia sesión recibe rol `admin`; los siguientes reciben `operator`.

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
| `SESSION_SECRET_KEY` | Clave SessionMiddleware (**requerida**) | usa `SECRET_KEY` si vacía |
| `OIDC_ISSUER` | URL issuer OIDC (**requerida**) | — |
| `OIDC_CLIENT_ID` | Client ID del proveedor OIDC (**requerido**) | — |
| `OIDC_CLIENT_SECRET` | Client Secret del proveedor OIDC (**requerido**) | — |
| `OIDC_REDIRECT_URI` | Redirect URI registrada en el proveedor | — |
| `TUNNEL_TOKEN` | Token Cloudflare Tunnel | — (opcional) |
| `POSTGRES_USER` | Usuario PostgreSQL | `collectorsforge` |
| `POSTGRES_DB` | Nombre de la base de datos | `collectorsforge` |
| `POSTGRES_HOST` | Host PostgreSQL | `cfs-postgres` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del JWT | `1440` (24h) |

Generar claves:
```bash
openssl rand -hex 32  # usar para SECRET_KEY y SESSION_SECRET_KEY
```

---

## Comandos rápidos de operación

```bash
# Estado de todos los servicios
systemctl --user status cfs-{postgres,backend,frontend,slicer,tunnel}

# Logs en tiempo real
journalctl --user -u cfs-backend -f

# Reiniciar backend
systemctl --user restart cfs-backend

# Conectar a PostgreSQL
podman exec -it cfs-postgres psql -U collectorsforge -d collectorsforge

# Backup de la base de datos
podman exec cfs-postgres pg_dump -U collectorsforge -Fc collectorsforge \
  > ~/backups/collectorsforge-$(date +%Y%m%d).dump

# Aplicar migraciones manualmente
podman exec cfs-backend alembic upgrade head

# Ver todos los contenedores
podman ps
```

---

## Licencia

Collector's Forge Studio está liberado bajo la **GNU Affero General
Public License v3.0** (AGPL-3.0). Ver [`LICENSE`](LICENSE) para el
texto completo.

AGPL es copyleft fuerte: si modificas este código y lo ofreces como
servicio de red (SaaS), estás obligado a publicar tus modificaciones
bajo la misma licencia para los usuarios del servicio. Si solo lo usas
internamente (sin exponerlo a terceros), no hay obligación de publicar
cambios.

```
Copyright (C) 2026  Giomar Gustavo Osorio Guevara

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Affero General Public License for more details.
```
