/**
 * @file Swatch primitive: representación visual del color de un filamento.
 *
 * Pinta un disco glossy con highlight y "agujero" central (spool). Detecta si
 * el color es claro para ajustar el rim del shadow. Si `level !== 'ok'` agrega
 * un anillo amber (alerta de stock bajo) con pulso si `critical`.
 *
 * Inspirado en `claude design/inventory-mobile.jsx::SwatchSmall`.
 *
 * @module components/ui/Swatch
 */

const FALLBACK_COLOR = '#7A8494';

/**
 * Indica si un hex `#RRGGBB` se percibe como color claro.
 *
 * @param {string} hex
 * @returns {boolean}
 */
function isLightHex(hex) {
  if (!hex || hex.length !== 7 || hex[0] !== '#') return false;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b > 200;
  } catch {
    return false;
  }
}

/**
 * @param {Object} props
 * @param {string} props.color  - Hex del filamento (`#RRGGBB`). Si null/inválido usa fallback gris.
 * @param {number} [props.size=36]
 * @param {('ok'|'low'|'critical')} [props.level='ok']
 */
export default function Swatch({ color, size = 36, level = 'ok' }) {
  const hex = color && color.length === 7 ? color : FALLBACK_COLOR;
  const rim = isLightHex(hex) ? 'rgba(228,232,237,0.25)' : 'rgba(15,18,25,0.5)';
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 28%, ${hex}ee 0%, ${hex} 55%, ${hex}99 100%)`,
        boxShadow: `0 0 0 1px ${rim} inset, 0 1px 2px rgba(0,0,0,0.4)`,
      }}
    >
      {/* "Agujero" del carrete */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full bg-[var(--color-surf-card)] border border-[var(--color-border)]"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          transform: 'translate(-50%, -50%)',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)',
        }}
      />
      {/* Anillo de alerta para low/critical */}
      {level !== 'ok' && (
        <div
          className={level === 'critical' ? 'pulse-soft absolute -inset-[3px] rounded-full pointer-events-none' : 'absolute -inset-[3px] rounded-full pointer-events-none'}
          style={{ border: `1px solid ${level === 'critical' ? '#FBBF24aa' : '#FBBF2455'}` }}
        />
      )}
    </div>
  );
}
