/**
 * @file CardGrid primitive (patrón P3 — foundation responsive).
 *
 * Wrapper del grid `repeat(auto-fill, minmax(Xpx, 1fr))` que hoy está
 * repetido inline en ~10 páginas. Las cards fluyen y colapsan a una
 * columna sola cuando el contenedor es más angosto que `min`.
 *
 * @module components/ui/CardGrid
 */

/**
 * @param {Object} props
 * @param {number} [props.min=240]  - Ancho mínimo de cada card en px
 * @param {number} [props.gap=12]   - Gap del grid en px
 * @param {string} [props.className]
 * @param {Object} [props.style]
 * @param {React.ReactNode} props.children
 */
export default function CardGrid({ min = 240, gap = 12, className = '', style, children }) {
  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
