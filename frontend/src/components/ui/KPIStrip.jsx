/**
 * @file KPIStrip primitive (patrón P5 — foundation responsive).
 *
 * Fila de KPIs. Desktop (≥1024): `flex-wrap`, las cards fluyen a la
 * siguiente línea (comportamiento actual del combo repetido
 * `flex flex-wrap` + wrappers `min-w-[180px]`). Mobile (<1024):
 * `overflow-x-auto` con scroll-snap + fade derecho — evita que 6 KPIs
 * envueltos coman media pantalla de scroll vertical.
 *
 * @module components/ui/KPIStrip
 */

import { Children } from 'react';
import KPI from './KPI';
import useOverflowFade from './useOverflowFade';
import { useIsMobile } from '../../hooks/useMediaQuery';

/**
 * @param {Object} props
 * @param {Array<Object>} [props.items]  - Props de `<KPI>` por item; alternativa a children
 * @param {React.ReactNode} [props.children] - `<KPI>`s directos (cada uno se envuelve)
 * @param {number} [props.minWidth=180]  - min-width por KPI en desktop (px)
 * @param {number} [props.snapWidth=200] - Ancho fijo por KPI en el carrusel mobile (px)
 * @param {string} [props.className]     - Clases extra del wrapper (padding externo…)
 */
export default function KPIStrip({ items, children, minWidth = 180, snapWidth = 200, className = '' }) {
  const isMobile = useIsMobile();
  const { scrollRef, fadeVisible, onScroll } = useOverflowFade();

  const cards = Children.toArray(
    items ? items.map((item, i) => <KPI key={item.label ?? i} {...item} />) : children,
  );

  if (isMobile) {
    return (
      <div className={`relative ${className}`}>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-2.5 overflow-x-auto pb-2.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {cards.map((card, i) => (
            <div
              key={card?.key ?? i}
              className="flex shrink-0"
              style={{ flex: `0 0 ${snapWidth}px`, scrollSnapAlign: 'start' }}
            >
              {card}
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 bottom-2.5 w-8 pointer-events-none transition-opacity duration-200"
          style={{
            background: 'linear-gradient(to right, transparent, var(--color-forge-black))',
            opacity: fadeVisible ? 1 : 0,
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {cards.map((card, i) => (
        <div key={card?.key ?? i} className="flex-1 flex" style={{ minWidth }}>
          {card}
        </div>
      ))}
    </div>
  );
}
