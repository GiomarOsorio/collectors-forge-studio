/**
 * @file Adaptador entre `inventory_items` del backend y la forma esperada por
 * los componentes de la UI Claude Design.
 *
 * El backend devuelve campos como `quantity`, `weight_per_roll`, `filament_type`,
 * `price_per_kg`, `color_hex`, `color_name`, etc. La UI Claude Design usa
 * `remaining`, `total`, `material`, `costPerKg`, `color`, `colorName`. Este
 * módulo es el único punto donde se traducen.
 *
 * @module utils/inventoryAdapter
 */

import { MATERIALS_BY_ID } from '../config/materials';

const DEFAULT_SPOOL_GRAMS = 1000;

/**
 * Convierte un `InventoryItemResponse` (Filamento) a la forma que consumen
 * los componentes (`FilamentCard`, `FilamentTable`, drawer).
 *
 * @param {Object} item
 * @returns {Object}
 */
export function mapToFilament(item) {
  const total = Number(item.weight_per_roll) || DEFAULT_SPOOL_GRAMS;
  const remaining = Math.max(0, Number(item.quantity) || 0);
  const materialId = MATERIALS_BY_ID[item.filament_type] ? item.filament_type : 'Otro';
  return {
    id: item.id,
    rawId: `ITEM-${String(item.id).padStart(4, '0')}`,
    name: item.name,
    material: materialId,
    vendor: item.filament_brand || '—',
    batch: item.batch || '',
    color: normalizeHex(item.color_hex),
    colorName: item.color_name || item.filament_color || item.name,
    remaining,
    total,
    costPerKg: Number(item.price_per_kg) || 0,
    salePerKg: item.sale_price != null ? Number(item.sale_price) : null,
    location: item.location || '',
    lowStock: !!item.low_stock,
    minQuantity: Number(item.min_quantity) || 0,
    unit: item.unit || 'g',
    notes: item.notes || '',
    updatedAt: item.updated_at,
  };
}

/**
 * Calcula el porcentaje restante (0-100) basado en `remaining`/`total`.
 *
 * @param {{ remaining: number, total: number }} f
 * @returns {number}
 */
export function fillPercent(f) {
  if (!f?.total) return 0;
  return Math.max(0, Math.min(100, (f.remaining / f.total) * 100));
}

/**
 * Clasifica el nivel de stock comparando `remaining` con el `minQuantity`
 * configurado por el usuario.
 *
 * Reglas:
 *   - Si `minQuantity > 0` y `remaining < minQuantity` → `'critical'`.
 *   - En cualquier otro caso → `'ok'`.
 *
 * El umbral porcentual viejo (10%/20% del total) fue removido en 2026-05:
 * cada item ahora controla su propio umbral via el campo `min_quantity`
 * (editable desde el form del inventario). Items sin `min_quantity`
 * configurado nunca se marcan como críticos.
 *
 * @param {{ remaining: number, minQuantity?: number }} f
 * @returns {'ok'|'critical'}
 */
export function stockLevel(f) {
  if (!f) return 'ok';
  const min = Number(f.minQuantity) || 0;
  const remaining = Number(f.remaining) || 0;
  if (min > 0 && remaining < min) return 'critical';
  return 'ok';
}

/**
 * Asegura que el hex sea válido `#RRGGBB`. Devuelve null si no.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeHex(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 7 && trimmed[0] === '#' && /^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

/**
 * Calcula estadísticas agregadas (total value, total grams, low, critical).
 *
 * @param {Array} filaments
 * @returns {{ totalValue: number, totalGrams: number, spoolCount: number, lowCount: number, criticalCount: number }}
 */
export function computeFilamentStats(filaments) {
  let totalValue = 0;
  let totalGrams = 0;
  let lowCount = 0;
  let criticalCount = 0;
  for (const f of filaments) {
    totalGrams += f.remaining;
    totalValue += (f.remaining / 1000) * f.costPerKg;
    const level = stockLevel(f);
    if (level !== 'ok') lowCount += 1;
    if (level === 'critical') criticalCount += 1;
  }
  return { totalValue, totalGrams, spoolCount: filaments.length, lowCount, criticalCount };
}

/**
 * Agrupa filamentos por nivel de stock primero (Stock bajo) y luego por material.
 *
 * @param {Array} filaments
 * @param {string[]} materialOrder
 * @returns {Array<{ key: string, label: string, items: Array, warn: boolean }>}
 */
export function groupFilaments(filaments, materialOrder) {
  const low = filaments.filter((f) => stockLevel(f) !== 'ok');
  const byMat = {};
  for (const f of filaments) {
    if (!byMat[f.material]) byMat[f.material] = [];
    byMat[f.material].push(f);
  }
  const groups = [];
  if (low.length) groups.push({ key: 'low', label: 'Stock bajo', items: low, warn: true });
  for (const mid of materialOrder) {
    if (byMat[mid] && byMat[mid].length) {
      groups.push({ key: mid, label: mid, items: byMat[mid], warn: false });
    }
  }
  return groups;
}

/**
 * Formateadores compartidos en la UI.
 */
export const fmtCOP = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const abs = Math.abs(Number(n));
  if (abs >= 1000) return `$ ${Math.round(Number(n)).toLocaleString('es-CO')}`;
  return `$ ${Number(n).toFixed(0)}`;
};

/**
 * Formato USD para precios de filamento (la calculadora los maneja en USD,
 * no COP). Ej: 25 → "$25.00", 1499.5 → "$1,499.50".
 */
export const fmtUSD = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const fmtKg = (g) => {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${Math.round(g)} g`;
};

export const fmtG = (g) => `${Math.round(g)} g`;

export const fmtPct = (n) => `${Math.round(n)}%`;
