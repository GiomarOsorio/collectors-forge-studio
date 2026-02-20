/**
 * @file Página de stock del inventario.
 *
 * Lista todos los ítems de inventario con indicadores de stock bajo y
 * banderas de "necesita compra". Permite crear, editar, ajustar cantidades,
 * eliminar ítems y marcar/desmarcar la bandera de compra manual.
 *
 * Los ítems con category="Filamento" incluyen campos adicionales usados por
 * la calculadora de costos (price_per_kg, filament_brand, filament_type,
 * filament_color, filament_diameter, filament_density, weight_per_roll).
 * Los ítems de otras categorías incluyen price_per_unit para la calculadora.
 *
 * @module pages/inventory/InventoryStockPage
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, X, AlertTriangle, ShoppingCart,
  PackageOpen, CheckCircle, ChevronDown,
} from 'lucide-react';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  flagInventoryItem,
  adjustInventoryItem,
} from '../../services/api';

/** Categorías predefinidas de inventario */
const CATEGORIES = [
  'Filamento',
  'Accesorio',
  'Accesorios de postprocesado',
  'Accesorios de preprocesado',
  'Repuesto impresora',
  'Herramienta',
  'General',
];

/** Unidades de medida disponibles */
const UNITS = ['unidades', 'kg', 'g', 'litros', 'ml', 'm', 'cm', 'láminas', 'piezas', 'cajas'];

/** Formulario vacío para crear/editar */
const EMPTY_FORM = {
  name: '',
  category: 'General',
  description: '',
  unit: 'unidades',
  quantity: '0',
  min_quantity: '0',
  unit_cost: '0',
  supplier_name: '',
  supplier_contact: '',
  supplier_info: '',
  notes: '',
  // Campos especificos para items de categoria "Filamento" (usados por la calculadora)
  price_per_kg: '',
  filament_brand: '',
  filament_type: '',
  filament_color: '',
  filament_diameter: '',
  filament_density: '',
  weight_per_roll: '',
  // Campo para insumos de otras categorias (precio unitario para la calculadora)
  price_per_unit: '',
};

/**
 * Etiqueta de estado de stock de un ítem.
 */
function StockBadge({ item }) {
  const lowStock = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
  const needsPurchase = item.needs_purchase;

  if (needsPurchase) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
        <ShoppingCart size={10} /> Comprar
      </span>
    );
  }
  if (lowStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        <AlertTriangle size={10} /> Stock bajo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
      <CheckCircle size={10} /> OK
    </span>
  );
}

/**
 * Página de stock del inventario.
 * @returns {JSX.Element}
 */
