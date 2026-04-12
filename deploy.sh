#!/bin/bash
set -e

echo "=== Collector's Forge Studio - Deploy ==="

DEPLOY_PATH="$(cd "$(dirname "$0")" && pwd)"

# Asegurar XDG_RUNTIME_DIR para systemctl --user en CI/CD
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# ── Infisical helpers ─────────────────────────────────────────────────────────
# Token cacheado para no hacer login múltiples veces en el mismo deploy
INFISICAL_TOKEN=""
INFISICAL_URL="${INFISICAL_URL:-http://127.0.0.1:8080}"
INFISICAL_PROJECT="${INFISICAL_PROJECT_SLUG:-homelab}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"
INFISICAL_PATH="${INFISICAL_SECRET_PATH:-/collectorsforge}"

# Verifica si Infisical está respondiendo
infisical_ready() {
    curl -sf "${INFISICAL_URL}/api/status" >/dev/null 2>&1
}

# Autenticación con Machine Identity (Universal Auth)
# Requiere INFISICAL_CLIENT_ID e INFISICAL_CLIENT_SECRET en el entorno
infisical_login() {
    [ -n "$INFISICAL_TOKEN" ] && return 0
    if [ -z "$INFISICAL_CLIENT_ID" ] || [ -z "$INFISICAL_CLIENT_SECRET" ]; then
        echo "ERROR: INFISICAL_CLIENT_ID e INFISICAL_CLIENT_SECRET son requeridos." >&2
        exit 1
    fi
    local response
    response=$(curl -s -X POST \
        "${INFISICAL_URL}/api/v1/auth/universal-auth/login" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "clientId=${INFISICAL_CLIENT_ID}" \
        --data-urlencode "clientSecret=${INFISICAL_CLIENT_SECRET}")
    INFISICAL_TOKEN=$(echo "$response" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])") || {
        echo "ERROR: Infisical login falló." >&2
        echo "  URL: ${INFISICAL_URL}/api/v1/auth/universal-auth/login" >&2
        echo "  Respuesta: ${response}" >&2
        exit 1
    }
}

# Obtiene el valor de un secreto por nombre desde Infisical
# Uso: infisical_get <SECRET_NAME>
infisical_get() {
    local name="$1"
    infisical_login
    local response
    response=$(curl -s \
        -H "Authorization: Bearer ${INFISICAL_TOKEN}" \
        "${INFISICAL_URL}/api/v3/secrets/raw/${name}?workspaceSlug=${INFISICAL_PROJECT}&environment=${INFISICAL_ENV}&secretPath=${INFISICAL_PATH}")
    echo "$response" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['secret']['secretValue'])" || {
        echo "ERROR: No se pudo obtener el secreto '${name}'." >&2
        echo "  Respuesta: ${response}" >&2
        exit 1
    }
}

# ── Archivo de variables de entorno ──────────────────────────────────────────
# Modo A (recomendado): jalar secretos desde Infisical si está disponible
# Modo B (fallback):    leer ~/CollectorsForgeENV (setup manual)

ENV_FILE="$HOME/CollectorsForgeENV"

