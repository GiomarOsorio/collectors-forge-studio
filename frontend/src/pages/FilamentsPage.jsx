import { useState, useEffect } from 'react';
import { getFilaments, createFilament, updateFilament, deleteFilament } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const emptyForm = {
  brand: '', type: 'PLA', color: '', price_per_kg: '',
  weight_per_roll: '1000', diameter: '1.75', density: '1.24', notes: '',
};

const filamentTypes = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PLA+', 'PETG+', 'Otro'];

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => getFilaments().then((res) => setFilaments(res.data));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      price_per_kg: parseFloat(form.price_per_kg),
      weight_per_roll: parseFloat(form.weight_per_roll),
      diameter: parseFloat(form.diameter),
      density: parseFloat(form.density),
      notes: form.notes || null,
    };
    try {
      if (editingId) {
        await updateFilament(editingId, data);
        toast.success('Filamento actualizado');
      } else {
        await createFilament(data);
        toast.success('Filamento creado');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleEdit = (f) => {
    setForm({
      brand: f.brand, type: f.type, color: f.color,
      price_per_kg: f.price_per_kg.toString(),
      weight_per_roll: f.weight_per_roll.toString(),
      diameter: f.diameter.toString(),
      density: f.density.toString(),
      notes: f.notes || '',
    });
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este filamento?')) return;
    try {
      await deleteFilament(id);
      toast.success('Filamento eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Filamentos</h2>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={20} /> Agregar
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingId ? 'Editar' : 'Nuevo'} Filamento</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                  <input name="brand" value={form.brand} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select name="type" value={form.type} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    {filamentTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color *</label>
                  <input name="color" value={form.color} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio por kg ($) *</label>
                  <input name="price_per_kg" type="number" step="0.01" value={form.price_per_kg} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso por rollo (g)</label>
                  <input name="weight_per_roll" type="number" value={form.weight_per_roll} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diámetro (mm)</label>
                  <input name="diameter" type="number" step="0.01" value={form.diameter} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                {editingId ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Marca</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Tipo</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Color</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Precio/kg</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filaments.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{f.brand}</td>
                <td className="px-6 py-4">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{f.type}</span>
                </td>
                <td className="px-6 py-4 text-gray-600">{f.color}</td>
                <td className="px-6 py-4 text-right font-medium">$ {f.price_per_kg.toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleEdit(f)} className="text-gray-400 hover:text-blue-600 mr-2"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(f.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {filaments.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay filamentos. Agrega uno para comenzar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
