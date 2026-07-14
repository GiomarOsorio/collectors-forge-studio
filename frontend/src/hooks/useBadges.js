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
import { getQueue, getInventoryItems, getMaintenanceSchedulesDue } from '../services/api';

const QUEUE_INTERVAL_MS = 5_000;
const SLOW_INTERVAL_MS = 60_000;

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
        const res = await getMaintenanceSchedulesDue();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setBadges((prev) => ({ ...prev, overdueMaintenance: list.length }));
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