if [ -n "$INFISICAL_CLIENT_ID" ] && infisical_ready; then
    echo "→ Obteniendo secretos desde Infisical (${INFISICAL_URL})..."

    secret_key=$(infisical_get SECRET_KEY)
    pg_password=$(infisical_get POSTGRES_PASSWORD)
    session_key=$(infisical_get SESSION_SECRET_KEY)
    oidc_issuer=$(infisical_get OIDC_ISSUER)
    oidc_client_id=$(infisical_get OIDC_CLIENT_ID)
    oidc_client_secret=$(infisical_get OIDC_CLIENT_SECRET)
    oidc_redirect_uri=$(infisical_get OIDC_REDIRECT_URI)
    minio_endpoint=$(infisical_get MINIO_ENDPOINT 2>/dev/null || echo "http://cfs-minio:9000")
    minio_access_key=$(infisical_get MINIO_ACCESS_KEY 2>/dev/null || echo "minioadmin")
    minio_secret_key=$(infisical_get MINIO_SECRET_KEY 2>/dev/null || echo "minioadmin")
    minio_bucket=$(infisical_get MINIO_BUCKET 2>/dev/null || echo "cfs-models")
    vault_quota=$(infisical_get VAULT_QUOTA_GB 2>/dev/null || echo "50")

    echo "→ Escribiendo ${ENV_FILE}..."
    {
        printf 'SECRET_KEY=%q\n'          "$secret_key"
        printf 'POSTGRES_USER=%q\n'       "${POSTGRES_USER:-collectorsforge}"
        printf 'POSTGRES_PASSWORD=%q\n'   "$pg_password"
        printf 'POSTGRES_DB=%q\n'         "${POSTGRES_DB:-collectorsforge}"
        printf 'SESSION_SECRET_KEY=%q\n'  "$session_key"
        printf 'OIDC_ISSUER=%q\n'         "$oidc_issuer"
        printf 'OIDC_CLIENT_ID=%q\n'      "$oidc_client_id"
        printf 'OIDC_CLIENT_SECRET=%q\n'  "$oidc_client_secret"
        printf 'OIDC_REDIRECT_URI=%q\n'   "$oidc_redirect_uri"
        printf 'MINIO_ENDPOINT=%q\n'      "$minio_endpoint"
        printf 'MINIO_ACCESS_KEY=%q\n'    "$minio_access_key"
        printf 'MINIO_SECRET_KEY=%q\n'    "$minio_secret_key"
        printf 'MINIO_BUCKET=%q\n'        "$minio_bucket"
        printf 'VAULT_QUOTA_GB=%q\n'      "$vault_quota"
    } > "$ENV_FILE"
    chmod 600 "$ENV_FILE"

elif [ -f "$ENV_FILE" ]; then
    echo "→ Usando variables de entorno desde: $ENV_FILE"

elif [ -f "$DEPLOY_PATH/.env" ]; then
    ENV_FILE="$DEPLOY_PATH/.env"
    echo "→ Usando variables de entorno desde: $ENV_FILE"

else
    echo "ERROR: No se encontró archivo de variables de entorno ni Infisical disponible."
    echo ""
    echo "  Opción A (recomendada): configurar Infisical y exportar INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET"
    echo "  Opción B (manual):      crear ~/CollectorsForgeENV (ver .env.example)"
    exit 1
fi

source "$ENV_FILE"

# ── Validar variables requeridas ─────────────────────────────────────────────
if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY no está configurada."
    echo "Genera una con: openssl rand -hex 32"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD no está configurada."
    exit 1
fi

if [ -z "$OIDC_ISSUER" ] || [ -z "$OIDC_CLIENT_ID" ] || [ -z "$OIDC_CLIENT_SECRET" ]; then
    echo "AVISO: Variables OIDC incompletas. El login SSO no funcionará."
    echo "  Configurar: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI"
fi

echo "→ Habilitando linger para servicios persistentes..."
loginctl enable-linger "$(whoami)" 2>/dev/null || true

echo "→ Construyendo imágenes de la aplicación..."
podman build -t cfs-backend -f "$DEPLOY_PATH/backend/Containerfile" "$DEPLOY_PATH/backend/"
podman build -t cfs-frontend -f "$DEPLOY_PATH/frontend/Containerfile" "$DEPLOY_PATH/frontend/"
podman build -t cfs-slicer -f "$DEPLOY_PATH/slicer/Containerfile" "$DEPLOY_PATH/slicer/"
podman build -t cfs-tracker -f "$DEPLOY_PATH/tracker/Containerfile" "$DEPLOY_PATH/tracker/"

echo "→ Descargando imagen de PostgreSQL..."
podman pull docker.io/postgres:16-alpine

