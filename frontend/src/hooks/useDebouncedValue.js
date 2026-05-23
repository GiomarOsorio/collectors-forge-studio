/**
 * @file Hook que debouncea un valor — útil para evitar disparar requests
 * en cada keystroke de un form reactivo.
 *
 * Issue #61 (calc reactivo): la calculadora computa al cambiar cualquier
 * input. Para no llamar al backend 50 veces en una palabra, debounceamos
 * el form 300 ms antes de disparar `calculateQuote`.
 *
 * @module hooks/useDebouncedValue
 */

import { useEffect, useState } from 'react';

/**
 * @template T
 * @param {T} value - Valor a debouncear.
 * @param {number} [delayMs=300] - Retraso en ms antes de propagar el cambio.
 * @returns {T} - El último valor que no cambió en `delayMs`.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
