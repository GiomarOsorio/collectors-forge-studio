/**
 * @file Pagina de gestion del catalogo de insumos adicionales.
 *
 * Permite gestionar los materiales no plasticos que se incorporan
 * a las piezas impresas: argollas metalicas, switches, imanes, etc.
 * Los insumos se compran en paquetes (pack_qty unidades a pack_price),
 * y el sistema calcula automaticamente el precio por unidad.
 *
 * @module pages/SuppliesPage
 */

import { useState, useEffect } from 'react';
import { getSupplies, createSupply, updateSupply, deleteSupply } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Package } from 'lucide-react';

const emptyForm = {
  name: '',
  description: '',
  unit: 'unidad',
  pack_qty: '',
  pack_price: '',
  notes: '',
};

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Precio por unidad calculado en tiempo real para mostrar preview
  const computedUnitPrice =
    form.pack_qty && form.pack_price && parseFloat(form.pack_qty) > 0
      ? parseFloat(form.pack_price) / parseFloat(form.pack_qty)
      : null;

  const load = async () => {
    try {
      const res = await getSupplies();
      setSupplies(res.data);
    } catch {
      toast.error('Error cargando insumos');
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pack_qty || !form.pack_price) {
      toast.error('Debes indicar la cantidad y el precio del paquete');
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      pack_qty: parseInt(form.pack_qty),
      pack_price: parseFloat(form.pack_price),
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await updateSupply(editing.id, payload);
        toast.success('Insumo actualizado');
      } else {
        await createSupply(payload);
        toast.success('Insumo creado');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      unit: s.unit,
      pack_qty: s.pack_qty?.toString() || '',
      pack_price: s.pack_price?.toString() || '',
      notes: s.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este insumo?')) return;
    try {
      await deleteSupply(id);
      toast.success('Insumo eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Insumos Adicionales</h2>
        <button
          onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Nuevo Insumo
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Materiales adicionales que se usan en las piezas: argollas, switches, imanes, insertos, etc.
        Se compran en paquetes y el sistema calcula el precio por unidad automáticamente.
      </p>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-right">Paquete</th>
              <th className="px-4 py-3 text-right">Precio / unidad</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {supplies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay insumos registrados
                </td>
              </tr>
            )}
            {supplies.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">{s.description || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{s.unit}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">
                  {s.pack_qty && s.pack_price != null
                    ? <span className="flex items-center justify-end gap-1"><Package size={13} className="text-gray-400" />{s.pack_qty} uds. · ${s.pack_price.toFixed(2)}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                  $ {s.price_per_unit.toFixed(6)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700 mr-3"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">{editing ? 'Editar Insumo' : 'Nuevo Insumo'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input name="name" value={form.name} onChange={handleChange} required
                  placeholder="Ej: Argolla metálica 25mm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input name="description" value={form.description} onChange={handleChange}
                  placeholder="Ej: Argolla de acero inoxidable para keychains"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad base *</label>
                <select name="unit" value={form.unit} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="unidad">unidad</option>
                  <option value="pieza">pieza</option>
                  <option value="cm">cm</option>
                  <option value="gramo">gramo</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Qué representa "1" cuando lo añades a la calculadora</p>
              </div>

              <hr />
              <p className="text-sm font-medium text-gray-700">Compra por paquete *</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Unidades en el paquete</label>
                  <input name="pack_qty" type="number" step="1" min="1" value={form.pack_qty} onChange={handleChange} required
                    placeholder="Ej: 50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Precio del paquete (USD)</label>
                  <input name="pack_price" type="number" step="0.01" min="0" value={form.pack_price} onChange={handleChange} required
                    placeholder="Ej: 5.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Preview del precio por unidad */}
              <div className={`rounded-lg px-4 py-3 text-sm flex justify-between items-center ${computedUnitPrice !== null ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                <span className="text-gray-600">Precio por {form.unit}:</span>
                <span className={`font-bold font-mono text-base ${computedUnitPrice !== null ? 'text-blue-700' : 'text-gray-400'}`}>
                  {computedUnitPrice !== null
                    ? `$ ${computedUnitPrice.toFixed(6)}`
                    : '—'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <input name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Proveedor, referencia, color, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
