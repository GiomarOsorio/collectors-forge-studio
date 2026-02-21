/**
 * @file Página de historial de cotizaciones de cliente.
 *
 * Muestra las cotizaciones generadas manualmente para clientes,
 * con la lista de productos, fechas de vigencia, subtotal y acciones
 * para ver el detalle, descargar el PDF o eliminar.
 *
 * @module pages/QuotesPage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClientQuotes, deleteClientQuote, downloadClientQuotePdf } from '../services/api';
import toast from 'react-hot-toast';
import { FileDown, Trash2, Eye, X, Plus } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';

/**
 * Formatea una fecha ISO o YYYY-MM-DD a dd/mm/yyyy.
 * @param {string} str
 * @returns {string}
 */
const fmt = (str) => {
  if (!str) return '-';
  const [y, m, d] = str.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Página de historial de cotizaciones de cliente.
 * @returns {JSX.Element}
 */
export default function QuotesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getClientQuotes();
      setQuotes(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!await confirm('¿Eliminar esta cotización?', 'Eliminar')) return;
    try {
      await deleteClientQuote(id);
      toast.success('Cotización eliminada');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleDownloadPdf = async (q) => {
    try {
      const res = await downloadClientQuotePdf(q.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `COT-${String(q.id).padStart(4, '0')}_${q.client_name.replace(/\s/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar PDF');
    }
  };

  /** Parsea los items JSON de una cotización. */
  const parseItems = (itemsStr) => {
    try { return JSON.parse(itemsStr); } catch { return []; }
  };

  if (loading) return <p className="text-center text-gunmetal py-16">Cargando cotizaciones...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="tf-page-title mb-0">Historial de Cotizaciones</h2>
        <button onClick={() => navigate('/cost/manual')} className="tf-btn-primary gap-2">
          <Plus size={18} /> Nueva cotización
        </button>
      </div>

      {/* Modal de detalle */}
      {selected && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gunmetal">COT-{String(selected.id).padStart(4, '0')}</p>
                <h3 className="tf-section-title mb-0">{selected.client_name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="tf-btn-ghost"><X size={20} /></button>
            </div>

            {selected.description && (
              <p className="text-steel text-sm mb-3">{selected.description}</p>
            )}

            <div className="flex gap-4 text-xs text-gunmetal mb-4">
              <span>Fecha: <span className="text-tech-white">{fmt(selected.quote_date)}</span></span>
              <span>Válida hasta: <span className="text-forge-green">{fmt(selected.expiry_date)}</span></span>
              <span>Vigencia: <span className="text-tech-white">{selected.expiry_days} días</span></span>
            </div>

            {/* Tabla de ítems */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="tf-th text-left py-2">Descripción</th>
                    <th className="tf-th-right py-2">Cant.</th>
                    <th className="tf-th-right py-2">P. Unit.</th>
                    <th className="tf-th-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parseItems(selected.items).map((it, i) => (
                    <tr key={i} className="border-b border-dark-border/40">
                      <td className="tf-td py-2">{it.name}</td>
                      <td className="tf-td-right py-2 text-steel">{it.quantity}</td>
                      <td className="tf-td-right py-2 text-steel">$ {parseFloat(it.unit_price).toFixed(2)}</td>
                      <td className="tf-td-right py-2 font-medium text-tech-white">
                        $ {(it.quantity * it.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-forge-green/10 border border-forge-green/20 rounded-lg px-4 py-3 mb-4">
              <span className="font-semibold text-forge-green">Total</span>
              <span className="text-xl font-bold text-forge-green">$ {parseFloat(selected.subtotal).toFixed(2)}</span>
            </div>

            {selected.notes && (
              <p className="text-xs text-gunmetal mb-4">Notas: {selected.notes}</p>
            )}

            <button onClick={() => handleDownloadPdf(selected)} className="tf-btn-primary w-full">
              <FileDown size={18} /> Descargar PDF
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[600px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">N°</th>
              <th className="tf-th">Fecha</th>
              <th className="tf-th">Cliente</th>
              <th className="tf-th hidden sm:table-cell">Vence</th>
              <th className="tf-th-right hidden sm:table-cell">Ítems</th>
              <th className="tf-th-right">Total</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="tf-tr">
                <td className="tf-td text-gunmetal font-mono">COT-{String(q.id).padStart(4, '0')}</td>
                <td className="tf-td text-gunmetal">{fmt(q.quote_date)}</td>
                <td className="tf-td font-medium text-tech-white">{q.client_name}</td>
                <td className="tf-td text-steel hidden sm:table-cell">{fmt(q.expiry_date)}</td>
                <td className="tf-td-right text-steel hidden sm:table-cell">
                  {parseItems(q.items).length}
                </td>
                <td className="tf-td-right font-semibold text-forge-green">
                  $ {parseFloat(q.subtotal).toFixed(2)}
                </td>
                <td className="tf-td-right">
                  <button onClick={() => setSelected(q)} className="tf-btn-ghost mr-2" title="Ver detalle"><Eye size={16} /></button>
                  <button onClick={() => handleDownloadPdf(q)} className="tf-btn-ghost mr-2" title="PDF"><FileDown size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="tf-btn-danger" title="Eliminar"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gunmetal">
                  No hay cotizaciones aún.{' '}
                  <button onClick={() => navigate('/cost/manual')} className="text-forge-green hover:underline">
                    Crear la primera
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
