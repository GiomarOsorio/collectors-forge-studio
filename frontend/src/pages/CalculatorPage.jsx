/**
 * @file Pagina principal de la calculadora de costos de impresion 3D.
 *
 * Contiene el formulario para ingresar los parametros de una pieza
 * (filamento, impresora, peso, tiempos, cantidad, margen) y muestra
 * el desglose completo de costos calculado por el backend.
 * Permite guardar la cotizacion en el historial.
 *
 * @module pages/CalculatorPage
 */

import { useState, useEffect } from 'react';
import { getFilaments, getPrinters, getSettings, calculateQuote, createQuote, getSupplies } from '../services/api';
import toast from 'react-hot-toast';
import { Calculator, Save, Plus, Trash2 } from 'lucide-react';

/**
 * Componente de la pagina de calculadora de costos.
 *
 * @description Pagina principal de la aplicacion. Presenta un formulario
 * de dos columnas donde el usuario ingresa los datos de la pieza a imprimir
 * y visualiza el desglose de costos resultante.
 *
 * Al montarse, carga en paralelo los filamentos, impresoras y configuracion
 * del usuario para prellenar los selectores del formulario.
 *
 * El flujo de uso es:
 * 1. Completar los datos de la pieza (nombre, filamento, impresora, peso, tiempos)
 * 2. Presionar "Calcular Costo" para obtener el desglose
 * 3. Opcionalmente guardar la cotizacion en el historial
 *
 * @returns {JSX.Element} Formulario de calculadora y panel de resultados
 */
