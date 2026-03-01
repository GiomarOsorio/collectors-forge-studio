/**
 * @file Componentes de skeleton loader para estados de carga.
 *
 * Provee variantes para tablas, grillas de tarjetas y formularios.
 * Usa la clase CSS `.tf-skeleton` con animación shimmer definida en index.css.
 *
 * @module components/SkeletonLoader
 */

/**
 * Bloque skeleton genérico de tamaño configurable.
 * @param {{ className?: string }} props
 */
function SkeletonBlock({ className = '' }) {
  return <div className={`tf-skeleton ${className}`} aria-hidden="true" />;
}

/**
 * Fila de skeleton para tablas.
 * @param {{ cols?: number }} props
 */
function SkeletonRow({ cols = 4 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <SkeletonBlock className={`h-4 ${i === 0 ? 'w-3/4' : 'w-1/2'}`} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton para tablas de datos.
 * @param {{ rows?: number, cols?: number }} props
 */
export function SkeletonTable({ rows = 6, cols = 4 }) {
  return (
    <div className="tf-table-wrap" role="status" aria-label="Cargando datos...">
      <table className="w-full">
        <thead className="tf-thead">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="tf-th">
                <SkeletonBlock className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton para grillas de tarjetas (ej: StudioHome, Cola).
 * @param {{ count?: number, cols?: string }} props
 */
export function SkeletonCards({ count = 6, cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' }) {
  return (
    <div className={`grid ${cols} gap-4`} role="status" aria-label="Cargando...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tf-card p-6 flex flex-col items-center gap-4" aria-hidden="true">
          <SkeletonBlock className="w-16 h-16 rounded-2xl" />
          <div className="w-full flex flex-col items-center gap-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para filas de lista (ej: cola de impresión).
 * @param {{ count?: number }} props
 */
export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tf-card p-5 flex items-center gap-4" aria-hidden="true">
          <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para formularios de dos columnas (ej: calculadora).
 */
export function SkeletonForm() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="status" aria-label="Cargando formulario...">
      {/* Columna izquierda */}
      <div className="tf-card p-6 space-y-5" aria-hidden="true">
        <SkeletonBlock className="h-5 w-32 mb-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      {/* Columna derecha */}
      <div className="tf-card p-6 space-y-4" aria-hidden="true">
        <SkeletonBlock className="h-5 w-32 mb-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton para tarjetas de dashboard (ej: mantenimiento).
 * @param {{ count?: number }} props
 */
export function SkeletonDashboard({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" role="status" aria-label="Cargando...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tf-card p-6 space-y-4" aria-hidden="true">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center">
                <SkeletonBlock className="h-3 w-32" />
                <SkeletonBlock className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
