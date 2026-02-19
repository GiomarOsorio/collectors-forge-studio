#!/bin/bash
set -e

echo "=== Calculator3D - Deploy ==="

DEPLOY_PATH="$(cd "$(dirname "$0")" && pwd)"

# Asegurar XDG_RUNTIME_DIR para systemctl --user en CI/CD
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Verificar .env
if [ ! -f "$DEPLOY_PATH/.env" ]; then
    echo "ERROR: No se encontró el archivo .env"
    echo "Copia .env.example como .env y completa los valores:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

source "$DEPLOY_PATH/.env"

# Validar variables requeridas
if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY no está configurada en .env"
    echo "Genera una con: openssl rand -hex 32"
    exit 1
fi

if [ -z "$TUNNEL_TOKEN" ]; then
    echo "AVISO: TUNNEL_TOKEN no configurado. Se levantará sin Cloudflare Tunnel."
    echo "La app estará disponible solo en http://localhost:3000"
    echo ""
fi

echo "→ Habilitando linger para servicios persistentes..."
loginctl enable-linger "$(whoami)" 2>/dev/null || true

echo "→ Construyendo imágenes..."
podman build -t calculator3d-backend -f "$DEPLOY_PATH/backend/Containerfile" "$DEPLOY_PATH/backend/"
podman build -t calculator3d-frontend -f "$DEPLOY_PATH/frontend/Containerfile" "$DEPLOY_PATH/frontend/"

echo "→ Instalando Quadlets en systemd..."
QUADLET_DIR="$HOME/.config/containers/systemd"
mkdir -p "$QUADLET_DIR"

# Copiar red y volumen (sin sustituciones)
cp "$DEPLOY_PATH/quadlet/calculator3d.network" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/calculator3d-data.volume" "$QUADLET_DIR/"

# Copiar contenedores sustituyendo la ruta de deploy
for f in "$DEPLOY_PATH"/quadlet/*.container; do
    sed "s|__DEPLOY_PATH__|$DEPLOY_PATH|g" "$f" > "$QUADLET_DIR/$(basename "$f")"
done

# Si no hay TUNNEL_TOKEN, quitar el tunnel
if [ -z "$TUNNEL_TOKEN" ]; then
    rm -f "$QUADLET_DIR/calculator3d-tunnel.container"
fi

echo "→ Recargando systemd..."
systemctl --user daemon-reload

echo "→ Iniciando servicios..."
systemctl --user restart calculator3d-backend calculator3d-frontend

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
echo "  systemctl --user status calculator3d-backend     # Estado backend"
echo "  systemctl --user status calculator3d-frontend    # Estado frontend"
echo "  systemctl --user status calculator3d-tunnel      # Estado tunnel"
echo "  journalctl --user -u calculator3d-tunnel -f      # Logs tunnel"
echo "  podman ps                                         # Ver contenedores"
