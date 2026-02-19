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

/**
 * Valores iniciales del formulario de insumo.
 * Se usan tanto al abrir el modal de creacion como al cancelar una edicion.
 * @type {Object}
 */
const emptyForm = {
  name: '',
  description: '',
  unit: 'unidad',
  pack_qty: '',
  pack_price: '',
  notes: '',
};

/**
 * Componente de la pagina de gestion de insumos adicionales.
 *
 * @description Presenta una tabla con todos los insumos registrados y un modal
 * para crear o editar insumos. Cada insumo se define por su precio de paquete
 * (pack_qty unidades a pack_price), y el sistema calcula price_per_unit en tiempo
 * real dentro del formulario como preview antes de guardar.
 *
 * La tabla muestra la informacion del paquete (cantidad y precio) y el precio
 * por unidad calculado con precision de 6 decimales (para insumos de bajo costo).
 *
 * @returns {JSX.Element} Pagina de gestion de insumos con tabla y modal de formulario
 */
export default function SuppliesPage() {
  /** @type {[Array, Function]} Lista de insumos cargados desde el backend */
  const [supplies, setSupplies] = useState([]);
  /** @type {[boolean, Function]} Controla la visibilidad del modal de creacion/edicion */
  const [showModal, setShowModal] = useState(false);
  /** @type {[Object|null, Function]} Insumo que se esta editando, o null si es creacion nueva */
  const [editing, setEditing] = useState(null);
  /**
   * Estado del formulario del modal.
   * @type {[Object, Function]}
   */
  const [form, setForm] = useState(emptyForm);

  /**
   * Precio por unidad calculado en tiempo real a partir de pack_qty y pack_price.
   * Se usa como preview dentro del modal antes de guardar.
   * Es null si los campos requeridos no estan completos o son invalidos.
   * @type {number|null}
   */
  const computedUnitPrice =
    form.pack_qty && form.pack_price && parseFloat(form.pack_qty) > 0
      ? parseFloat(form.pack_price) / parseFloat(form.pack_qty)
      : null;

  /**
   * Carga la lista de insumos desde el backend y actualiza el estado.
   * Muestra un toast de error si la peticion falla.
   *
   * @returns {Promise<void>}
   */
  const load = async () => {
    try {
      const res = await getSupplies();
      setSupplies(res.data);
    } catch {
      toast.error('Error cargando insumos');
    }
  };

  // Carga los insumos al montar el componente.
  useEffect(() => { load(); }, []);

  /**
   * Actualiza el campo del formulario correspondiente al input modificado.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e - Evento de cambio
   */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /**
   * Maneja el envio del formulario para crear o actualizar un insumo.
   * Valida que pack_qty y pack_price esten presentes antes de enviar.
   * Segun si hay un insumo en edicion, llama a updateSupply o createSupply.
   * Al terminar, cierra el modal, limpia el formulario y recarga la lista.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   * @returns {Promise<void>}
   */
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

  /**
   * Prepara el modal para editar un insumo existente.
   * Carga los datos del insumo en el formulario y abre el modal.
   *
   * @param {Object} s - Objeto del insumo a editar
   * @param {number} s.id - ID del insumo
   * @param {string} s.name - Nombre del insumo
   * @param {string|null} s.description - Descripcion del insumo
   * @param {string} s.unit - Unidad base del insumo
   * @param {number} s.pack_qty - Cantidad de unidades por paquete
   * @param {number} s.pack_price - Precio del paquete en USD
   * @param {string|null} s.notes - Notas adicionales
   */
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

  /**
   * Elimina un insumo tras pedir confirmacion al usuario.
   * Recarga la lista si la eliminacion es exitosa.
   *
   * @param {number} id - ID del insumo a eliminar
   * @returns {Promise<void>}
   */
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
        <h2 className="text-2xl font-bold text-tech-white">Insumos Adicionales</h2>
        <button
          onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
          className="tf-btn-primary"
        >
          <Plus size={18} /> Nuevo Insumo
        </button>
      </div>

      <p className="text-sm text-gunmetal mb-4">
        Materiales adicionales que se usan en las piezas: argollas, switches, imanes, insertos, etc.
        Se compran en paquetes y el sistema calcula el precio por unidad automáticamente.
      </p>

      <div className="tf-table-wrap">
        <table className="w-full min-w-[550px]">
          <thead className="tf-thead">
            <tr>
              <th className="tf-th">Nombre</th>
              <th className="tf-th">Descripción</th>
              <th className="tf-th">Unidad</th>
              <th className="tf-th-right">Paquete</th>
              <th className="tf-th-right">Precio / unidad</th>
              <th className="tf-th"></th>
            </tr>
          </thead>
          <tbody>
            {supplies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gunmetal">
                  No hay insumos registrados
                </td>
              </tr>
            )}
            {supplies.map((s) => (
              <tr key={s.id} className="tf-tr">
                <td className="tf-td font-medium text-tech-white">{s.name}</td>
                <td className="tf-td text-gunmetal text-sm">{s.description || '—'}</td>
                <td className="tf-td text-steel">{s.unit}</td>
                <td className="tf-td-right text-sm text-gunmetal">
                  {s.pack_qty && s.pack_price != null
                    ? <span className="flex items-center justify-end gap-1"><Package size={13} className="text-gunmetal" />{s.pack_qty} uds. · ${s.pack_price.toFixed(2)}</span>
                    : '—'}
                </td>
                <td className="tf-td-right font-mono font-semibold text-tech-white">
                  $ {s.price_per_unit.toFixed(6)}
                </td>
                <td className="tf-td-right">
                  <button onClick={() => handleEdit(s)} className="text-forge-green hover:text-deep-green mr-3 transition-colors"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(s.id)} className="tf-btn-danger"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="tf-section-title">{editing ? 'Editar Insumo' : 'Nuevo Insumo'}</h3>
              <button onClick={() => setShowModal(false)} className="tf-btn-ghost"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="tf-label">Nombre *</label>
                <input name="name" value={form.name} onChange={handleChange} required
                  placeholder="Ej: Argolla metálica 25mm"
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Descripción</label>
                <input name="description" value={form.description} onChange={handleChange}
                  placeholder="Ej: Argolla de acero inoxidable para keychains"
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Unidad base *</label>
                <select name="unit" value={form.unit} onChange={handleChange}
                  className="tf-input">
                  <option value="unidad">unidad</option>
                  <option value="pieza">pieza</option>
                  <option value="cm">cm</option>
                  <option value="gramo">gramo</option>
                </select>
                <p className="tf-hint">Qué representa "1" cuando lo añades a la calculadora</p>
              </div>

              <hr className="tf-hr" />
              <p className="text-sm font-medium text-steel">Compra por paquete *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tf-label">Unidades en el paquete</label>
                  <input name="pack_qty" type="number" step="1" min="1" value={form.pack_qty} onChange={handleChange} required
                    placeholder="Ej: 50"
                    className="tf-input" />
                </div>
                <div>
                  <label className="tf-label">Precio del paquete (USD)</label>
                  <input name="pack_price" type="number" step="0.01" min="0" value={form.pack_price} onChange={handleChange} required
                    placeholder="Ej: 5.00"
                    className="tf-input" />
                </div>
              </div>

              {/* Preview del precio por unidad calculado en tiempo real */}
              <div className={`rounded-lg px-4 py-3 text-sm flex justify-between items-center ${computedUnitPrice !== null ? 'bg-forge-green/10 border border-forge-green/20' : 'bg-[#0d1014] border border-[#2e3238]'}`}>
                <span className="text-steel">Precio por {form.unit}:</span>
                <span className={`font-bold font-mono text-base ${computedUnitPrice !== null ? 'text-forge-green' : 'text-gunmetal'}`}>
                  {computedUnitPrice !== null
                    ? `$ ${computedUnitPrice.toFixed(6)}`
                    : '—'}
                </span>
              </div>

              <div>
                <label className="tf-label">Notas</label>
                <input name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Proveedor, referencia, color, etc."
                  className="tf-input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="tf-btn-secondary flex-1">Cancelar</button>
                <button type="submit"
                  className="tf-btn-primary flex-1">
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
