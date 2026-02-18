import { useState, useEffect } from 'react';
import { getFilaments, getPrinters, getSettings, calculateQuote, createQuote } from '../services/api';
import toast from 'react-hot-toast';
import { Calculator, Save } from 'lucide-react';

export default function CalculatorPage() {
  const [filaments, setFilaments] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [settings, setSettings] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    piece_name: '',
    description: '',
    client_name: '',
    filament_id: '',
    printer_id: '',
    weight_grams: '',
    print_time_hours: '',
    preparation_time_hours: '0',
    post_processing_time_hours: '0',
    quantity: '1',
    margin_percent: '',
  });

  useEffect(() => {
    Promise.all([getFilaments(), getPrinters(), getSettings()])
      .then(([f, p, s]) => {
        setFilaments(f.data);
        setPrinters(p.data);
        setSettings(s.data);
        if (p.data.length > 0) setForm((prev) => ({ ...prev, printer_id: p.data[0].id }));
        if (f.data.length > 0) setForm((prev) => ({ ...prev, filament_id: f.data[0].id }));
        setForm((prev) => ({ ...prev, margin_percent: s.data.default_margin_percent }));
      })
      .catch(() => toast.error('Error cargando datos'));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const buildPayload = () => ({
    piece_name: form.piece_name,
    description: form.description || null,
    client_name: form.client_name || null,
    filament_id: parseInt(form.filament_id),
    printer_id: parseInt(form.printer_id),
    weight_grams: parseFloat(form.weight_grams),
    print_time_hours: parseFloat(form.print_time_hours),
    preparation_time_hours: parseFloat(form.preparation_time_hours) || 0,
    post_processing_time_hours: parseFloat(form.post_processing_time_hours) || 0,
    quantity: parseInt(form.quantity) || 1,
    margin_percent: parseFloat(form.margin_percent),
  });

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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Calculadora de Costos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleCalculate} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la pieza *</label>
              <input name="piece_name" value={form.piece_name} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <input name="client_name" value={form.client_name} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <hr className="my-4" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filamento *</label>
              <select name="filament_id" value={form.filament_id} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Seleccionar...</option>
                {filaments.map((f) => (
                  <option key={f.id} value={f.id}>{f.brand} {f.type} - {f.color}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impresora *</label>
              <select name="printer_id" value={form.printer_id} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Seleccionar...</option>
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso filamento (g) *</label>
              <input name="weight_grams" type="number" step="0.1" min="0" value={form.weight_grams} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo impresión (h) *</label>
              <input name="print_time_hours" type="number" step="0.1" min="0" value={form.print_time_hours} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preparación (h)</label>
              <input name="preparation_time_hours" type="number" step="0.1" min="0" value={form.preparation_time_hours} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Post-procesado (h)</label>
              <input name="post_processing_time_hours" type="number" step="0.1" min="0" value={form.post_processing_time_hours} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen de ganancia (%)</label>
              <input name="margin_percent" type="number" step="0.1" min="0" value={form.margin_percent} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4">
            <Calculator size={20} />
            {loading ? 'Calculando...' : 'Calcular Costo'}
          </button>
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Desglose de Costos</h3>
              <div className="space-y-3">
                <CostRow label="Material" value={result.material_cost} />
                <CostRow label="Electricidad" value={result.electricity_cost} />
                <CostRow label="Depreciación equipo" value={result.depreciation_cost} />
                <CostRow label="Mantenimiento" value={result.maintenance_cost} />
                <CostRow label="Mano de obra" value={result.labor_cost} />
                <CostRow label="Absorción de fallos" value={result.failure_cost} />
                <hr />
                <CostRow label="Subtotal" value={result.subtotal} bold />
                <CostRow label={`Margen (${result.margin_percent}%)`} value={result.margin_amount} />
                <hr />
                <CostRow label="Precio por unidad" value={result.total_per_unit} bold />
                {result.quantity > 1 && (
                  <CostRow label={`Total (${result.quantity} uds.)`} value={result.total_price} bold highlight />
                )}
                {result.quantity === 1 && (
                  <CostRow label="TOTAL" value={result.total_price} bold highlight />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-4">* Precios sin IVA</p>

              <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors mt-4">
                <Save size={20} />
                Guardar Cotización
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <Calculator size={48} className="mx-auto mb-4 opacity-30" />
              <p>Completa el formulario y presiona "Calcular Costo"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, highlight }) {
  return (
    <div className={`flex justify-between items-center ${highlight ? 'bg-blue-50 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
      <span className={`text-gray-${bold ? '900' : '600'} ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-bold text-lg' : ''} ${highlight ? 'text-blue-700 text-xl' : 'text-gray-900'}`}>
        $ {value.toFixed(2)}
      </span>
    </div>
  );
}
