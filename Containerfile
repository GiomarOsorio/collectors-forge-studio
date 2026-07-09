# Build stage — frontend (Vite)
FROM docker.io/node:20-alpine AS frontend-build

# LABEL para que `podman image prune --filter label=...` pueda limpiar
# los layers intermedios huérfanos antes del próximo build.
LABEL stage=cfs-frontend-build

WORKDIR /app

# Copy del código + manifests EN UN SOLO STEP. Importante: no separamos
# `COPY package.json` antes de `npm ci` — eso causaba que el layer cacheado
# de npm ci se reusara aunque el package-lock cambiara (bug observado en
# este server podman: ignora --no-cache en algunas ocasiones). Al instalar
# deps DESPUÉS del COPY, garantizamos que node_modules siempre coincide con
# el package-lock que viene en el código actual.
COPY frontend/ ./

# CRÍTICO: borrar cualquier node_modules / dist / .vite que se haya
# colado del host (.containerignore en podman ha mostrado ser
# inconsistente — a veces COPY ignora exclusiones). Sin este rm,
# `npm ci` puede dejar un layout corrupto donde npm ls dice OK pero
# vite no encuentra los modules en el lookup path correcto.
RUN rm -rf node_modules dist .vite

# Print de la versión del package.json para confirmar que el COPY trajo
# lo último (no un layer cacheado).
RUN echo "── frontend package.json version ──" && \
    grep '"version"' package.json | head -1

# --ignore-scripts evita que `prepare` (husky) aborte npm ci en el
# container (sin .git, husky falla y deja node_modules a medio instalar).
RUN npm ci --ignore-scripts

# Verifica que las deps críticas estén realmente instaladas.
RUN npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-router-dom axios react-i18next i18next \
    || (echo "ERROR: deps faltantes tras npm ci." && exit 1)

# Verifica que Node puede RESOLVER (no solo listar) los packages críticos.
# Si npm ls dice OK pero node no lo resuelve, el path/exports del
# package está roto.
RUN node -e "console.log('resolved:', require.resolve('@dnd-kit/core'))" \
    || (echo "ERROR: Node no resuelve @dnd-kit/core." && exit 1)
RUN node -e "console.log('resolved:', require.resolve('axios'))" \
    || (echo "ERROR: Node no resuelve axios. Build de Vite/Rollup va a fallar." && exit 1)

RUN npm run build

# Production stage — backend (FastAPI sirve la API + el SPA compilado)
FROM docker.io/python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev libpq-dev \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --no-create-home --shell /bin/false --uid 1000 appuser

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
RUN chown -R appuser:appuser /app

# Build del frontend, servido por FastAPI (StaticFiles + catch-all SPA en
# app/main.py, que calcula SPA_DIR relativo a __file__ → app/app/spa/, NO
# app/spa/). OJO: NO usar "./app/static" como destino — ya existe
# backend/app/static/ (logo + fuentes que lee pdf_generator.py para
# ReportLab) y un COPY ahí encima pisaría logo.png con el del build de Vite.
COPY --from=frontend-build /app/dist ./app/spa
RUN chown -R appuser:appuser /app/app/spa

USER appuser

EXPOSE 8000

# Ejecuta las migraciones de Alembic antes de arrancar el servidor.
# Si las tablas ya están al día, alembic upgrade head es un no-op seguro.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
