/**
 * @file ProgressBar primitive (Claude Design v2 port).
 *
 * Barra de progreso minimal con tint amber automático debajo de `warnAt`
 * (ratio). Usada en Vault para cuota de almacenamiento, en Mantenimiento
 * para % vida útil, en Cola para fuel-gauge de filamento.
 *
 * @module components/ui/ProgressBar
 */

/**
 * @param {Object} props
 * @param {number} props.value
 * @param {number} [props.max=100]
 * @param {string} [props.accent='var(--page-accent)']
 * @param {number} [props.warnAt=0.2] - Ratio (0-1) bajo el cual el bar se pone amber
 * @param {number} [props.height=4]
 * @param {string|number} [props.width='100%']
 */
export default function ProgressBar({
  value,
  max = 100,
  accent = 'var(--page-accent)',
  warnAt = 0.2,
  height = 4,
  width = '100%',
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const warn = max > 0 && value / max <= warnAt;
  return (
    <div
      className="bg-white/5 overflow-hidden"
      style={{ width, height, borderRadius: height / 2 }}
    >
      <div
        className="h-full transition-all duration-200"
        style={{
          width: `${pct}%`,
          background: warn ? 'var(--color-forge-amber)' : accent,
          borderRadius: height / 2,
        }}
      />
    </div>
  );
}
