/**
 * @file Página de pedidos de compra con tracking.
 *
 * Permite registrar compras realizadas en proveedores (Amazon, Delbex, etc.)
 * con número de tracking. Al marcar un pedido como llegado, el stock del
 * inventario se actualiza automáticamente.
 *
 * @module pages/inventory/InventoryPurchasesPage
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  Plus, X, Eye, Trash2, PackageCheck, Truck, Clock, Ban,
  ShoppingCart, Pencil, RefreshCw, Loader, SendHorizonal,
} from 'lucide-react';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  arrivePurchaseOrder,
  getInventoryItems,
  scanTracking,
} from '../../services/api';

/** Mapa de colores y etiquetas por estado del pedido */
const STATUS_CONFIG = {
  pendiente:   { label: 'No despachado', color: 'text-gunmetal',    bg: 'bg-gunmetal/20',    border: 'border-gunmetal/30',    icon: Clock },
  despachado:  { label: 'Despachado',    color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30',   icon: SendHorizonal },
  en_transito: { label: 'En tránsito',   color: 'text-blue-400',    bg: 'bg-blue-500/20',    border: 'border-blue-500/30',    icon: Truck },
  entregado:   { label: 'Entregado',     color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', icon: PackageCheck },
  llegado:     { label: 'Recibido',      color: 'text-green-400',   bg: 'bg-green-500/20',   border: 'border-green-500/30',   icon: PackageCheck },
  cancelado:   { label: 'Cancelado',     color: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/30',     icon: Ban },
};

/** Estado vacío de un ítem del pedido */
const EMPTY_ITEM = { name: '', quantity: '1', unit_cost: '0', inventory_item_id: '', notes: '' };

/** Formatea fecha YYYY-MM-DD a dd/mm/yyyy */
const fmt = (str) => {
  if (!str) return '—';
  const [y, m, d] = str.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

/** Insignia de estado del pedido */
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

/**
 * Página de pedidos de compra.
 * @returns {JSX.Element}
 */
export default function InventoryPurchasesPage() {
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null); // null = crear, obj = editar
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  /** Estado del formulario de nuevo/editar pedido */
  const [form, setForm] = useState({
    supplier: '',
    tracking_number: '',
    carrier: '',
    estimated_arrival: '',
    notes: '',
  });
  const [formItems, setFormItems] = useState([{ ...EMPTY_ITEM }]);

  const load = async () => {
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        getPurchaseOrders(),
        getInventoryItems(),
      ]);
      setOrders(ordersRes.data);
      setInventoryItems(
        [...itemsRes.data].sort((a, b) =>
          (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es')
        )
      );
    } catch {
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingOrder(null);
    setForm({ supplier: '', tracking_number: '', carrier: '', estimated_arrival: '', notes: '' });
    setFormItems([{ ...EMPTY_ITEM }]);
    setModalOpen(true);
  };

  const openEdit = (order) => {
    setEditingOrder(order);
    setForm({
      supplier: order.supplier || '',
      tracking_number: order.tracking_number || '',
      carrier: order.carrier || '',
      estimated_arrival: order.estimated_arrival ? order.estimated_arrival.split('T')[0] : '',
      notes: order.notes || '',
    });
    setFormItems(
      (order.items || []).map((it) => ({
        name: it.name || '',
        quantity: String(it.quantity ?? 1),
        unit_cost: String(it.unit_cost ?? 0),
        inventory_item_id: it.inventory_item_id ? String(it.inventory_item_id) : '',
        notes: it.notes || '',
      }))
    );
    setSelected(null);
    setModalOpen(true);
  };

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleItemChange = (idx, field, value) => {
    setFormItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    // Si seleccionó un ítem de inventario, pre-llenar el nombre
    if (field === 'inventory_item_id' && value) {
      const inv = inventoryItems.find((i) => String(i.id) === String(value));
      if (inv) {
        setFormItems((prev) => prev.map((it, i) =>
          i === idx ? { ...it, inventory_item_id: value, name: inv.name } : it
        ));
      }
    }
  };

  const addFormItem = () => setFormItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeFormItem = (idx) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier.trim()) { toast.error('El proveedor es obligatorio'); return; }
    for (const it of formItems) {
      if (!it.name.trim()) { toast.error('Cada ítem debe tener un nombre'); return; }
    }
    setSaving(true);
    const payload = {
      supplier: form.supplier.trim(),
      tracking_number: form.tracking_number || null,
      carrier: form.carrier || null,
      estimated_arrival: form.estimated_arrival || null,
      notes: form.notes || null,
      items: formItems.map((it) => ({
        name: it.name.trim(),
        quantity: parseInt(it.quantity, 10) || 1,
        unit_cost: parseFloat(it.unit_cost) || 0,
        inventory_item_id: it.inventory_item_id ? parseInt(it.inventory_item_id) : null,
        notes: it.notes || null,
      })),
    };
    try {
      if (editingOrder) {
        await updatePurchaseOrder(editingOrder.id, payload);
        toast.success('Pedido actualizado');
      } else {
        await createPurchaseOrder(payload);
        toast.success('Pedido registrado');
      }
      setModalOpen(false);
      load();
    } catch {
      toast.error(editingOrder ? 'Error al actualizar el pedido' : 'Error al guardar el pedido');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('¿Eliminar este pedido?', 'Eliminar')) return;
    try {
      await deletePurchaseOrder(id);
      toast.success('Pedido eliminado');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleArrive = async (id) => {
    if (!await confirm('¿Marcar este pedido como llegado? El stock del inventario se actualizará automáticamente.', 'Confirmar')) return;
    try {
      await arrivePurchaseOrder(id);
      toast.success('Pedido marcado como llegado. El inventario fue actualizado.');
      if (selected?.id === id) setSelected(null);
      load();
    } catch {
      toast.error('Error al procesar la llegada');
    }
  };

  const handleScanTracking = async () => {
    setScanning(true);
    const tid = toast.loading('Consultando tracking en parcelsapp.com… (puede tardar varios minutos)');
    try {
      const res = await scanTracking();
      const { scanned, updated, errors } = res.data;
      toast.dismiss(tid);
      toast.success(`Tracking actualizado: ${scanned} pedidos revisados, ${updated} actualizados${errors ? `, ${errors} errores` : ''}`);
      load();
    } catch {
      toast.dismiss(tid);
      toast.error('Error al actualizar tracking. ¿Está el servicio activo?');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="tf-page-title mb-0">Pedidos de Compra</h2>
          <p className="text-sm text-gunmetal mt-1">Tracking de compras en Amazon, Delbex y otros</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScanTracking}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white hover:border-[#363C47] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Consulta parcelsapp.com para todos los pedidos activos"
          >
            {scanning
              ? <Loader size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
            Actualizar tracking
          </button>
          <button onClick={openCreate} className="tf-btn-primary gap-2" style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}>
            <Plus size={18} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[600px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">N°</th>
              <th className="tf-th">Proveedor</th>
              <th className="tf-th hidden sm:table-cell">Tracking</th>
              <th className="tf-th hidden md:table-cell">Llegada est.</th>
              <th className="tf-th">Estado</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gunmetal">Cargando...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gunmetal">
                  No hay pedidos registrados.{' '}
                  <button onClick={openCreate} className="text-blue-400 hover:underline">Registrar el primero</button>
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="tf-tr">
                <td className="tf-td text-gunmetal font-mono text-sm">#{String(order.id).padStart(3, '0')}</td>
                <td className="tf-td">
                  <p className="font-medium text-tech-white">{order.supplier}</p>
                  {order.items?.length > 0 && (
                    <p className="text-xs text-gunmetal mt-0.5 truncate max-w-[200px]">
                      {order.items.map((it) => it.name).join(' · ')}
                    </p>
                  )}
                </td>
                <td className="tf-td hidden sm:table-cell">
                  {order.tracking_number
                    ? <span className="font-mono text-sm text-blue-400">{order.tracking_number}</span>
                    : <span className="text-gunmetal">—</span>}
                </td>
                <td className="tf-td hidden md:table-cell text-steel text-sm">{fmt(order.estimated_arrival)}</td>
                <td className="tf-td"><StatusBadge status={order.status} /></td>
                <td className="tf-td-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setSelected(order)} className="tf-btn-ghost p-1.5" title="Ver detalle">
                      <Eye size={14} />
                    </button>
                    {order.status !== 'llegado' && order.status !== 'cancelado' && (
                      <>
                        <button
                          onClick={() => openEdit(order)}
                          className="tf-btn-ghost p-1.5 text-blue-400 hover:text-blue-300"
                          title="Editar pedido"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleArrive(order.id)}
                          className="tf-btn-ghost p-1.5 text-green-400 hover:text-green-300"
                          title="Marcar como llegado"
                        >
                          <PackageCheck size={14} />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(order.id)} className="tf-btn-danger p-1.5" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle */}
      {selected && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gunmetal">Pedido #{String(selected.id).padStart(3, '0')}</p>
                <h3 className="tf-section-title mb-0">{selected.supplier}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="tf-btn-ghost"><X size={20} /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <StatusBadge status={selected.status} />
                {selected.carrier && <span className="text-steel">{selected.carrier}</span>}
              </div>
              {selected.tracking_number && (
                <div className="bg-[#0A0E16] rounded-lg px-3 py-2">
                  <p className="text-xs text-gunmetal mb-0.5">Número de tracking</p>
                  <p className="font-mono text-blue-400 font-medium">{selected.tracking_number}</p>
                  {selected.tracking_checked_at && (
                    <p className="text-xs text-gunmetal mt-1">
                      Última consulta: {new Date(selected.tracking_checked_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              )}
              {selected.tracking_data && (() => {
                try {
                  const data = JSON.parse(selected.tracking_data);
                  const events = data.events || data.checkpoints || data.states || [];
                  const rawText = data.raw_text;
                  if (events.length > 0) {
                    return (
                      <div>
                        <p className="text-xs text-gunmetal font-medium uppercase tracking-wider mb-2">Eventos de tracking</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {events.slice(0, 10).map((ev, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                              <div>
                                <p className="text-tech-white">{ev.description || ev.message || ev.title || ev.status || JSON.stringify(ev)}</p>
                                {(ev.date || ev.time || ev.timestamp) && (
                                  <p className="text-gunmetal">{ev.date || ev.time || ev.timestamp}</p>
                                )}
                                {ev.location && <p className="text-gunmetal">{ev.location}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (rawText) {
                    return (
                      <div>
                        <p className="text-xs text-gunmetal font-medium uppercase tracking-wider mb-2">Info de tracking</p>
                        <pre className="text-xs text-steel bg-[#0A0E16] rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{rawText.slice(0, 1500)}</pre>
                      </div>
                    );
                  }
                } catch { /* JSON inválido, ignorar */ }
                return null;
              })()}
              <div className="flex gap-4 text-xs text-gunmetal">
                <span>Creado: <span className="text-tech-white">{fmt(selected.created_at)}</span></span>
                {selected.estimated_arrival && (
                  <span>Llegada est.: <span className="text-blue-400">{fmt(selected.estimated_arrival)}</span></span>
                )}
                {selected.arrived_at && (
                  <span>Llegó: <span className="text-green-400">{fmt(selected.arrived_at)}</span></span>
                )}
              </div>
            </div>

            {/* Ítems del pedido */}
            <h4 className="text-sm font-semibold text-steel mb-2">Ítems del pedido</h4>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="tf-th text-left py-2">Ítem</th>
                    <th className="tf-th-right py-2">Cant.</th>
                    <th className="tf-th-right py-2">Costo unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((it, i) => (
                    <tr key={i} className="border-b border-dark-border/40">
                      <td className="tf-td py-2">
                        {it.name}
                        {it.inventory_item_id && (
                          <span className="ml-1 text-xs text-blue-400">(vinculado)</span>
                        )}
                      </td>
                      <td className="tf-td-right py-2 text-steel">{parseFloat(it.quantity).toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                      <td className="tf-td-right py-2 text-steel">
                        {parseFloat(it.unit_cost) > 0 ? `$ ${parseFloat(it.unit_cost).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected.notes && (
              <p className="text-xs text-gunmetal mb-4">Notas: {selected.notes}</p>
            )}

            {selected.status !== 'llegado' && selected.status !== 'cancelado' && (
              <div className="flex gap-3">
                <button
                  onClick={() => openEdit(selected)}
                  className="flex-1 tf-btn-ghost gap-2 text-blue-400 border border-blue-500/30 hover:border-blue-400"
                >
                  <Pencil size={16} /> Editar pedido
                </button>
                <button
                  onClick={() => { handleArrive(selected.id); setSelected(null); }}
                  className="flex-1 tf-btn-primary gap-2"
                  style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                >
                  <PackageCheck size={16} /> Marcar llegado
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal nuevo pedido */}
      {modalOpen && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="tf-section-title mb-0 flex items-center gap-2">
                {editingOrder
                  ? <><Pencil size={20} className="text-blue-400" /> Editar pedido #{String(editingOrder.id).padStart(3, '0')}</>
                  : <><ShoppingCart size={20} className="text-blue-400" /> Nuevo pedido de compra</>
                }
              </h3>
              <button onClick={() => setModalOpen(false)} className="tf-btn-ghost"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Datos del pedido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tf-label">Proveedor *</label>
                  <input name="supplier" value={form.supplier} onChange={handleFormChange}
                    required className="tf-input" placeholder="Amazon, Delbex, AliExpress..." />
                </div>
                <div>
                  <label className="tf-label">Transportista</label>
                  <input name="carrier" value={form.carrier} onChange={handleFormChange}
                    className="tf-input" placeholder="UPS, FedEx, DHL, USPS..." />
                </div>
                <div>
                  <label className="tf-label">Número de tracking</label>
                  <input name="tracking_number" value={form.tracking_number} onChange={handleFormChange}
                    className="tf-input font-mono" placeholder="Ej: 1Z999AA10123456784" />
                </div>
                <div>
                  <label className="tf-label">Llegada estimada</label>
                  <input name="estimated_arrival" type="date" value={form.estimated_arrival}
                    onChange={handleFormChange} className="tf-input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="tf-label">Notas del pedido</label>
                  <textarea name="notes" value={form.notes} onChange={handleFormChange}
                    rows={2} className="tf-input" placeholder="Observaciones del pedido..." />
                </div>
              </div>

              {/* Ítems del pedido */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-steel">Ítems comprados</h4>
                  <button type="button" onClick={addFormItem} className="tf-btn-ghost text-sm gap-1">
                    <Plus size={14} /> Agregar ítem
                  </button>
                </div>

                {/* Encabezados (sm+) */}
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-gunmetal font-medium px-1 mb-1">
                  <span className="col-span-4">Nombre del ítem</span>
                  <span className="col-span-3">Ítem de inventario (opcional)</span>
                  <span className="col-span-2 text-right">Cantidad</span>
                  <span className="col-span-2 text-right">Costo unit. USD</span>
                  <span className="col-span-1"></span>
                </div>

                <div className="space-y-2">
                  {formItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-4">
                        <input
                          value={it.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="tf-input text-sm" placeholder="Nombre del producto" required />
                      </div>
                      <div className="col-span-12 sm:col-span-3">
                        <select
                          value={it.inventory_item_id}
                          onChange={(e) => handleItemChange(idx, 'inventory_item_id', e.target.value)}
                          className="tf-input text-sm"
                        >
                          <option value="">Sin vincular</option>
                          {Object.entries(
                            inventoryItems.reduce((acc, inv) => {
                              const cat = inv.category || 'Sin categoría';
                              (acc[cat] = acc[cat] || []).push(inv);
                              return acc;
                            }, {})
                          ).map(([category, items]) => (
                            <optgroup key={category} label={category}>
                              {items.map((inv) => (
                                <option key={inv.id} value={inv.id}>{inv.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <input
                          type="number" min="1" step="1" value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="tf-input text-sm text-right" placeholder="1" required />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <input
                          type="number" min="0" step="0.01" value={it.unit_cost}
                          onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                          className="tf-input text-sm text-right" placeholder="0.00" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => removeFormItem(idx)}
                          disabled={formItems.length === 1}
                          className="tf-btn-danger p-1 disabled:opacity-30">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gunmetal mt-2">
                  💡 Vincula un ítem al inventario para que el stock se actualice automáticamente cuando el pedido llegue.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 tf-btn-primary" style={{ backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}>
                  {saving ? 'Guardando...' : editingOrder ? 'Guardar cambios' : 'Registrar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