echo "→ Instalando Quadlets en systemd..."
QUADLET_DIR="$HOME/.config/containers/systemd"
mkdir -p "$QUADLET_DIR"

# Copiar red y volúmenes
# Nota: service-deployments también instala cfs.network (para cloudflared)
cp "$DEPLOY_PATH/quadlet/cfs.network" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/cfs-data.volume" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/cfs-pgdata.volume" "$QUADLET_DIR/"
cp "$DEPLOY_PATH/quadlet/cfs-slicer-jobs.volume" "$QUADLET_DIR/"

# Copiar contenedores sustituyendo __DEPLOY_PATH__ y __ENV_FILE__
for f in "$DEPLOY_PATH"/quadlet/*.container; do
    sed "s|__DEPLOY_PATH__|$DEPLOY_PATH|g; s|__ENV_FILE__|$ENV_FILE|g" \
        "$f" > "$QUADLET_DIR/$(basename "$f")"
done

echo "→ Recargando systemd..."
systemctl --user daemon-reload

echo "→ Iniciando PostgreSQL..."
systemctl --user restart cfs-postgres

echo "→ Esperando que PostgreSQL esté listo (máx. 60s)..."
PG_USER="${POSTGRES_USER:-collectorsforge}"
PG_DB="${POSTGRES_DB:-collectorsforge}"
for i in $(seq 1 30); do
    if podman exec cfs-postgres pg_isready -U "$PG_USER" -d "$PG_DB" 2>/dev/null; then
        echo "  PostgreSQL listo."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: PostgreSQL no respondió en 60 segundos."
        echo "  Revisa los logs: journalctl --user -u cfs-postgres -n 50"
        exit 1
    fi
    echo "  Esperando... ($i/30)"
    sleep 2
done

echo "→ Aplicando migraciones de base de datos..."
podman run --rm \
    --network cfs \
    --env-file "$ENV_FILE" \
    -e ALGORITHM=HS256 \
    -e ACCESS_TOKEN_EXPIRE_MINUTES=1440 \
    localhost/cfs-backend:latest \
    alembic upgrade head
if [ $? -ne 0 ]; then
    echo "ERROR: alembic upgrade head falló. Abortando deploy."
    echo "  Ver versión actual: podman exec cfs-postgres psql -U $PG_USER $PG_DB -c 'SELECT * FROM alembic_version;'"
    exit 1
fi

echo "→ Iniciando backend, slicer, tracker y frontend..."
systemctl --user restart cfs-slicer cfs-backend cfs-tracker cfs-frontend

echo "→ Verificando que el backend responde (máx. 30s)..."
for i in $(seq 1 15); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "  Backend listo."
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo "AVISO: El backend no respondió en 30 segundos."
        echo "  Revisa los logs: journalctl --user -u cfs-backend -n 50"
    fi
    echo "  Esperando... ($i/15)"
    sleep 2
done

echo ""
echo "=== Deploy completo ==="
echo "  App local:  http://localhost:3000"
echo "  App pública: https://3d.turtlenode.dev (vía cloudflared en service-deployments)"

echo ""
echo "Comandos útiles:"
echo "  systemctl --user status cfs-postgres        # Estado PostgreSQL"
echo "  systemctl --user status cfs-backend         # Estado backend"
echo "  systemctl --user status cfs-slicer          # Estado OrcaSlicer"
echo "  systemctl --user status cfs-tracker         # Estado tracker"
echo "  systemctl --user status cfs-frontend        # Estado frontend"
echo "  journalctl --user -u cfs-backend -f         # Logs backend"
echo "  journalctl --user -u cfs-slicer -f          # Logs OrcaSlicer"
echo "  journalctl --user -u cfs-tracker -f         # Logs tracker"
echo "  podman exec -it cfs-postgres psql -U $PG_USER $PG_DB  # Shell PG"
echo "  podman ps                                             # Ver contenedores"
