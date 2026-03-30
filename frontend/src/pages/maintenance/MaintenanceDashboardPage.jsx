/**
 * @file Dashboard de estado de mantenimiento por impresora.
 *
 * Muestra una tarjeta por impresora con:
 * - Nombre e horas actuales (editables con botón inline)
 * - Grid de tipos de mantenimiento con badge de estado:
 *   🟢 OK (< 80% del intervalo)
 *   🟡 Próximo (80–100%)
 *   🔴 Vencido (> 100%)
 *   ⚪ Sin intervalo definido
 *
 * Lógica de estado cuando no hay log previo:
 *   Se asume que el último mantenimiento fue en la hora 0 (inicio de vida),
 *   por lo que hoursSince = currentHours. Con 0 h todo está verde.
 *
 * @module pages/maintenance/MaintenanceDashboardPage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, AlertTriangle, CheckCircle2, Clock, HelpCircle, X } from 'lucide-react';
import { getMaintenanceSummary, updatePrinter } from '../../services/api';
import { MAINTENANCE_TYPES, getMaintenanceType } from '../../config/maintenance';
import { SkeletonDashboard } from '../../components/SkeletonLoader';

/**
 * Calcula el estado de un tipo de mantenimiento.
 *
 * Si no hay log previo (hoursSince == null), se asume que el último mantenimiento
 * fue en la hora 0, por lo que las horas acumuladas desde entonces son currentHours.
 * Esto evita alertas falsas cuando la impresora está recién registrada (0 h).
 *
 * @param {number|null} hoursSince    - Horas desde el último mantenimiento (null = nunca hecho)
 * @param {number|null} intervalHours - Intervalo recomendado (null = sin intervalo)
 * @param {number}      currentHours  - Horas actuales acumuladas de la impresora
 * @returns {'ok'|'soon'|'overdue'|'no_interval'}
 */
function getStatus(hoursSince, intervalHours, currentHours) {
  if (intervalHours == null) return 'no_interval';
  // Sin log previo: asumir que se hizo en hora 0 → hours since = currentHours
  const effective = hoursSince ?? currentHours;
  const ratio = effective / intervalHours;
  if (ratio >= 1) return 'overdue';
  if (ratio >= 0.8) return 'soon';
  return 'ok';
}

/** Configuración visual de cada estado */
const STATUS_CONFIG = {
  ok:          { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, label: 'OK' },
  soon:        { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: Clock,        label: 'Próximo' },
  overdue:     { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: AlertTriangle, label: 'Vencido' },
  no_interval: { color: 'text-steel',       bg: 'bg-[#1A1D25]',      border: 'border-[#2A2F38]',      icon: HelpCircle,   label: null },
};

/**
 * Chip de tipo de mantenimiento con estado visual.
 * Si el tipo tiene wiki_url, el chip es un enlace que abre el wiki en nueva pestaña.
 * La descripción del tipo se muestra como tooltip (title).
 */
