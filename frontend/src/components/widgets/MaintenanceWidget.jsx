/**
 * @file Widget de Mantenimiento pendiente (home dashboard).
 *
 * Lista los recordatorios de mantenimiento (`MaintenanceSchedule`, issue
 * #138) vencidos o próximos a vencer, agrupados por impresora. Reemplaza
 * el cálculo anterior basado en los intervalos hardcodeados de
 * `config/maintenance.js` — ahora la fuente de verdad es
 * `GET /api/maintenance/schedules/due`.
 *
 * @module components/widgets/MaintenanceWidget
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { getMaintenanceSchedulesDue } from '../../services/api';

const REFRESH_MS = 60_000;

/**
 * Agrupa schedules due por impresora, ordenando overdue primero.
 *
 * @param {Array} due
 * @returns {Array<{ printer_id: number, printer_name: string, items: Array }>}
 */
function groupByPrinter(due) {
  if (!Array.isArray(due)) return [];
  const sorted = [...due].sort((a, b) => {
    if (a.status === b.status) return Number(b.progress_pct) - Number(a.progress_pct);
    return a.status === 'overdue' ? -1 : 1;
  });
  const byPrinter = new Map();
  for (const s of sorted) {
    if (!byPrinter.has(s.printer_id)) {
      byPrinter.set(s.printer_id, { printer_id: s.printer_id, printer_name: s.printer_name, items: [] });
    }
    byPrinter.get(s.printer_id).items.push(s);
  }
  return [...byPrinter.values()];
}

/** @returns {{ groups: Array, loading: boolean, error: boolean }} */
function usePendingMaintenance() {
  const [state, setState] = useState({ groups: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getMaintenanceSchedulesDue();
        if (cancelled) return;
        setState({ groups: groupByPrinter(res?.data), loading: false, error: false });
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
  const { groups, loading, error } = usePendingMaintenance();
  const top = useMemo(() => groups.slice(0, 5), [groups]);

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando mantenimiento…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">No se pudo cargar el mantenimiento.</p>;
  }
  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <Wrench size={18} className="text-violet-400" />
        <span>Sin recordatorios vencidos.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2">
        {top.map(({ printer_id: printerId, printer_name: printerName, items }) => {
          const first = items[0];
          const extra = items.length - 1;
          return (
            <li
              key={printerId}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]"
            >
              <div className="min-w-0">
                <p className="text-sm text-tech-white truncate">{printerName || 'Impresora'}</p>
                <p className="text-xs text-gunmetal truncate">
                  {first.task_name}
                  {extra > 0 ? ` · +${extra}` : ''}
                </p>
              </div>
              <span
                className={`text-xs font-medium shrink-0 ${
                  first.status === 'overdue' ? 'text-rose-300' : 'text-amber-400'
                }`}
              >
                {Math.round(Number(first.progress_pct))}%
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end text-xs">
        <Link to="/maintenance" className="text-violet-400 hover:text-violet-300">
          Ver mantenimiento →
        </Link>
      </div>
    </div>
  );
}
