/**
 * Formatea cantidades de inventario para evitar ambigüedad visual.
 *
 * es-CO usa `.` como separador de miles, lo que hace que `1500` se renderice
 * como `"1.500"` y se confunda con un decimal. Se desactiva el agrupamiento
 * de miles (`useGrouping: false`) para que las cantidades enteras se muestren
 * limpias y los decimales usen `,` sin ambigüedad.
 *
 * @param {number|string} value - Cantidad a formatear.
 * @param {number} [maxFractionDigits=3] - Máximo de decimales.
 * @returns {string} Cantidad formateada (p.ej. "1500" o "1500,75").
 */
export function formatQuantity(value, maxFractionDigits = 3) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('es-CO', {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });
}
