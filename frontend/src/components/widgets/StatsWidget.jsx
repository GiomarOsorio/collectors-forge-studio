/**
 * @file Widget de Stats (home dashboard) — tasa de éxito y horas de los
 * últimos 30 días (issue #132).
 *
 * @module components/widgets/StatsWidget
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { getStatsOverview } from '../../services/api';

const REFRESH_MS = 60_000;

function last30DaysParams() {
  const pad = (n) => String(n).padStart(2, '0');
  const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { date_from: toIso(from), date_to: toIso(today) };
}

/** @returns {{ overview: Object|null, loading: boolean, error: boolean }} */
function useRecentOverview() {
  const [state, setState] = useState({ overview: null, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getStatsOverview(last30DaysParams());
        if (cancelled) return;
        setState({ overview: res?.data ?? null, loading: false, error: false });
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
export default function StatsWidget() {
  const { overview, loading, error } = useRecentOverview();

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando estadísticas…</p>;
  }
  if (error || !overview) {
    return <p className="text-sm text-rose-400">No se pudieron cargar las estadísticas.</p>;
  }
  const total = overview.prints_done + overview.prints_cancelled;
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <BarChart3 size={18} className="text-cyan-400" />
        <span>Sin impresiones en los últimos 30 días.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]">
          <p className="text-[10px] text-gunmetal uppercase tracking-wide">Tasa de éxito</p>
          <p className={`text-lg font-semibold ${overview.success_rate_pct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {Number(overview.success_rate_pct).toFixed(1)}%
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]">
          <p className="text-[10px] text-gunmetal uppercase tracking-wide">Horas impresas</p>
          <p className="text-lg font-semibold text-tech-white">{Number(overview.total_hours).toFixed(1)}h</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gunmetal">{overview.prints_done} listas · {overview.prints_cancelled} canceladas</span>
        <Link to="/stats" className="text-cyan-400 hover:text-cyan-300">
          Ver dashboard →
        </Link>
      </div>
    </div>
  );
}
