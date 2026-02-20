#!/bin/bash
set -e

echo "=== TurtleForge Cost - Deploy ==="

DEPLOY_PATH="$(cd "$(dirname "$0")" && pwd)"

# Asegurar XDG_RUNTIME_DIR para systemctl --user en CI/CD
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# ── Archivo de variables de entorno ──────────────────────────────────────────
# Busca primero ~/Calculator3dENV (fuente única fuera del repo),
# luego cae a .env en el directorio del proyecto como fallback.
if [ -f "$HOME/Calculator3DENV" ]; then
    ENV_FILE="$HOME/Calculator3DENV"
elif [ -f "$DEPLOY_PATH/.env" ]; then
    ENV_FILE="$DEPLOY_PATH/.env"
else
    echo "ERROR: No se encontró el archivo de variables de entorno."
    echo "  Opción A (recomendada): ~/Calculator3dENV"
    echo "  Opción B (fallback):    $DEPLOY_PATH/.env"
    exit 1
fi

echo "→ Usando variables de entorno desde: $ENV_FILE"
source "$ENV_FILE"

# ── Validar variables requeridas ─────────────────────────────────────────────
if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY no está configurada."
    echo "Genera una con: openssl rand -hex 32"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD no está configurada."
    echo "Agrega a $ENV_FILE:  POSTGRES_PASSWORD=$(openssl rand -hex 16)"
    exit 1
fi

if [ -z "$TUNNEL_TOKEN" ]; then
    echo "AVISO: TUNNEL_TOKEN no configurado. Se levantará sin Cloudflare Tunnel."
    echo "La app estará disponible solo en http://localhost:3000"
    echo ""
fi

echo "→ Habilitando linger para servicios persistentes..."
loginctl enable-linger "$(whoami)" 2>/dev/null || true

echo "→ Construyendo imágenes de la aplicación..."
podman build -t calculator3d-backend -f "$DEPLOY_PATH/backend/Containerfile" "$DEPLOY_PATH/backend/"
podman build -t calculator3d-frontend -f "$DEPLOY_PATH/frontend/Containerfile" "$DEPLOY_PATH/frontend/"
podman build -t calculator3d-slicer -f "$DEPLOY_PATH/slicer/Containerfile" "$DEPLOY_PATH/slicer/"

echo "→ Descargando imagen de PostgreSQL..."
podman pull docker.io/postgres:16-alpine

echo "→ Instalando Quadlets en systemd..."
QUADLET_DIR="$HOME/.config/containers/systemd"
mkdir -p "$QUADLET_DIR"

# Copiar red y volúmenes
cp "$DEPLOY_PATH/quadlet/calculator3d.network" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/calculator3d-data.volume" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/calculator3d-pgdata.volume" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/calculator3d-slicer-jobs.volume" "$QUADLET_DIR/"

# Copiar contenedores sustituyendo __DEPLOY_PATH__ y __ENV_FILE__
for f in "$DEPLOY_PATH"/quadlet/*.container; do
    sed "s|__DEPLOY_PATH__|$DEPLOY_PATH|g; s|__ENV_FILE__|$ENV_FILE|g" \
        "$f" > "$QUADLET_DIR/$(basename "$f")"
done

# Si no hay TUNNEL_TOKEN, quitar el tunnel
if [ -z "$TUNNEL_TOKEN" ]; then
    rm -f "$QUADLET_DIR/calculator3d-tunnel.container"
fi

echo "→ Recargando systemd..."
systemctl --user daemon-reload

echo "→ Iniciando PostgreSQL..."
systemctl --user restart calculator3d-postgres

echo "→ Esperando que PostgreSQL esté listo (máx. 60s)..."
PG_USER="${POSTGRES_USER:-turtleforge}"
PG_DB="${POSTGRES_DB:-turtleforge}"
for i in $(seq 1 30); do
    if podman exec calculator3d-postgres pg_isready -U "$PG_USER" -d "$PG_DB" 2>/dev/null; then
        echo "  PostgreSQL listo."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: PostgreSQL no respondió en 60 segundos."
        echo "  Revisa los logs: journalctl --user -u calculator3d-postgres -n 50"
        exit 1
    fi
    echo "  Esperando... ($i/30)"
    sleep 2
done

echo "→ Iniciando backend, slicer y frontend..."
systemctl --user restart calculator3d-slicer calculator3d-backend calculator3d-frontend

if [ -n "$TUNNEL_TOKEN" ]; then
    systemctl --user restart calculator3d-tunnel
    echo ""
    echo "=== Deploy completo ==="
    echo "App disponible en: https://3d.turtlenode.dev"
else
    echo ""
    echo "=== Deploy completo (sin tunnel) ==="
    echo "App disponible en: http://localhost:3000"
fi

echo ""
echo "Comandos útiles:"
echo "  systemctl --user status calculator3d-postgres        # Estado PostgreSQL"
echo "  systemctl --user status calculator3d-backend         # Estado backend"
echo "  systemctl --user status calculator3d-slicer          # Estado OrcaSlicer"
echo "  systemctl --user status calculator3d-frontend        # Estado frontend"
echo "  journalctl --user -u calculator3d-backend -f         # Logs backend"
echo "  journalctl --user -u calculator3d-slicer -f          # Logs OrcaSlicer"
echo "  podman exec -it calculator3d-postgres psql -U $PG_USER $PG_DB  # Shell PG"
echo "  podman ps                                             # Ver contenedores"
