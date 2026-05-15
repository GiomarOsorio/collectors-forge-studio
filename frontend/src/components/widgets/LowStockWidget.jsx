/**
 * @file Widget de Stock bajo.
 *
 * Lista los 5 items de inventario con `low_stock=true` y muestra el conteo total.
 * Refresca cada 60s (el inventario cambia lento).
 *
 * @module components/widgets/LowStockWidget
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { getInventoryItems } from '../../services/api';

const REFRESH_MS = 60_000;

/** @returns {{ items: Array, loading: boolean, error: boolean }} */
function useLowStock() {
  const [state, setState] = useState({ items: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetcher = async () => {
      try {
        const res = await getInventoryItems();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const low = list.filter((i) => i.low_stock);
        setState({ items: low, loading: false, error: false });
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
export default function LowStockWidget() {
  const { items, loading, error } = useLowStock();
  const top = items.slice(0, 5);
  const extra = Math.max(0, items.length - top.length);

  if (loading) {
    return <p className="text-sm text-gunmetal">Cargando inventario…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">No se pudo cargar el inventario.</p>;
  }
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 text-gunmetal text-sm">
        <PackageOpen size={18} className="text-blue-400" />
        <span>Todo el stock está sobre el mínimo.</span>
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
              <p className="text-sm text-tech-white truncate">{item.name}</p>
              <p className="text-xs text-gunmetal">
                {item.category_name || 'Sin categoría'}
              </p>
            </div>
            <span className="text-xs font-medium text-rose-300 shrink-0">
              {item.quantity} / {item.min_quantity}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gunmetal">
          {items.length} bajo mínimo{extra > 0 ? ` (+${extra} más)` : ''}
        </span>
        <Link to="/inventory/stock" className="text-blue-400 hover:text-blue-300">
          Ver inventario →
        </Link>
      </div>
    </div>
  );
}
