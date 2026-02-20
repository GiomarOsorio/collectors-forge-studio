/**
 * @file Pagina de cotizacion manual de impresion 3D.
 *
 * Permite calcular el costo de una impresion sin necesidad de tener
 * filamentos o impresoras pre-registrados en el sistema. El usuario
 * ingresa todos los parametros directamente en el formulario.
 *
 * @module pages/ManualQuotePage
 */

import { useState, useEffect } from 'react';
import { getSettings, calculateManualQuote } from '../services/api';
import toast from 'react-hot-toast';
import { FileEdit, Calculator } from 'lucide-react';

/**
 * Pagina de cotizacion manual de costos de impresion 3D.
 *
 * Presenta un formulario con tres secciones:
 * 1. Datos de la pieza (nombre, cliente, cantidad, margen)
 * 2. Parametros del filamento (material, precio/kg)
 * 3. Parametros de la impresora (potencia, precio, vida util, mantenimiento)
 *
 * Los campos de configuracion (tarifa electrica, mano de obra, fallos)
 * se precargan desde la configuracion de la empresa del usuario y se
 * pueden sobrescribir individualmente.
 *
 * @returns {JSX.Element} Formulario de cotizacion manual y panel de resultados
 */
export default function ManualQuotePage() {
  /** @type {[Object|null, Function]} Resultado del calculo devuelto por el backend */
  const [result, setResult] = useState(null);
  /** @type {[boolean, Function]} Estado de carga durante el calculo */
  const [loading, setLoading] = useState(false);

  /**
   * Estado del formulario con todos los parametros para la cotizacion manual.
   * Los tiempos se almacenan en minutos (se convierten a horas al enviar).
   */
  const [form, setForm] = useState({
    // Datos de la pieza
    piece_name: '',
    client_name: '',
    description: '',
    quantity: '1',
    margin_percent: '',

    // Filamento
    filament_name: 'PLA',
    price_per_kg: '',

    // Impresora
    power_consumption_watts: '',
    purchase_price: '',
    estimated_lifespan_hours: '',
    nozzle_price: '0',
    nozzle_lifespan_hours: '500',
    buildplate_price: '0',
    buildplate_lifespan_hours: '2000',
    other_maintenance_per_hour: '0',

    // Parametros de impresion
    weight_grams: '',
    print_time_minutes: '',
    preparation_time_minutes: '0',
    post_processing_time_minutes: '0',

    // Configuracion (se precargan desde los ajustes de la empresa)
    electricity_rate: '',
    failure_rate_percent: '',
    labor_cost_per_hour: '',
  });

  // Cargar configuracion de la empresa para precargar los campos de configuracion
  useEffect(() => {
    getSettings()
      .then((res) => {
        const s = res.data;
        setForm((prev) => ({
          ...prev,
          electricity_rate: s.electricity_rate,
          failure_rate_percent: s.failure_rate_percent,
          labor_cost_per_hour: s.labor_cost_per_hour,
          margin_percent: prev.margin_percent || s.default_margin_percent,
        }));
      })
      .catch(() => toast.error('No se pudo cargar la configuracion'));
  }, []);

  /**
   * Actualiza un campo del formulario cuando el usuario modifica un input.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>} e - Evento de cambio
   */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /**
   * Envía el formulario al backend para calcular los costos.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        piece_name: form.piece_name,
        description: form.description || null,
        client_name: form.client_name || null,
        filament_name: form.filament_name || 'Material',
        price_per_kg: parseFloat(form.price_per_kg),
        power_consumption_watts: parseFloat(form.power_consumption_watts),
        purchase_price: parseFloat(form.purchase_price),
        estimated_lifespan_hours: parseFloat(form.estimated_lifespan_hours),
        nozzle_price: parseFloat(form.nozzle_price) || 0,
        nozzle_lifespan_hours: parseFloat(form.nozzle_lifespan_hours) || 500,
        buildplate_price: parseFloat(form.buildplate_price) || 0,
        buildplate_lifespan_hours: parseFloat(form.buildplate_lifespan_hours) || 2000,
        other_maintenance_per_hour: parseFloat(form.other_maintenance_per_hour) || 0,
        weight_grams: parseFloat(form.weight_grams),
        print_time_hours: (parseFloat(form.print_time_minutes) || 0) / 60,
        preparation_time_hours: (parseFloat(form.preparation_time_minutes) || 0) / 60,
        post_processing_time_hours: (parseFloat(form.post_processing_time_minutes) || 0) / 60,
        quantity: parseInt(form.quantity) || 1,
        margin_percent: form.margin_percent !== '' ? parseFloat(form.margin_percent) : null,
        electricity_rate: form.electricity_rate !== '' ? parseFloat(form.electricity_rate) : null,
        failure_rate_percent: form.failure_rate_percent !== '' ? parseFloat(form.failure_rate_percent) : null,
        labor_cost_per_hour: form.labor_cost_per_hour !== '' ? parseFloat(form.labor_cost_per_hour) : null,
      };
      const res = await calculateManualQuote(payload);
      setResult(res.data);
    } catch {
      toast.error('Error al calcular');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileEdit size={24} className="text-forge-green" />
        <h2 className="tf-page-title mb-0">Cotización Manual</h2>
      </div>
      <p className="text-gunmetal text-sm mb-6">
        Calcula el costo sin necesidad de tener filamentos o impresoras registrados en el sistema.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <form onSubmit={handleCalculate} className="space-y-6">

          {/* Seccion 1: Datos de la pieza */}
          <div className="tf-card p-6 space-y-4">
            <h3 className="tf-section-title">Datos de la pieza</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="tf-label">Nombre de la pieza *</label>
                <input name="piece_name" value={form.piece_name} onChange={handleChange}
                  required className="tf-input" />
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
          </div>

          {/* Seccion 2: Filamento */}
          <div className="tf-card p-6 space-y-4">
            <h3 className="tf-section-title">Filamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tf-label">Material</label>
                <input name="filament_name" value={form.filament_name} onChange={handleChange}
                  placeholder="Ej: PLA, PETG, ABS" className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Precio por kg (USD) *</label>
                <input name="price_per_kg" type="number" step="0.01" min="0.01" value={form.price_per_kg} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 25" />
              </div>
              <div>
                <label className="tf-label">Peso filamento (g) *</label>
                <input name="weight_grams" type="number" step="0.01" min="0.01" value={form.weight_grams} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 35" />
              </div>
            </div>
          </div>

          {/* Seccion 3: Impresora */}
          <div className="tf-card p-6 space-y-4">
            <h3 className="tf-section-title">Impresora</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tf-label">Consumo (Watts) *</label>
                <input name="power_consumption_watts" type="number" step="1" min="1" value={form.power_consumption_watts} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 180" />
              </div>
              <div>
                <label className="tf-label">Precio compra (USD) *</label>
                <input name="purchase_price" type="number" step="1" min="0" value={form.purchase_price} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 700" />
              </div>
              <div>
                <label className="tf-label">Vida útil (horas) *</label>
                <input name="estimated_lifespan_hours" type="number" step="100" min="100" value={form.estimated_lifespan_hours} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 5000" />
              </div>
              <div>
                <label className="tf-label">Tiempo impresión (min) *</label>
                <input name="print_time_minutes" type="number" step="1" min="1" value={form.print_time_minutes} onChange={handleChange}
                  required className="tf-input" placeholder="Ej: 120" />
              </div>
              <div>
                <label className="tf-label">Boquilla (USD)</label>
                <input name="nozzle_price" type="number" step="0.01" min="0" value={form.nozzle_price} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Vida boquilla (h)</label>
                <input name="nozzle_lifespan_hours" type="number" step="100" min="100" value={form.nozzle_lifespan_hours} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Placa construcción (USD)</label>
                <input name="buildplate_price" type="number" step="0.01" min="0" value={form.buildplate_price} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Vida placa (h)</label>
                <input name="buildplate_lifespan_hours" type="number" step="100" min="100" value={form.buildplate_lifespan_hours} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Prep. (min)</label>
                <input name="preparation_time_minutes" type="number" step="1" min="0" value={form.preparation_time_minutes} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Post-procesado (min)</label>
                <input name="post_processing_time_minutes" type="number" step="1" min="0" value={form.post_processing_time_minutes} onChange={handleChange}
                  className="tf-input" />
              </div>
            </div>
          </div>

          {/* Seccion 4: Configuracion (precargada desde ajustes de la empresa) */}
          <div className="tf-card p-6 space-y-4">
            <h3 className="tf-section-title">Configuración</h3>
            <p className="text-xs text-gunmetal">
              Precargados desde la configuración de tu empresa. Modifícalos solo para esta cotización.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tf-label">Tarifa eléctrica (USD/kWh)</label>
                <input name="electricity_rate" type="number" step="0.001" min="0" value={form.electricity_rate} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Fallos (%)</label>
                <input name="failure_rate_percent" type="number" step="0.1" min="0" max="100" value={form.failure_rate_percent} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Mano de obra (USD/h)</label>
                <input name="labor_cost_per_hour" type="number" step="0.1" min="0" value={form.labor_cost_per_hour} onChange={handleChange}
                  className="tf-input" />
              </div>
              <div>
                <label className="tf-label">Margen (%)</label>
                <input name="margin_percent" type="number" step="0.1" min="0" max="100" value={form.margin_percent} onChange={handleChange}
                  className="tf-input" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="tf-btn-primary w-full py-3 text-base">
            <Calculator size={20} />
            {loading ? 'Calculando...' : 'Calcular Costo'}
          </button>
        </form>

        {/* Panel de resultados */}
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
                <hr className="tf-hr" />
                <CostRow label="Subtotal" value={result.subtotal} bold />
                <CostRow label={`Margen (${result.margin_percent}%)`} value={result.margin_amount} />
                <hr className="tf-hr" />
                <CostRow label="Total cotización" value={result.total_price} bold highlight />
                {result.quantity > 1 && (
                  <CostRow label={`Precio por pieza (÷${result.quantity})`} value={result.total_per_unit} bold />
                )}
              </div>
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
              <p className="text-xs text-gunmetal mt-1">
                Esta cotización no se guarda en el historial. Para guardarla, registra el filamento
                e impresora y usa la Calculadora principal.
              </p>
            </div>
          ) : (
            <div className="tf-card p-12 text-center">
              <FileEdit size={48} className="mx-auto mb-4 text-gunmetal opacity-30" />
              <p className="text-gunmetal">Completa el formulario y presiona "Calcular Costo"</p>
              <p className="text-gunmetal text-sm mt-2 opacity-60">
                Útil para filamentos o impresoras que aún no están registrados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente auxiliar para una fila del desglose de costos.
 *
 * @param {Object} props
 * @param {string} props.label - Etiqueta del concepto
 * @param {number} props.value - Valor numerico del costo
 * @param {boolean} [props.bold] - Aplica estilo en negrita
 * @param {boolean} [props.highlight] - Destaca la fila con fondo verde
 * @returns {JSX.Element}
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
