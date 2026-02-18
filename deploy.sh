#!/bin/bash
set -e

echo "=== Calculator3D - Deploy ==="

# Verificar .env
if [ ! -f .env ]; then
    echo "ERROR: No se encontró el archivo .env"
    echo "Copia .env.example como .env y completa los valores:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Cargar variables
source .env

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

echo "→ Construyendo imágenes..."
podman build -t calculator3d-backend -f backend/Containerfile backend/
podman build -t calculator3d-frontend -f frontend/Containerfile frontend/

echo "→ Creando red y volumen..."
podman network create calculator3d 2>/dev/null || true
podman volume create calculator3d-data 2>/dev/null || true

echo "→ Deteniendo contenedores anteriores..."
podman rm -f calculator3d-backend calculator3d-frontend calculator3d-tunnel 2>/dev/null || true

echo "→ Levantando backend..."
podman run -d --name calculator3d-backend \
    --network calculator3d \
    -v calculator3d-data:/app/data:Z \
    -e DATABASE_URL="sqlite+aiosqlite:///./data/calculator3d.db" \
    -e SECRET_KEY="$SECRET_KEY" \
    -e ALGORITHM="HS256" \
    -e ACCESS_TOKEN_EXPIRE_MINUTES="1440" \
    -e ADMIN_USERNAME="${ADMIN_USERNAME:-admin}" \
    -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}" \
    -e ADMIN_EMAIL="${ADMIN_EMAIL:-admin@turtlenode.dev}" \
    --restart unless-stopped \
    calculator3d-backend

echo "→ Levantando frontend..."
podman run -d --name calculator3d-frontend \
    --network calculator3d \
    -p 3000:80 \
    --restart unless-stopped \
    calculator3d-frontend

if [ -n "$TUNNEL_TOKEN" ]; then
    echo "→ Levantando Cloudflare Tunnel..."
    podman run -d --name calculator3d-tunnel \
        --network calculator3d \
        -e TUNNEL_TOKEN="$TUNNEL_TOKEN" \
        --restart unless-stopped \
        docker.io/cloudflare/cloudflared:latest tunnel run
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
echo "  podman logs calculator3d-backend    # Ver logs del backend"
echo "  podman logs calculator3d-frontend   # Ver logs del frontend"
echo "  podman logs calculator3d-tunnel     # Ver logs del tunnel"
echo "  podman ps                           # Ver contenedores"
