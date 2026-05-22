/**
 * @file Página de inventario de impresiones 3D.
 *
 * Muestra las impresiones listas para vender en formato de tarjetas
 * con imagen, categoría, cantidad en stock y precio. Permite agregar,
 * editar, vender y eliminar ítems del inventario de impresiones.
 *
 * @module pages/inventory/InventoryPrintsPage
 */

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  Plus, X, Trash2, Pencil, ShoppingBag, Package, ImagePlus,
  Tag, Layers,
} from 'lucide-react';
import {
  getPrintedItems,
  createPrintedItem,
  updatePrintedItem,
  deletePrintedItem,
  sellPrintedItem,
  uploadPrintedItemImage,
  getExchangeRate,
} from '../../services/api';
import { fmtCOP, fmtUSD } from '../../utils/inventoryAdapter';

/**
 * Formatea el precio según la moneda del ítem (issue #78).
 * @param {number|string|null} price
 * @param {'USD'|'COP'} currency
 */
const fmtPrice = (price, currency) => {
  if (price == null || price === '') return '—';
  const n = parseFloat(price);
  return currency === 'COP' ? fmtCOP(n) : `${fmtUSD(n)} USD`;
};

/** Estado vacío del formulario (default COP por preferencia de Giomar) */
const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  quantity: '0',
  unit_price: '',
  currency: 'COP',
  material: '',
  color: '',
};

/** Categorías sugeridas para autocompletar */
const CATEGORIAS_SUGERIDAS = [
  'Llaveros', 'Figuras', 'Repuestos', 'Decoración', 'Joyería',
  'Herramientas', 'Juguetes', 'Arte', 'Prototipos', 'Otro',
];

/**
 * Tarjeta de un ítem de impresión.
 *
 * @param {{ item: object, onEdit: Function, onDelete: Function, onSell: Function }} props
 */
