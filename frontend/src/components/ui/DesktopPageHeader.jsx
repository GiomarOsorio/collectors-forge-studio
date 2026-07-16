/**
 * @file DesktopPageHeader primitive (patrón P7 — foundation responsive).
 *
 * Header de página desktop: icono con tinte del accent de la app + eyebrow
 * mono uppercase + título con badge de conteo + acciones a la derecha —
 * el bloque JSX hoy copiado en ~15 páginas. Absorbe al huérfano
 * `PageHeader` (v2, sin consumidores), eliminado en este mismo cambio.
 *
 * Referencia visual 1:1: `agent-docs/ui-responsive/mockups/patterns.html` §P7.
 *
 * @module components/ui/DesktopPageHeader
 */

/**
 * @param {Object} props
 * @param {React.ComponentType} [props.icon]  - Ícono lucide del badge
 * @param {string} [props.eyebrow]            - Texto mono uppercase sobre el título ("Queue · Cola")
 * @param {string} props.title
 * @param {number|string} [props.count]       - Badge de conteo junto al título
 * @param {React.ReactNode} [props.actions]   - Botones a la derecha
 * @param {string} [props.accent='var(--page-accent, #2DD4BF)']
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.children]  - Slot extra debajo del título
 */
export default function DesktopPageHeader({
  icon: Icon,
  eyebrow,
  title,
  count,
  actions,
  accent = 'var(--page-accent, #2DD4BF)',
  className = '',
  children,
}) {
  return (
    <header className={`flex items-center gap-3.5 ${className}`}>
      {Icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklab, ${accent} 12%, transparent)`,
            border: `1px solid color-mix(in oklab, ${accent} 35%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={19} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="mono text-[10px] font-bold uppercase tracking-widest text-gunmetal mb-0.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-lg font-semibold text-tech-white leading-tight tracking-tight m-0 inline-flex items-center gap-2">
          <span className="truncate">{title}</span>
          {count != null && (
            <span
              className="mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                color: accent,
              }}
            >
              {count}
            </span>
          )}
        </h1>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
