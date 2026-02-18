import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [form, setForm] = useState({
    electricity_rate: '',
    failure_rate_percent: '',
    labor_cost_per_hour: '',
    default_margin_percent: '',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((res) => {
      const s = res.data;
      setForm({
        electricity_rate: s.electricity_rate.toString(),
        failure_rate_percent: s.failure_rate_percent.toString(),
        labor_cost_per_hour: s.labor_cost_per_hour.toString(),
        default_margin_percent: s.default_margin_percent.toString(),
        currency: s.currency,
      });
      setLoading(false);
    });
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
      </div>
    </div>
  );
}