function MaintenanceTypeChip({ typeValue, lastEntry, currentHours }) {
  const typeDef = getMaintenanceType(typeValue);
  const label = typeDef?.label ?? typeValue;
  const intervalHours = typeDef?.interval_hours ?? null;
  const wikiUrl = typeDef?.wiki_url ?? null;
  const description = typeDef?.description ?? null;

  const hoursSince = lastEntry?.hours_since ?? null;
  const status = getStatus(hoursSince, intervalHours, currentHours);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  // Texto de detalle: "X / Y h" usando horas efectivas
  let detail = null;
  if (intervalHours != null) {
    const effective = hoursSince ?? currentHours;
    detail = `${Math.round(effective)} / ${intervalHours} h`;
  } else if (lastEntry) {
    const d = new Date(lastEntry.performed_at);
    detail = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  const inner = (
    <>
      <Icon size={14} className={`mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="min-w-0">
        <p className={`text-xs font-medium leading-tight ${cfg.color}`}>{label}</p>
        {detail && (
          <p className="text-xs text-gunmetal mt-0.5 truncate">{detail}</p>
        )}
      </div>
    </>
  );

  const baseClass = `flex items-start gap-2 p-2.5 rounded-lg border ${cfg.bg} ${cfg.border} min-w-0`;
  const tooltip = description ?? undefined;

  if (wikiUrl) {
    return (
      <a
        href={wikiUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={tooltip}
        className={`${baseClass} hover:brightness-125 transition-all cursor-pointer`}
      >
        {inner}
      </a>
    );
  }

  return (
    <div title={tooltip} className={baseClass}>
      {inner}
    </div>
  );
}

/**
 * Tarjeta de impresora en el dashboard.
 */
function PrinterCard({ summary, onUpdateHours }) {
  const { printer, last_per_type } = summary;
  const currentHours = Number(printer.current_hours);

  // Contar alertas usando la lógica corregida
  const alerts = MAINTENANCE_TYPES.filter(({ value, interval_hours }) => {
    if (interval_hours == null) return false;
    const entry = last_per_type[value];
    const hoursSince = entry?.hours_since ?? null;
    return getStatus(hoursSince, interval_hours, currentHours) === 'overdue';
  }).length;

  return (
    <div className="bg-[#0A0E16] border border-[#222630] rounded-xl p-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-tech-white font-semibold text-base">{printer.name}</h3>
          {printer.model && <p className="text-steel text-xs mt-0.5">{printer.model}</p>}
        </div>
        <button
          onClick={() => onUpdateHours(printer)}
          className="flex items-center gap-1.5 ml-4 shrink-0 group"
          title="Actualizar horas"
        >
          <div className="text-right">
            <p className="text-violet-400 font-mono font-bold text-lg leading-tight group-hover:text-violet-300 transition-colors">
              {currentHours.toFixed(1)} h
            </p>
            <p className="text-gunmetal text-xs group-hover:text-steel transition-colors">
              horas · editar
            </p>
          </div>
        </button>
      </div>

      {alerts > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs font-medium">
            {alerts} {alerts === 1 ? 'mantenimiento vencido' : 'mantenimientos vencidos'}
          </p>
        </div>
      )}

      {/* Grid de tipos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MAINTENANCE_TYPES.filter((t) => t.value !== 'otro').map(({ value }) => (
          <MaintenanceTypeChip
            key={value}
            typeValue={value}
            lastEntry={last_per_type[value] ?? null}
            currentHours={currentHours}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Página principal del dashboard de mantenimiento.
 * @returns {JSX.Element}
 */
export default function MaintenanceDashboardPage() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursTarget, setHoursTarget] = useState(null);
  const [hoursValue, setHoursValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getMaintenanceSummary();
      setSummaries(res.data);
    } catch {
      toast.error('Error al cargar el resumen de mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openHoursModal = (printer) => {
    setHoursTarget(printer);
    setHoursValue(String(printer.current_hours));
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePrinter(hoursTarget.id, { current_hours: parseFloat(hoursValue) || 0 });
      toast.success('Horas actualizadas');
      setHoursTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Error al actualizar las horas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Estado general</h1>
          <p className="text-steel text-sm mt-1">Resumen de mantenimiento por impresora.</p>
        </div>
        <button
          onClick={() => navigate('/maintenance/logs')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {loading ? (
        <SkeletonDashboard count={2} />
      ) : summaries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-steel mb-4">No hay impresoras registradas.</p>
          <button
            onClick={() => navigate('/maintenance/printers')}
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            + Agregar primera impresora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {summaries.map((s) => (
            <PrinterCard key={s.printer.id} summary={s} onUpdateHours={openHoursModal} />
          ))}
        </div>
      )}

      {/* Modal actualizar horas */}
      {hoursTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0E16] border border-[#222630] rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222630]">
              <h2 className="text-tech-white font-semibold">Actualizar horas</h2>
              <button onClick={() => setHoursTarget(null)} className="text-steel hover:text-tech-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveHours} className="p-6 space-y-4">
              <p className="text-steel text-sm">{hoursTarget.name}</p>
              <p className="text-xs text-gunmetal">
                Este valor actualiza la calculadora de costos y los badges de mantenimiento.
              </p>
              <div>
                <label className="block text-xs text-gunmetal mb-1">Horas actuales *</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  autoFocus
                  className="w-full bg-[#1A1D25] border border-[#2A2F38] rounded-lg px-3 py-2 text-tech-white text-sm focus:outline-none focus:border-violet-500"
                  value={hoursValue}
                  onChange={(e) => setHoursValue(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHoursTarget(null)}
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
