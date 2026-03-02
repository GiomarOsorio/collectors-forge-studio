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
 * Acepta props opcionales para filtrar por categoría (usado por las páginas
 * de Filamentos e Insumos que comparten este componente).
 *
 * @module pages/inventory/InventoryStockPage
 */

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  Plus, Pencil, Trash2, X, AlertTriangle, ShoppingCart,
  PackageOpen, CheckCircle, ChevronUp, ChevronDown, Loader2, Zap,
} from 'lucide-react';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  flagInventoryItem,
  adjustInventoryItem,
  getInventoryCategories,
} from '../../services/api';
import { SkeletonTable } from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';

/** Ítems por página en la tabla */
const PAGE_SIZE = 15;

/** Tipos de filamento disponibles */
const FILAMENT_TYPES = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PLA+', 'PETG+', 'Otro'];

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
  price_per_kg: '',
  filament_brand: '',
  filament_type: 'PLA',
  filament_color: '',
  filament_diameter: '1.75',
  filament_density: '1.24',
  weight_per_roll: '1000',
  price_per_unit: '',
  useful_life_hours: '',
  unit_cost_cal: '',
};

/**
 * Devuelve un número para ordenar el estado de stock.
 * OK=0, Stock bajo=1, Comprar=2
 */
function getStatusOrder(item) {
  if (item.needs_purchase) return 2;
  const low = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
  return low ? 1 : 0;
}

/**
 * Etiqueta de estado de stock de un ítem.
 */
function StockBadge({ item }) {
  const lowStock = parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) < parseFloat(item.min_quantity);
  if (item.needs_purchase) {
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
 * Encabezado de columna ordenable.
 *
 * @param {Object} props
 * @param {string} props.label - Texto del encabezado
 * @param {string} props.sortKey - Clave del campo a ordenar
 * @param {{key:string, direction:string}} props.sortConfig - Estado de ordenamiento actual
 * @param {Function} props.onSort - Callback al hacer click
 * @param {string} [props.className] - Clase CSS del th
 */
function SortTh({ label, sortKey, sortConfig, onSort, className = 'tf-th' }) {
  const active = sortConfig.key === sortKey;
  return (
    <th className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 transition-colors group ${active ? 'text-blue-400' : 'hover:text-tech-white'}`}
      >
        <span>{label}</span>
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}`}>
          {active && sortConfig.direction === 'desc'
            ? <ChevronDown size={13} />
            : <ChevronUp size={13} />}
        </span>
      </button>
    </th>
  );
}

/**
 * Página de stock del inventario.
 *
 * @param {Object} props
 * @param {string|null}   [props.categoryFilter]    - Si se pasa, solo muestra ítems de esa categoría
 * @param {string|null}   [props.excludeCategory]   - Si se pasa, excluye ítems de esa categoría (singular)
 * @param {string[]|null} [props.excludeCategories] - Si se pasa, excluye ítems de esas categorías (plural)
 * @returns {JSX.Element}
 */
