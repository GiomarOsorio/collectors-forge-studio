import { useState, useEffect } from 'react';
import { getQuotes, deleteQuote, downloadQuotePdf } from '../services/api';
import toast from 'react-hot-toast';
import { FileDown, Trash2, Eye, X } from 'lucide-react';

export default function HistoryPage() {
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = () => getQuotes().then((res) => setQuotes(res.data));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cotización?')) return;
    try {
      await deleteQuote(id);
      toast.success('Cotización eliminada');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleDownloadPdf = async (q) => {
    try {
      const res = await downloadQuotePdf(q.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cotizacion_${q.piece_name.replace(/\s/g, '_')}_${q.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar PDF');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Historial de Cotizaciones</h2>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selected.piece_name}</h3>
              <button onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            {selected.client_name && (
              <p className="text-gray-500 mb-2">Cliente: {selected.client_name}</p>
            )}
            {selected.description && (
              <p className="text-gray-500 mb-4 text-sm">{selected.description}</p>
            )}
            <div className="space-y-2 text-sm">
              <Row label="Material" value={selected.material_cost} />
              <Row label="Electricidad" value={selected.electricity_cost} />
              <Row label="Depreciación" value={selected.depreciation_cost} />
              <Row label="Mantenimiento" value={selected.maintenance_cost} />
              <Row label="Mano de obra" value={selected.labor_cost} />
              <Row label="Absorción fallos" value={selected.failure_cost} />
              <hr />
              <Row label="Subtotal" value={selected.subtotal} bold />
              <Row label={`Margen (${selected.margin_percent}%)`} value={selected.margin_amount} />
              <hr />
              <Row label="Precio/unidad" value={selected.total_per_unit} bold />
              <Row label={`Total (${selected.quantity} uds.)`} value={selected.total_price} bold highlight />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => handleDownloadPdf(selected)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <FileDown size={18} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Fecha</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Pieza</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Cliente</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Cant.</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Total</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quotes.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(q.created_at)}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{q.piece_name}</td>
                <td className="px-6 py-4 text-gray-600">{q.client_name || '-'}</td>
                <td className="px-6 py-4 text-right">{q.quantity}</td>
                <td className="px-6 py-4 text-right font-semibold text-green-700">$ {q.total_price.toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setSelected(q)} className="text-gray-400 hover:text-blue-600 mr-2" title="Ver detalle"><Eye size={16} /></button>
                  <button onClick={() => handleDownloadPdf(q)} className="text-gray-400 hover:text-blue-600 mr-2" title="PDF"><FileDown size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay cotizaciones guardadas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value, bold, highlight }) {
  return (
    <div className={`flex justify-between ${highlight ? 'bg-blue-50 px-2 py-1 rounded' : ''}`}>
      <span className={bold ? 'font-semibold' : 'text-gray-600'}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-blue-700' : ''}`}>$ {value.toFixed(2)}</span>
    </div>
  );
}
