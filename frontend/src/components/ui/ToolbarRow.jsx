/**
 * @file ToolbarRow primitive (Claude Design v2 port).
 *
 * Fila sticky de toolbar con padding consistente y border-bottom.
 * Wrapper para search + chips + actions arriba de listas/grids.
 *
 * @module components/ui/ToolbarRow
 */

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export default function ToolbarRow({ children, className = '' }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-7 py-3 border-b border-[var(--color-border-soft)] bg-forge-black ${className}`}
    >
      {children}
    </div>
  );
}
