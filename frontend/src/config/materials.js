/**
 * @file Catálogo de materiales de filamento para Collector's Forge Studio.
 *
 * Define identificadores, etiqueta legible, temperatura típica de impresión y
 * un `tone` (hex) para colorear el dot de los chips de filtro en la UI. Está
 * alineado con `filament_type` en `inventory_items` y con `FILAMENT_TYPES` del
 * antiguo `InventoryStockPage`.
 *
 * @module config/materials
 */

/**
 * @typedef {Object} MaterialDef
 * @property {string} id    - Coincide con `inventory_items.filament_type`
 * @property {string} name  - Etiqueta mostrada en UI
 * @property {number} temp  - Temperatura típica de impresión en °C (informativa)
 * @property {string} tone  - Hex usado como dot en los chips de filtro
 */

/** @type {MaterialDef[]} */
export const MATERIALS = [
  { id: 'PLA',     name: 'PLA',     temp: 220, tone: '#7DD3FC' },
  { id: 'PLA+',    name: 'PLA+',    temp: 225, tone: '#60A5FA' },
  { id: 'PLA-CF',  name: 'PLA-CF',  temp: 230, tone: '#A7F3D0' },
  { id: 'PETG',    name: 'PETG',    temp: 240, tone: '#FBBF24' },
  { id: 'PETG+',   name: 'PETG+',   temp: 245, tone: '#F59E0B' },
  { id: 'ABS',     name: 'ABS',     temp: 260, tone: '#FB923C' },
  { id: 'ASA',     name: 'ASA',     temp: 260, tone: '#F87171' },
  { id: 'TPU',     name: 'TPU',     temp: 230, tone: '#C4B5FD' },
  { id: 'Nylon',   name: 'Nylon',   temp: 270, tone: '#A78BFA' },
  { id: 'PA-CF',   name: 'PA-CF',   temp: 290, tone: '#94A3B8' },
  { id: 'Otro',    name: 'Otro',    temp: 0,   tone: '#7A8494' },
];

/** Mapa id → MaterialDef para lookups O(1). */
export const MATERIALS_BY_ID = MATERIALS.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

/** Lista ordenada de IDs (para ordenar grupos en el grid). */
export const MATERIAL_ORDER = MATERIALS.map((m) => m.id);
