/**
 * @file Widget de Mantenimiento pendiente.
 *
 * Lista las impresoras con al menos un tipo de mantenimiento vencido,
 * usando los intervalos definidos en `config/maintenance.js`. Muestra el
 * primer tipo vencido por impresora.
 *
 * @module components/widgets/MaintenanceWidget
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { getMaintenanceSummary } from '../../services/api';
import { MAINTENANCE_TYPES } from '../../config/maintenance';

const REFRESH_MS = 60_000;

/** Tabla pre-construida tipo → { label, interval_hours } para lookups. */
const TYPE_BY_VALUE = MAINTENANCE_TYPES.reduce((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

/**
 * Calcula el primer tipo vencido por impresora a partir del summary.
 *
 * @param {Array} summary
 * @returns {Array<{ printer: Object, vencidos: Array<{ tipo: string, label: string, hoursSince: number, intervalHours: number }> }>}
 */
function selectOverdue(summary) {
  if (!Array.isArray(summary)) return [];
  const result = [];
  for (const entry of summary) {
    const vencidos = [];
    const lastPerType = entry?.last_per_type ?? {};
    for (const [tipo, info] of Object.entries(lastPerType)) {
      const def = TYPE_BY_VALUE[tipo];
      if (!def?.interval_hours) continue;
      const hoursSince = Number(info?.hours_since ?? 0);
      if (hoursSince >= def.interval_hours) {
        vencidos.push({
          tipo,
          label: def.label,
          hoursSince,
          intervalHours: def.interval_hours,
        });
      }
    }
    if (vencidos.length > 0) {
      result.push({ printer: entry.printer, vencidos });
    }
  }
  return result;
}

/** @returns {{ rows: Array, loading: boolean, error: boolean }} */
function useOverdueMaintenance() {
  const [state, setState] = useState({ rows: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getMaintenanceSummary();
        if (cancelled) return;
        setState({ rows: selectOverdue(res?.data), loading: false, error: false });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: true }));
      }
    };
    fetcher();
    const id = setInterval(fetcher, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

/** @returns {JSX.Element} */
export default function MaintenanceWidget() {
  const { rows, loading, error } = useOverdueMaintenance();
  const top = useMemo(() => rows.slice(0, 5), [rows]);

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando mantenimiento…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">No se pudo cargar el mantenimiento.</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <Wrench size={18} className="text-violet-400" />
        <span>Sin mantenimientos vencidos.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2">
        {top.map(({ printer, vencidos }) => {
          const first = vencidos[0];
          const extra = vencidos.length - 1;
          return (
            <li
              key={printer?.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]"
            >
              <div className="min-w-0">
                <p className="text-sm text-tech-white truncate">{printer?.name || 'Impresora'}</p>
                <p className="text-xs text-gunmetal truncate">
                  {first.label}
                  {extra > 0 ? ` · +${extra}` : ''}
                </p>
              </div>
              <span className="text-xs font-medium text-violet-300 shrink-0">
                {Math.round(first.hoursSince)}h / {first.intervalHours}h
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end text-xs">
        <Link to="/maintenance/dashboard" className="text-violet-400 hover:text-violet-300">
          Ver dashboard →
        </Link>
      </div>
    </div>
  );
}
