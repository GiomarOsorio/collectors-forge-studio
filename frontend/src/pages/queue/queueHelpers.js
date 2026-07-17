/**
 * @file Helpers compartidos entre QueuePage y sus componentes hijos
 * (QueueList, HistoryList, BatchRow, TimelineView) — issue #133.
 *
 * @module pages/queue/queueHelpers
 */

import { CheckCircle2, Clock, GanttChartSquare, ListOrdered, Pause, Play, ScrollText, XCircle } from 'lucide-react';

export const ACCENT = '#14B8A6';

/**
 * Segundo nivel de la app Queue como un único AppTabs (issue #181 — la
 * sidebar ya no tiene subnav). Cola activa/Historial/Timeline son tabs de
 * estado interno de `QueuePage`; Bitácora es una ruta separada
 * (`/queue/log`, `PrintLogPage`) que se fusiona visualmente en la misma
 * fila — ambas páginas montan este mismo array para poder navegar entre sí.
 */
export const QUEUE_TABS = [
  { id: 'activa',    label: 'Cola activa', icon: ListOrdered },
  { id: 'historial', label: 'Historial',   icon: Clock },
  { id: 'timeline',  label: 'Timeline',    icon: GanttChartSquare },
  { id: 'bitacora',  label: 'Bitácora',    icon: ScrollText },
];

/**
 * Mapea el status del queue item a metadata `StatusPill` (label + tone + icon).
 *
 * Tonos:
 *   - `printing`  → en impresión (azul)
 *   - `done`      → completado (verde)
 *   - `danger`    → cancelado (rojo)
 *   - `pending`   → en espera (gris)
 */
export function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'printing')  return { label: 'Imprimiendo', tone: 'printing', icon: Play };
  if (s === 'done')      return { label: 'Listo',       tone: 'done',     icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelado',   tone: 'danger',   icon: XCircle };
  return { label: 'Pendiente', tone: 'pending', icon: Pause };
}

export const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Vista normalizada de un item de cola: unifica los campos visibles
 * que vienen de Quote (`item.quote`) y Vault (`item.vault`). Permite que
 * Card/Row/Body trabajen con un solo shape sin if/else en cada lectura.
 *
 * Si el item tiene ambos snapshots (no debería pasar) o ninguno, el
 * fallback es el item raw.
 */
export function itemView(item) {
  if (!item) return null;
  const q = item.quote;
  const v = item.vault;
  if (q) {
    return {
      source: 'quote',
      piece_name: q.piece_name,
      printer_name: q.printer_name,
      printer_id: q.printer_id,
      weight_grams: q.weight_grams,
      print_time_hours: q.print_time_hours,
      quantity: q.quantity,
      total_price: q.total_price,
      filament_name: null,
      sliced_filament_type: null,
    };
  }
  if (v) {
    return {
      source: 'vault',
      piece_name: v.name,
      printer_name: v.printer_name,
      printer_id: v.printer_id,
      weight_grams: v.weight_grams,
      print_time_hours: v.print_time_hours,
      quantity: v.quantity,
      total_price: null,
      filament_name: v.filament_name,
      sliced_filament_type: v.sliced_filament_type,
      spool_id: v.spool_id,
      spool_label_code: v.spool_label_code,
      spool_percent_remaining: v.spool_percent_remaining,
    };
  }
  return {
    source: 'unknown',
    piece_name: item.notes || `Item #${item.id}`,
    printer_name: null,
    weight_grams: null,
    print_time_hours: null,
    quantity: 1,
    total_price: null,
    filament_name: null,
    sliced_filament_type: null,
  };
}

export const fmtTimeHours = (h) => {
  if (h == null || !Number.isFinite(Number(h))) return '—';
  return `${Number(h).toFixed(1)}h`;
};

/**
 * Agrupa una lista de items (ya ordenada por `position`) en "unidades"
 * para render y drag-and-drop: cada unidad es un item suelto o un lote
 * completo (todos los items con el mismo `batch_id`, agrupados en la
 * posición del PRIMERO que aparece en la lista — issue #133).
 *
 * @param {Array<Object>} items
 * @returns {Array<{type: 'item', item: Object} | {type: 'batch', batchId: string, items: Object[]}>}
 */
export function groupIntoUnits(items) {
  const units = [];
  const batchUnitIndex = new Map();
  for (const item of items) {
    if (item.batch_id) {
      if (batchUnitIndex.has(item.batch_id)) {
        units[batchUnitIndex.get(item.batch_id)].items.push(item);
      } else {
        batchUnitIndex.set(item.batch_id, units.length);
        units.push({ type: 'batch', batchId: item.batch_id, items: [item] });
      }
    } else {
      units.push({ type: 'item', item });
    }
  }
  return units;
}

/** dnd-kit necesita un id string estable por unidad arrastrable. */
export function unitDndId(unit) {
  return unit.type === 'batch' ? `batch-${unit.batchId}` : `item-${unit.item.id}`;
}

/**
 * Progreso agregado de un lote ("2/5 done") — cuenta TODOS los items con
 * ese `batch_id`, sin importar si siguen activos (pending/printing) o ya
 * pasaron al historial (done/cancelled). Necesario porque los items
 * `done` desaparecen de `active` (issue #133).
 */
export function getBatchProgress(batchId, active, history) {
  const members = [...active, ...history].filter((it) => it.batch_id === batchId);
  const done = members.filter((it) => it.status === 'done').length;
  return { done, total: members.length };
}
