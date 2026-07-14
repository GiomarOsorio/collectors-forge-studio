/**
 * @file Categorías fijas de motivo de fallo/cancelación (issue #130).
 *
 * Espejo del `Literal` de `backend/app/schemas/queue.py` (`FailureCategory`)
 * — compartido entre el historial de impresiones del Vault y la captura
 * de motivo al cancelar en Queue, para no duplicar (y desincronizar) el
 * mismo vocabulario en dos archivos.
 *
 * @module utils/failureCategories
 */

/** @type {{ value: string, label: string }[]} */
export const FAILURE_CATEGORIES = [
  { value: 'adhesion', label: 'Adherencia' },
  { value: 'clog', label: 'Atasco' },
  { value: 'filament_runout', label: 'Filamento agotado' },
  { value: 'power_loss', label: 'Corte de luz' },
  { value: 'layer_shift', label: 'Desalineación de capas' },
  { value: 'other', label: 'Otro' },
];

/** Mapa value → label para lookups rápidos en tablas/badges. */
export const FAILURE_CATEGORY_LABELS = Object.fromEntries(
  FAILURE_CATEGORIES.map((c) => [c.value, c.label]),
);
