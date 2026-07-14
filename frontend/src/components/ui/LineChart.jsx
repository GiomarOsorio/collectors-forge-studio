/**
 * @file LineChart primitive — SVG propio, sin librerías (issue #132).
 *
 * Serie temporal simple (una o dos líneas) para las tendencias de Stats:
 * escala lineal, eje X con labels espaciados, puntos con `<title>` nativo
 * como tooltip (sin JS de hover). Ver decisión de "cero libs de charting"
 * en el doc local de #132.
 *
 * @module components/ui/LineChart
 */

const WIDTH = 600;
const HEIGHT = 180;
const PAD = 28;

/**
 * @param {Object} props
 * @param {Array<{label: string, value: number}>} props.data
 * @param {string} [props.accent='var(--page-accent)']
 * @param {(v: number) => string} [props.formatValue]
 */
export default function LineChart({ data, accent = 'var(--page-accent)', formatValue = (v) => String(v) }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gunmetal py-4 text-center">Sin datos en el rango seleccionado.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD + i * stepX;
    const y = PAD + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Mostrar como máximo ~6 labels en el eje X para no amontonar texto.
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Tendencia">
      <line x1={PAD} y1={PAD + innerH} x2={PAD + innerW} y2={PAD + innerH} stroke="var(--color-border)" strokeWidth="1" />
      <path d={pathD} fill="none" stroke={accent} strokeWidth="2" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="2.5" fill={accent}>
            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
          </circle>
          {i % labelStep === 0 && (
            <text x={p.x} y={HEIGHT - 6} fontSize="9" textAnchor="middle" fill="var(--color-gunmetal)">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
