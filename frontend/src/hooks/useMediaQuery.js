/**
 * @file Hook reactivo para `window.matchMedia`.
 *
 * Útil para conmutar entre shells de UI (desktop vs mobile) sin duplicar
 * estado. La query se evalúa al montar y se mantiene sincronizada vía
 * `MediaQueryList.addEventListener('change', ...)`.
 *
 * @module hooks/useMediaQuery
 */

import { useEffect, useState } from 'react';

/**
 * Devuelve `true` si la query CSS coincide actualmente.
 * SSR-safe: arranca en `false` cuando `window` no existe.
 *
 * @param {string} query - Media query CSS, ej. `'(max-width: 1279px)'`.
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Atajo: `true` debajo de Tailwind `xl` (≤ 1279px).
 *
 * @returns {boolean}
 */
export function useIsMobile() {
  return useMediaQuery('(max-width: 1279px)');
}
