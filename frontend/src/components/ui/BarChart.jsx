/**
 * @file BarChart primitive — SVG propio, sin librerías (issue #132).
 *
 * Barras horizontales simples para "gramos por filamento", "por impresora",
 * "fallos por categoría". Un chart de barras genérico no justifica una
 * dependencia como recharts (+400KB) — ver decisión en el doc local de #132.
 *
 * @module components/ui/BarChart
 */

/**
 * @param {Object} props
 * @param {Array<{label: string, value: number}>} props.data
 * @param {string} [props.accent='var(--page-accent)']
 * @param {(v: number) => string} [props.formatValue]
 */
export default function BarChart({ data, accent = 'var(--page-accent)', formatValue = (v) => String(v) }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gunmetal py-4 text-center">Sin datos en el rango seleccionado.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => {
        const pct = Math.max(0, Math.min(100, (d.value / max) * 100));
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-steel truncate" title={d.label}>{d.label}</span>
            <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{ width: `${pct}%`, background: accent }}
                title={`${d.label}: ${formatValue(d.value)}`}
              />
            </div>
            <span className="w-20 shrink-0 text-right mono text-[11px] text-gunmetal">{formatValue(d.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
