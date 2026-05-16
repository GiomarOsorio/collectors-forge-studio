/**
 * @file EmptyState primitive (Claude Design v2 port).
 *
 * Refresh del `components/EmptyState.jsx` legacy con la API del nuevo
 * design: icon-badge coloreado + title + hint + action slot.
 *
 * @module components/ui/EmptyState
 */

/**
 * @param {Object} props
 * @param {React.ComponentType} props.icon
 * @param {string} props.title
 * @param {string} [props.hint] - Texto descriptivo bajo el title
 * @param {React.ReactNode} [props.action] - Botón/link CTA opcional
 * @param {string} [props.accent='var(--page-accent)']
 */
export default function EmptyState({ icon: Icon, title, hint, action, accent = 'var(--page-accent)' }) {
  return (
    <div className="px-6 py-14 text-center max-w-md mx-auto">
      {Icon && (
        <div
          className="w-14 h-14 mx-auto mb-3.5 rounded-2xl flex items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${accent} 10%, transparent)`,
            border: `1px solid color-mix(in oklab, ${accent} 22%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={24} />
        </div>
      )}
      <p className="text-[15px] font-semibold text-tech-white leading-snug mb-1.5">{title}</p>
      {hint && <p className="text-[12.5px] text-gunmetal leading-relaxed mb-4">{hint}</p>}
      {action}
    </div>
  );
}
