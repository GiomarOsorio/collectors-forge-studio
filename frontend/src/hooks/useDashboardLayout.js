/**
 * @file Hook que gestiona el layout del dashboard persistido en localStorage.
 *
 * El layout es un array `[{ id, visible, size }]` con el orden, visibilidad y
 * tamaño de cada widget. Se reconcilia con `WIDGETS` en cada montaje: si aparece
 * un widget nuevo se anexa al final con sus defaults; si un widget fue eliminado
 * de la app se descarta del layout guardado.
 *
 * @module hooks/useDashboardLayout
 */

import { useCallback, useEffect, useState } from 'react';
import { NEXT_SIZE, VALID_SIZES, WIDGETS, WIDGETS_BY_ID } from '../components/widgets';

const STORAGE_KEY = 'cfs.dashboard.layout';

/**
 * @typedef {Object} LayoutEntry
 * @property {string} id
 * @property {boolean} visible
 * @property {('quarter'|'half'|'full')} size
 */

/** Default layout = orden de `WIDGETS`, visible+size según defaults. */
function buildDefaultLayout() {
  return WIDGETS.map((w) => ({
    id: w.id,
    visible: w.defaultVisible,
    size: w.defaultSize,
  }));
}

/**
 * Reconcilia un layout guardado con el registro `WIDGETS` actual.
 * Descarta widgets que ya no existen, agrega los nuevos al final con defaults.
 *
 * @param {LayoutEntry[]} stored
 * @returns {LayoutEntry[]}
 */
function reconcile(stored) {
  const knownIds = new Set(WIDGETS.map((w) => w.id));
  const filtered = stored
    .filter((e) => knownIds.has(e.id))
    .map((e) => ({
      id: e.id,
      visible: typeof e.visible === 'boolean' ? e.visible : true,
      size: VALID_SIZES.includes(e.size) ? e.size : WIDGETS_BY_ID[e.id].defaultSize,
    }));
  const seen = new Set(filtered.map((e) => e.id));
  for (const w of WIDGETS) {
    if (!seen.has(w.id)) {
      filtered.push({ id: w.id, visible: w.defaultVisible, size: w.defaultSize });
    }
  }
  return filtered;
}

/** Lee el layout guardado o construye el default. */
function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return reconcile(parsed);
    }
  } catch {
    /* malformado → ignorar y usar default */
  }
  return buildDefaultLayout();
}

/**
 * Hook que devuelve el layout y mutadores.
 *
 * @returns {{
 *   layout: LayoutEntry[],
 *   visibleLayout: LayoutEntry[],
 *   hiddenWidgets: import('../components/widgets').WidgetDef[],
 *   reorder: (fromId: string, toId: string) => void,
 *   cycleSize: (id: string) => void,
 *   hide: (id: string) => void,
 *   show: (id: string) => void,
 *   reset: () => void,
 * }}
 */
export function useDashboardLayout() {
  const [layout, setLayout] = useState(loadLayout);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const reorder = useCallback((fromId, toId) => {
    setLayout((prev) => {
      const fromIdx = prev.findIndex((e) => e.id === fromId);
      const toIdx = prev.findIndex((e) => e.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const cycleSize = useCallback((id) => {
    setLayout((prev) =>
      prev.map((e) => (e.id === id ? { ...e, size: NEXT_SIZE[e.size] || 'half' } : e)),
    );
  }, []);

  const hide = useCallback((id) => {
    setLayout((prev) => prev.map((e) => (e.id === id ? { ...e, visible: false } : e)));
  }, []);

  const show = useCallback((id) => {
    setLayout((prev) => prev.map((e) => (e.id === id ? { ...e, visible: true } : e)));
  }, []);

  const reset = useCallback(() => setLayout(buildDefaultLayout()), []);

  const visibleLayout = layout.filter((e) => e.visible);
  const hiddenWidgets = layout
    .filter((e) => !e.visible)
    .map((e) => WIDGETS_BY_ID[e.id])
    .filter(Boolean);

  return { layout, visibleLayout, hiddenWidgets, reorder, cycleSize, hide, show, reset };
}
