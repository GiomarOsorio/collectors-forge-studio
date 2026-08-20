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
    // Un 422 sin el nombre del campo es indepurable desde la UI: FastAPI manda
    // `loc: ['body', 'margin_percent']`, así que lo anexamos al mensaje.
    return detail
      .slice(0, 3)
      .map((e) => {
        const msg = e?.msg;
        if (!msg) return null;
        const field = Array.isArray(e?.loc) ? e.loc.filter((l) => l !== 'body').join('.') : '';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join(' · ') || fallback;
  }
  // detail objeto suelto: nunca devolver el objeto (React error #31 al render)
  if (typeof detail === 'object') return detail?.msg ?? fallback;
  return fallback;
}
