/**
 * @file Hook para mantener los conteos de badges de la sidebar en vivo.
 *
 * Cola pendiente refresca cada 5s. Stock bajo cada 60s. Mantenimiento vencido
 * cada 60s. Reemplaza al uso de React Query (no instalado en CFS) con
 * setInterval simple y `cancelled` flag para evitar fugas.
 *
 * @module hooks/useBadges
 */

import { useEffect, useState } from 'react';
import { getQueue, getInventoryItems, getMaintenanceSummary } from '../services/api';
import { MAINTENANCE_TYPES } from '../config/maintenance';

const QUEUE_INTERVAL_MS = 5_000;
const SLOW_INTERVAL_MS = 60_000;

const INTERVAL_BY_TYPE = MAINTENANCE_TYPES.reduce((acc, t) => {
  if (t.interval_hours) acc[t.value] = t.interval_hours;
  return acc;
}, {});

/**
 * Cuenta impresoras con al menos un tipo de mantenimiento vencido.
 *
 * `summary` es `[{ printer, last_per_type: { [tipo]: { hours_since } } }]`.
 * Un tipo está vencido si `hours_since >= INTERVAL_BY_TYPE[tipo]`.
 *
 * @param {Array} summary
 * @returns {number}
 */
function countOverdue(summary) {
  if (!Array.isArray(summary)) return 0;
  let count = 0;
  for (const entry of summary) {
    const lastPerType = entry?.last_per_type ?? {};
    const hasOverdue = Object.entries(lastPerType).some(([tipo, info]) => {
      const limit = INTERVAL_BY_TYPE[tipo];
      if (!limit) return false;
      const hoursSince = Number(info?.hours_since ?? 0);
      return hoursSince >= limit;
    });
    if (hasOverdue) count += 1;
  }
  return count;
}

/**
 * Hook que devuelve los conteos en vivo para badges de la sidebar.
 *
 * @returns {{ pendingQueue: number, lowStock: number, overdueMaintenance: number }}
 */
export function useBadges() {
  const [badges, setBadges] = useState({
    pendingQueue: 0,
    lowStock: 0,
    overdueMaintenance: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchQueue = async () => {
      try {
        const res = await getQueue();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const pending = list.filter((i) => i.status === 'pending').length;
        setBadges((prev) => ({ ...prev, pendingQueue: pending }));
      } catch {
        // Silenciar errores: si falla la red el badge queda en el último valor.
      }
    };

    const fetchStock = async () => {
      try {
        const res = await getInventoryItems();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const low = list.filter((i) => i.low_stock).length;
        setBadges((prev) => ({ ...prev, lowStock: low }));
      } catch {
        /* idem */
      }
    };

    const fetchMaintenance = async () => {
      try {
        const res = await getMaintenanceSummary();
        if (cancelled) return;
        const count = countOverdue(res?.data);
        setBadges((prev) => ({ ...prev, overdueMaintenance: count }));
      } catch {
        /* idem */
      }
    };

    fetchQueue();
    fetchStock();
    fetchMaintenance();

    const queueId = setInterval(fetchQueue, QUEUE_INTERVAL_MS);
    const stockId = setInterval(fetchStock, SLOW_INTERVAL_MS);
    const maintId = setInterval(fetchMaintenance, SLOW_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(queueId);
      clearInterval(stockId);
      clearInterval(maintId);
    };
  }, []);

  return badges;
}
