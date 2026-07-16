/**
 * @file AppTabs primitive (patrón P4 — foundation responsive).
 *
 * Fila de tabs tipo pill con contador, unifica las 4 implementaciones
 * paralelas del repo (CategoryTabs / TabsBar ×2 / CostTabs). Scroll
 * horizontal con scroll-snap y fade gradiente en el borde derecho que
 * aparece solo cuando hay tabs ocultas — antes el usuario no tenía
 * ninguna señal de que existían más.
 *
 * @module components/ui/AppTabs
 */

import useOverflowFade from './useOverflowFade';

/**
 * @typedef {Object} AppTabItem
 * @property {string} id
 * @property {string} label
 * @property {React.ComponentType} [icon] - Ícono lucide opcional
 * @property {number} [count]             - Contador en badge; omitir para ocultarlo
 */

/**
 * @param {Object} props
 * @param {AppTabItem[]} props.items
 * @param {string} props.value                    - id de la tab activa
 * @param {(id: string) => void} props.onChange
 * @param {string} [props.accent='var(--page-accent, #2DD4BF)'] - Color de la tab activa
 * @param {string} [props.className]              - Clases extra del wrapper (padding, borde…)
 */
export default function AppTabs({
  items,
  value,
  onChange,
  accent = 'var(--page-accent, #2DD4BF)',
  className = '',
}) {
  const { scrollRef, fadeVisible, onScroll } = useOverflowFade();

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="tablist"
        className="flex gap-2 overflow-x-auto px-0.5 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange?.(item.id)}
              className={`inline-flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                active
                  ? ''
                  : 'bg-[var(--color-surf-card)] border-[var(--color-border-strong)] text-steel hover:border-[var(--color-border-bright)]'
              }`}
              style={{
                scrollSnapAlign: 'start',
                ...(active
                  ? {
                      background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                      borderColor: `color-mix(in oklab, ${accent} 50%, transparent)`,
                      color: accent,
                    }
                  : undefined),
              }}
            >
              {Icon && <Icon size={13} />}
              {item.label}
              {item.count != null && (
                <span
                  className="mono text-[10.5px] font-bold px-1.5 py-px rounded-full"
                  style={{
                    background: active
                      ? `color-mix(in oklab, ${accent} 22%, transparent)`
                      : 'var(--color-surf-card-2)',
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 bottom-2 w-9 pointer-events-none transition-opacity duration-200"
        style={{
          background: 'linear-gradient(to right, transparent, var(--color-forge-black))',
          opacity: fadeVisible ? 1 : 0,
        }}
      />
    </div>
  );
}
