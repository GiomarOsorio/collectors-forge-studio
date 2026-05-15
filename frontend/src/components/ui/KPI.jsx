/**
 * @file KPI primitive: tarjeta de métrica con label, value, sub, trend y sparkline opcional.
 *
 * Inspirado en `claude design/inventory.jsx::KPI`.
 *
 * @module components/ui/KPI
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import Sparkline from './Sparkline';

/**
 * @param {Object} props
 * @param {string}              props.label       - Texto eyebrow superior
 * @param {React.ReactNode}     props.value       - Valor principal (string/number/JSX)
 * @param {string}              [props.unit]      - Unidad opcional al lado del value
 * @param {string}              [props.sub]       - Texto secundario debajo
 * @param {string}              [props.accent]    - Color del ícono y sparkline
 * @param {number}              [props.trend]     - %, positivo verde, negativo rojo
 * @param {number[]}            [props.sparkline] - Datos del sparkline
 * @param {React.ComponentType} [props.icon]      - Ícono lucide en cabecera
 */
export default function KPI({ label, value, unit, sub, accent = '#3B82F6', trend, sparkline, icon: Icon }) {
  const trendColor = trend > 0 ? '#34D399' : trend < 0 ? '#F87171' : 'var(--color-gunmetal)';
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0 flex-1 relative overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <span className="shrink-0 inline-flex" style={{ color: accent }}>
            <Icon size={12} />
          </span>
        )}
        <span className="lbl-eyebrow truncate min-w-0">{label}</span>
        <span className="flex-1" />
        {sparkline && (
          <span className="shrink-0">
            <Sparkline data={sparkline} color={accent} width={60} height={20} />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
        <span className="mono text-2xl font-semibold text-tech-white tracking-tight">{value}</span>
        {unit && <span className="mono text-xs text-gunmetal">{unit}</span>}
      </div>
      {(trend != null || sub) && (
        <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden min-w-0 text-xs">
          {trend != null && (
            <span className="inline-flex items-center gap-1 shrink-0" style={{ color: trendColor }}>
              {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span className="mono">{Math.abs(trend)}%</span>
            </span>
          )}
          {sub && <span className="text-gunmetal truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}
