/**
 * @file Widget de Cola activa.
 *
 * Muestra los próximos 3 items con status `pending` y un CTA para ir a la cola.
 * Refresca cada 10s para no martillar el backend.
 *
 * @module components/widgets/QueueWidget
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListOrdered } from 'lucide-react';
import { getQueue } from '../../services/api';

const REFRESH_MS = 10_000;

/**
 * Carga la cola pendiente con un setInterval simple.
 *
 * @returns {{ items: Array, loading: boolean, error: boolean }}
 */
function usePendingQueue() {
  const [state, setState] = useState({ items: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getQueue();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const pending = list
          .filter((i) => i.status === 'pending')
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setState({ items: pending, loading: false, error: false });
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
export default function QueueWidget() {
  const { items, loading, error } = usePendingQueue();
  const top = items.slice(0, 3);
  const extra = Math.max(0, items.length - top.length);

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando cola…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">No se pudo cargar la cola.</p>;
  }
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <ListOrdered size={18} className="text-teal-400" />
        <span>No hay items pendientes.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2">
        {top.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0A0E16] border border-[#222630]"
          >
            <div className="min-w-0">
              <p className="text-sm text-tech-white truncate">
                {item.notes || item.model_name || `Item #${item.id}`}
              </p>
              <p className="text-xs text-gunmetal">
                Posición {item.position ?? '—'}
                {item.printer_name ? ` · ${item.printer_name}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gunmetal">
          {items.length} pendiente{items.length === 1 ? '' : 's'}
          {extra > 0 ? ` (+${extra} más)` : ''}
        </span>
        <Link to="/queue/" className="text-teal-400 hover:text-teal-300">
          Ver cola →
        </Link>
      </div>
    </div>
  );
}
