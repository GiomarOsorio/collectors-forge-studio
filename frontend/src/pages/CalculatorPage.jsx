/**
 * @file Pagina principal de la calculadora de costos de impresion 3D.
 *
 * Contiene el formulario para ingresar los parametros de una pieza
 * (filamento del inventario, impresora, peso, tiempos, cantidad, margen) y
 * muestra el desglose completo de costos calculado por el backend.
 * Permite guardar la cotizacion en el historial.
 *
 * Los filamentos se obtienen del inventario (category="Filamento") usando
 * inventory_item_id. Los insumos tambien provienen del inventario (cualquier
 * categoria distinta a "Filamento").
 *
 * @module pages/CalculatorPage
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getInventoryFilaments,
  getInventoryItems,
  getPrinters,
  getSettings,
  calculateQuote,
  createQuote,
} from '../services/api';
import toast from 'react-hot-toast';
import { Calculator, Save, Plus, Trash2, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import { formatQuantity } from '../utils/format';

/**
 * Componente de la pagina de calculadora de costos.
 *
 * @description Pagina principal de la aplicacion. Presenta un formulario
 * de dos columnas donde el usuario ingresa los datos de la pieza a imprimir
 * y visualiza el desglose de costos resultante.
 *
 * Al montarse, carga en paralelo los filamentos del inventario, impresoras
 * y configuracion del usuario para prellenar los selectores del formulario.
 * Los filamentos son items de inventario con category="Filamento".
 * Los insumos son items de inventario con cualquier otra categoria.
 *
 * El flujo de uso es:
 * 1. Completar los datos de la pieza (nombre, filamento, impresora, peso, tiempos)
 * 2. Presionar "Calcular Costo" para obtener el desglose
 * 3. Opcionalmente guardar la cotizacion en el historial
 *
 * @returns {JSX.Element} Formulario de calculadora y panel de resultados
 */
