/**
 * @file Menú contextual (click derecho) posicionado en coordenadas de viewport.
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0
 * (versión simplificada: sin submenús ni búsqueda interna — CFS no los
 * necesita todavía; agregar solo si un consumidor real lo requiere).
 *
 * El llamador captura `x`/`y` en el handler `onContextMenu` del elemento
 * disparador (`e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY })`)
 * y renderiza `<ContextMenu>` condicionalmente. El menú se cierra solo al
 * hacer click fuera, presionar Escape, o al ejecutar un item.
 *
 * En touch el click derecho no existe: usar `useContextMenuTrigger` (spread
 * de handlers con long-press de 500ms) o, mejor aún para descubribilidad,
 * un botón ⋮ explícito que llame `open({ x, y })` con las coords del botón.
 *
 * @module components/ui/ContextMenu
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Handlers para disparar un ContextMenu tanto con click derecho (desktop)
 * como con long-press de 500ms (touch, donde `contextmenu` no dispara de
 * forma confiable). El long-press se cancela si el dedo se mueve >10px
 * (scroll) o se levanta antes de tiempo.
 *
 * @param {(coords: {x: number, y: number}) => void} open - Abre el menú en coords de viewport
 * @returns {{onContextMenu: Function, onTouchStart: Function, onTouchMove: Function, onTouchEnd: Function, onTouchCancel: Function}}
 *   Spread directo sobre el elemento disparador: `<div {...triggerProps}>`.
 */
export function useContextMenuTrigger(open) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const onContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      cancel();
      open({ x: e.clientX, y: e.clientY });
    },
    [open, cancel],
  );

  const onTouchStart = useCallback(
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        open({ x: startRef.current.x, y: startRef.current.y });
      }, 500);
    },
    [open, cancel],
  );

  const onTouchMove = useCallback(
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > 10) cancel();
    },
    [cancel],
  );

  return {
    onContextMenu,
    onTouchStart,
    onTouchMove,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}

/**
 * @typedef {Object} ContextMenuItem
 * @property {string} label
 * @property {React.ComponentType} [icon]  - Ícono lucide.
 * @property {() => void} [onClick]        - Ignorado si `divider` es true.
 * @property {boolean} [danger]            - Pinta el item en rojo (acciones destructivas).
 * @property {boolean} [disabled]
 * @property {boolean} [divider]           - Renderiza una línea separadora en vez de un item.
 */

/**
 * @param {Object} props
 * @param {number} props.x
 * @param {number} props.y
 * @param {ContextMenuItem[]} props.items
 * @param {() => void} props.onClose
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ x, y, visible: false });

  // Cerrar al hacer click fuera, al presionar Escape, o al hacer scroll
  // fuera del propio menú.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Ajusta la posición para que el menú no se salga del viewport — medición
  // síncrona antes del paint para evitar parpadeo.
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let adjustedX = x;
    let adjustedY = y;
    if (x + rect.width > window.innerWidth - padding) {
      adjustedX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (adjustedX < padding) adjustedX = padding;
    if (y + rect.height > window.innerHeight - padding) {
      adjustedY = Math.max(padding, window.innerHeight - rect.height - padding);
    }
    if (adjustedY < padding) adjustedY = padding;
    setPosition({ x: adjustedX, y: adjustedY, visible: true });
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] max-w-[280px] rounded-lg border py-1 shadow-xl bg-surf-card-2 border-border-strong"
      style={{ left: position.x, top: position.y, visibility: position.visible ? 'visible' : 'hidden' }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="my-1 border-t border-border" />;
        }
        const Icon = item.icon;
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              item.disabled
                ? 'text-gunmetal-dim cursor-not-allowed'
                : item.danger
                ? 'text-rose-400 hover:bg-rose-500/10'
                : 'text-tech-white hover:bg-surf-hover'
            }`}
          >
            {Icon && (
              <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center">
                <Icon size={14} />
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
