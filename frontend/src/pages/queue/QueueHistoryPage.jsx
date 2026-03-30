/**
 * @file Página de historial de la cola de impresión.
 *
 * Muestra los últimos 50 trabajos completados ('done') o cancelados ('cancelled'),
 * ordenados del más reciente al más antiguo.
 *
 * @module pages/queue/QueueHistoryPage
 */

import { useState, useEffect } from 'react';
import { getQueueHistory } from '../../services/api';
import toast from 'react-hot-toast';
import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';

/**
 * Formatea una fecha ISO a string localizado.
 * @param {string|null} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea horas a string legible.
 * @param {number} hours
 * @returns {string}
 */
function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Página de historial de trabajos completados y cancelados.
 * @returns {JSX.Element}
 */
export default function QueueHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQueueHistory()
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Error al cargar el historial'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gunmetal">
        <Loader2 size={22} className="animate-spin mr-2" />
        Cargando historial...
      </div>
    );
  }

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-teal-500/10">
          <Clock size={24} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Historial</h1>
          <p className="text-steel text-sm mt-0.5">Últimos 50 trabajos completados o cancelados</p>
        </div>
      </div>

      {/* Tabla */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-teal-500/10 mb-4">
            <Clock size={32} className="text-teal-400" />
          </div>
          <h3 className="text-tech-white font-semibold mb-2">Sin historial aún</h3>
          <p className="text-steel text-sm">
            Los trabajos marcados como impresos o cancelados aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#222630]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222630] text-gunmetal">
                <th className="text-left px-4 py-3 font-medium">Pieza</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Impresora</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Duración</th>
                <th className="text-left px-4 py-3 font-medium">Completado</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const q = item.quote;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-[#222630] last:border-0 ${
                      idx % 2 === 0 ? 'bg-[#0A0E16]' : 'bg-[#0D1018]'
                    }`}
                  >
                    {/* Pieza */}
                    <td className="px-4 py-3">
                      {q ? (
                        <div>
                          <div className="text-tech-white font-medium">{q.piece_name}</div>
                          <div className="text-gunmetal text-xs">
                            COT-{String(q.id).padStart(4, '0')}
                            {q.quantity > 1 && ` · ×${q.quantity}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gunmetal italic text-xs">Cotización eliminada</span>
                      )}
                    </td>

                    {/* Impresora */}
                    <td className="px-4 py-3 text-steel hidden md:table-cell">
                      {q ? q.printer_name : '—'}
                    </td>

                    {/* Duración */}
                    <td className="px-4 py-3 text-steel hidden lg:table-cell">
                      {q ? formatHours(q.print_time_hours) : '—'}
                    </td>

                    {/* Completado */}
                    <td className="px-4 py-3 text-steel whitespace-nowrap">
                      {formatDate(item.completed_at)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      {item.status === 'done' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle size={11} />
                          Impreso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          <XCircle size={11} />
                          Cancelado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
