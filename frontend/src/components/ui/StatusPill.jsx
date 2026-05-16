/**
 * @file StatusPill primitive (Claude Design v2 port).
 *
 * Pill coloreado con presets de tono para estados (printing/done/pending/
 * paused/warn/danger/info/active/neutral). Usado en Cola, Mantenimiento,
 * Vault para tag status de filas o cards.
 *
 * @module components/ui/StatusPill
 */

/**
 * Mapeo tone → color/bg/border. Coincide 1:1 con el design Claude.
 */
export const STATUS_PRESETS = {
  active:   { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.30)' },
  printing: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.10)',  border: 'rgba(59, 130, 246, 0.32)' },
  pending:  { color: '#94A0AE', bg: 'rgba(148, 160, 174, 0.10)', border: 'rgba(148, 160, 174, 0.25)' },
  paused:   { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.30)' },
  done:     { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.28)' },
  warn:     { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.30)' },
  danger:   { color: '#F87171', bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.30)' },
  info:     { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.30)' },
  neutral:  { color: '#94A0AE', bg: 'rgba(228, 232, 237, 0.05)', border: '#222630' },
};

/**
 * @param {Object} props
 * @param {keyof typeof STATUS_PRESETS} [props.tone='neutral']
 * @param {React.ComponentType} [props.icon]
 * @param {('sm'|'lg')} [props.size='sm']
 * @param {React.ReactNode} props.children
 */
export default function StatusPill({ tone = 'neutral', icon: Icon, size = 'sm', children }) {
  const s = STATUS_PRESETS[tone] || STATUS_PRESETS.neutral;
  const padding = size === 'lg' ? 'px-2 py-1' : 'px-1.5 py-0.5';
  const text = size === 'lg' ? 'text-[11px]' : 'text-[9.5px]';
  const iconSize = size === 'lg' ? 10 : 9;
  return (
    <span
      className={`mono inline-flex items-center gap-1 ${padding} ${text} font-semibold uppercase tracking-wider rounded-full whitespace-nowrap`}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </span>
  );
}
