/**
 * @file Sparkline primitive (mini-gráfico de línea con relleno).
 *
 * Render SVG inline. Acepta arreglo numérico arbitrario. Pinta polyline + área
 * con degradado al color especificado y un punto en el último dato.
 *
 * Inspirado en `claude design/inventory.jsx::Sparkline`.
 *
 * @module components/ui/Sparkline
 */

let _gradId = 0;

/**
 * @param {Object} props
 * @param {number[]} props.data         - Serie numérica
 * @param {string}   [props.color]      - Color del trazo
 * @param {number}   [props.width=96]
 * @param {number}   [props.height=28]
 */
export default function Sparkline({ data, color = '#3B82F6', width = 96, height = 28 }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const id = `spark-grad-${++_gradId}`;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  const last = data[data.length - 1];
  const lastX = (data.length - 1) * step;
  const lastY = height - (last / max) * (height - 4) - 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
