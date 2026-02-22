/**
 * Extrae un mensaje de error legible de una respuesta de Axios.
 *
 * Pydantic devuelve `detail` como un array de objetos cuando hay errores de
 * validación (p. ej. email inválido). Este helper normaliza eso a un string
 * para que pueda pasarse de forma segura a `toast.error()`.
 *
 * @param {unknown} err       - El error capturado en el catch
 * @param {string}  [fallback] - Mensaje de respaldo si no se puede extraer detalle
 * @returns {string}
 */
export function apiErrorMsg(err, fallback = 'Error inesperado') {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail[0]?.msg ?? fallback;
  }
  return fallback;
}
