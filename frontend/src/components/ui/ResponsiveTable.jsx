/**
 * @file ResponsiveTable primitive (patrón P2 — foundation responsive).
 *
 * Tabla de datos de solo lectura (bitácora de impresión, historial…).
 *
 * - **Desktop (≥1024)**: `<table>` dentro de un wrapper con `overflow-x-auto`
 *   SIEMPRE activo (fallback aunque la tabla quepa).
 * - **Mobile (<1024)**: lista de cards — título + pill de estado en la
 *   primera línea, columnas priorizadas como pares label/valor en
 *   `grid-cols-2`. Con la prop `mobileCard` el consumidor controla la card
 *   completa; sin ella se genera automática con las columnas `mobile !== false`.
 *
 * Referencia visual 1:1: `agent-docs/ui-responsive/mockups/patterns.html` §P2.
 *
 * @module components/ui/ResponsiveTable
 */

import { useIsMobile } from '../../hooks/useMediaQuery';

/**
 * @typedef {Object} ResponsiveTableColumn
 * @property {string} key
 * @property {string} label
 * @property {(row: Object, index: number) => React.ReactNode} [render] - Default: `row[key]`
 * @property {boolean} [strong=false]  - Texto destacado (color principal)
 * @property {boolean} [mobile=true]   - false = la columna no sobrevive en la card mobile
 * @property {string} [className]      - Clases extra del `<td>`
 */

/**
 * @param {Object} props
 * @param {ResponsiveTableColumn[]} props.columns
 * @param {Object[]} props.rows
 * @param {(row: Object, index: number) => string|number} [props.rowKey]
 * @param {(row: Object, index: number) => void} [props.onRowClick]
 * @param {(row: Object, index: number) => React.ReactNode} [props.mobileCard]
 *   Render custom de la card mobile completa (reemplaza la automática)
 * @param {(row: Object, index: number) => React.ReactNode} [props.mobileTitle]
 *   Título de la card automática; default: primera columna
 * @param {(row: Object, index: number) => React.ReactNode} [props.mobileBadge]
 *   Nodo a la derecha del título (típicamente `<StatusPill>`)
 * @param {number} [props.minWidth] - min-width de la tabla desktop en px
 * @param {React.ReactNode} [props.empty] - Contenido cuando `rows` está vacío
 * @param {string} [props.className]
 */
export default function ResponsiveTable({
  columns,
  rows,
  rowKey = (_row, index) => index,
  onRowClick,
  mobileCard,
  mobileTitle,
  mobileBadge,
  minWidth,
  empty = null,
  className = '',
}) {
  const isMobile = useIsMobile();
  const cell = (col, row, index) => (col.render ? col.render(row, index) : row[col.key]);

  if (!rows.length && empty) return empty;

  if (isMobile) {
    const [first, ...rest] = columns;
    const mobileCols = rest.filter((col) => col.mobile !== false);
    return (
      <div className={className}>
        {rows.map((row, index) => {
          if (mobileCard) {
            return <div key={rowKey(row, index)}>{mobileCard(row, index)}</div>;
          }
          return (
            <div
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={`bg-[var(--color-surf-panel)] border border-[var(--color-border)] rounded-xl p-3.5 mb-2.5 ${
                onRowClick ? 'cursor-pointer active:bg-[var(--color-surf-hover)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-sm font-semibold text-tech-white min-w-0 truncate">
                  {mobileTitle ? mobileTitle(row, index) : cell(first, row, index)}
                </span>
                {mobileBadge && <span className="shrink-0">{mobileBadge(row, index)}</span>}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {mobileCols.map((col) => (
                  <div key={col.key}>
                    <label className="block mono text-[9.5px] font-bold uppercase tracking-wider text-gunmetal mb-0.5">
                      {col.label}
                    </label>
                    <span className="text-[12.5px] text-steel">{cell(col, row, index)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`bg-[var(--color-surf-panel)] border border-[var(--color-border)] rounded-xl overflow-x-auto ${className}`}
    >
      <table className="w-full border-collapse" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="bg-[var(--color-surf-card-2)] border-b border-[var(--color-border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-3.5 py-2.5 mono text-[10px] font-bold uppercase tracking-wider text-gunmetal whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={`hover:bg-[var(--color-surf-hover)] ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3.5 py-2.5 text-[12.5px] border-b border-[var(--color-border-soft)] whitespace-nowrap ${
                    col.strong ? 'text-tech-white font-medium' : 'text-steel'
                  } ${col.className ?? ''}`}
                >
                  {cell(col, row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
