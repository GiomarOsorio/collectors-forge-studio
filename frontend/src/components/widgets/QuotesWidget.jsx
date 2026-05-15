/**
 * @file Widget de cotizaciones de cliente recientes.
 *
 * Muestra las últimas 5 cotizaciones (ClientQuote) con cliente y subtotal.
 *
 * @module components/widgets/QuotesWidget
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { getClientQuotes } from '../../services/api';

const REFRESH_MS = 60_000;

const formatCOP = (value) => {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `$${value}`;
  }
};

/** @returns {{ items: Array, loading: boolean, error: boolean }} */
function useRecentQuotes() {
  const [state, setState] = useState({ items: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getClientQuotes();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const sorted = [...list].sort((a, b) => {
          const da = new Date(a.created_at || a.quote_date).getTime();
          const db = new Date(b.created_at || b.quote_date).getTime();
          return db - da;
        });
        setState({ items: sorted.slice(0, 5), loading: false, error: false });
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
export default function QuotesWidget() {
  const { items, loading, error } = useRecentQuotes();

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando cotizaciones…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">No se pudieron cargar las cotizaciones.</p>;
  }
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <FileText size={18} className="text-forge-teal" />
        <span>Aún no hay cotizaciones.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2">
        {items.map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]"
          >
            <div className="min-w-0">
              <p className="text-sm text-tech-white truncate">{q.client_name}</p>
              <p className="text-xs text-gunmetal truncate">
                {q.description || `COT-${String(q.id).padStart(4, '0')}`}
              </p>
            </div>
            <span className="text-xs font-medium text-forge-teal shrink-0">
              {formatCOP(q.subtotal)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end text-xs">
        <Link to="/cost/quotes" className="text-forge-teal hover:text-forge-teal/80">
          Ver historial →
        </Link>
      </div>
    </div>
  );
}
