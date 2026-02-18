/**
 * @file Pagina de configuracion general de Calculator3D.
 *
 * Permite al usuario ajustar los parametros globales que afectan
 * el calculo de costos de impresion 3D:
 * - Tarifa electrica (precio por kWh)
 * - Tasa de fallos (porcentaje de impresiones fallidas)
 * - Costo de mano de obra por hora
 * - Margen de ganancia por defecto
 * - Moneda de la aplicacion
 *
 * Estos valores se usan como base para todos los calculos de cotizacion
 * y se pueden sobreescribir individualmente en cada cotizacion.
 *
 * @module pages/SettingsPage
 */

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getExchangeRate } from '../services/api';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

/**
 * Componente de la pagina de configuracion.
 *
 * @description Presenta un formulario organizado en secciones (Electricidad,
 * Produccion, Precios) con los parametros globales de la aplicacion.
 * Al montarse, carga la configuracion actual del backend y la muestra
 * en el formulario. El usuario puede modificar los valores y guardar.
 *
 * @returns {JSX.Element} Formulario de configuracion de la aplicacion
 */
export default function SettingsPage() {
  /**
   * Estado del formulario con los parametros de configuracion.
   * Los valores se almacenan como strings para compatibilidad con inputs HTML.
   */
  const [form, setForm] = useState({
    electricity_rate: '',
    failure_rate_percent: '',
    labor_cost_per_hour: '',
    default_margin_percent: '',
    currency: 'USD',
  });
  /** @type {[boolean, Function]} Estado de carga mientras se obtiene la configuracion del backend */
  const [loading, setLoading] = useState(true);
  /** @type {[Object|null, Function]} Informacion de la tasa de cambio USD/COP */
  const [exchangeRate, setExchangeRate] = useState(null);

  // Carga la configuracion actual y la tasa de cambio al montar el componente
  useEffect(() => {
    Promise.all([getSettings(), getExchangeRate()]).then(([sRes, rRes]) => {
      const s = sRes.data;
      setForm({
        electricity_rate: s.electricity_rate.toString(),
        failure_rate_percent: s.failure_rate_percent.toString(),
        labor_cost_per_hour: s.labor_cost_per_hour.toString(),
        default_margin_percent: s.default_margin_percent.toString(),
        currency: s.currency,
      });
      setExchangeRate(rRes.data);
      setLoading(false);
    });
  }, []);

  /**
   * Actualiza el campo correspondiente del formulario al cambiar un input.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e - Evento de cambio
   */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /**
   * Maneja el envio del formulario para guardar la configuracion.
   * Convierte los valores string del formulario a numeros antes de enviar al backend.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSettings({
        electricity_rate: parseFloat(form.electricity_rate),
        failure_rate_percent: parseFloat(form.failure_rate_percent),
        labor_cost_per_hour: parseFloat(form.labor_cost_per_hour),
        default_margin_percent: parseFloat(form.default_margin_percent),
        currency: form.currency,
      });
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar');
    }
  };

  // Muestra indicador de carga mientras se obtiene la configuracion
  if (loading) return <p className="text-gray-400">Cargando...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h2>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Electricidad</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarifa eléctrica ($ por kWh)
              </label>
              <input name="electricity_rate" type="number" step="0.001" value={form.electricity_rate} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Costo que pagas por cada kilovatio-hora de electricidad</p>
            </div>
          </div>

          <hr />

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Producción</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa de fallos (%)
                </label>
                <input name="failure_rate_percent" type="number" step="0.1" value={form.failure_rate_percent} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Porcentaje de impresiones que fallan</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo hora de trabajo ($)
                </label>
                <input name="labor_cost_per_hour" type="number" step="0.01" value={form.labor_cost_per_hour} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Tu costo por hora de trabajo manual</p>
              </div>
            </div>
          </div>

          <hr />

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Precios</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margen de ganancia por defecto (%)
                </label>
                <input name="default_margin_percent" type="number" step="0.1" value={form.default_margin_percent} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                <select name="currency" value={form.currency} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                  <option value="ARS">ARS</option>
                  <option value="CLP">CLP</option>
                  <option value="PEN">PEN</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit"
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Save size={20} />
            Guardar Configuración
          </button>
        </form>

        {exchangeRate && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <h3 className="font-semibold text-yellow-900 mb-3">Tasa de Cambio USD → COP</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-yellow-700">Precio mercado</span>
                <span className="font-medium text-yellow-900">$ {exchangeRate.market_rate?.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-700">Markup aplicado</span>
                <span className="font-medium text-yellow-900">+ {exchangeRate.markup} COP</span>
              </div>
              <hr className="border-yellow-300" />
              <div className="flex justify-between">
                <span className="font-semibold text-yellow-800">Tasa usada en cálculos</span>
                <span className="font-bold text-yellow-900 text-base">$ {exchangeRate.rate_used?.toLocaleString('es-CO')} COP</span>
              </div>
            </div>
            <p className="text-xs text-yellow-600 mt-3">Actualizado automáticamente cada hora desde open.er-api.com</p>
          </div>
        )}
      </div>
    </div>
  );
}
