/**
 * @file PageHeader primitive (Claude Design v2 port).
 *
 * Header de página con ícono-badge a la izquierda, eyebrow (nombre app +
 * dot accent), title grande, subtitle opcional y actions a la derecha.
 *
 * Inspirado en `claude design/components.jsx::PageHeader`.
 *
 * @module components/ui/PageHeader
 */

/**
 * @param {Object} props
 * @param {React.ComponentType} [props.icon] - Ícono lucide para el badge
 * @param {string} [props.appName] - Eyebrow text (mayúsculas, con dot)
 * @param {string} props.title - Título grande de la página
 * @param {string} [props.subtitle] - Descripción opcional debajo del título
 * @param {string} [props.accent='var(--page-accent)'] - Color hex o CSS var
 * @param {React.ReactNode} [props.actions] - Botones / links a la derecha
 * @param {React.ReactNode} [props.children] - Slot extra debajo del subtitle
 */
export default function PageHeader({
  icon: Icon,
  appName,
  title,
  subtitle,
  accent = 'var(--page-accent)',
  actions,
  children,
}) {
  return (
    <header className="flex items-start gap-4 px-7 pt-5 pb-4 border-b border-[var(--color-border-soft)] bg-forge-black">
      {Icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklab, ${accent} 12%, transparent)`,
            border: `1px solid color-mix(in oklab, ${accent} 35%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={20} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {appName && (
          <p
            className="mono text-[10px] uppercase tracking-widest text-gunmetal mb-1 inline-flex items-center gap-1.5"
          >
            <span
              className="w-1 h-1 rounded-full inline-block"
              style={{ background: accent }}
            />
            {appName}
          </p>
        )}
        <h1 className="text-[22px] font-semibold text-tech-white leading-tight tracking-tight m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-steel leading-relaxed mt-1 max-w-xl">{subtitle}</p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
