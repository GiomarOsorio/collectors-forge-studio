/**
 * @file Página de impresoras en el módulo de mantenimiento.
 *
 * Muestra las impresoras registradas en la app Cost (fuente única de verdad).
 * Permite actualizar las horas actuales directamente desde aquí, lo que
 * impacta tanto la calculadora de costos como el dashboard de mantenimiento.
 *
 * Para crear o eliminar impresoras, ir a Cost → Impresoras.
 *
 * @module pages/maintenance/MaintenancePrintersPage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, X, Printer, ExternalLink } from 'lucide-react';
import { getPrinters, updatePrinter } from '../../services/api';

/**
 * Página de impresoras del módulo de mantenimiento.
 * @returns {JSX.Element}
 */
export default function MaintenancePrintersPage() {
  const navigate = useNavigate();
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [hoursTarget, setHoursTarget] = useState(null);
  const [hoursValue, setHoursValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getPrinters();
      setPrinters(res.data);
    } catch {
      toast.error('Error al cargar las impresoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openHoursModal = (printer) => {
    setHoursTarget(printer);
    setHoursValue(String(printer.current_hours));
    setHoursModalOpen(true);
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePrinter(hoursTarget.id, { current_hours: parseFloat(hoursValue) || 0 });
      toast.success('Horas actualizadas');
      setHoursModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al actualizar las horas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Impresoras</h1>
          <p className="text-steel text-sm mt-1">
            Las impresoras se gestionan en la app Cost. Aquí puedes actualizar las horas acumuladas.
          </p>
        </div>
        <button
          onClick={() => navigate('/cost/printers')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white hover:border-violet-500/50 text-sm transition-colors shrink-0"
          title="Gestionar impresoras en Cost"
        >
          <ExternalLink size={14} /> Gestionar en Cost
        </button>
      </div>

      {loading ? (
        <p className="text-steel">Cargando...</p>
      ) : printers.length === 0 ? (
        <div className="text-center py-16">
          <Printer size={48} className="mx-auto text-gunmetal mb-4" />
          <p className="text-steel mb-4">No hay impresoras registradas.</p>
          <button
            onClick={() => navigate('/cost/printers')}
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            Agregar impresora en Cost →
          </button>
        </div>
      ) : (
        <div className="bg-[#0A0E16] rounded-xl border border-[#222630] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#222630]">
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gunmetal font-medium">Modelo</th>
                <th className="text-right px-4 py-3 text-gunmetal font-medium">Horas actuales</th>
                <th className="text-right px-4 py-3 text-gunmetal font-medium">Vida útil</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => {
                const pct = p.estimated_lifespan_hours > 0
                  ? Math.min(100, (p.current_hours / p.estimated_lifespan_hours) * 100)
                  : 0;
                const pctColor = pct >= 80 ? 'text-red-400' : pct >= 60 ? 'text-amber-400' : 'text-violet-400';

                return (
                  <tr key={p.id} className="border-b border-[#222630] hover:bg-[#1A1D25] transition-colors">
                    <td className="px-4 py-3 text-tech-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-steel">{p.model}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-semibold ${pctColor}`}>
                        {Number(p.current_hours).toFixed(1)} h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-steel">
                      {Number(p.estimated_lifespan_hours).toLocaleString()} h
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openHoursModal(p)}
                        className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs border border-[#2A2F38] text-steel hover:text-violet-400 hover:border-violet-500/50 transition-colors"
                        title="Actualizar horas"
                      >
                        <Clock size={13} /> Actualizar horas
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal actualizar horas */}
      {hoursModalOpen && hoursTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0E16] border border-[#222630] rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222630]">
              <h2 className="text-tech-white font-semibold">Actualizar horas</h2>
              <button onClick={() => setHoursModalOpen(false)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveHours} className="p-6 space-y-4">
              <p className="text-steel text-sm">{hoursTarget.name}</p>
              <p className="text-xs text-gunmetal">
                Este valor se usa en el cálculo de depreciación de la Calculadora de Costos.
              </p>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Horas actuales *</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={hoursValue}
                  onChange={(e) => setHoursValue(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHoursModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
