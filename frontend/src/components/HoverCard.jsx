/**
 * @file HoverCard genérico para mostrar contenido contextual al pasar el cursor.
 *
 * Renderiza el trigger inline y un panel flotante que aparece al `mouseenter`
 * (con un pequeño delay para evitar parpadeos). El panel se posiciona en
 * `position: absolute` relativo al wrapper. Para usar dentro de tablas o
 * filas, basta envolver la celda activa.
 *
 * Uso típico:
 * ```jsx
 * <HoverCard content={<FilamentDetails item={f} />}>
 *   <span>{f.name}</span>
 * </HoverCard>
 * ```
 *
 * @module components/HoverCard
 */

import { useRef, useState } from 'react';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 100;

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children       - Elemento trigger (siempre visible).
 * @param {React.ReactNode} props.content        - Contenido del panel flotante.
 * @param {('top'|'bottom'|'right'|'left')} [props.placement='bottom'] - Lado del panel.
 * @param {string} [props.className]             - Clases extra para el panel.
 * @returns {JSX.Element}
 */
export default function HoverCard({ children, content, placement = 'bottom', className = '' }) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const handleLeave = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const placementClass = {
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
  }[placement];

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {open && content && (
        <span
          role="tooltip"
          className={`absolute z-50 min-w-[220px] max-w-xs bg-[#0A0E16] border border-[#222630] rounded-lg shadow-xl p-3 text-xs ${placementClass} ${className}`}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {content}
        </span>
      )}
    </span>
  );
}
