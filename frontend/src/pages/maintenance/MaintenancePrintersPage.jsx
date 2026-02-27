/**
 * @file Página de gestión de impresoras del módulo de mantenimiento.
 *
 * Permite crear, editar y eliminar impresoras. También permite
 * actualizar las horas actuales mediante un modal dedicado.
 *
 * @module pages/maintenance/MaintenancePrintersPage
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Pencil, Trash2, Clock, X, Printer } from 'lucide-react';
import {
  getMaintenancePrinters,
  createMaintenancePrinter,
  updateMaintenancePrinter,
  deleteMaintenancePrinter,
} from '../../services/api';

/** Estado vacío del formulario de impresora */
const EMPTY_FORM = { name: '', model: '', current_hours: '0', notes: '' };

/**
 * Página de gestión de impresoras de mantenimiento.
 * @returns {JSX.Element}
 */
export default function MaintenancePrintersPage() {
  const confirm = useConfirm();
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = crear, obj = editar
  const [hoursTarget, setHoursTarget] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [hoursValue, setHoursValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getMaintenancePrinters();
      setPrinters(res.data);
    } catch {
      toast.error('Error al cargar las impresoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (printer) => {
    setEditing(printer);
    setForm({
      name: printer.name,
      model: printer.model ?? '',
      current_hours: String(printer.current_hours),
      notes: printer.notes ?? '',
    });
    setModalOpen(true);
  };

  const openHoursModal = (printer) => {
    setHoursTarget(printer);
    setHoursValue(String(printer.current_hours));
    setHoursModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        model: form.model.trim() || null,
        current_hours: parseFloat(form.current_hours) || 0,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await updateMaintenancePrinter(editing.id, payload);
        toast.success('Impresora actualizada');
      } else {
        await createMaintenancePrinter(payload);
        toast.success('Impresora creada');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al guardar la impresora');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMaintenancePrinter(hoursTarget.id, {
        current_hours: parseFloat(hoursValue) || 0,
      });
      toast.success('Horas actualizadas');
      setHoursModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al actualizar las horas');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (printer) => {
    const ok = await confirm({
      title: 'Eliminar impresora',
      message: `¿Eliminar "${printer.name}"? Se eliminarán también todos sus registros de mantenimiento.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMaintenancePrinter(printer.id);
      toast.success('Impresora eliminada');
      load();
    } catch {
      toast.error('Error al eliminar la impresora');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Impresoras</h1>
          <p className="text-steel text-sm mt-1">Gestiona las impresoras registradas en el módulo de mantenimiento.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Plus size={16} /> Nueva impresora
        </button>
      </div>

      {loading ? (
        <p className="text-steel">Cargando...</p>
      ) : printers.length === 0 ? (
        <div className="text-center py-16">
          <Printer size={48} className="mx-auto text-gunmetal mb-4" />
          <p className="text-steel">No hay impresoras registradas.</p>
          <button onClick={openCreate} className="mt-4 text-violet-400 hover:text-violet-300 text-sm">
            + Agregar primera impresora
          </button>
        </div>
      ) : (
        <div className="bg-[#0d1014] rounded-xl border border-[#1e2125] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2125]">
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Modelo</th>
                <th className="text-right px-4 py-3 text-gunmetal font-medium">Horas actuales</th>
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <tr key={p.id} className="border-b border-[#1e2125] hover:bg-[#1a1d21] transition-colors">
                  <td className="px-4 py-3 text-tech-white font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-steel">{p.model ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-violet-400 font-mono font-semibold">{Number(p.current_hours).toFixed(1)} h</span>
                  </td>
                  <td className="px-4 py-3 text-steel text-xs max-w-xs truncate">{p.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openHoursModal(p)}
                        className="p-1.5 rounded text-steel hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                        title="Actualizar horas"
                      >
                        <Clock size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded text-steel hover:text-tech-white hover:bg-[#1e2125] transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded text-steel hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar impresora */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2125]">
              <h2 className="text-tech-white font-semibold">
                {editing ? 'Editar impresora' : 'Nueva impresora'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gunmetal mb-1">Nombre *</label>
                <input
                  className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mi BambuLab P2S Combo"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Modelo</label>
                <input
                  className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="P2S Combo"
                />
              </div>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Horas actuales</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={form.current_hours}
                  onChange={(e) => setForm({ ...form, current_hours: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Notas</label>
                <textarea
                  rows={3}
                  className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observaciones opcionales..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2a2d31] text-steel hover:text-tech-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal actualizar horas */}
      {hoursModalOpen && hoursTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2125]">
              <h2 className="text-tech-white font-semibold">Actualizar horas</h2>
              <button onClick={() => setHoursModalOpen(false)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveHours} className="p-6 space-y-4">
              <p className="text-steel text-sm">{hoursTarget.name}</p>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Horas actuales *</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  className="w-full bg-[#1a1d21] border border-[#2a2d31] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={hoursValue}
                  onChange={(e) => setHoursValue(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHoursModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2a2d31] text-steel hover:text-tech-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