export default function CalculatorPage() {
  /** @type {[Array, Function]} Lista de filamentos disponibles del usuario */
  const [filaments, setFilaments] = useState([]);
  /** @type {[Array, Function]} Lista de impresoras disponibles del usuario */
  const [printers, setPrinters] = useState([]);
  /** @type {[Object|null, Function]} Configuracion de la aplicacion (tarifas, margenes) */
  const [settings, setSettings] = useState(null);
  /** @type {[Array, Function]} Catalogo de insumos disponibles */
  const [supplies, setSupplies] = useState([]);
  /** @type {[Array, Function]} Insumos seleccionados para esta cotizacion [{supply_id, quantity}] */
  const [selectedSupplies, setSelectedSupplies] = useState([]);
  /** @type {[Array, Function]} Filamentos adicionales para pieza multicolor [{filament_id, weight_grams}] */
  const [additionalFilaments, setAdditionalFilaments] = useState([]);
  /** @type {[Object|null, Function]} Resultado del calculo de costos devuelto por el backend */
  const [result, setResult] = useState(null);
  /** @type {[boolean, Function]} Estado de carga durante el calculo */
  const [loading, setLoading] = useState(false);

  /**
   * Estado del formulario con los parametros de la pieza a cotizar.
   * Los valores se almacenan como strings para compatibilidad con los inputs HTML.
   */
  const [form, setForm] = useState({
    piece_name: '',
    description: '',
    client_name: '',
    filament_id: '',
    printer_id: '',
    weight_grams: '',
    print_time_minutes: '',
    preparation_time_minutes: '0',
    post_processing_time_minutes: '0',
    quantity: '1',
    margin_percent: '',
  });

  /**
   * Estado temporal para el insumo que se esta por agregar a la cotizacion.
   * Se resetea a valores vacios tras cada llamada a addSupply.
   * @type {[{supply_id: string, quantity: number}, Function]}
   */
  const [supplyToAdd, setSupplyToAdd] = useState({ supply_id: '', quantity: 1 });
  /**
   * Estado temporal para el filamento adicional que se esta por agregar.
   * Se resetea a valores vacios tras cada llamada a addFilament.
   * @type {[{filament_id: string, weight_grams: string}, Function]}
   */
  const [filamentToAdd, setFilamentToAdd] = useState({ filament_id: '', weight_grams: '' });

  // Carga inicial: obtiene filamentos, impresoras, configuracion e insumos en paralelo.
  // Preselecciona el primer filamento y la primera impresora si existen,
  // y establece el margen de ganancia por defecto segun la configuracion.
  useEffect(() => {
    Promise.all([getFilaments(), getPrinters(), getSettings(), getSupplies()])
      .then(([f, p, s, sup]) => {
        setFilaments(f.data);
        setPrinters(p.data);
        setSettings(s.data);
        setSupplies(sup.data);
        if (p.data.length > 0) setForm((prev) => ({ ...prev, printer_id: p.data[0].id }));
        if (f.data.length > 0) setForm((prev) => ({ ...prev, filament_id: f.data[0].id }));
        setForm((prev) => ({ ...prev, margin_percent: s.data.default_margin_percent }));
      })
      .catch(() => toast.error('Error cargando datos'));
  }, []);

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
   * Incluye supplies (insumos adicionales) y additional_filaments (filamentos multicolor).
   *
   * @returns {Object} Objeto con los datos de la cotizacion en formato esperado por la API
   */
  const buildPayload = () => ({
    piece_name: form.piece_name,
    description: form.description || null,
    client_name: form.client_name || null,
    filament_id: parseInt(form.filament_id),
    printer_id: parseInt(form.printer_id),
    weight_grams: parseFloat(form.weight_grams),
    print_time_hours: (parseFloat(form.print_time_minutes) || 0) / 60,
    preparation_time_hours: (parseFloat(form.preparation_time_minutes) || 0) / 60,
    post_processing_time_hours: (parseFloat(form.post_processing_time_minutes) || 0) / 60,
    quantity: parseInt(form.quantity) || 1,
    margin_percent: parseFloat(form.margin_percent),
    supplies: selectedSupplies,
    additional_filaments: additionalFilaments,
  });

  /**
   * Agrega el insumo seleccionado en supplyToAdd al listado de insumos de la cotizacion.
   * Si el insumo ya existe en la lista, incrementa su cantidad en lugar de duplicarlo.
   * No hace nada si supply_id esta vacio. Resetea supplyToAdd tras agregar.
   *
   * @returns {void}
   */
  const addSupply = () => {
    if (!supplyToAdd.supply_id) return;
    const id = parseInt(supplyToAdd.supply_id);
    const qty = parseFloat(supplyToAdd.quantity) || 1;
    const existing = selectedSupplies.find((s) => s.supply_id === id);
    if (existing) {
      setSelectedSupplies(selectedSupplies.map((s) => s.supply_id === id ? { ...s, quantity: s.quantity + qty } : s));
    } else {
      setSelectedSupplies([...selectedSupplies, { supply_id: id, quantity: qty }]);
    }
    setSupplyToAdd({ supply_id: '', quantity: 1 });
  };

  /**
   * Elimina un insumo del listado de insumos seleccionados para la cotizacion.
   *
   * @param {number} supply_id - ID del insumo a eliminar
   * @returns {void}
   */
  const removeSupply = (supply_id) => setSelectedSupplies(selectedSupplies.filter((s) => s.supply_id !== supply_id));

  /**
   * Agrega el filamento seleccionado en filamentToAdd al listado de filamentos
   * adicionales (para piezas multicolor). No hace nada si falta filament_id
   * o weight_grams. Resetea filamentToAdd tras agregar.
   *
   * @returns {void}
   */
  const addFilament = () => {
    if (!filamentToAdd.filament_id || !filamentToAdd.weight_grams) return;
    setAdditionalFilaments([...additionalFilaments, {
      filament_id: parseInt(filamentToAdd.filament_id),
      weight_grams: parseFloat(filamentToAdd.weight_grams),
    }]);
    setFilamentToAdd({ filament_id: '', weight_grams: '' });
  };

  /**
   * Elimina un filamento adicional del listado por su posicion en el arreglo.
   *
   * @param {number} index - Indice del filamento a eliminar en additionalFilaments
   * @returns {void}
   */
  const removeFilament = (index) => setAdditionalFilaments(additionalFilaments.filter((_, i) => i !== index));

  /**
   * Maneja el envio del formulario para calcular los costos.
   * Valida que se haya seleccionado filamento e impresora antes de enviar.
   * El resultado se almacena en el estado 'result' para mostrarlo en el panel derecho.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!form.filament_id || !form.printer_id) {
      toast.error('Debes tener al menos un filamento y una impresora');
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
   * Guarda la cotizacion actual en el historial del backend.
   * Envia los mismos datos del formulario al endpoint de creacion de cotizaciones.
   */
  const handleSave = async () => {
    try {
      await createQuote(buildPayload());
      toast.success('Cotización guardada en el historial');
    } catch {
      toast.error('Error al guardar');
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Calculadora de Costos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleCalculate} className="tf-card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="tf-label">Nombre de la pieza *</label>
              <input name="piece_name" value={form.piece_name} onChange={handleChange} required
                className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Cliente</label>
              <input name="client_name" value={form.client_name} onChange={handleChange}
                className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Cantidad</label>
              <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange}
                className="tf-input" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="tf-label">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                className="tf-input" />
            </div>
          </div>

          <hr className="tf-hr" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="tf-label">Filamento *</label>
              <select name="filament_id" value={form.filament_id} onChange={handleChange} required
                className="tf-input">
                <option value="">Seleccionar...</option>
                {filaments.map((f) => (
                  <option key={f.id} value={f.id}>{f.brand} {f.type} - {f.color}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="tf-label">Impresora *</label>
              <select name="printer_id" value={form.printer_id} onChange={handleChange} required
                className="tf-input">
                <option value="">Seleccionar...</option>
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="tf-label">Peso filamento (g) *</label>
              <input name="weight_grams" type="number" step="0.01" min="0" value={form.weight_grams} onChange={handleChange} required
                className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Tiempo impresión (min) *</label>
              <input name="print_time_minutes" type="number" step="1" min="0" value={form.print_time_minutes} onChange={handleChange} required
                className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Preparación (min)</label>
              <input name="preparation_time_minutes" type="number" step="1" min="0" value={form.preparation_time_minutes} onChange={handleChange}
                className="tf-input" />
            </div>
            <div>
              <label className="tf-label">Post-procesado (min)</label>
              <input name="post_processing_time_minutes" type="number" step="1" min="0" value={form.post_processing_time_minutes} onChange={handleChange}
                className="tf-input" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="tf-label">Margen de ganancia (%)</label>
              <input name="margin_percent" type="number" step="0.1" min="0" value={form.margin_percent} onChange={handleChange}
                className="tf-input" />
            </div>
          </div>

          {/* Filamentos adicionales (multicolor) */}
          {filaments.length > 0 && (
            <>
              <hr className="tf-hr" />
              <div>
                <p className="text-sm font-medium text-steel mb-2">Filamentos adicionales <span className="text-gunmetal font-normal">(multicolor)</span></p>
                {additionalFilaments.map((af, i) => {
                  const f = filaments.find((x) => x.id === af.filament_id);
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1 text-sm bg-[#0d1014] border border-[#1e2125] px-3 py-1.5 rounded-lg">
                      <span className="flex-1 text-steel">{f ? `${f.brand} ${f.type} - ${f.color}` : af.filament_id}</span>
                      <span className="text-gunmetal">{af.weight_grams} g</span>
                      <button type="button" onClick={() => removeFilament(i)} className="text-gunmetal hover:text-red-400 ml-1 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 mt-1">
                  <select value={filamentToAdd.filament_id} onChange={(e) => setFilamentToAdd({ ...filamentToAdd, filament_id: e.target.value })}
                    className="tf-input flex-1">
                    <option value="">Filamento...</option>
                    {filaments.map((f) => <option key={f.id} value={f.id}>{f.brand} {f.type} - {f.color}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0" placeholder="g" value={filamentToAdd.weight_grams}
                    onChange={(e) => setFilamentToAdd({ ...filamentToAdd, weight_grams: e.target.value })}
                    className="tf-input w-full sm:w-20" />
                  <button type="button" onClick={addFilament}
                    className="tf-btn-secondary px-3 py-1.5 text-sm">
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Insumos adicionales */}
          {supplies.length > 0 && (
            <>
              <hr className="tf-hr" />
              <div>
                <p className="text-sm font-medium text-steel mb-2">Insumos adicionales</p>
                {selectedSupplies.map((si) => {
                  const sup = supplies.find((x) => x.id === si.supply_id);
                  return (
                    <div key={si.supply_id} className="flex items-center gap-2 mb-1 text-sm bg-[#0d1014] border border-[#1e2125] px-3 py-1.5 rounded-lg">
                      <span className="flex-1 text-steel">{sup ? sup.name : si.supply_id}</span>
                      <span className="text-gunmetal">{si.quantity} {sup?.unit || ''}</span>
                      {sup && <span className="text-forge-green font-mono text-xs">${(sup.price_per_unit * si.quantity).toFixed(4)}</span>}
                      <button type="button" onClick={() => removeSupply(si.supply_id)} className="text-gunmetal hover:text-red-400 ml-1 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 mt-1">
                  <select value={supplyToAdd.supply_id} onChange={(e) => setSupplyToAdd({ ...supplyToAdd, supply_id: e.target.value })}
                    className="tf-input flex-1">
                    <option value="">Insumo...</option>
                    {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} — ${s.price_per_unit.toFixed(6)}/{s.unit}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0.01" placeholder="Cant." value={supplyToAdd.quantity}
                    onChange={(e) => setSupplyToAdd({ ...supplyToAdd, quantity: e.target.value })}
                    className="tf-input w-full sm:w-20" />
                  <button type="button" onClick={addSupply}
                    className="tf-btn-primary px-3 py-1.5 text-sm">
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={loading}
            className="tf-btn-primary w-full py-3 text-base mt-4">
            <Calculator size={20} />
            {loading ? 'Calculando...' : 'Calcular Costo'}
          </button>
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result ? (
            <div className="tf-card p-6">
              <h3 className="tf-section-title mb-4">Desglose de Costos</h3>
              {result.quantity > 1 && (
                <p className="text-xs text-forge-green bg-forge-green/10 border border-forge-green/20 rounded px-2 py-1 mb-3">
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
                {result.supplies_cost > 0 && <CostRow label="Insumos adicionales" value={result.supplies_cost} />}
                <hr className="tf-hr" />
                <CostRow label="Subtotal" value={result.subtotal} bold />
                <CostRow label={`Margen (${result.margin_percent}%)`} value={result.margin_amount} />
                <hr className="tf-hr" />
                <CostRow label="Total cotización" value={result.total_price} bold highlight />
                {result.quantity > 1 && (
                  <CostRow label={`Precio por pieza (÷${result.quantity})`} value={result.total_per_unit} bold />
                )}
              </div>
              {result.supplies_detail && result.supplies_detail.length > 0 && (
                <div className="mt-3 p-3 bg-[#0d1014] border border-[#2a2d31] rounded-lg">
                  <p className="text-forge-green text-xs font-semibold mb-1">Desglose de insumos</p>
                  {result.supplies_detail.map((sd, i) => (
                    <div key={i} className="flex justify-between text-xs text-steel mt-0.5">
                      <span>{sd.name} × {sd.quantity} {sd.unit}</span>
                      <span>$ {sd.subtotal.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.usd_to_cop_rate && (
                <div className="mt-4 p-3 bg-[#0d2b14] border border-forge-green/20 rounded-lg">
                  <p className="text-forge-green text-xs font-semibold mb-1">Equivalente en Pesos Colombianos</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-steel">Total cotización</span>
                    <span className="font-bold text-tech-white">$ {result.total_price_cop?.toLocaleString('es-CO')} COP</span>
                  </div>
                  {result.quantity > 1 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-steel">Precio por pieza (÷{result.quantity})</span>
                      <span className="font-bold text-tech-white">$ {result.total_per_unit_cop?.toLocaleString('es-CO')} COP</span>
                    </div>
                  )}
                  <p className="text-gunmetal text-xs mt-2">Tasa usada: 1 USD = {result.usd_to_cop_rate?.toLocaleString('es-CO')} COP</p>
                </div>
              )}
              <p className="text-xs text-gunmetal mt-4">* Precios sin IVA</p>

              <button onClick={handleSave}
                className="tf-btn-primary w-full py-3 text-base mt-4">
                <Save size={20} />
                Guardar Cotización
              </button>
            </div>
          ) : (
            <div className="tf-card p-12 text-center">
              <Calculator size={48} className="mx-auto mb-4 text-gunmetal opacity-30" />
              <p className="text-gunmetal">Completa el formulario y presiona "Calcular Costo"</p>
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
    <div className={`tf-cost-row ${highlight ? 'bg-forge-green/10 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
      <span className={bold ? 'font-semibold text-tech-white' : 'text-steel'}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-forge-green text-xl' : 'text-tech-white'}`}>
        $ {value.toFixed(2)}
      </span>
    </div>
  );
}
