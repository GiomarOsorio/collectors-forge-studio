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
import { Layers, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';

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
  const confirm = useConfirm();
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
    if (!await confirm('¿Eliminar este filamento?', 'Eliminar')) return;
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
        <h2 className="text-2xl font-bold text-tech-white">Filamentos</h2>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="tf-btn-primary">
          <Plus size={20} /> Agregar
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="tf-section-title">{editingId ? 'Editar' : 'Nuevo'} Filamento</h3>
              <button onClick={() => setShowForm(false)} className="tf-btn-ghost"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tf-label">Marca *</label>
                  <input name="brand" value={form.brand} onChange={handleChange} required
                    className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Tipo *</label>
                  <select name="type" value={form.type} onChange={handleChange}
                    className="tf-input">
                    {filamentTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="tf-label">Color *</label>
                  <input name="color" value={form.color} onChange={handleChange} required
                    className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Precio por kg ($) *</label>
                  <input name="price_per_kg" type="number" step="0.01" value={form.price_per_kg} onChange={handleChange} required
                    className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Peso por rollo (g)</label>
                  <input name="weight_per_roll" type="number" value={form.weight_per_roll} onChange={handleChange}
                    className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Diámetro (mm)</label>
                  <input name="diameter" type="number" step="0.01" value={form.diameter} onChange={handleChange}
                    className="tf-input" />
                </div>
              </div>
              <div>
                <label className="tf-label">Notas</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  className="tf-input" />
              </div>
              <button type="submit"
                className="tf-btn-primary w-full">
                {editingId ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[500px]">
          <thead className="tf-thead">
            <tr>
              <th className="tf-th">Marca</th>
              <th className="tf-th">Tipo</th>
              <th className="tf-th">Color</th>
              <th className="tf-th-right">Precio/kg</th>
              <th className="tf-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filaments.map((f) => (
              <tr key={f.id} className="tf-tr">
                <td className="tf-td font-medium text-tech-white">{f.brand}</td>
                <td className="tf-td">
                  <span className="tf-badge-green">{f.type}</span>
                </td>
                <td className="tf-td text-steel">{f.color}</td>
                <td className="tf-td-right font-medium text-tech-white">$ {f.price_per_kg.toFixed(2)}</td>
                <td className="tf-td-right">
                  <button onClick={() => handleEdit(f)} className="tf-btn-ghost mr-2"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(f.id)} className="tf-btn-danger"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {filaments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="p-4 rounded-2xl bg-[#222630]">
                      <Layers size={32} className="text-gunmetal" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-semibold text-steel">Sin filamentos aún</p>
                      <p className="text-xs text-gunmetal mt-1">Agrega el primer filamento para usarlo en la calculadora.</p>
                    </div>
                    <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="tf-btn-primary gap-2 mt-1">
                      <Plus size={14} />
                      Agregar primer filamento
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
