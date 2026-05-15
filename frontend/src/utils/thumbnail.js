/**
 * @file Helper para resolver la URL de miniatura de un modelo del Vault.
 *
 * Prioridad:
 *  1. `local_thumbnail_path` — PNG de plate render extraído del `.3mf`
 *     (servido por el backend en `/static/thumbnails/{id}.png`).
 *  2. `thumbnail_url` — URL externa de MakerWorld/Printables (puede ser genérica).
 *  3. `null` — el caller debe pintar placeholder.
 *
 * @module utils/thumbnail
 */

/**
 * @param {{ local_thumbnail_path?: string | null, thumbnail_url?: string | null }} model
 * @returns {string | null}
 */
export function getThumbnail(model) {
  if (!model) return null;
  return model.local_thumbnail_path || model.thumbnail_url || null;
}
