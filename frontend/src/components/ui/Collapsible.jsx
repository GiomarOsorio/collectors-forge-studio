/**
 * @file Widget de disclosure (acordeón simple).
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0.
 *
 * Renderiza una fila `summary` clicable y, si está abierto, el contenido
 * `children` debajo. La zona clicable es un `div[role="button"]` (no un
 * `<button>`) para que `summary` pueda contener elementos interactivos
 * propios sin anidar `<button>` dentro de `<button>`.
 *
 * Soporta modo no controlado (estado interno) y controlado (`open` +
 * `onToggle`, el padre decide cuándo abrir/cerrar).
 *
 * @module components/ui/Collapsible
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.summary          - Contenido de la fila siempre visible.
 * @param {React.ReactNode} props.children          - Contenido mostrado cuando está abierto.
 * @param {boolean} [props.defaultOpen=false]        - Estado inicial (modo no controlado).
 * @param {string} [props.className='']              - Clases del contenedor raíz.
 * @param {string} [props.summaryClassName='']       - Clases adicionales de la fila summary.
 * @param {boolean} [props.open]                     - Si se provee, el componente es controlado.
 * @param {(open: boolean) => void} [props.onToggle] - Callback al hacer click (modo controlado).
 */
export default function Collapsible({
  summary,
  children,
  defaultOpen = false,
  className = '',
  summaryClassName = '',
  open: controlledOpen,
  onToggle,
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`w-full flex items-center justify-between gap-2 text-left cursor-pointer ${summaryClassName}`}
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0">{summary}</div>
        <ChevronDown
          size={16}
          className={`text-gunmetal shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}
