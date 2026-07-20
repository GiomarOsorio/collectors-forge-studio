/**
 * @file LineItems primitive (patrón P1 — foundation responsive).
 *
 * Filas editables tipo tabla (ítems de cotización manual, líneas de PO,
 * ítems de log de mantenimiento, filamentos extra de calculadora).
 *
 * - **Desktop (≥1024)**: grid con cabecera de columnas. Los anchos `fr` se
 *   envuelven en `minmax(0, Xfr)` — un track `fr` a secas hereda el ancho
 *   intrínseco de los inputs y desborda el contenedor.
 * - **Mobile (<1024)**: cada línea es una card apilada — la primera columna
 *   (campo principal) va full-width arriba, el resto en `grid-cols-2` con
 *   label mono uppercase, el botón quitar 44×44 en la esquina superior
 *   derecha y un pie con "Ítem i de n" + contenido opcional (subtotal).
 * - **`stacked`**: fuerza la card apilada en todos los anchos (drawers
 *   angostos ~480px donde una fila grid quedaría comprimida — p. ej. el
 *   LogFormDrawer de Mantenimiento, issue #166). En este modo el campo
 *   principal también lleva su label.
 *
 * Referencia visual 1:1: `agent-docs/ui-responsive/mockups/patterns.html` §P1.
 *
 * @module components/ui/LineItems
 */

import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

/**
 * @typedef {Object} LineItemColumn
 * @property {string} key
 * @property {string} label - Cabecera desktop y label de campo en la card mobile
 * @property {string} [width='1fr'] - Track del grid desktop ('2.2fr', '90px'…)
 * @property {(item: Object, index: number) => React.ReactNode} render
 * @property {boolean} [mobile=true] - false = la columna no aparece en la card mobile
 * @property {boolean} [full=false]  - true = ocupa las 2 columnas del grid mobile
 */

/** Envuelve tracks `fr` en minmax(0, …) para que los inputs no expandan el grid. */
const toTrack = (width) => (/fr$/.test(width) ? `minmax(0, ${width})` : width);

/**
 * @param {Object} props
 * @param {LineItemColumn[]} props.columns - La primera es el campo principal
 * @param {Object[]} props.items
 * @param {(item: Object, index: number) => string|number} [props.itemKey]
 * @param {(item: Object, index: number) => void} [props.onRemove] - Muestra el botón quitar
 * @param {(item: Object, index: number) => React.ReactNode} [props.mobileFoot]
 *   Contenido derecho del pie de card (típicamente el subtotal)
 * @param {React.ReactNode} [props.footer] - Fila de total al pie (solo desktop)
 * @param {number} [props.minWidth=640] - min-width del grid desktop; el wrapper hace scroll-x
 * @param {boolean} [props.stacked=false] - fuerza la card apilada en todos los anchos
 * @param {string} [props.removeLabel='Quitar ítem']
 * @param {string} [props.className]
 */
export default function LineItems({
  columns,
  items,
  itemKey = (_item, index) => index,
  onRemove,
  mobileFoot,
  footer,
  minWidth = 640,
  stacked = false,
  removeLabel = 'Quitar ítem',
  className = '',
}) {
  const isMobile = useIsMobile();

  if (isMobile || stacked) {
    const [primary, ...rest] = columns;
    const mobileCols = rest.filter((col) => col.mobile !== false);
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div
            key={itemKey(item, index)}
            className="relative bg-[var(--color-surf-panel)] border border-[var(--color-border)] rounded-xl p-3.5 mb-3"
          >
            {onRemove && (
              <button
                type="button"
                title={removeLabel}
                aria-label={removeLabel}
                onClick={() => onRemove(item, index)}
                className="absolute top-2 right-2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-gunmetal hover:text-forge-rose hover:bg-forge-rose/12 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            <div className={`mb-2.5 ${onRemove ? 'pr-12' : ''}`}>
              {stacked && primary.label && (
                <label className="block mono text-[9.5px] font-bold uppercase tracking-wider text-gunmetal mb-1">
                  {primary.label}
                </label>
              )}
              {primary.render(item, index)}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {mobileCols.map((col) => (
                <div key={col.key} className={col.full ? 'col-span-2' : ''}>
                  <label className="block mono text-[9.5px] font-bold uppercase tracking-wider text-gunmetal mb-1">
                    {col.label}
                  </label>
                  {col.render(item, index)}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border-soft)]">
              <span className="mono text-[11px] uppercase tracking-wide text-gunmetal">
                Ítem {index + 1} de {items.length}
              </span>
              {mobileFoot && (
                <span className="mono text-[13.5px] font-semibold text-tech-white">
                  {mobileFoot(item, index)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const template = [...columns.map((col) => toTrack(col.width ?? '1fr')), ...(onRemove ? ['44px'] : [])].join(' ');
  return (
    <div className={`overflow-x-auto rounded-xl border border-[var(--color-border)] ${className}`}>
      <div style={{ minWidth }}>
        <div
          className="grid gap-2.5 items-center px-4 py-2.5 bg-[var(--color-surf-card-2)] border-b border-[var(--color-border)]"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((col) => (
            <span key={col.key} className="mono text-[10.5px] font-bold uppercase tracking-wider text-gunmetal">
              {col.label}
            </span>
          ))}
          {onRemove && <span />}
        </div>
        {items.map((item, index) => (
          <div
            key={itemKey(item, index)}
            className="grid gap-2.5 items-center px-4 py-3 border-b border-[var(--color-border-soft)] last:border-b-0"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((col) => (
              <div key={col.key} className="min-w-0">
                {col.render(item, index)}
              </div>
            ))}
            {onRemove && (
              <button
                type="button"
                title={removeLabel}
                aria-label={removeLabel}
                onClick={() => onRemove(item, index)}
                className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-gunmetal hover:text-forge-rose hover:bg-forge-rose/12 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {footer && (
          <div className="flex justify-end px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surf-card-2)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
