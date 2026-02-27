/**
 * @file Dashboard de estado de mantenimiento por impresora.
 *
 * Muestra una tarjeta por impresora con:
 * - Nombre e horas actuales
 * - Grid de tipos de mantenimiento con badge de estado:
 *   🟢 OK (< 80% del intervalo)
 *   🟡 Próximo (80–100%)
 *   🔴 Vencido (> 100% o nunca hecho y tiene intervalo)
 *   ⚪ Sin intervalo (solo fecha del último)
 *
 * @module pages/maintenance/MaintenanceDashboardPage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, AlertTriangle, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { getMaintenanceSummary } from '../../services/api';
import { MAINTENANCE_TYPES, getMaintenanceType } from '../../config/maintenance';

/**
 * Calcula el estado de un tipo de mantenimiento dado las horas desde el último.
 * @param {number|null} hoursSince - Horas desde el último mantenimiento (null = nunca hecho)
 * @param {number|null} intervalHours - Intervalo recomendado (null = sin intervalo)
 * @returns {'ok'|'soon'|'overdue'|'no_interval'|'never'}
 */
function getStatus(hoursSince, intervalHours) {
  if (intervalHours == null) return 'no_interval';
  if (hoursSince == null) return 'never';
  const ratio = hoursSince / intervalHours;
  if (ratio >= 1) return 'overdue';
  if (ratio >= 0.8) return 'soon';
  return 'ok';
}

/** Configuración visual de cada estado */
const STATUS_CONFIG = {
  ok:          { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, label: 'OK' },
  soon:        { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: Clock,         label: 'Próximo' },
  overdue:     { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: AlertTriangle, label: 'Vencido' },
  never:       { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: AlertTriangle, label: 'Pendiente' },
  no_interval: { color: 'text-steel',       bg: 'bg-[#1a1d21]',      border: 'border-[#2a2d31]',      icon: HelpCircle,    label: null },
};

/**
 * Chip de tipo de mantenimiento con estado visual.
 */
function MaintenanceTypeChip({ typeValue, lastEntry }) {
  const typeDef = getMaintenanceType(typeValue);
  const label = typeDef?.label ?? typeValue;
  const intervalHours = typeDef?.interval_hours ?? null;

  const hoursSince = lastEntry?.hours_since ?? null;
  const status = getStatus(hoursSince, intervalHours);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  let detail = null;
  if (lastEntry) {
    const d = new Date(lastEntry.performed_at);
    const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (intervalHours != null && hoursSince != null) {
      detail = `${Math.round(hoursSince)} / ${intervalHours} h`;
    } else {
      detail = dateStr;
    }
  } else if (intervalHours != null) {
    detail = `Intervalo: ${intervalHours} h`;
  }

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${cfg.bg} ${cfg.border} min-w-0`}>
      <Icon size={14} className={`mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="min-w-0">
        <p className={`text-xs font-medium leading-tight ${cfg.color}`}>{label}</p>
        {detail && (
          <p className="text-xs text-gunmetal mt-0.5 truncate">{detail}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Tarjeta de impresora en el dashboard.
 */
function PrinterCard({ summary }) {
  const { printer, last_per_type } = summary;

  // Contar alertas
  const alerts = MAINTENANCE_TYPES.filter(({ value, interval_hours }) => {
    if (interval_hours == null) return false;
    const entry = last_per_type[value];
    const hoursSince = entry?.hours_since ?? null;
    const st = getStatus(hoursSince, interval_hours);
    return st === 'overdue' || st === 'never';
  }).length;

  return (
    <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl p-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-tech-white font-semibold text-base">{printer.name}</h3>
          {printer.model && <p className="text-steel text-xs mt-0.5">{printer.model}</p>}
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-violet-400 font-mono font-bold text-lg leading-tight">
            {Number(printer.current_hours).toFixed(1)} h
          </p>
          <p className="text-gunmetal text-xs">horas actuales</p>
        </div>
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
        <p className="text-steel">Cargando...</p>
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
            <PrinterCard key={s.printer.id} summary={s} />
          ))}
        </div>
      )}
    </div>
  );
}
