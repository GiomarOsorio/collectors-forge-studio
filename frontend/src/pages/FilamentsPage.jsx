/**
 * @file Pagina de gestion de filamentos de impresion 3D.
 *
 * Permite al usuario realizar operaciones CRUD (crear, leer, actualizar, eliminar)
 * sobre sus filamentos de impresion 3D. Muestra una tabla con todos los filamentos
 * registrados y un formulario modal para agregar o editar filamentos.
 *
 * Cada filamento tiene propiedades como marca, tipo de material (PLA, PETG, ABS, etc.),
 * color, precio por kilogramo, peso por rollo, diametro y densidad.
 *
 * @module pages/FilamentsPage
 */

import { useState, useEffect } from 'react';
import { getFilaments, createFilament, updateFilament, deleteFilament } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

/**
 * Valores iniciales del formulario de filamento.
 * Se usa tanto para crear nuevos filamentos como para resetear el formulario.
 * Los valores por defecto (PLA, 1000g, 1.75mm, densidad 1.24) representan
 * los parametros mas comunes para un rollo de filamento PLA estandar.
 * @type {Object}
 */
const emptyForm = {
  brand: '', type: 'PLA', color: '', price_per_kg: '',
  weight_per_roll: '1000', diameter: '1.75', density: '1.24', notes: '',
};

/**
 * Lista de tipos de filamento disponibles para seleccionar en el formulario.
 * Incluye los materiales de impresion 3D mas utilizados.
 * @type {string[]}
 */
const filamentTypes = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PLA+', 'PETG+', 'Otro'];

/**
 * Componente de la pagina de gestion de filamentos.
 *
 * @description Muestra una tabla con todos los filamentos del usuario y
 * proporciona un formulario modal para crear o editar filamentos.
 * Incluye funcionalidad de eliminacion con confirmacion.
 *
 * @returns {JSX.Element} Pagina completa de gestion de filamentos
 */
export default function FilamentsPage() {
  /** @type {[Array, Function]} Lista de filamentos obtenidos del backend */
  const [filaments, setFilaments] = useState([]);
  /** @type {[boolean, Function]} Controla la visibilidad del formulario modal */
  const [showForm, setShowForm] = useState(false);
  /** @type {[number|null, Function]} ID del filamento en edicion, o null si es creacion nueva */
  const [editingId, setEditingId] = useState(null);
  /** @type {[Object, Function]} Estado actual del formulario de filamento */
  const [form, setForm] = useState(emptyForm);

  /**
   * Carga la lista de filamentos desde el backend y actualiza el estado.
   */
  const load = () => getFilaments().then((res) => setFilaments(res.data));

  // Carga los filamentos al montar el componente
  useEffect(() => { load(); }, []);

  /**
   * Actualiza el campo correspondiente del formulario al cambiar un input.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} e - Evento de cambio
   */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /**
   * Maneja el envio del formulario para crear o actualizar un filamento.
   * Convierte los valores string del formulario a numeros antes de enviar al backend.
   * Tras una operacion exitosa, cierra el modal, resetea el formulario y recarga la lista.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
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

  /**
   * Prepara el formulario para editar un filamento existente.
   * Carga los datos del filamento en el formulario y abre el modal.
   *
   * @param {Object} f - Objeto del filamento a editar con todas sus propiedades
   */
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

  /**
   * Elimina un filamento previa confirmacion del usuario.
   * Muestra un dialogo de confirmacion antes de proceder con la eliminacion.
   *
   * @param {number} id - ID del filamento a eliminar
   */
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingId ? 'Editar' : 'Nuevo'} Filamento</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[500px]">
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
