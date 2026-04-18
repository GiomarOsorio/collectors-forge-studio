/**
 * @file Página de historial de registros de mantenimiento.
 *
 * Tabla con todos los registros con filtro por impresora.
 * Modal para crear un nuevo registro con ítems dinámicos vinculables
 * a items del inventario.
 *
 * @module pages/maintenance/MaintenanceLogsPage
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, X, Trash2, Pencil, ChevronDown, ChevronUp, ClipboardList, ExternalLink } from 'lucide-react';
import {
  getMaintenanceLogs,
  createMaintenanceLog,
  updateMaintenanceLog,
  deleteMaintenanceLog,
  getPrinters,
  getInventoryItems,
} from '../../services/api';
import { MAINTENANCE_TYPES, getMaintenanceType } from '../../config/maintenance';

/** Estado vacío de un ítem del formulario */
const EMPTY_ITEM = {
  name: '',
  quantity: '1',
  unit_cost: '0',
  inventory_item_id: '',
  notes: '',
};

/** Formatea datetime ISO a dd/mm/yyyy */
const fmt = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Fila expandible de la tabla de logs.
 */
function LogRow({ log, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const typeDef = getMaintenanceType(log.maintenance_type);
  const typeLabel = typeDef?.label ?? log.maintenance_type;

  return (
    <>
      <tr className="border-b border-[#222630] hover:bg-[#1A1D25] transition-colors">
        <td className="px-4 py-3 text-tech-white font-medium">{log.printer?.name ?? '—'}</td>
        <td className="px-4 py-3">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20">
            {typeLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-violet-400 text-sm">
          {Number(log.hours_at_maintenance).toFixed(1)} h
        </td>
        <td className="px-4 py-3 text-steel text-sm">{fmt(log.performed_at)}</td>
        <td className="px-4 py-3 text-center text-steel text-sm">{log.items?.length ?? 0}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {log.items?.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="tf-btn-ghost p-1.5"
                title={expanded ? 'Colapsar' : 'Ver ítems'}
              >
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
            <button
              onClick={() => onEdit(log)}
              className="tf-btn-ghost p-1.5 text-blue-400 hover:text-blue-300"
              title="Editar"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onDelete(log)}
              className="tf-btn-danger p-1.5"
              title="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && log.items?.length > 0 && (
        <tr className="border-b border-[#222630]">
          <td colSpan={6} className="px-6 py-3 bg-[#0A0E16]">
            <div className="text-xs text-gunmetal mb-2 font-medium">Ítems usados:</div>
            <div className="space-y-1">
              {log.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 text-xs text-steel">
                  <span className="text-tech-white">{item.name}</span>
                  <span>×{Number(item.quantity)}</span>
                  <span>${Number(item.unit_cost).toFixed(2)} c/u</span>
                  {item.notes && <span className="text-gunmetal italic">{item.notes}</span>}
                </div>
              ))}
            </div>
            {log.description && (
              <p className="text-xs text-steel mt-2 italic">"{log.description}"</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Página de historial de registros de mantenimiento.
 * @returns {JSX.Element}
 */
export default function MaintenanceLogsPage() {
  const confirm = useConfirm();
  const [logs, setLogs] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPrinter, setFilterPrinter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({ performed_at: '', hours_at_maintenance: '', maintenance_type: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Formulario del modal
  const [form, setForm] = useState({
    printer_id: '',
    maintenance_type: '',
    hours_at_maintenance: '',
    description: '',
    performed_at: new Date().toISOString().split('T')[0],
  });
  const [formItems, setFormItems] = useState([{ ...EMPTY_ITEM }]);

  const load = async (printerId = '') => {
    try {
      const [logsRes, printersRes, invRes] = await Promise.all([
        getMaintenanceLogs(printerId || null),
        getPrinters(),
        getInventoryItems(),
      ]);
      setLogs(logsRes.data);
      setPrinters([...printersRes.data].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      setInventoryItems(
        [...invRes.data].sort((a, b) =>
          (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es')
        )
      );
    } catch {
      toast.error('Error al cargar los registros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filterPrinter); }, [filterPrinter]);

  /** Convierte los suggested_items de un tipo en filas del formulario. */
  const suggestedToFormItems = (typeDef) => {
    if (!typeDef?.suggested_items?.length) return [];
    return typeDef.suggested_items.map((si) => ({
      ...EMPTY_ITEM,
      name: si.name,
      quantity: String(si.quantity),
    }));
  };

  const openModal = () => {
    const defaultType = MAINTENANCE_TYPES[0];
    setForm({
      printer_id: printers[0]?.id ? String(printers[0].id) : '',
      maintenance_type: defaultType.value,
      hours_at_maintenance: printers[0] ? String(printers[0].current_hours) : '',
      description: '',
      performed_at: new Date().toISOString().split('T')[0],
    });
    setFormItems(suggestedToFormItems(defaultType));
    setModalOpen(true);
  };

  // Cuando cambia el tipo de mantenimiento, auto-poblar ítems si aún están vacíos
  const handleMaintenanceTypeChange = (newType) => {
    setForm((prev) => ({ ...prev, maintenance_type: newType }));
    const allEmpty = formItems.every((it) => !it.name.trim());
    if (allEmpty) {
      const typeDef = getMaintenanceType(newType);
      setFormItems(suggestedToFormItems(typeDef));
    }
  };

  // Cuando cambia la impresora en el modal, auto-rellenar las horas
  const handlePrinterChange = (printerId) => {
    const p = printers.find((pr) => String(pr.id) === printerId);
    setForm((prev) => ({
      ...prev,
      printer_id: printerId,
      hours_at_maintenance: p ? String(p.current_hours) : prev.hours_at_maintenance,
    }));
  };

  // Cuando se selecciona un ítem de inventario, rellenar nombre y costo
  const handleInventoryItemChange = (index, itemId) => {
    const invItem = inventoryItems.find((i) => String(i.id) === itemId);
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventory_item_id: itemId,
        name: invItem ? invItem.name : updated[index].name,
        unit_cost: invItem ? String(invItem.unit_cost) : updated[index].unit_cost,
      };
      return updated;
    });
  };

  const addItem = () => setFormItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (index) =>
    setFormItems((prev) => prev.filter((_, i) => i !== index));

  const updateItem = (index, field, value) =>
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        printer_id: parseInt(form.printer_id, 10),
        maintenance_type: form.maintenance_type,
        hours_at_maintenance: parseFloat(form.hours_at_maintenance) || 0,
        description: form.description.trim() || null,
        performed_at: form.performed_at ? `${form.performed_at}T00:00:00` : null,
        items: formItems
          .filter((it) => it.name.trim())
          .map((it) => ({
            inventory_item_id: it.inventory_item_id ? parseInt(it.inventory_item_id, 10) : null,
            name: it.name.trim(),
            quantity: parseFloat(it.quantity) || 1,
            unit_cost: parseFloat(it.unit_cost) || 0,
            notes: it.notes.trim() || null,
          })),
      };
      await createMaintenanceLog(payload);
      toast.success('Registro de mantenimiento creado');
      setModalOpen(false);
      load(filterPrinter);
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log) => {
    const typeDef = getMaintenanceType(log.maintenance_type);
    const ok = await confirm(
      `¿Eliminar el registro de "${typeDef?.label ?? log.maintenance_type}" del ${fmt(log.performed_at)}?`,
      'Eliminar',
    );
    if (!ok) return;
    try {
      await deleteMaintenanceLog(log.id);
      toast.success('Registro eliminado');
      load(filterPrinter);
    } catch {
      toast.error('Error al eliminar el registro');
    }
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setEditForm({
      performed_at: log.performed_at ? log.performed_at.split('T')[0] : '',
      hours_at_maintenance: String(log.hours_at_maintenance),
      maintenance_type: log.maintenance_type,
      description: log.description ?? '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await updateMaintenanceLog(editingLog.id, {
        performed_at: `${editForm.performed_at}T00:00:00`,
        hours_at_maintenance: parseFloat(editForm.hours_at_maintenance) || 0,
        maintenance_type: editForm.maintenance_type,
        description: editForm.description.trim() || null,
      });
      toast.success('Registro actualizado');
      setEditModalOpen(false);
      load(filterPrinter);
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al actualizar el registro');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Historial</h1>
          <p className="text-steel text-sm mt-1">Registros de mantenimiento realizados.</p>
        </div>
        <button
          onClick={openModal}
          disabled={printers.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          title={printers.length === 0 ? 'Crea una impresora primero' : ''}
        >
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {/* Filtro por impresora */}
      {printers.length > 1 && (
        <div className="mb-4">
          <select
            className="bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
            value={filterPrinter}
            onChange={(e) => setFilterPrinter(e.target.value)}
          >
            <option value="">Todas las impresoras</option>
            {printers.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-steel">Cargando...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={48} className="mx-auto text-gunmetal mb-4" />
          <p className="text-steel">No hay registros de mantenimiento.</p>
        </div>
      ) : (
        <div className="bg-[#0A0E16] rounded-xl border border-[#222630] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222630]">
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Impresora</th>
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Tipo</th>
                <th className="text-right px-4 py-3 text-gunmetal font-medium">Horas</th>
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Fecha</th>
                <th className="text-center px-4 py-3 text-gunmetal font-medium">Ítems</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <LogRow key={log.id} log={log} onDelete={handleDelete} onEdit={handleEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar registro */}
      {editModalOpen && editingLog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0E16] border border-[#222630] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222630]">
              <h2 className="text-tech-white font-semibold">Editar registro</h2>
              <button onClick={() => setEditModalOpen(false)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gunmetal mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={editForm.performed_at}
                    onChange={(e) => setEditForm({ ...editForm, performed_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gunmetal mb-1">Horas al realizar *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={editForm.hours_at_maintenance}
                    onChange={(e) => setEditForm({ ...editForm, hours_at_maintenance: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Tipo de mantenimiento *</label>
                <select
                  required
                  className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={editForm.maintenance_type}
                  onChange={(e) => setEditForm({ ...editForm, maintenance_type: e.target.value })}
                >
                  {MAINTENANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Descripción</label>
                <textarea
                  rows={2}
                  className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <p className="text-xs text-gunmetal">Los ítems no se pueden modificar (ya se descontaron del inventario).</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear registro */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0E16] border border-[#222630] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222630] shrink-0">
              <h2 className="text-tech-white font-semibold">Nuevo registro de mantenimiento</h2>
              <button onClick={() => setModalOpen(false)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Fila impresora + tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gunmetal mb-1">Impresora *</label>
                  <select
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={form.printer_id}
                    onChange={(e) => handlePrinterChange(e.target.value)}
                  >
                    <option value="">Selecciona...</option>
                    {printers.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gunmetal">Tipo de mantenimiento *</label>
                    {(() => {
                      const selected = MAINTENANCE_TYPES.find((t) => t.value === form.maintenance_type);
                      return selected?.wiki_url ? (
                        <a
                          href={selected.wiki_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                          title="Ver cómo se hace en el wiki de BambuLab"
                        >
                          <ExternalLink size={11} /> Wiki
                        </a>
                      ) : null;
                    })()}
                  </div>
                  <select
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={form.maintenance_type}
                    onChange={(e) => handleMaintenanceTypeChange(e.target.value)}
                  >
                    {MAINTENANCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value} title={t.description}>{t.label}</option>
                    ))}
                  </select>
                  {(() => {
                    const selected = MAINTENANCE_TYPES.find((t) => t.value === form.maintenance_type);
                    return selected?.description ? (
                      <p className="text-xs text-gunmetal mt-1 leading-relaxed">{selected.description}</p>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Fila horas + fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gunmetal mb-1">Horas al realizar *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={form.hours_at_maintenance}
                    onChange={(e) => setForm({ ...form, hours_at_maintenance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gunmetal mb-1">Fecha de realización *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                    value={form.performed_at}
                    onChange={(e) => setForm({ ...form, performed_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-gunmetal mb-1">Descripción</label>
                <textarea
                  rows={2}
                  className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe brevemente el mantenimiento realizado..."
                />
              </div>

              {/* Ítems usados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gunmetal font-medium">Ítems usados</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    + Agregar ítem
                  </button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="bg-[#1A1D25] border border-[#2A2F38] rounded-lg p-3 space-y-2">
                      {/* Vinculación a inventario */}
                      <div>
                        <label className="block text-xs text-gunmetal mb-1">Ítem del inventario (opcional)</label>
                        <select
                          className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded px-2 py-1.5 text-steel text-xs focus:outline-none focus:border-violet-500"
                          value={item.inventory_item_id}
                          onChange={(e) => handleInventoryItemChange(idx, e.target.value)}
                        >
                          <option value="">— Sin vincular —</option>
                          {Object.entries(
                            inventoryItems.reduce((acc, inv) => {
                              const cat = inv.category || 'Sin categoría';
                              (acc[cat] = acc[cat] || []).push(inv);
                              return acc;
                            }, {})
                          ).map(([category, items]) => (
                            <optgroup key={category} label={category}>
                              {items.map((inv) => (
                                <option key={inv.id} value={String(inv.id)}>{inv.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      {/* Nombre + cantidad + costo */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3 sm:col-span-1">
                          <label className="block text-xs text-gunmetal mb-1">Nombre *</label>
                          <input
                            required
                            className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded px-2 py-1.5 text-tech-white text-xs focus:outline-none focus:border-violet-500"
                            value={item.name}
                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                            placeholder="Grasa Syntetica..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gunmetal mb-1">Cantidad</label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded px-2 py-1.5 text-tech-white text-xs focus:outline-none focus:border-violet-500"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gunmetal mb-1">Costo unit.</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded px-2 py-1.5 text-tech-white text-xs focus:outline-none focus:border-violet-500"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                          />
                        </div>
                      </div>
                      {/* Notas del ítem + botón eliminar */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gunmetal mb-1">Notas</label>
                          <input
                            className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded px-2 py-1.5 text-steel text-xs focus:outline-none focus:border-violet-500"
                            value={item.notes}
                            onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                            placeholder="Opcional..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 rounded text-steel hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Quitar ítem"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-[#222630] flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