export default function CalculatorPage() {
  const [searchParams] = useSearchParams();
  /** @type {[Array, Function]} Lista de items de inventario tipo Filamento */
  const [filaments, setFilaments] = useState([]);
  /** @type {[Array, Function]} Lista de impresoras disponibles del usuario */
  const [printers, setPrinters] = useState([]);
  /** @type {[Object|null, Function]} Configuracion de la aplicacion (tarifas, margenes) */
  const [settings, setSettings] = useState(null);
  /**
   * @type {[Array, Function]} Catalogo de insumos (items de inventario que no son Filamento ni Consumible)
   */
  const [supplies, setSupplies] = useState([]);
  /**
   * @type {[Array, Function]} Consumibles del inventario (desgaste por horas de impresión)
   */
  const [consumables, setConsumables] = useState([]);
  /**
   * @type {[Array, Function]} IDs de consumibles seleccionados para esta cotización
   */
  const [selectedConsumables, setSelectedConsumables] = useState([]);
  /**
   * @type {[Array, Function]} Insumos seleccionados para esta cotizacion
   * Cada elemento: {inventory_item_id: string, quantity: number}
   */
  const [selectedSupplies, setSelectedSupplies] = useState([]);
  /**
   * @type {[Array, Function]} Filamentos adicionales para pieza multicolor
   * Cada elemento: {inventory_item_id: string, weight_grams: number}
   */
  const [additionalFilaments, setAdditionalFilaments] = useState([]);
  /** @type {[Object|null, Function]} Resultado del calculo de costos devuelto por el backend */
  const [result, setResult] = useState(null);
  /** @type {[boolean, Function]} Estado de carga durante el calculo */
  const [loading, setLoading] = useState(false);
  /** @type {[boolean, Function]} Estado de carga durante el guardado */
  const [saving, setSaving] = useState(false);
  /** @type {[boolean, Function]} Carga inicial de datos (filamentos, impresoras, config) */
  const [initialLoading, setInitialLoading] = useState(true);

  /**
   * Estado del formulario con los parametros de la pieza a cotizar.
   * Los valores se almacenan como strings para compatibilidad con los inputs HTML.
   * inventory_item_id referencia el item de inventario (filamento) seleccionado.
   */
  const [form, setForm] = useState({
    piece_name: '',
    description: '',
    client_name: '',
    inventory_item_id: '',
    printer_id: '',
    weight_grams: '',
    print_time_minutes: '',
    preparation_time_minutes: '0',
    post_processing_time_minutes: '0',
    quantity: '1',
    margin_percent: '',
    color_changes: '0',
  });

  /**
   * Estado temporal para el insumo que se esta por agregar a la cotizacion.
   * Se resetea a valores vacios tras cada llamada a addSupply.
   * @type {[{inventory_item_id: string, quantity: number}, Function]}
   */
  const [supplyToAdd, setSupplyToAdd] = useState({ inventory_item_id: '', quantity: 1 });
  /**
   * Estado temporal para el filamento adicional que se esta por agregar.
   * Se resetea a valores vacios tras cada llamada a addFilament.
   * @type {[{inventory_item_id: string, weight_grams: string}, Function]}
   */
  const [filamentToAdd, setFilamentToAdd] = useState({ inventory_item_id: '', weight_grams: '' });
  const [consumableToAdd, setConsumableToAdd] = useState('');

  /**
   * Genera la etiqueta de nombre para un item de inventario tipo Filamento.
   * Usa los campos especificos de filamento si existen, de lo contrario usa item.name.
   *
   * @param {Object} item - Item de inventario
   * @returns {string} Etiqueta legible para mostrar en el selector
   */
  const filamentLabel = (item) => {
    const brand = item.filament_brand || '';
    const type = item.filament_type || '';
    const color = item.filament_color || item.name;
    if (brand || type) {
      return `${brand} ${type} - ${color}`.trim();
    }
    return item.name;
  };

  // Carga inicial: obtiene filamentos del inventario, todos los items (para insumos),
  // impresoras y configuracion en paralelo.
  // Preselecciona el primer filamento y la primera impresora si existen,
  // y establece el margen de ganancia por defecto segun la configuracion.
  // Si hay URL params provenientes del Slicer (?weight_grams, ?print_time_hours,
  // ?filament_type), los aplica tras cargar los datos.
  useEffect(() => {
    Promise.all([getInventoryFilaments(), getInventoryItems(), getPrinters(), getSettings()])
      .then(([fRes, allRes, pRes, sRes]) => {
        const filamentItems = [...fRes.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        // Los insumos son items que NO son Filamento ni Consumible (los consumibles son automáticos)
        const supplyItems = allRes.data
          .filter((i) => i.category !== 'Filamento' && i.category !== 'Consumible')
          .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es'));
        const consumableItems = allRes.data
          .filter((i) => i.category === 'Consumible' && i.useful_life_hours > 0 && i.unit_cost_cal)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        const sortedPrinters = [...pRes.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));

        setFilaments(filamentItems);
        setSupplies(supplyItems);
        setConsumables(consumableItems);
        setPrinters(sortedPrinters);
        setSettings(sRes.data);

        // Valores base: primera impresora, primer filamento, margen por defecto
        const updates = { margin_percent: sRes.data.default_margin_percent };
        if (sortedPrinters.length > 0) updates.printer_id = sortedPrinters[0].id;
        if (filamentItems.length > 0) updates.inventory_item_id = filamentItems[0].id;

        // Aplicar URL params del Slicer si están presentes
        const weightGrams = searchParams.get('weight_grams');
        const printTimeHours = searchParams.get('print_time_hours');
        const filamentType = searchParams.get('filament_type');
        const inventoryItemId = searchParams.get('inventory_item_id');

        if (weightGrams) updates.weight_grams = parseFloat(weightGrams).toFixed(2);
        if (printTimeHours) {
          updates.print_time_minutes = Math.round(parseFloat(printTimeHours) * 60).toString();
        }

        const colorChanges = searchParams.get('color_changes');
        if (colorChanges) updates.color_changes = String(parseInt(colorChanges) || 0);

        // ID directo del inventario (viene del modal de mapeo)
        if (inventoryItemId && filamentItems.some((f) => f.id === parseInt(inventoryItemId))) {
          updates.inventory_item_id = parseInt(inventoryItemId);
        } else if (filamentType && filamentItems.length > 0) {
          // Fallback: match por tipo de filamento
          const match = filamentItems.find(
            (item) =>
              (item.filament_type || '').toLowerCase() === filamentType.toLowerCase() ||
              item.name.toLowerCase().includes(filamentType.toLowerCase()),
          );
          if (match) updates.inventory_item_id = match.id;
        }

        setForm((prev) => ({ ...prev, ...updates }));

        // Filamentos adicionales: primero buscar extra_id_N (IDs directos del modal)
        const extras = [];
        for (let i = 1; i <= 10; i++) {
          const eId = searchParams.get(`extra_id_${i}`);
          const eWeight = searchParams.get(`extra_weight_${i}`);
          if (eId && eWeight && filamentItems.some((f) => f.id === parseInt(eId))) {
            extras.push({
              inventory_item_id: parseInt(eId),
              weight_grams: parseFloat(eWeight),
            });
          } else if (!eId) {
            break;
          }
        }
        if (extras.length > 0) setAdditionalFilaments(extras);

        if (weightGrams || printTimeHours) {
          toast.success('Datos del Slicer cargados en la calculadora');
        }
      })
      .catch(() => toast.error('Error cargando datos'))
      .finally(() => setInitialLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Actualiza un campo del formulario cuando el usuario modifica un input.
   * Usa el atributo 'name' del elemento para identificar el campo.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} e - Evento de cambio
   */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /**
   * Construye el payload para enviar al backend a partir del estado del formulario.
   * Convierte los valores string del formulario a los tipos numericos que espera la API.
   * Los campos opcionales (description, client_name) se envian como null si estan vacios.
   *
   * Usa inventory_item_id para el filamento principal (en lugar de filament_id legacy).
   * Insumos: [{inventory_item_id, quantity}]
   * Filamentos adicionales: [{inventory_item_id, weight_grams}]
   *
   * @returns {Object} Objeto con los datos de la cotizacion en formato esperado por la API
   */
  const buildPayload = () => ({
    piece_name: form.piece_name,
    description: form.description || null,
    client_name: form.client_name || null,
    inventory_item_id: form.inventory_item_id,
    printer_id: parseInt(form.printer_id),
    weight_grams: parseFloat(form.weight_grams),
    print_time_hours: (parseFloat(form.print_time_minutes) || 0) / 60,
    preparation_time_hours: (parseFloat(form.preparation_time_minutes) || 0) / 60,
    post_processing_time_hours: (parseFloat(form.post_processing_time_minutes) || 0) / 60,
    quantity: parseInt(form.quantity) || 1,
    margin_percent: parseFloat(form.margin_percent),
    color_changes: parseInt(form.color_changes) || 0,
    supplies: selectedSupplies,
    additional_filaments: additionalFilaments,
    consumable_ids: selectedConsumables.map((c) => c.id),
  });

  /**
   * Agrega el insumo seleccionado en supplyToAdd al listado de insumos de la cotizacion.
   * Si el insumo ya existe en la lista, incrementa su cantidad en lugar de duplicarlo.
   * No hace nada si inventory_item_id esta vacio. Resetea supplyToAdd tras agregar.
   *
   * @returns {void}
   */
  const addSupply = () => {
    if (!supplyToAdd.inventory_item_id) return;
    const id = parseInt(supplyToAdd.inventory_item_id);
    const qty = Math.max(1, parseInt(supplyToAdd.quantity) || 1);
    const existing = selectedSupplies.find((s) => s.inventory_item_id === id);
    if (existing) {
      setSelectedSupplies(
        selectedSupplies.map((s) =>
          s.inventory_item_id === id ? { ...s, quantity: s.quantity + qty } : s
        )
      );
    } else {
      setSelectedSupplies([...selectedSupplies, { inventory_item_id: id, quantity: qty }]);
    }
    setSupplyToAdd({ inventory_item_id: '', quantity: 1 });
  };

  /**
   * Elimina un insumo del listado de insumos seleccionados para la cotizacion.
   *
   * @param {string} inventory_item_id - UUID del item de inventario a eliminar
   * @returns {void}
   */
  const removeSupply = (inventory_item_id) =>
    setSelectedSupplies(selectedSupplies.filter((s) => s.inventory_item_id !== inventory_item_id));

  /**
   * Agrega el filamento seleccionado en filamentToAdd al listado de filamentos
   * adicionales (para piezas multicolor). No hace nada si falta inventory_item_id
   * o weight_grams. Resetea filamentToAdd tras agregar.
   *
   * @returns {void}
   */
  const addFilament = () => {
    if (!filamentToAdd.inventory_item_id || !filamentToAdd.weight_grams) return;
    setAdditionalFilaments([
      ...additionalFilaments,
      {
        inventory_item_id: parseInt(filamentToAdd.inventory_item_id),
        weight_grams: parseFloat(filamentToAdd.weight_grams),
      },
    ]);
    setFilamentToAdd({ inventory_item_id: '', weight_grams: '' });
  };

  /**
   * Elimina un filamento adicional del listado por su posicion en el arreglo.
   *
   * @param {number} index - Indice del filamento a eliminar en additionalFilaments
   * @returns {void}
   */
  const removeFilament = (index) =>
    setAdditionalFilaments(additionalFilaments.filter((_, i) => i !== index));

  const addConsumable = () => {
    if (!consumableToAdd) return;
    const id = parseInt(consumableToAdd);
    if (selectedConsumables.some((c) => c.id === id)) return;
    const item = consumables.find((c) => c.id === id);
    if (item) setSelectedConsumables([...selectedConsumables, item]);
    setConsumableToAdd('');
  };

  const removeConsumable = (id) =>
    setSelectedConsumables(selectedConsumables.filter((c) => c.id !== id));

  /**
   * Maneja el envio del formulario para calcular los costos.
   * Valida que se haya seleccionado filamento (del inventario) e impresora antes de enviar.
   * El resultado se almacena en el estado 'result' para mostrarlo en el panel derecho.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!form.inventory_item_id || !form.printer_id) {
      toast.error('Debes tener al menos un filamento en inventario y una impresora');
      return;
    }
    setLoading(true);
    try {
      const res = await calculateQuote(buildPayload());
      setResult(res.data);
    } catch {
      toast.error('Error al calcular');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Limpia el formulario, los insumos y el resultado, volviendo al estado inicial.
   * Conserva filamento, impresora y margen por defecto para mayor comodidad.
   */
  const handleClear = () => {
    setForm({
      piece_name: '',
      description: '',
      client_name: '',
      inventory_item_id: '',
      printer_id: printers.length > 0 ? printers[0].id : '',
      weight_grams: '',
      print_time_minutes: '',
      preparation_time_minutes: '0',
      post_processing_time_minutes: '0',
      quantity: '1',
      margin_percent: settings?.default_margin_percent ?? '',
      color_changes: '0',
    });
    setSelectedSupplies([]);
    setAdditionalFilaments([]);
    setSelectedConsumables([]);
    setResult(null);
  };

  /**
   * Guarda la cotizacion actual en el historial del backend.
   * Envia los mismos datos del formulario al endpoint de creacion de cotizaciones.
   * Usa inventory_item_id para referenciar el filamento principal.
   */
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      // Incluir la tasa USD/COP ya calculada para que el backend
      // guarde exactamente lo que el usuario vio (A-05).
      if (result?.usd_to_cop_rate) {
        payload.usd_to_cop_rate = result.usd_to_cop_rate;
      }
      await createQuote(payload);
      toast.success('Cotización guardada en el historial');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Filamento actualmente seleccionado (para mostrar advertencia de stock bajo)
  const selectedFilament = filaments.find((f) => f.id === parseInt(form.inventory_item_id, 10));
  const filamentLowStock =
    selectedFilament &&
    parseFloat(selectedFilament.min_quantity) > 0 &&
    parseFloat(selectedFilament.quantity) < parseFloat(selectedFilament.min_quantity);

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-steel text-sm">Cargando calculadora…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="tf-page-title">Calculadora de Costos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <form onSubmit={handleCalculate} className="tf-card p-6 space-y-5">

          {/* — Sección: Pieza — */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Pieza</span>
              <div className="flex-1 h-px bg-[#222630]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="tf-label">Nombre de la pieza *</label>
                <input
                  name="piece_name"
                  value={form.piece_name}
                  onChange={handleChange}
                  required
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Cliente</label>
                <input
                  name="client_name"
                  value={form.client_name}
                  onChange={handleChange}
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Cantidad</label>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={handleChange}
                  className="tf-input"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="tf-label">Descripción</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="tf-input"
                />
              </div>
            </div>
          </div>

          {/* — Sección: Material & equipo — */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Material &amp; equipo</span>
              <div className="flex-1 h-px bg-[#222630]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tf-label">Filamento *</label>
                {filaments.length === 0 ? (
                  <div className="tf-input flex items-center gap-2 text-orange-400 text-sm">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>
                      Sin filamentos en inventario.{' '}
                      <a href="/inventory/stock" className="underline hover:text-orange-300">
                        Ir a Inventario → Stock
                      </a>{' '}
                      para registrar uno.
                    </span>
                  </div>
                ) : (
                  <>
                    <select
                      name="inventory_item_id"
                      value={form.inventory_item_id}
                      onChange={handleChange}
                      required
                      className="tf-input"
                    >
                      <option value="">Seleccionar...</option>
                      {filaments.map((f) => {
                        const sinStock =
                          parseFloat(f.quantity) === 0 && parseFloat(f.min_quantity) > 0;
                        return (
                          <option key={f.id} value={f.id} disabled={sinStock}>
                            {filamentLabel(f)}
                            {sinStock ? ' (Sin stock)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {filamentLowStock && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-2 py-1">
                        <AlertTriangle size={12} />
                        Stock bajo — solo{' '}
                        {formatQuantity(selectedFilament.quantity)}{' '}
                        {selectedFilament.unit} disponible
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="tf-label">Impresora *</label>
                <select
                  name="printer_id"
                  value={form.printer_id}
                  onChange={handleChange}
                  required
                  className="tf-input"
                >
                  <option value="">Seleccionar...</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tf-label">Peso filamento (g) *</label>
                <input
                  name="weight_grams"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.weight_grams}
                  onChange={handleChange}
                  required
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Margen de ganancia (%)</label>
                <input
                  name="margin_percent"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.margin_percent}
                  onChange={handleChange}
                  className="tf-input"
                />
              </div>
            </div>
          </div>

          {/* — Sección: Tiempos — */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Tiempos</span>
              <div className="flex-1 h-px bg-[#222630]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="tf-label">Impresión (min) *</label>
                <input
                  name="print_time_minutes"
                  type="number"
                  step="1"
                  min="0"
                  value={form.print_time_minutes}
                  onChange={handleChange}
                  required
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Preparación (min)</label>
                <input
                  name="preparation_time_minutes"
                  type="number"
                  step="1"
                  min="0"
                  value={form.preparation_time_minutes}
                  onChange={handleChange}
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Post-procesado (min)</label>
                <input
                  name="post_processing_time_minutes"
                  type="number"
                  step="1"
                  min="0"
                  value={form.post_processing_time_minutes}
                  onChange={handleChange}
                  className="tf-input"
                />
              </div>
              <div>
                <label className="tf-label">Cambios de color</label>
                <input
                  name="color_changes"
                  type="number"
                  step="1"
                  min="0"
                  value={form.color_changes}
                  onChange={handleChange}
                  className="tf-input"
                />
                <p className="text-xs text-gunmetal mt-1">
                  +3 min c/u (purga). Suma{' '}
                  {((parseInt(form.color_changes) || 0) * 3).toLocaleString('es-CO')} min al
                  tiempo efectivo.
                </p>
              </div>
            </div>
          </div>

          {/* — Sección: Adicionales — */}
          {filaments.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Filamentos adicionales</span>
                  <span className="text-xs text-gunmetal">(multicolor)</span>
                  <div className="flex-1 h-px bg-[#222630]" />
                </div>
                {additionalFilaments.map((af, i) => {
                  const f = filaments.find((x) => x.id === af.inventory_item_id);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 mb-1 text-sm bg-[#0A0E16] border border-[#222630] px-3 py-1.5 rounded-lg"
                    >
                      <span className="flex-1 text-steel">
                        {f ? filamentLabel(f) : af.inventory_item_id}
                      </span>
                      <span className="text-gunmetal">{af.weight_grams} g</span>
                      <button
                        type="button"
                        onClick={() => removeFilament(i)}
                        className="text-gunmetal hover:text-red-400 ml-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 mt-1">
                  <select
                    value={filamentToAdd.inventory_item_id}
                    onChange={(e) =>
                      setFilamentToAdd({ ...filamentToAdd, inventory_item_id: e.target.value })
                    }
                    className="tf-input flex-1"
                  >
                    <option value="">Filamento...</option>
                    {filaments.map((f) => (
                      <option key={f.id} value={f.id}>
                        {filamentLabel(f)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="g"
                    value={filamentToAdd.weight_grams}
                    onChange={(e) =>
                      setFilamentToAdd({ ...filamentToAdd, weight_grams: e.target.value })
                    }
                    className="tf-input w-full sm:w-20"
                  />
                  <button
                    type="button"
                    onClick={addFilament}
                    className="tf-btn-secondary px-3 py-1.5 text-sm"
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Insumos adicionales del inventario */}
          {supplies.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Insumos adicionales</span>
                  <div className="flex-1 h-px bg-[#222630]" />
                </div>
                {selectedSupplies.map((si) => {
                  const sup = supplies.find((x) => x.id === si.inventory_item_id);
                  const price = sup
                    ? (sup.price_per_unit ?? sup.unit_cost ?? 0)
                    : 0;
                  return (
                    <div
                      key={si.inventory_item_id}
                      className="flex items-center gap-2 mb-1 text-sm bg-[#0A0E16] border border-[#222630] px-3 py-1.5 rounded-lg"
                    >
                      <span className="flex-1 text-steel">{sup ? sup.name : si.inventory_item_id}</span>
                      <span className="text-gunmetal">
                        {si.quantity} {sup?.unit || ''}
                      </span>
                      {sup && (
                        <span className="text-forge-teal font-mono text-xs">
                          ${(price * si.quantity).toFixed(4)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSupply(si.inventory_item_id)}
                        className="text-gunmetal hover:text-red-400 ml-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 mt-1">
                  <select
                    value={supplyToAdd.inventory_item_id}
                    onChange={(e) =>
                      setSupplyToAdd({ ...supplyToAdd, inventory_item_id: e.target.value })
                    }
                    className="tf-input flex-1"
                  >
                    <option value="">Insumo...</option>
                    {Object.entries(
                      supplies.reduce((acc, s) => {
                        const cat = s.category || 'Sin categoría';
                        (acc[cat] = acc[cat] || []).push(s);
                        return acc;
                      }, {})
                    ).map(([category, items]) => (
                      <optgroup key={category} label={category}>
                        {items.map((s) => {
                          const price = s.price_per_unit ?? s.unit_cost ?? 0;
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} — ${parseFloat(price).toFixed(4)}/{s.unit}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Cant."
                    value={supplyToAdd.quantity}
                    onChange={(e) =>
                      setSupplyToAdd({ ...supplyToAdd, quantity: e.target.value })
                    }
                    className="tf-input w-full sm:w-20"
                  />
                  <button
                    type="button"
                    onClick={addSupply}
                    className="tf-btn-primary px-3 py-1.5 text-sm"
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Consumibles del inventario (desgaste por tiempo de impresión) */}
          {consumables.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gunmetal uppercase tracking-wider">Consumibles</span>
                <span className="text-xs text-gunmetal">(desgaste por horas)</span>
                <div className="flex-1 h-px bg-[#222630]" />
              </div>
              {selectedConsumables.map((c) => {
                const printHours = (parseFloat(form.print_time_minutes) || 0) / 60;
                const wear = printHours > 0
                  ? (parseFloat(c.unit_cost_cal) / parseFloat(c.useful_life_hours)) * printHours
                  : null;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 mb-1 text-sm bg-[#0A0E16] border border-[#222630] px-3 py-1.5 rounded-lg"
                  >
                    <span className="flex-1 text-steel">{c.name}</span>
                    <span className="text-gunmetal text-xs">{c.useful_life_hours}h vida útil</span>
                    {wear !== null && (
                      <span className="text-amber-400 font-mono text-xs">
                        ${wear.toFixed(4)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeConsumable(c.id)}
                      className="text-gunmetal hover:text-red-400 ml-1 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 mt-1">
                <select
                  value={consumableToAdd}
                  onChange={(e) => setConsumableToAdd(e.target.value)}
                  className="tf-input flex-1"
                >
                  <option value="">Consumible...</option>
                  {consumables
                    .filter((c) => !selectedConsumables.some((sc) => sc.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.useful_life_hours}h vida útil
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addConsumable}
                  className="tf-btn-secondary px-3 py-1.5 text-sm"
                >
                  <Plus size={14} /> Añadir
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="tf-btn-primary flex-1 py-3 text-base"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Calculator size={20} />}
              {loading ? 'Calculando...' : 'Calcular Costo'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="tf-btn-ghost px-4 py-3 text-sm"
              title="Limpiar formulario"
            >
              <RotateCcw size={16} />
              Limpiar
            </button>
          </div>
        </form>

        {/* Panel de resultados */}
        <div className="space-y-6">
          {result ? (
            <div className="tf-card p-6">
              <h3 className="tf-section-title mb-4">Desglose de Costos</h3>
              {result.quantity > 1 && (
                <p className="text-xs text-forge-teal bg-forge-teal/10 border border-forge-teal/20 rounded px-2 py-1 mb-3">
                  Costos calculados para el trabajo completo ({result.quantity} piezas en la placa)
                </p>
              )}
              <div className="space-y-3">
                <CostRow label="Material" value={result.material_cost} />
                <CostRow label="Electricidad" value={result.electricity_cost} />
                <CostRow label="Depreciación equipo" value={result.depreciation_cost} />
                <CostRow label="Mantenimiento" value={result.maintenance_cost} />
                <CostRow label="Mano de obra" value={result.labor_cost} />
                <CostRow label="Absorción de fallos" value={result.failure_cost} />
                {result.consumables_wear_cost > 0 && (
                  <CostRow label="Desgaste consumibles" value={result.consumables_wear_cost} />
                )}
                {result.supplies_cost > 0 && (
                  <CostRow label="Insumos adicionales" value={result.supplies_cost} />
                )}
                <hr className="tf-hr" />
                <CostRow label="Subtotal" value={result.subtotal} bold />
                <CostRow label={`Margen (${result.margin_percent}%)`} value={result.margin_amount} />
                <hr className="tf-hr" />
                <CostRow label="Total cotización" value={result.total_price} bold highlight />
                {result.quantity > 1 && (
                  <CostRow
                    label={`Precio por pieza (÷${result.quantity})`}
                    value={result.total_per_unit}
                    bold
                  />
                )}
              </div>
              {result.supplies_detail && result.supplies_detail.length > 0 && (
                <div className="mt-3 p-3 bg-[#0A0E16] border border-[#2A2F38] rounded-lg">
                  <p className="text-forge-teal text-xs font-semibold mb-1">Desglose de insumos</p>
                  {result.supplies_detail.map((sd, i) => (
                    <div key={i} className="flex justify-between text-xs text-steel mt-0.5">
                      <span>
                        {sd.name} × {sd.quantity} {sd.unit}
                      </span>
                      <span>$ {sd.subtotal.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.usd_to_cop_rate && (
                <div className="mt-4 p-3 bg-[#0A2530] border border-forge-teal/20 rounded-lg">
                  <p className="text-forge-teal text-xs font-semibold mb-1">
                    Equivalente en Pesos Colombianos
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-steel">Total cotización</span>
                    <span className="font-bold text-tech-white">
                      $ {result.total_price_cop?.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                  {result.quantity > 1 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-steel">
                        Precio por pieza (÷{result.quantity})
                      </span>
                      <span className="font-bold text-tech-white">
                        $ {result.total_per_unit_cop?.toLocaleString('es-CO')} COP
                      </span>
                    </div>
                  )}
                  <p className="text-gunmetal text-xs mt-2">
                    Tasa usada: 1 USD = {result.usd_to_cop_rate?.toLocaleString('es-CO')} COP
                  </p>
                </div>
              )}
              <p className="text-xs text-gunmetal mt-4">* Precios sin IVA</p>

              <button
                onClick={handleSave}
                disabled={saving}
                className="tf-btn-primary w-full py-3 text-base mt-4"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {saving ? 'Guardando...' : 'Guardar costo de impresión'}
              </button>
            </div>
          ) : (
            <div className="tf-card p-12 text-center">
              <Calculator size={48} className="mx-auto mb-4 text-gunmetal opacity-30" />
              <p className="text-gunmetal">
                Completa el formulario y presiona "Calcular Costo"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente auxiliar que renderiza una fila del desglose de costos.
 * Muestra una etiqueta a la izquierda y un valor monetario a la derecha.
 *
 * @param {Object} props
 * @param {string} props.label - Texto descriptivo del concepto de costo
 * @param {number} props.value - Valor numerico del costo a mostrar
 * @param {boolean} [props.bold] - Si es true, aplica estilo en negrita
 * @param {boolean} [props.highlight] - Si es true, destaca la fila con fondo verde (usado para el total)
 * @returns {JSX.Element} Fila con etiqueta y valor formateado como moneda
 */
function CostRow({ label, value, bold, highlight }) {
  return (
    <div
      className={`tf-cost-row ${highlight ? 'bg-forge-teal/10 -mx-2 px-2 py-2 rounded-lg' : ''}`}
    >
      <span className={bold ? 'font-semibold text-tech-white' : 'text-steel'}>{label}</span>
      <span
        className={`${bold ? 'font-bold' : ''} ${
          highlight ? 'text-forge-teal text-xl' : 'text-tech-white'
        }`}
      >
        $ {value.toFixed(2)}
      </span>
    </div>
  );
}
