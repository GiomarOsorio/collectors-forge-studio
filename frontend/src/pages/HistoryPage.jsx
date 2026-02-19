/**
 * @file Pagina de historial de cotizaciones de Calculator3D.
 *
 * Muestra una tabla con todas las cotizaciones guardadas por el usuario.
 * Permite ver el detalle de cada cotizacion en un modal, descargar
 * el PDF de la cotizacion y eliminar cotizaciones del historial.
 *
 * El historial es util para llevar un registro de los trabajos cotizados,
 * generar PDFs para clientes y consultar cotizaciones anteriores.
 *
 * @module pages/HistoryPage
 */

import { useState, useEffect } from 'react';
import { getQuotes, deleteQuote, downloadQuotePdf } from '../services/api';
import toast from 'react-hot-toast';
import { FileDown, Trash2, Eye, X } from 'lucide-react';

/**
 * Componente de la pagina de historial de cotizaciones.
 *
 * @description Presenta una tabla con todas las cotizaciones guardadas,
 * mostrando fecha, nombre de pieza, cliente, cantidad y precio total.
 * Cada fila tiene botones para ver detalle, descargar PDF y eliminar.
 * Al seleccionar una cotizacion, se abre un modal con el desglose completo.
 *
 * @returns {JSX.Element} Pagina de historial con tabla y modal de detalle
 */
export default function HistoryPage() {
  /** @type {[Array, Function]} Lista de cotizaciones obtenidas del backend */
  const [quotes, setQuotes] = useState([]);
  /** @type {[Object|null, Function]} Cotizacion seleccionada para ver en detalle (modal) */
  const [selected, setSelected] = useState(null);

  /**
   * Carga la lista de cotizaciones desde el backend y actualiza el estado.
   */
  const load = () => getQuotes().then((res) => setQuotes(res.data));

  // Carga las cotizaciones al montar el componente
  useEffect(() => { load(); }, []);

  /**
   * Elimina una cotizacion previa confirmacion del usuario.
   * Muestra un dialogo nativo de confirmacion antes de proceder.
   *
   * @param {number} id - ID de la cotizacion a eliminar
   */
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

  /**
   * Descarga el PDF de una cotizacion.
   * Crea un enlace temporal en el DOM para forzar la descarga del archivo.
   * El nombre del archivo sigue el formato: cotizacion_[nombre_pieza]_[id].pdf
   *
   * @param {Object} q - Objeto de cotizacion con id y piece_name
   */
  const handleDownloadPdf = async (q) => {
    try {
      const res = await downloadQuotePdf(q.id);
      // Crear un URL temporal desde el blob del PDF
      const url = window.URL.createObjectURL(new Blob([res.data]));
      // Crear un enlace invisible, asignar la URL y forzar el clic para descargar
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cotizacion_${q.piece_name.replace(/\s/g, '_')}_${q.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      // Limpiar el enlace temporal y liberar la URL del blob
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar PDF');
    }
  };

  /**
   * Formatea una cadena de fecha ISO a formato legible en espanol (dd/mm/yyyy).
   *
   * @param {string} dateStr - Fecha en formato ISO (e.g., "2024-01-15T10:30:00")
   * @returns {string} Fecha formateada (e.g., "15/01/2024")
   */
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
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
              <Row label="Precio/unidad (USD)" value={selected.total_per_unit} bold />
              <Row label={`Total (${selected.quantity} uds.)`} value={selected.total_price} bold highlight />
              {selected.total_price_cop && (
                <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                  <span className="font-semibold">Total COP</span>
                  <span className="font-bold text-green-700">$ {Math.round(selected.total_price_cop).toLocaleString('es-CO')} COP</span>
                </div>
              )}
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
                <td className="px-6 py-4 text-right font-semibold text-green-700">
                  {q.total_price_cop
                    ? `$ ${Math.round(q.total_price_cop).toLocaleString('es-CO')} COP`
                    : `$ ${q.total_price.toFixed(2)}`}
                </td>
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

/**
 * Componente auxiliar que renderiza una fila del desglose de costos en el modal de detalle.
 * Muestra una etiqueta a la izquierda y un valor monetario a la derecha.
 *
 * @param {Object} props
 * @param {string} props.label - Texto descriptivo del concepto de costo
 * @param {number} props.value - Valor numerico del costo a mostrar
 * @param {boolean} [props.bold] - Si es true, aplica estilo en negrita
 * @param {boolean} [props.highlight] - Si es true, destaca la fila con fondo azul (usado para el total)
 * @returns {JSX.Element} Fila con etiqueta y valor formateado como moneda
 */
function Row({ label, value, bold, highlight }) {
  return (
    <div className={`flex justify-between ${highlight ? 'bg-blue-50 px-2 py-1 rounded' : ''}`}>
      <span className={bold ? 'font-semibold' : 'text-gray-600'}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-blue-700' : ''}`}>$ {value.toFixed(2)}</span>
    </div>
  );
}
