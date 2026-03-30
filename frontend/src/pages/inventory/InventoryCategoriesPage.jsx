/**
 * @file Página de gestión de categorías de inventario.
 *
 * Permite crear, editar y eliminar categorías de inventario configurables
 * por empresa. Las categorías de sistema (ej: Filamento) no pueden eliminarse
 * ni renombrarse, pero sí actualizarse en el flag allows_decimals.
 *
 * @module pages/inventory/InventoryCategoriesPage
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Pencil, Trash2, X, Tags, Shield } from 'lucide-react';
import {
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
} from '../../services/api';

/** Formulario vacío para crear/editar */
const EMPTY_FORM = {
  name: '',
  allows_decimals: false,
};

/**
 * Página de gestión de categorías de inventario.
 * @returns {JSX.Element}
 */
export default function InventoryCategoriesPage() {
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getInventoryCategories();
      setCategories(res.data);
    } catch {
      toast.error('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditCat(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditCat(cat);
    setForm({ name: cat.name, allows_decimals: cat.allows_decimals });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editCat) {
        await updateInventoryCategory(editCat.id, {
          name: editCat.is_system ? undefined : form.name.trim(),
          allows_decimals: form.allows_decimals,
        });
        toast.success('Categoría actualizada');
      } else {
        await createInventoryCategory({
          name: form.name.trim(),
          allows_decimals: form.allows_decimals,
        });
        toast.success('Categoría creada');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!await confirm(`¿Eliminar la categoría "${cat.name}"?`, 'Eliminar')) return;
    try {
      await deleteInventoryCategory(cat.id);
      toast.success('Categoría eliminada');
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'Error al eliminar');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="tf-page-title mb-0">Categorías de inventario</h2>
          <p className="text-sm text-steel mt-1">
            Define las categorías y si admiten cantidades decimales (ej: gramos de filamento).
          </p>
        </div>
        <button onClick={openCreate} className="tf-btn-primary gap-2">
          <Plus size={18} /> Nueva categoría
        </button>
      </div>

      <div className="tf-table-wrap">
        <table className="w-full min-w-[500px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">Nombre</th>
              <th className="tf-th">Decimales</th>
              <th className="tf-th hidden sm:table-cell">Tipo</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gunmetal">Cargando...</td></tr>
            )}
            {!loading && categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-gunmetal">
                  No hay categorías. <button onClick={openCreate} className="text-blue-400 hover:underline">Crear la primera</button>
                </td>
              </tr>
            )}
            {categories.map((cat) => (
              <tr key={cat.id} className="tf-tr">
                <td className="tf-td">
                  <div className="flex items-center gap-2">
                    <Tags size={15} className="text-steel shrink-0" />
                    <span className="font-medium text-tech-white">{cat.name}</span>
                  </div>
                </td>
                <td className="tf-td">
                  {cat.allows_decimals ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Sí (ej: gramos)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#222630] text-steel border border-[#2A2F38]">
                      No (enteros)
                    </span>
                  )}
                </td>
                <td className="tf-td hidden sm:table-cell">
                  {cat.is_system ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Shield size={10} /> Sistema
                    </span>
                  ) : (
                    <span className="text-gunmetal text-xs">Personalizada</span>
                  )}
                </td>
                <td className="tf-td-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(cat)}
                      className="tf-btn-ghost p-1.5"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={cat.is_system}
                      className={`p-1.5 rounded transition-colors ${
                        cat.is_system
                          ? 'text-gunmetal cursor-not-allowed opacity-40'
                          : 'tf-btn-danger'
                      }`}
                      title={cat.is_system ? 'Las categorías del sistema no pueden eliminarse' : 'Eliminar'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="tf-section-title mb-0 flex items-center gap-2">
                <Tags size={18} className="text-blue-400" />
                {editCat ? 'Editar categoría' : 'Nueva categoría'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="tf-btn-ghost">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="tf-label">Nombre *</label>
                {editCat?.is_system ? (
                  <input
                    value={form.name}
                    readOnly
                    className="tf-input opacity-60 cursor-not-allowed"
                    title="Las categorías del sistema no pueden renombrarse"
                  />
                ) : (
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="tf-input"
                    placeholder="Ej: Tornillería, Electrónica, Pintura"
                    autoFocus
                  />
                )}
                {editCat?.is_system && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <Shield size={11} /> Las categorías del sistema no pueden renombrarse.
                  </p>
                )}
              </div>

              <div>
                <label className="tf-label flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.allows_decimals}
                    onChange={(e) => setForm({ ...form, allows_decimals: e.target.checked })}
                    className="rounded"
                  />
                  Permite cantidades decimales
                </label>
                <p className="text-xs text-gunmetal mt-1">
                  Actívalo si los ítems de esta categoría se miden en fracciones
                  (ej: gramos de filamento). Desactívalo para obligar cantidades enteras
                  (unidades, piezas, etc.).
                </p>
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
                  {saving ? 'Guardando...' : editCat ? 'Actualizar' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
