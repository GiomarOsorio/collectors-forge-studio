/**
 * @file Hook interno de ui/: detecta overflow horizontal en un contenedor
 * con scroll para mostrar/ocultar el fade gradiente del borde derecho
 * (patrones P4 AppTabs y P5 KPIStrip).
 *
 * @module components/ui/useOverflowFade
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @returns {{ scrollRef: React.RefObject, fadeVisible: boolean, onScroll: () => void }}
 *   `scrollRef` va en el contenedor con `overflow-x-auto`; `onScroll` en su
 *   handler de scroll. `fadeVisible` es true mientras quede contenido oculto
 *   a la derecha.
 */
export default function useOverflowFade() {
  const scrollRef = useRef(null);
  const [fadeVisible, setFadeVisible] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 2px de tolerancia por redondeo subpixel del navegador.
    setFadeVisible(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  return { scrollRef, fadeVisible, onScroll: update };
}
