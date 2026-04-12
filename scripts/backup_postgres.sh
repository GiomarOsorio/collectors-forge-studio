#!/usr/bin/env bash
# backup_postgres.sh — Respaldo diario de la base de datos PostgreSQL
#
# Uso:
#   ./scripts/backup_postgres.sh
#
# Variables de entorno requeridas (o usar valores por defecto):
#   POSTGRES_DB       — nombre de la base de datos (default: cfs)
#   POSTGRES_USER     — usuario de PostgreSQL (default: postgres)
#   POSTGRES_HOST     — host del servidor (default: localhost)
#   BACKUP_DIR        — directorio donde guardar los respaldos (default: /var/backups/cfs)
#   BACKUP_RETAIN_DAYS— días a conservar respaldos antiguos (default: 30)
#
# El respaldo se comprime con gzip y se nombra con la fecha y hora.
# Los respaldos con más de BACKUP_RETAIN_DAYS días se eliminan automáticamente.
#
# Ejemplo de cron (diario a las 02:00):
#   0 2 * * * /opt/cfs/scripts/backup_postgres.sh >> /var/log/cfs_backup.log 2>&1

set -euo pipefail

DB="${POSTGRES_DB:-cfs}"
USER="${POSTGRES_USER:-postgres}"
HOST="${POSTGRES_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cfs}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/${DB}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Iniciando respaldo de '${DB}' en ${HOST}..."

pg_dump \
    --host="${HOST}" \
    --username="${USER}" \
    --no-password \
    --format=plain \
    --encoding=UTF8 \
    "${DB}" | gzip > "${FILENAME}"

SIZE=$(du -sh "${FILENAME}" | cut -f1)
echo "[$(date -Iseconds)] Respaldo completado: ${FILENAME} (${SIZE})"

# Eliminar respaldos anteriores a RETAIN_DAYS días
DELETED=$(find "${BACKUP_DIR}" -name "${DB}_*.sql.gz" -mtime "+${RETAIN_DAYS}" -print -delete | wc -l | tr -d ' ')
if [ "${DELETED}" -gt 0 ]; then
    echo "[$(date -Iseconds)] Respaldos eliminados (>${RETAIN_DAYS} días): ${DELETED}"
fi
