/**
 * @file KPITile primitive (Claude Design v2 port).
 *
 * Versión más compacta que `KPI`. Cabe en grids densos del diseño v2.
 * Props: label / value / unit / sub / icon / accent / warn / trend.
 *
 * `accent` lee `var(--page-accent)` por default — el `PageShell` ancestro
 * lo define. `warn=true` colorea el value en ámbar.
 *
 * @module components/ui/KPITile
 */

import { TrendingDown, TrendingUp } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string}              props.label
 * @param {React.ReactNode}     props.value
 * @param {string}              [props.unit]
 * @param {string}              [props.sub]
 * @param {React.ComponentType} [props.icon]
 * @param {string}              [props.accent='var(--page-accent)']
 * @param {boolean}             [props.warn]
 * @param {string}              [props.trend]  - ej. '+4%' o '-2%'
 */
export default function KPITile({ label, value, unit, sub, icon: Icon, accent = 'var(--page-accent)', warn, trend }) {
  const trendNeg = trend && trend.startsWith('-');
  return (
    <div className="flex-1 min-w-0 bg-[var(--color-surf-card)] border border-[var(--color-border)] rounded-lg px-3.5 py-3 flex flex-col gap-1 relative overflow-hidden">
      <div className="flex items-center gap-1.5">
        {Icon && (
          <span
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded"
            style={{
              background: `color-mix(in oklab, ${accent} 14%, transparent)`,
              color: accent,
            }}
          >
            <Icon size={11} />
          </span>
        )}
        <span className="mono text-[9px] text-gunmetal uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="mono text-[22px] font-semibold tracking-tight"
          style={{ color: warn ? 'var(--color-forge-amber)' : 'var(--color-tech-white)' }}
        >
          {value}
        </span>
        {unit && <span className="mono text-[11px] text-gunmetal">{unit}</span>}
        {trend && (
          <span
            className="mono ml-auto inline-flex items-center gap-0.5 text-[10.5px]"
            style={{ color: trendNeg ? '#F87171' : '#34D399' }}
          >
            {trendNeg ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
            {trend.replace(/^[-+]/, '')}
          </span>
        )}
      </div>
      {sub && <p className="mono text-[10px] text-gunmetal-dim">{sub}</p>}
    </div>
  );
}