export default function InventoryStockPage({ categoryFilter = null, excludeCategory = null, excludeCategories = null }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [apiCategories, setApiCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        getInventoryItems(),
        getInventoryCategories(),
      ]);
      setItems(itemsRes.data);
      setApiCategories(catsRes.data);
    } catch {
      toast.error('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Resetear página al cambiar filtros
  useEffect(() => { setCurrentPage(1); }, [filterCategory, filterStatus]);

  /** Alterna el criterio de ordenamiento al hacer click en un encabezado. */
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({
      ...EMPTY_FORM,
      category: categoryFilter || '',
    });
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
      price_per_kg: item.price_per_kg != null ? String(item.price_per_kg) : '',
      filament_brand: item.filament_brand || '',
      filament_type: item.filament_type || 'PLA',
      filament_color: item.filament_color || '',
      filament_diameter: item.filament_diameter != null ? String(item.filament_diameter) : '1.75',
      filament_density: item.filament_density != null ? String(item.filament_density) : '1.24',
      weight_per_roll: item.weight_per_roll != null ? String(item.weight_per_roll) : '1000',
      price_per_unit: item.price_per_unit != null ? String(item.price_per_unit) : '',
      useful_life_hours: item.useful_life_hours != null ? String(item.useful_life_hours) : '',
      unit_cost_cal: item.unit_cost_cal != null ? String(item.unit_cost_cal) : '',
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
      const isFilament = form.category === 'Filamento';
      const isConsumable = form.category === 'Consumible';
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
        // Campos de filamento o insumo según categoría
        price_per_kg: isFilament && form.price_per_kg ? parseFloat(form.price_per_kg) : null,
        filament_brand: isFilament ? form.filament_brand || null : null,
        filament_type: isFilament ? form.filament_type || null : null,
        filament_color: isFilament ? form.filament_color || null : null,
        filament_diameter: isFilament && form.filament_diameter ? parseFloat(form.filament_diameter) : null,
        filament_density: isFilament && form.filament_density ? parseFloat(form.filament_density) : null,
        weight_per_roll: isFilament && form.weight_per_roll ? parseFloat(form.weight_per_roll) : null,
        price_per_unit: !isFilament && !isConsumable && form.price_per_unit ? parseFloat(form.price_per_unit) : null,
        // Campos de consumible (calculadora de desgaste)
        useful_life_hours: isConsumable && form.useful_life_hours ? parseFloat(form.useful_life_hours) : null,
        unit_cost_cal: isConsumable && form.unit_cost_cal ? parseFloat(form.unit_cost_cal) : null,
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
    if (!await confirm('¿Eliminar este ítem del inventario?', 'Eliminar')) return;
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

  // Filtrado
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (excludeCategory && item.category === excludeCategory) return false;
      if (excludeCategories && excludeCategories.includes(item.category)) return false;
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
  }, [items, categoryFilter, excludeCategory, excludeCategories, filterCategory, filterStatus]);

  // Ordenamiento
  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === 'quantity' || key === 'min_quantity') {
        return (parseFloat(a[key]) - parseFloat(b[key])) * dir;
      }
      if (key === 'status') {
        return (getStatusOrder(a) - getStatusOrder(b)) * dir;
      }
      if (key === 'supplier_name') {
        if (!a.supplier_name && !b.supplier_name) return 0;
        if (!a.supplier_name) return 1;   // nulos siempre al final
        if (!b.supplier_name) return -1;
        return a.supplier_name.toLowerCase().localeCompare(b.supplier_name.toLowerCase()) * dir;
      }
      // Campos de texto (name, category)
      return (a[key] || '').toLowerCase().localeCompare((b[key] || '').toLowerCase()) * dir;
    });
  }, [filtered, sortConfig]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const alertCount = items.filter(
    (i) => i.needs_purchase || (parseFloat(i.min_quantity) > 0 && parseFloat(i.quantity) < parseFloat(i.min_quantity))
  ).length;

  // Título adaptado según props
  const pageTitle = categoryFilter === 'Filamento'
    ? 'Filamentos'
    : categoryFilter === 'Herramienta'
      ? 'Herramientas'
      : categoryFilter === 'Insumo'
        ? 'Insumos'
        : categoryFilter === 'Consumible'
          ? 'Consumibles'
          : 'Todo el stock';

  const isFilamentForm = form.category === 'Filamento';
  const isConsumableForm = form.category === 'Consumible';

  // Determina si la categoría seleccionada admite decimales
  const selectedCatConfig = apiCategories.find((c) => c.name === form.category);
  const allowsDecimals = selectedCatConfig ? selectedCatConfig.allows_decimals : true;
  const qtyStep = allowsDecimals ? '0.001' : '1';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="tf-page-title mb-0">{pageTitle}</h2>
          {alertCount > 0 && !categoryFilter && !excludeCategory && !excludeCategories && (
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

      {/* Filtros — se ocultan cuando la página ya filtra por categoría fija */}
      <div className="flex flex-wrap gap-3 mb-4">
        {!categoryFilter && !excludeCategory && !excludeCategories && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="tf-input py-1.5 text-sm w-auto"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
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
              <SortTh label="Nombre" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
              {!categoryFilter && (
                <SortTh label="Categoría" sortKey="category" sortConfig={sortConfig} onSort={handleSort} className="tf-th hidden md:table-cell" />
              )}
              <SortTh label="Cantidad" sortKey="quantity" sortConfig={sortConfig} onSort={handleSort} className="tf-th-right" />
              <SortTh label="Mínimo" sortKey="min_quantity" sortConfig={sortConfig} onSort={handleSort} className="tf-th-right hidden sm:table-cell" />
              <SortTh label="Estado" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="tf-th hidden sm:table-cell" />
              <SortTh label="Proveedor" sortKey="supplier_name" sortConfig={sortConfig} onSort={handleSort} className="tf-th hidden lg:table-cell" />
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className={`tf-skeleton h-4 ${j === 0 ? 'w-3/4' : 'w-1/2'}`} />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {items.length === 0 ? (
                    <EmptyState
                      icon={PackageOpen}
                      title="El inventario está vacío"
                      description="Agrega tu primer ítem para comenzar a gestionar el stock."
                      actionLabel="Agregar ítem"
                      onAction={openCreate}
                    />
                  ) : (
                    <EmptyState
                      icon={PackageOpen}
                      title="Sin resultados"
                      description="Ningún ítem coincide con los filtros aplicados."
                      size="sm"
                    />
                  )}
                </td>
              </tr>
            )}
            {paginated.map((item) => {
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
                  {!categoryFilter && (
                    <td className="tf-td hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded text-xs bg-[#1e2125] text-steel">{item.category}</span>
                    </td>
                  )}
                  <td className="tf-td-right">
                    <span className={`font-semibold font-mono ${alert ? 'text-red-400' : 'text-tech-white'}`}>
                      {parseFloat(item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })}
                    </span>
                    <span className="text-gunmetal text-xs ml-1">{item.unit}</span>
                  </td>
                  <td className="tf-td-right hidden sm:table-cell text-steel text-sm font-mono">
                    {parseFloat(item.min_quantity) > 0
                      ? parseFloat(item.min_quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })
                      : '—'}
                  </td>
                  <td className="tf-td hidden sm:table-cell">
                    <StockBadge item={item} />
                  </td>
                  <td className="tf-td hidden lg:table-cell text-steel text-sm">
                    {item.supplier_name || '—'}
                  </td>
                  <td className="tf-td-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setAdjustModal({ item, value: '' })}
                        className="tf-btn-ghost p-1.5 text-xs"
                        title="Ajustar cantidad"
                      >
                        ±
                      </button>
                      <button
                        onClick={() => handleFlag(item.id)}
                        className={`tf-btn-ghost p-1.5 ${item.needs_purchase ? 'text-orange-400' : ''}`}
                        title={item.needs_purchase ? 'Quitar bandera de compra' : 'Marcar que necesita compra'}
                      >
                        <ShoppingCart size={14} />
                      </button>
                      <button onClick={() => openEdit(item)} className="tf-btn-ghost p-1.5" title="Editar">
                        <Pencil size={14} />
                      </button>
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

      {/* Paginación */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-steel px-1">
          <span className="font-mono text-xs text-gunmetal">
            {sorted.length <= PAGE_SIZE
              ? `${sorted.length} ítem${sorted.length !== 1 ? 's' : ''}`
              : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, sorted.length)} de ${sorted.length} ítems`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="tf-btn-ghost px-3 py-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              {/* Números de página — máximo 5 visibles */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`dots-${idx}`} className="px-1 text-gunmetal">…</span>
                    : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          p === currentPage
                            ? 'bg-blue-500/20 text-blue-400 font-medium'
                            : 'tf-btn-ghost'
                        }`}
                      >
                        {p}
                      </button>
                    )
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="tf-btn-ghost px-3 py-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}

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
                {/* Categoría: readonly si la página ya filtra por una, dropdown si es stock general */}
                <div>
                  <label className="tf-label">Categoría *</label>
                  {categoryFilter ? (
                    <input value={categoryFilter} readOnly className="tf-input opacity-60 cursor-not-allowed" />
                  ) : (
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      required
                      className="tf-input"
                    >
                      <option value="" disabled>— Seleccionar categoría —</option>
                      {apiCategories
                        .filter((c) => {
                          if (excludeCategory && c.name === excludeCategory) return false;
                          if (excludeCategories && excludeCategories.includes(c.name)) return false;
                          return true;
                        })
                        .map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
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
                  <input name="quantity" type="number" step={qtyStep} min="0"
                    value={form.quantity} onChange={handleChange} className="tf-input" />
                  {!allowsDecimals && (
                    <p className="text-xs text-gunmetal mt-1">Solo números enteros</p>
                  )}
                </div>
                <div>
                  <label className="tf-label">Mínimo de stock</label>
                  <input name="min_quantity" type="number" step={qtyStep} min="0"
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

              {/* Campos específicos para filamentos */}
              {isFilamentForm && (
                <div className="border border-blue-500/20 rounded-lg p-4 space-y-4 bg-blue-500/5">
                  <p className="text-sm font-medium text-blue-400 flex items-center gap-2">
                    <PackageOpen size={15} /> Datos del filamento (para la calculadora)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="tf-label">Marca</label>
                      <input name="filament_brand" value={form.filament_brand} onChange={handleChange}
                        className="tf-input" placeholder="Ej: Bambu Lab, eSUN" />
                    </div>
                    <div>
                      <label className="tf-label">Tipo</label>
                      <select name="filament_type" value={form.filament_type} onChange={handleChange}
                        className="tf-input">
                        {FILAMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="tf-label">Color</label>
                      <input name="filament_color" value={form.filament_color} onChange={handleChange}
                        className="tf-input" placeholder="Ej: Negro, Rojo, Gris" />
                    </div>
                    <div>
                      <label className="tf-label">Precio por kg (USD) *</label>
                      <input name="price_per_kg" type="number" step="0.01" min="0"
                        value={form.price_per_kg} onChange={handleChange}
                        className="tf-input" placeholder="Ej: 18.50" required={isFilamentForm} />
                      <p className="text-xs text-gunmetal mt-1">Usado por la calculadora</p>
                    </div>
                    <div>
                      <label className="tf-label">Peso por rollo (g)</label>
                      <input name="weight_per_roll" type="number" step="1" min="0"
                        value={form.weight_per_roll} onChange={handleChange}
                        className="tf-input" placeholder="Ej: 1000" />
                    </div>
                    <div>
                      <label className="tf-label">Diámetro (mm)</label>
                      <input name="filament_diameter" type="number" step="0.01" min="0"
                        value={form.filament_diameter} onChange={handleChange}
                        className="tf-input" placeholder="Ej: 1.75" />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos específicos para consumibles */}
              {isConsumableForm && (
                <div className="border border-amber-500/20 rounded-lg p-4 space-y-4 bg-amber-500/5">
                  <p className="text-sm font-medium text-amber-400 flex items-center gap-2">
                    <Zap size={15} /> Datos del consumible (para la calculadora)
                  </p>
                  <p className="text-xs text-gunmetal -mt-2">
                    El desgaste se calcula automáticamente: precio_cal / vida_útil × horas_impresión
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="tf-label">Vida útil (horas de impresión) *</label>
                      <input name="useful_life_hours" type="number" step="1" min="1"
                        value={form.useful_life_hours} onChange={handleChange}
                        className="tf-input" placeholder="Ej: 500"
                        required={isConsumableForm} />
                      <p className="text-xs text-gunmetal mt-1">
                        Horas antes de necesitar reemplazo
                      </p>
                    </div>
                    <div>
                      <label className="tf-label">Precio para cotización (USD) *</label>
                      <input name="unit_cost_cal" type="number" step="0.0001" min="0"
                        value={form.unit_cost_cal} onChange={handleChange}
                        className="tf-input" placeholder="Ej: 3.50"
                        required={isConsumableForm} />
                      <p className="text-xs text-gunmetal mt-1">
                        Lo que cobras al cliente (puede incluir impuestos de importación)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Precio por unidad para insumos (no filamento, no consumible) */}
              {!isFilamentForm && !isConsumableForm && (
                <div>
                  <label className="tf-label">Precio por unidad para calculadora (USD)</label>
                  <input name="price_per_unit" type="number" step="0.0001" min="0"
                    value={form.price_per_unit} onChange={handleChange}
                    className="tf-input" placeholder="Ej: 0.05" />
                  <p className="text-xs text-gunmetal mt-1">
                    Costo que se sumará al cotizar cuando se incluya este insumo
                  </p>
                </div>
              )}

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
                  {saving && <Loader2 size={16} className="animate-spin" />}
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
              Actual: <span className="text-blue-400 font-medium">
                {parseFloat(adjustModal.item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })} {adjustModal.item.unit}
              </span>
            </p>
            <label className="tf-label">
              Cantidad a sumar o restar (usa número negativo para restar)
            </label>
            <input
              type="number"
              step={(() => {
                const c = apiCategories.find((cat) => cat.name === adjustModal.item.category);
                return c?.allows_decimals ? '0.001' : '1';
              })()}
              value={adjustModal.value}
              onChange={(e) => setAdjustModal({ ...adjustModal, value: e.target.value })}
              className="tf-input mb-4"
              placeholder="Ej: 2 para sumar, -1 para restar"
              autoFocus
            />
            {adjustModal.value !== '' && !isNaN(parseFloat(adjustModal.value)) && (
              <p className="text-xs text-gunmetal mb-4">
                Nuevo total: <span className="text-tech-white font-medium">
                  {(parseFloat(adjustModal.item.quantity) + parseFloat(adjustModal.value))
                    .toLocaleString('es-CO', { maximumFractionDigits: 3 })} {adjustModal.item.unit}
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
