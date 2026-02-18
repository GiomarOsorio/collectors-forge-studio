import { useState, useEffect } from 'react';
import { getPrinters, createPrinter, updatePrinter, deletePrinter } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const emptyForm = {
  name: '', model: '', purchase_price: '', power_consumption_watts: '',
  estimated_lifespan_hours: '5000', current_hours: '0',
  nozzle_price: '0', nozzle_lifespan_hours: '500',
  buildplate_price: '0', buildplate_lifespan_hours: '2000',
  other_maintenance_per_hour: '0', notes: '',
};

export default function PrintersPage() {
  const [printers, setPrinters] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => getPrinters().then((res) => setPrinters(res.data));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {};
    for (const [key, val] of Object.entries(form)) {
      data[key] = key === 'name' || key === 'model' || key === 'notes'
        ? (val || (key === 'notes' ? null : val))
        : parseFloat(val) || 0;
    }
    if (!data.notes) data.notes = null;
    try {
      if (editingId) {
        await updatePrinter(editingId, data);
        toast.success('Impresora actualizada');
      } else {
        await createPrinter(data);
        toast.success('Impresora creada');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleEdit = (p) => {
    const f = {};
    for (const key of Object.keys(emptyForm)) {
      f[key] = p[key] != null ? p[key].toString() : '';
    }
    setForm(f);
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta impresora?')) return;
    try {
      await deletePrinter(id);
      toast.success('Impresora eliminada');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Impresoras</h2>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={20} /> Agregar
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingId ? 'Editar' : 'Nueva'} Impresora</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input name="name" value={form.name} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                  <input name="model" value={form.model} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio de compra ($) *</label>
                  <input name="purchase_price" type="number" step="0.01" value={form.purchase_price} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consumo (watts) *</label>
                  <input name="power_consumption_watts" type="number" value={form.power_consumption_watts} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vida útil (horas)</label>
                  <input name="estimated_lifespan_hours" type="number" value={form.estimated_lifespan_hours} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas de uso actual</label>
                  <input name="current_hours" type="number" value={form.current_hours} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <h4 className="font-medium text-gray-700 mt-4">Mantenimiento</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio boquilla ($)</label>
                  <input name="nozzle_price" type="number" step="0.01" value={form.nozzle_price} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vida boquilla (h)</label>
                  <input name="nozzle_lifespan_hours" type="number" value={form.nozzle_lifespan_hours} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio placa ($)</label>
                  <input name="buildplate_price" type="number" step="0.01" value={form.buildplate_price} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vida placa (h)</label>
                  <input name="buildplate_lifespan_hours" type="number" value={form.buildplate_lifespan_hours} onChange={handleChange}
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

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {printers.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
                <p className="text-gray-500 text-sm">{p.model}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(p)} className="text-gray-400 hover:text-blue-600"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Costo:</span> <span className="font-medium">$ {p.purchase_price.toFixed(2)}</span></div>
              <div><span className="text-gray-500">Consumo:</span> <span className="font-medium">{p.power_consumption_watts} W</span></div>
              <div><span className="text-gray-500">Vida útil:</span> <span className="font-medium">{p.estimated_lifespan_hours} h</span></div>
              <div><span className="text-gray-500">Horas usadas:</span> <span className="font-medium">{p.current_hours} h</span></div>
            </div>
            {p.notes && <p className="mt-3 text-sm text-gray-400">{p.notes}</p>}
          </div>
        ))}
        {printers.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            No hay impresoras configuradas.
          </div>
        )}
      </div>
    </div>
  );
}
