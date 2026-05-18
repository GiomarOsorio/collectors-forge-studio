/**
 * @file Helper para resolver la URL de miniatura de un modelo del Vault.
 *
 * Prioridad:
 *  1. `local_thumbnail_url` — URL del endpoint proxy
 *     (`/api/vault/{id}/thumbnail`) que streamea el PNG de plate render
 *     extraído del `.3mf` desde MinIO.
 *  2. `thumbnail_url` — URL externa de MakerWorld/Printables (puede ser genérica).
 *  3. `null` — el caller debe pintar placeholder.
 *
 * @module utils/thumbnail
 */

/**
 * @param {{ local_thumbnail_url?: string | null, thumbnail_url?: string | null }} model
 * @returns {string | null}
 */
export function getThumbnail(model) {
  if (!model) return null;
  return model.local_thumbnail_url || model.thumbnail_url || null;
}