function PrintCard({ item, onEdit, onDelete, onSell, exchangeRate }) {
  const itemCurrency = item.currency || 'USD';
  const priceNum = item.unit_price != null ? parseFloat(item.unit_price) : null;
  const priceCOP = priceNum != null && itemCurrency === 'USD' && exchangeRate
    ? priceNum * exchangeRate
    : null;
  return (
    <div className="tf-card rounded-xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-colors">
      {/* Imagen o placeholder */}
      <div className="relative bg-[#0A0E16] h-44 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gunmetal">
            <Package size={40} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
        {/* Badge de stock */}
        <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
          item.quantity > 0
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {item.quantity > 0 ? `${item.quantity} disponibles` : 'Sin stock'}
        </span>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-tech-white text-sm leading-tight mb-1">{item.name}</h3>

          <div className="flex flex-wrap gap-1 mb-2">
            {item.category && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <Tag size={9} /> {item.category}
              </span>
            )}
            {item.material && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <Layers size={9} /> {item.material}
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-xs text-gunmetal line-clamp-2 mb-2">{item.description}</p>
          )}
        </div>

        {/* Precio y acciones */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#222630]">
          <span className="text-tech-white font-bold text-sm mono">
            <span>{fmtPrice(item.unit_price, itemCurrency)}</span>
            {priceCOP != null && (
              <span className="block text-[10px] text-gunmetal font-normal">≈ {fmtCOP(priceCOP)}</span>
            )}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="tf-btn-ghost p-1.5 text-steel hover:text-blue-400"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="tf-btn-danger p-1.5"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {item.quantity > 0 && (
          <button
            onClick={() => onSell(item)}
            className="mt-2 w-full tf-btn-primary py-2 text-sm gap-2 flex items-center justify-center"
            style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}
          >
            <ShoppingBag size={14} /> Registrar venta
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Página principal de inventario de impresiones 3D.
 * @returns {JSX.Element}
 */
export default function InventoryPrintsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [sellItem, setSellItem] = useState(null);
  const [sellQty, setSellQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPrintedItems({ limit: 100 });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Error al cargar las impresiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getExchangeRate()
      .then((res) => setExchangeRate(Number(res.data.rate_used)))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      category: item.category || '',
      description: item.description || '',
      quantity: String(item.quantity ?? 0),
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      currency: item.currency || 'USD',
      material: item.material || '',
      color: item.color || '',
    });
    setImageFile(null);
    setImagePreview(item.image_url || null);
    setModalOpen(true);
  };

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category || null,
        description: form.description || null,
        quantity: parseInt(form.quantity) || 0,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        currency: form.currency || 'COP',
        material: form.material || null,
        color: form.color || null,
      };

      let savedItem;
      if (editingItem) {
        const res = await updatePrintedItem(editingItem.id, payload);
        savedItem = res.data;
        toast.success('Impresión actualizada');
      } else {
        const res = await createPrintedItem(payload);
        savedItem = res.data;
        toast.success('Impresión agregada');
      }

      // Subir imagen si se seleccionó una
      if (imageFile && savedItem?.id) {
        try {
          await uploadPrintedItemImage(savedItem.id, imageFile);
        } catch {
          toast.error('La imagen no se pudo subir, pero el ítem fue guardado');
        }
      }

      setModalOpen(false);
      load();
    } catch {
      toast.error(editingItem ? 'Error al actualizar' : 'Error al crear la impresión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('¿Eliminar esta impresión del inventario?', 'Eliminar')) return;
    try {
      await deletePrintedItem(id);
      toast.success('Impresión eliminada');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleSell = async () => {
    if (!sellItem || sellQty < 1) return;
    if (sellQty > sellItem.quantity) {
      toast.error(`Stock insuficiente. Solo hay ${sellItem.quantity} disponibles.`);
      return;
    }
    try {
      await sellPrintedItem(sellItem.id, sellQty);
      toast.success(`Venta registrada: ${sellQty} × ${sellItem.name}`);
      setSellItem(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al registrar la venta');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="tf-page-title mb-0">Disponible para Venta</h2>
          <p className="text-sm text-gunmetal mt-1">
            {total} {total === 1 ? 'ítem' : 'ítems'} en inventario
          </p>
        </div>
        <button
          onClick={openCreate}
          className="tf-btn-primary gap-2"
          style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}
        >
          <Plus size={18} /> Nueva impresión
        </button>
      </div>

      {/* Grid de tarjetas */}
      {loading && (
        <div className="text-center py-16 text-gunmetal">Cargando impresiones...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gunmetal">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium text-steel">No hay impresiones en el inventario</p>
          <p className="text-sm mt-2">
            <button onClick={openCreate} className="text-blue-400 hover:underline">
              Agrega tu primera impresión
            </button>
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <PrintCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSell={(it) => { setSellItem(it); setSellQty(1); }}
              exchangeRate={exchangeRate}
            />
          ))}
        </div>
      )}

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="tf-section-title mb-0 flex items-center gap-2">
                {editingItem
                  ? <><Pencil size={18} className="text-blue-400" /> Editar impresión</>
                  : <><Plus size={18} className="text-blue-400" /> Nueva impresión</>
                }
              </h3>
              <button onClick={() => setModalOpen(false)} className="tf-btn-ghost">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Imagen */}
              <div>
                <label className="tf-label">Imagen</label>
                <div
                  className="relative bg-[#0A0E16] border-2 border-dashed border-[#2A2F38] rounded-xl h-36 flex items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gunmetal">
                      <ImagePlus size={28} />
                      <span className="text-xs">Haz clic para subir imagen</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="tf-label">Nombre *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  className="tf-input"
                  placeholder="Ej: Llavero tortuga PLA verde"
                />
              </div>

              {/* Categoría y material */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tf-label">Categoría</label>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="tf-input"
                    placeholder="Llaveros, Figuras..."
                    list="categorias-list"
                  />
                  <datalist id="categorias-list">
                    {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="tf-label">Material</label>
                  <input
                    name="material"
                    value={form.material}
                    onChange={handleFormChange}
                    className="tf-input"
                    placeholder="PLA, PETG, ABS..."
                  />
                </div>
              </div>

              {/* Color, cantidad, precio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="tf-label">Color</label>
                  <input
                    name="color"
                    value={form.color}
                    onChange={handleFormChange}
                    className="tf-input"
                    placeholder="Verde, Rojo..."
                  />
                </div>
                <div>
                  <label className="tf-label">Cantidad en stock</label>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={handleFormChange}
                    className="tf-input text-right"
                  />
                </div>
                <div>
                  <label className="tf-label flex items-center justify-between gap-2">
                    <span>Precio de venta ({form.currency})</span>
                    <div className="inline-flex rounded-md border border-dark-border overflow-hidden text-[10px]">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, currency: 'COP' })}
                        className={`px-1.5 py-0.5 font-medium ${form.currency === 'COP' ? 'bg-forge-teal text-forge-black' : 'text-gunmetal'}`}
                        aria-pressed={form.currency === 'COP'}
                      >COP</button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, currency: 'USD' })}
                        className={`px-1.5 py-0.5 font-medium ${form.currency === 'USD' ? 'bg-forge-teal text-forge-black' : 'text-gunmetal'}`}
                        aria-pressed={form.currency === 'USD'}
                      >USD</button>
                    </div>
                  </label>
                  <input
                    name="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={handleFormChange}
                    className="tf-input text-right"
                    placeholder="0.00"
                  />
                  {form.currency === 'USD' && exchangeRate && form.unit_price && (
                    <p className="text-[10px] text-gunmetal text-right mt-0.5 mono">
                      ≈ {fmtCOP(parseFloat(form.unit_price) * exchangeRate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="tf-label">Descripción</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={2}
                  className="tf-input"
                  placeholder="Descripción opcional..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 tf-btn-primary"
                  style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}
                >
                  {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Agregar impresión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de venta */}
      {sellItem && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="tf-section-title mb-0 flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-400" /> Registrar venta
              </h3>
              <button onClick={() => setSellItem(null)} className="tf-btn-ghost">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#0A0E16] rounded-xl p-4 mb-4">
              <p className="text-tech-white font-semibold">{sellItem.name}</p>
              <p className="text-gunmetal text-sm mt-1">
                Stock disponible: <span className="text-green-400 font-bold">{sellItem.quantity}</span>
              </p>
              {sellItem.unit_price && (
                <p className="text-gunmetal text-sm">
                  Precio unitario: <span className="text-tech-white font-bold mono">{fmtPrice(sellItem.unit_price, sellItem.currency || 'USD')}</span>
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="tf-label">Cantidad a vender</label>
              <input
                type="number"
                min="1"
                max={sellItem.quantity}
                value={sellQty}
                onChange={(e) => setSellQty(parseInt(e.target.value) || 1)}
                className="tf-input text-right text-xl font-bold"
              />
              {sellItem.unit_price && (
                <p className="text-right text-sm text-blue-400 mt-1 font-medium mono">
                  Total: {fmtPrice(parseFloat(sellItem.unit_price) * sellQty, sellItem.currency || 'USD')}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSellItem(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSell}
                className="flex-1 tf-btn-primary gap-2"
                style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
              >
                <ShoppingBag size={16} /> Confirmar venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
