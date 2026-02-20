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
import { getQuotes, deleteQuote } from '../services/api';
import toast from 'react-hot-toast';
import { Trash2, Eye, X } from 'lucide-react';

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
   * Elimina un registro de costo de impresión previa confirmación.
   *
   * @param {number} id - ID del registro a eliminar
   */
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await deleteQuote(id);
      toast.success('Registro eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
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
      <h2 className="tf-page-title">Historial de Costos de Impresión</h2>

      {/* Detail modal */}
      {selected && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="tf-section-title">{selected.piece_name}</h3>
              <button onClick={() => setSelected(null)} className="tf-btn-ghost"><X size={20} /></button>
            </div>
            {selected.client_name && (
              <p className="text-steel mb-2 text-sm">Cliente: {selected.client_name}</p>
            )}
            {selected.description && (
              <p className="text-gunmetal mb-4 text-sm">{selected.description}</p>
            )}
            <div className="space-y-2 text-sm">
              <Row label="Material" value={selected.material_cost} />
              <Row label="Electricidad" value={selected.electricity_cost} />
              <Row label="Depreciación" value={selected.depreciation_cost} />
              <Row label="Mantenimiento" value={selected.maintenance_cost} />
              <Row label="Mano de obra" value={selected.labor_cost} />
              <Row label="Absorción fallos" value={selected.failure_cost} />
              <hr className="tf-hr" />
              <Row label="Subtotal" value={selected.subtotal} bold />
              <Row label={`Margen (${selected.margin_percent}%)`} value={selected.margin_amount} />
              <hr className="tf-hr" />
              {/* Total en USD */}
              <Row label="Total cotización (USD)" value={selected.total_price} bold highlight />
              {selected.quantity > 1 && (
                <Row label={`Precio por pieza USD (÷${selected.quantity})`} value={selected.total_per_unit} bold />
              )}
              {/* Total en COP */}
              {selected.total_price_cop && (
                <>
                  <div className="flex justify-between items-baseline gap-2 bg-[#0d2b14] border border-forge-green/20 px-3 py-2 rounded-lg">
                    <span className="font-semibold text-forge-green min-w-0">Total cotización (COP)</span>
                    <span className="font-bold text-forge-green text-lg shrink-0">$ {Math.round(selected.total_price_cop).toLocaleString('es-CO')}</span>
                  </div>
                  {selected.quantity > 1 && (
                    <div className="flex justify-between items-baseline gap-2 bg-[#0d2b14]/60 px-3 py-1 rounded">
                      <span className="font-semibold text-forge-green text-sm min-w-0">Por pieza COP (÷{selected.quantity})</span>
                      <span className="font-bold text-forge-green shrink-0">$ {Math.round(selected.total_per_unit_cop).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  <p className="text-xs text-gunmetal">Tasa: 1 USD = {selected.usd_to_cop_rate?.toLocaleString('es-CO')} COP</p>
                </>
              )}
            </div>
            <div className="mt-4 text-xs text-gunmetal">
              Este registro corresponde a un cálculo de costo de impresión, no a una cotización de cliente.
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[600px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">Fecha</th>
              <th className="tf-th">Pieza</th>
              <th className="tf-th hidden sm:table-cell">Cliente</th>
              <th className="tf-th-right">Cant.</th>
              <th className="tf-th-right">Total</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="tf-tr">
                <td className="tf-td text-gunmetal">{formatDate(q.created_at)}</td>
                <td className="tf-td font-medium text-tech-white">{q.piece_name}</td>
                <td className="tf-td text-steel hidden sm:table-cell">{q.client_name || '-'}</td>
                <td className="tf-td-right text-steel">{q.quantity}</td>
                <td className="tf-td-right font-semibold text-forge-green">
                  {q.total_price_cop
                    ? `$ ${Math.round(q.total_price_cop).toLocaleString('es-CO')} COP`
                    : `$ ${q.total_price.toFixed(2)}`}
                </td>
                <td className="tf-td-right">
                  <button onClick={() => setSelected(q)} className="tf-btn-ghost mr-2" title="Ver detalle"><Eye size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="tf-btn-danger" title="Eliminar"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gunmetal">No hay registros de costos de impresión.</td></tr>
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
 * @param {boolean} [props.highlight] - Si es true, destaca la fila con fondo verde (usado para el total)
 * @returns {JSX.Element} Fila con etiqueta y valor formateado como moneda
 */
function Row({ label, value, bold, highlight }) {
  return (
    <div className={`tf-cost-row ${highlight ? 'bg-forge-green/10 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
      <span className={`${bold ? 'font-semibold text-tech-white' : 'text-steel'} min-w-0`}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-forge-green' : 'text-tech-white'} shrink-0`}>$ {value.toFixed(2)}</span>
    </div>
  );
}