export default function InventoryStockPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null); // {item, value}
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    try {
      const res = await getInventoryItems();
      setItems(res.data);
    } catch {
      toast.error('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      unit: item.unit,
      quantity: String(item.quantity),
      min_quantity: String(item.min_quantity),
      unit_cost: String(item.unit_cost),
      supplier_name: item.supplier_name || '',
      supplier_contact: item.supplier_contact || '',
      supplier_info: item.supplier_info || '',
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description || null,
        unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        min_quantity: parseFloat(form.min_quantity) || 0,
        unit_cost: parseFloat(form.unit_cost) || 0,
        supplier_name: form.supplier_name || null,
        supplier_contact: form.supplier_contact || null,
        supplier_info: form.supplier_info || null,
        notes: form.notes || null,
      };
      if (editItem) {
        await updateInventoryItem(editItem.id, payload);
        toast.success('Ítem actualizado');
      } else {
        await createInventoryItem(payload);
        toast.success('Ítem creado');
      }
      setModalOpen(false);
      load();
    } catch {
      toast.error('Error al guardar el ítem');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este ítem del inventario?')) return;
    try {
      await deleteInventoryItem(id);
      toast.success('Ítem eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleFlag = async (id) => {
    try {
      await flagInventoryItem(id);
      load();
    } catch {
      toast.error('Error al actualizar la bandera');
    }
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const qty = parseFloat(adjustModal.value);
    if (isNaN(qty)) { toast.error('Cantidad inválida'); return; }
    try {
      await adjustInventoryItem(adjustModal.item.id, qty);
      toast.success(`Cantidad ajustada: ${qty >= 0 ? '+' : ''}${qty} ${adjustModal.item.unit}`);
      setAdjustModal(null);
      load();
    } catch {
      toast.error('Error al ajustar la cantidad');
    }
  };

  // Filtros
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const filtered = items.filter((item) => {
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterStatus === 'bajo') {
      const low = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
      if (!low && !item.needs_purchase) return false;
    }
    if (filterStatus === 'ok') {
      const low = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
      if (low || item.needs_purchase) return false;
    }
    return true;
  });

  const alertCount = items.filter(
    (i) => i.needs_purchase || (parseFloat(i.min_quantity) > 0 && parseFloat(i.quantity) < parseFloat(i.min_quantity))
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="tf-page-title mb-0">Stock de Inventario</h2>
          {alertCount > 0 && (
            <p className="text-sm text-orange-400 mt-1 flex items-center gap-1">
              <AlertTriangle size={14} />
              {alertCount} ítem{alertCount > 1 ? 's' : ''} requiere{alertCount === 1 ? '' : 'n'} atención
            </p>
          )}
        </div>
        <button onClick={openCreate} className="tf-btn-primary gap-2">
          <Plus size={18} /> Nuevo ítem
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="tf-input py-1.5 text-sm w-auto"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="tf-input py-1.5 text-sm w-auto"
        >
          <option value="">Todos los estados</option>
          <option value="bajo">Stock bajo / necesita compra</option>
          <option value="ok">Stock OK</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[700px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">Nombre</th>
              <th className="tf-th hidden md:table-cell">Categoría</th>
              <th className="tf-th-right">Cantidad</th>
              <th className="tf-th-right hidden sm:table-cell">Mínimo</th>
              <th className="tf-th hidden sm:table-cell">Estado</th>
              <th className="tf-th hidden lg:table-cell">Proveedor</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gunmetal">Cargando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gunmetal">
                  {items.length === 0
                    ? <span>No hay ítems en el inventario. <button onClick={openCreate} className="text-blue-400 hover:underline">Agregar el primero</button></span>
                    : 'No hay ítems que coincidan con los filtros.'}
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const lowStock = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
              const alert = item.needs_purchase || lowStock;
              return (
                <tr key={item.id} className={`tf-tr ${alert ? 'bg-red-500/5' : ''}`}>
                  <td className="tf-td">
                    <span className={`font-medium ${alert ? 'text-red-300' : 'text-tech-white'}`}>
                      {item.name}
                    </span>
                    {item.description && <p className="text-xs text-gunmetal truncate max-w-[180px]">{item.description}</p>}
                  </td>
                  <td className="tf-td hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded text-xs bg-[#1e2125] text-steel">{item.category}</span>
                  </td>
                  <td className="tf-td-right">
                    <span className={`font-semibold ${alert ? 'text-red-400' : 'text-tech-white'}`}>
                      {parseFloat(item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })}
                    </span>
                    <span className="text-gunmetal text-xs ml-1">{item.unit}</span>
                  </td>
                  <td className="tf-td-right hidden sm:table-cell text-steel text-sm">
                    {parseFloat(item.min_quantity) > 0 ? parseFloat(item.min_quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 }) : '—'}
                  </td>
                  <td className="tf-td hidden sm:table-cell">
                    <StockBadge item={item} />
                  </td>
                  <td className="tf-td hidden lg:table-cell text-steel text-sm">
                    {item.supplier_name || '—'}
                  </td>
                  <td className="tf-td-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ajustar cantidad */}
                      <button
                        onClick={() => setAdjustModal({ item, value: '' })}
                        className="tf-btn-ghost p-1.5 text-xs"
                        title="Ajustar cantidad"
                      >
                        ±
                      </button>
                      {/* Toggle bandera */}
                      <button
                        onClick={() => handleFlag(item.id)}
                        className={`tf-btn-ghost p-1.5 ${item.needs_purchase ? 'text-orange-400' : ''}`}
                        title={item.needs_purchase ? 'Quitar bandera de compra' : 'Marcar que necesita compra'}
                      >
                        <ShoppingCart size={14} />
                      </button>
                      {/* Editar */}
                      <button onClick={() => openEdit(item)} className="tf-btn-ghost p-1.5" title="Editar">
                        <Pencil size={14} />
                      </button>
                      {/* Eliminar */}
                      <button onClick={() => handleDelete(item.id)} className="tf-btn-danger p-1.5" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar ítem */}
      {modalOpen && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="tf-section-title mb-0 flex items-center gap-2">
                <PackageOpen size={20} className="text-blue-400" />
                {editItem ? 'Editar ítem' : 'Nuevo ítem de inventario'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="tf-btn-ghost"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre y categoría */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="tf-label">Nombre *</label>
                  <input name="name" value={form.name} onChange={handleChange}
                    required className="tf-input" placeholder="Ej: PLA Bambu Lab Negro 1kg" />
                </div>
                <div>
                  <label className="tf-label">Categoría *</label>
                  <div className="relative">
                    <input
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      list="categories-list"
                      required
                      className="tf-input"
                      placeholder="Selecciona o escribe una categoría"
                    />
                    <datalist id="categories-list">
                      {CATEGORIES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="tf-label">Unidad *</label>
                  <div className="relative">
                    <input
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      list="units-list"
                      required
                      className="tf-input"
                      placeholder="unidades"
                    />
                    <datalist id="units-list">
                      {UNITS.map((u) => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="tf-label">Descripción</label>
                  <input name="description" value={form.description} onChange={handleChange}
                    className="tf-input" placeholder="Descripción corta del ítem" />
                </div>
              </div>

              {/* Cantidades y costo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="tf-label">Cantidad actual</label>
                  <input name="quantity" type="number" step="0.001" min="0"
                    value={form.quantity} onChange={handleChange} className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Mínimo de stock</label>
                  <input name="min_quantity" type="number" step="0.001" min="0"
                    value={form.min_quantity} onChange={handleChange} className="tf-input"
                    placeholder="0 = sin límite" />
                  <p className="text-xs text-gunmetal mt-1">0 = sin alerta de mínimo</p>
                </div>
                <div>
                  <label className="tf-label">Costo unitario (USD)</label>
                  <input name="unit_cost" type="number" step="0.01" min="0"
                    value={form.unit_cost} onChange={handleChange} className="tf-input" />
                </div>
              </div>

              {/* Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tf-label">Proveedor</label>
                  <input name="supplier_name" value={form.supplier_name} onChange={handleChange}
                    className="tf-input" placeholder="Ej: Amazon, Delbex" />
                </div>
                <div>
                  <label className="tf-label">Contacto del proveedor</label>
                  <input name="supplier_contact" value={form.supplier_contact} onChange={handleChange}
                    className="tf-input" placeholder="Email, teléfono o web" />
                </div>
                <div className="sm:col-span-2">
                  <label className="tf-label">Información adicional del proveedor</label>
                  <textarea name="supplier_info" value={form.supplier_info} onChange={handleChange}
                    rows={2} className="tf-input" placeholder="Tiempo de entrega, instrucciones, links..." />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="tf-label">Notas</label>
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  rows={2} className="tf-input" placeholder="Observaciones adicionales" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2a2d31] text-steel hover:text-tech-white transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 tf-btn-primary" style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}>
                  {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Crear ítem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de ajuste de cantidad */}
      {adjustModal && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="tf-section-title mb-0">Ajustar cantidad</h3>
              <button onClick={() => setAdjustModal(null)} className="tf-btn-ghost"><X size={20} /></button>
            </div>
            <p className="text-steel text-sm mb-4">
              <span className="text-tech-white font-medium">{adjustModal.item.name}</span>
              <br />
              Actual: <span className="text-blue-400 font-medium">{parseFloat(adjustModal.item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })} {adjustModal.item.unit}</span>
            </p>
            <label className="tf-label">
              Cantidad a sumar o restar (usa número negativo para restar)
            </label>
            <input
              type="number"
              step="0.001"
              value={adjustModal.value}
              onChange={(e) => setAdjustModal({ ...adjustModal, value: e.target.value })}
              className="tf-input mb-4"
              placeholder="Ej: 2 para sumar, -1 para restar"
              autoFocus
            />
            {adjustModal.value !== '' && !isNaN(parseFloat(adjustModal.value)) && (
              <p className="text-xs text-gunmetal mb-4">
                Nuevo total: <span className="text-tech-white font-medium">
                  {(parseFloat(adjustModal.item.quantity) + parseFloat(adjustModal.value)).toLocaleString('es-CO', { maximumFractionDigits: 3 })} {adjustModal.item.unit}
                </span>
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setAdjustModal(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2d31] text-steel hover:text-tech-white transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleAdjust}
                className="flex-1 tf-btn-primary" style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
