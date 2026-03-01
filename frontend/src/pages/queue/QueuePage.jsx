/**
 * @file Página principal de la cola de impresión activa.
 *
 * Muestra dos secciones:
 * - "Imprimiendo ahora": ítems con status 'printing' (tarjeta destacada).
 * - "En cola": ítems con status 'pending' en orden de posición.
 *
 * Permite agregar una cotización guardada a la cola mediante un modal con
 * búsqueda local. Las acciones de cada tarjeta cambian el estado del ítem.
 *
 * @module pages/queue/QueuePage
 */

import { useState, useEffect } from 'react';
import {
  getQueue,
  addToQueue,
  updateQueueStatus,
  deleteQueueItem,
  getQuotes,
} from '../../services/api';
import toast from 'react-hot-toast';
import {
  ListOrdered,
  Plus,
  X,
  Play,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  Clock,
  Weight,
  Printer,
} from 'lucide-react';
import { SkeletonList } from '../../components/SkeletonLoader';

/**
 * Formatea un número de horas a string legible (ej. 1.5 → "1h 30m").
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
 * Tarjeta de un ítem que está imprimiendo actualmente.
 * @param {{ item: Object, onDone: Function, onCancel: Function }} props
 */
function PrintingCard({ item, onDone, onCancel }) {
  const q = item.quote;
  return (
    <div className="bg-teal-500/10 border border-teal-500/40 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Imprimiendo
            </span>
            {q && (
              <span className="text-gunmetal text-xs">COT-{String(q.id).padStart(4, '0')}</span>
            )}
          </div>
          <h3 className="text-tech-white font-semibold text-lg truncate">
            {q ? q.piece_name : <span className="text-gunmetal italic">Cotización eliminada</span>}
          </h3>
          {q && (
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-steel">
              <span className="flex items-center gap-1">
                <Printer size={13} />{q.printer_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} />{formatHours(q.print_time_hours)}
              </span>
              <span className="flex items-center gap-1">
                <Weight size={13} />{q.weight_grams.toFixed(1)} g
              </span>
              {q.quantity > 1 && (
                <span className="text-teal-400 font-medium">×{q.quantity}</span>
              )}
              <span className="text-tech-white font-medium">${q.total_price.toFixed(2)}</span>
            </div>
          )}
          {item.notes && (
            <p className="text-gunmetal text-xs mt-2 italic">{item.notes}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onDone(item.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CheckCircle size={15} />
            Impreso
          </button>
          <button
            onClick={() => onCancel(item.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2125] hover:bg-red-500/20 text-steel hover:text-red-400 text-sm rounded-lg transition-colors"
          >
            <XCircle size={15} />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta compacta de un ítem pendiente en cola.
 * @param {{ item: Object, onStart: Function, onRemove: Function }} props
 */
function PendingCard({ item, onStart, onRemove }) {
  const q = item.quote;
  return (
    <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl p-4 flex items-center gap-4">
      <div className="text-gunmetal text-lg font-mono w-6 text-center shrink-0">
        {item.position}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-tech-white font-medium truncate">
            {q ? q.piece_name : <span className="text-gunmetal italic">Cotización eliminada</span>}
          </h3>
          {q && (
            <span className="text-gunmetal text-xs shrink-0">COT-{String(q.id).padStart(4, '0')}</span>
          )}
        </div>
        {q && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-steel">
            <span>{q.printer_name}</span>
            <span>{formatHours(q.print_time_hours)}</span>
            <span>{q.weight_grams.toFixed(1)} g</span>
            {q.quantity > 1 && <span className="text-teal-400">×{q.quantity}</span>}
            <span className="text-tech-white">${q.total_price.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onStart(item.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs font-medium rounded-lg transition-colors"
          title="Iniciar impresión"
        >
          <Play size={13} />
          Imprimir
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-gunmetal hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
          title="Quitar de la cola"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Modal para agregar una cotización a la cola.
 * @param {{ onClose: Function, onAdded: Function }} props
 */
function AddToQueueModal({ onClose, onAdded }) {
  const [quotes, setQuotes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    getQuotes()
      .then((r) => setQuotes(r.data))
      .catch(() => toast.error('Error al cargar cotizaciones'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = quotes.filter((q) =>
    q.piece_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (quoteId) => {
    setAdding(quoteId);
    try {
      await addToQueue({ quote_id: quoteId });
      toast.success('Agregado a la cola');
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al agregar a la cola');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1014] border border-[#1e2125] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2125]">
          <h2 className="text-tech-white font-semibold">Agregar a la cola</h2>
          <button onClick={onClose} className="text-gunmetal hover:text-tech-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="p-4 border-b border-[#1e2125]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gunmetal" />
            <input
              type="text"
              placeholder="Buscar por nombre de pieza..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg pl-9 pr-3 py-2 text-sm text-tech-white placeholder-gunmetal focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gunmetal">
              <Loader2 size={20} className="animate-spin mr-2" />
              Cargando cotizaciones...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gunmetal py-12 text-sm">
              {search ? 'Sin resultados para la búsqueda.' : 'No hay cotizaciones guardadas.'}
            </p>
          ) : (
            filtered.map((q) => (
              <button
                key={q.id}
                onClick={() => handleAdd(q.id)}
                disabled={adding === q.id}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#1e2125] transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-tech-white font-medium truncate">{q.piece_name}</span>
                      <span className="text-gunmetal text-xs shrink-0">COT-{String(q.id).padStart(4, '0')}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-steel">
                      <span>{formatHours(parseFloat(q.print_time_hours))}</span>
                      <span>{parseFloat(q.weight_grams).toFixed(1)} g</span>
                      {parseInt(q.quantity) > 1 && (
                        <span className="text-teal-400">×{q.quantity}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-tech-white font-semibold">${parseFloat(q.total_price).toFixed(2)}</span>
                    {adding === q.id ? (
                      <Loader2 size={15} className="animate-spin text-teal-400" />
                    ) : (
                      <Plus size={15} className="text-gunmetal group-hover:text-teal-400 transition-colors" />
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Página principal de la cola de impresión activa.
 * @returns {JSX.Element}
 */
export default function QueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadQueue = async () => {
    try {
      const r = await getQueue();
      setItems(r.data);
    } catch {
      toast.error('Error al cargar la cola de impresión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleStart = async (id) => {
    try {
      await updateQueueStatus(id, { status: 'printing' });
      toast.success('Impresión iniciada');
      loadQueue();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al iniciar impresión');
    }
  };

  const handleDone = async (id) => {
    try {
      await updateQueueStatus(id, { status: 'done' });
      toast.success('Marcado como impreso — inventario actualizado');
      loadQueue();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al marcar como impreso');
    }
  };

  const handleCancel = async (id) => {
    try {
      await updateQueueStatus(id, { status: 'cancelled' });
      toast.success('Trabajo cancelado');
      loadQueue();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al cancelar');
    }
  };

  const handleRemove = async (id) => {
    try {
      await deleteQueueItem(id);
      toast.success('Quitado de la cola');
      loadQueue();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar');
    }
  };

  const printing = items.filter((i) => i.status === 'printing');
  const pending = items.filter((i) => i.status === 'pending');

  if (loading) return <SkeletonList count={4} />;

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10">
            <ListOrdered size={24} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-tech-white">Cola activa</h1>
            <p className="text-steel text-sm mt-0.5">
              {items.length === 0 ? 'Sin trabajos en cola' : `${items.length} trabajo${items.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          Agregar a cola
        </button>
      </div>

      {/* Sección: Imprimiendo ahora */}
      {printing.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
            Imprimiendo ahora
          </h2>
          <div className="space-y-3">
            {printing.map((item) => (
              <PrintingCard
                key={item.id}
                item={item}
                onDone={handleDone}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sección: En cola */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-steel uppercase tracking-wider mb-3">
            En cola
          </h2>
          <div className="space-y-2">
            {pending.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                onStart={handleStart}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </section>
      )}

      {/* Estado vacío */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl bg-teal-500/10 mb-4">
            <ListOrdered size={32} className="text-teal-400" />
          </div>
          <h3 className="text-tech-white font-semibold mb-2">La cola está vacía</h3>
          <p className="text-steel text-sm mb-6 max-w-sm">
            Agrega una cotización guardada para empezar a gestionar tus trabajos de impresión.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-colors text-sm"
          >
            <Plus size={16} />
            Agregar a cola
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <AddToQueueModal
          onClose={() => setModalOpen(false)}
          onAdded={loadQueue}
        />
      )}
    </div>
  );
}
