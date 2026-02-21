/**
 * @file Página de creación de cotizaciones de cliente multi-producto.
 *
 * Permite generar cotizaciones orientadas al cliente con múltiples líneas de
 * producto. No requiere filamentos ni impresoras registrados. El usuario
 * define el nombre del cliente, fechas de vigencia y las líneas de producto
 * con su cantidad y precio unitario.
 *
 * @module pages/ManualQuotePage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClientQuote, getPrintedItems } from '../services/api';
import toast from 'react-hot-toast';
import { FileEdit, Plus, Trash2, Package, X } from 'lucide-react';

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD para el input type="date".
 * @returns {string}
 */
const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Calcula la fecha de vencimiento sumando días a una fecha base.
 *
 * @param {string} dateStr - Fecha base en formato YYYY-MM-DD.
 * @param {number} days    - Días a sumar.
 * @returns {string} Fecha de vencimiento en formato DD/MM/YYYY o vacío si los inputs son inválidos.
 */
const calcExpiry = (dateStr, days) => {
  if (!dateStr || !days) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + parseInt(days));
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Página de cotización manual de cliente con múltiples productos.
 *
 * @returns {JSX.Element}
 */
export default function ManualQuotePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [prints, setPrints] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(null); // idx de la línea que abrió el selector

  useEffect(() => {
    getPrintedItems({ limit: 100 })
      .then((res) => setPrints(res.data.items || []))
      .catch(() => {}); // silencioso si no hay impresiones
  }, []);

  /** @type {[Object, Function]} Datos principales de la cotización */
  const [form, setForm] = useState({
    client_name: '',
    description: '',
    quote_date: todayISO(),
    expiry_days: '15',
    notes: '',
  });

  /** @type {[Array, Function]} Líneas de producto */
  const [items, setItems] = useState([
    { name: '', quantity: '1', unit_price: '' },
  ]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /** Actualiza un campo de una línea de producto. */
  const handleItemChange = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  /** Agrega una nueva línea vacía. */
  const addItem = () => {
    setItems((prev) => [...prev, { name: '', quantity: '1', unit_price: '' }]);
  };

  /** Selecciona una impresión del inventario y pre-llena la línea. */
  const selectPrint = (idx, print) => {
    setItems((prev) => prev.map((it, i) =>
      i === idx
        ? { ...it, name: print.name, unit_price: print.unit_price != null ? String(print.unit_price) : it.unit_price }
        : it
    ));
    setSelectorOpen(null);
  };

  /** Elimina una línea (mínimo 1). */
  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /** Calcula el subtotal en tiempo real. */
  const subtotal = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const it of items) {
      if (!it.name.trim()) { toast.error('Cada producto debe tener un nombre'); return; }
      if (!it.unit_price || parseFloat(it.unit_price) < 0) { toast.error('Precio unitario inválido'); return; }
    }

    setLoading(true);
    try {
      await createClientQuote({
        client_name: form.client_name,
        description: form.description || null,
        quote_date: form.quote_date,
        expiry_days: parseInt(form.expiry_days) || 15,
        items: items.map((it) => ({
          name: it.name,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
        })),
        notes: form.notes || null,
      });
      toast.success('Cotización guardada');
      navigate('/cost/quotes');
    } catch {
      toast.error('Error al guardar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const expiryLabel = calcExpiry(form.quote_date, form.expiry_days);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileEdit size={24} className="text-forge-green" />
        <h2 className="tf-page-title mb-0">Nueva Cotización</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* Datos del cliente y vigencia */}
        <div className="tf-card p-6 space-y-4">
          <h3 className="tf-section-title">Datos del cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="tf-label">Cliente *</label>
              <input
                name="client_name" value={form.client_name} onChange={handleChange}
                required className="tf-input" placeholder="Nombre del cliente o empresa" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="tf-label">Descripción</label>
              <textarea
                name="description" value={form.description} onChange={handleChange}
                rows={2} className="tf-input" placeholder="Descripción general de la cotización" />
            </div>
            <div>
              <label className="tf-label">Fecha de cotización *</label>
              <input
                name="quote_date" type="date" value={form.quote_date} onChange={handleChange}
                required className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Vigencia (días) *</label>
              <input
                name="expiry_days" type="number" min="1" value={form.expiry_days}
                onChange={handleChange} required className="tf-input" placeholder="15" />
              {expiryLabel && (
                <p className="text-xs text-gunmetal mt-1">Válida hasta: <span className="text-forge-green">{expiryLabel}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Líneas de producto */}
        <div className="tf-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="tf-section-title mb-0">Productos / Servicios</h3>
            <button type="button" onClick={addItem} className="tf-btn-ghost text-sm gap-1">
              <Plus size={16} /> Agregar línea
            </button>
          </div>

          <div className="space-y-3">
            {/* Encabezado de columnas (visible en sm+) */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-gunmetal font-medium px-1">
              <span className="col-span-5">Descripción</span>
              <span className="col-span-2 text-right">Cantidad</span>
              <span className="col-span-3 text-right">Precio unit. (USD)</span>
              <span className="col-span-1 text-right">Total</span>
              <span className="col-span-1"></span>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-5 flex gap-1">
                  <input
                    value={it.name} onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    className="tf-input text-sm flex-1" placeholder="Nombre del producto o servicio" required />
                  {prints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectorOpen(idx)}
                      className="tf-btn-ghost p-2 text-blue-400 hover:text-blue-300 shrink-0"
                      title="Seleccionar del inventario de impresiones"
                    >
                      <Package size={16} />
                    </button>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number" min="0.01" step="0.01" value={it.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="tf-input text-sm text-right" placeholder="1" required />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input
                    type="number" min="0" step="0.01" value={it.unit_price}
                    onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                    className="tf-input text-sm text-right" placeholder="0.00" required />
                </div>
                <div className="col-span-2 sm:col-span-1 text-right text-sm text-tech-white font-medium">
                  {((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button" onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="tf-btn-danger p-1 disabled:opacity-30" title="Eliminar línea">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal */}
          <div className="flex justify-end border-t border-dark-border pt-4">
            <div className="text-right">
              <p className="text-sm text-gunmetal">Total cotización (USD)</p>
              <p className="text-2xl font-bold text-forge-green">$ {subtotal.toFixed(2)}</p>
              <p className="text-xs text-gunmetal mt-1">Sin IVA</p>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="tf-card p-6">
          <label className="tf-label">Notas adicionales</label>
          <textarea
            name="notes" value={form.notes} onChange={handleChange}
            rows={2} className="tf-input" placeholder="Condiciones especiales, observaciones..." />
        </div>

        <button type="submit" disabled={loading} className="tf-btn-primary w-full py-3 text-base">
          <FileEdit size={20} />
          {loading ? 'Guardando...' : 'Guardar Cotización'}
        </button>
      </form>

      {/* Mini-modal selector de impresiones del inventario */}
      {selectorOpen !== null && (
        <div className="tf-modal-overlay" onClick={() => setSelectorOpen(null)}>
          <div className="tf-modal max-w-sm max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-tech-white font-semibold flex items-center gap-2">
                <Package size={18} className="text-blue-400" />
                Seleccionar impresión
              </h3>
              <button onClick={() => setSelectorOpen(null)} className="tf-btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gunmetal mb-3">
              Se pre-llenará el nombre y el precio de venta.
            </p>
            <div className="overflow-y-auto space-y-1">
              {prints.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPrint(selectorOpen, p)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#1e2125] transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-tech-white text-sm font-medium group-hover:text-blue-400 transition-colors">
                      {p.name}
                    </span>
                    <span className="text-forge-green text-sm font-bold ml-2 shrink-0">
                      {p.unit_price != null ? `$ ${parseFloat(p.unit_price).toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    {p.category && <span className="text-xs text-gunmetal">{p.category}</span>}
                    <span className={`text-xs ${p.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {p.quantity} en stock
                    </span>
                  </div>
                </button>
              ))}
              {prints.length === 0 && (
                <p className="text-gunmetal text-sm text-center py-4">
                  No hay impresiones en el inventario.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
