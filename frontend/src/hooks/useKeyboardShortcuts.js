/**
 * @file Hook global de atajos de teclado (issue #140, pieza A).
 *
 * Listener `keydown` en `document`. Se ignora si el foco está en un campo
 * editable (input/textarea/select/contenteditable) o si hay un modal
 * abierto (`[role="dialog"]`) — evita interceptar teclas mientras el
 * usuario escribe.
 *
 * Mapa:
 *   `?`        → abre el modal de ayuda de atajos.
 *   `g` + tecla (secuencia con timeout de 1s) → navega entre apps:
 *     g c → /cost, g i → /inventory, g q → /queue, g v → /vault,
 *     g m → /maintenance, g s → /settings.
 *   `/`        → enfoca `[data-search-input]` de la página actual, si existe.
 *   `Esc`      → ya lo manejan los modales individualmente (no se toca acá).
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
 * concepto de modal de ayuda + atajo `?`; el mapa `g`+letra es propio de CFS
 * (bambuddy usa números 1-9 para nav, no aplica a la cantidad de apps de CFS).
 *
 * @module hooks/useKeyboardShortcuts
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const NAV_SHORTCUTS = {
  c: { path: '/cost', label: 'Cost' },
  i: { path: '/inventory', label: 'Inventory' },
  q: { path: '/queue', label: 'Queue' },
  v: { path: '/vault', label: 'Vault' },
  m: { path: '/maintenance', label: 'Maintenance' },
  s: { path: '/settings', label: 'Settings' },
};

const G_SEQUENCE_TIMEOUT_MS = 1000;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function hasOpenModal() {
  return !!document.querySelector('[role="dialog"]');
}

/**
 * @returns {{ helpOpen: boolean, closeHelp: () => void }}
 */
export default function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target) || hasOpenModal()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG.current) {
        pendingG.current = false;
        clearTimeout(timeoutRef.current);
        const target = NAV_SHORTCUTS[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          navigate(target.path);
        }
        return;
      }

      if (e.key === 'g') {
        pendingG.current = true;
        timeoutRef.current = setTimeout(() => {
          pendingG.current = false;
        }, G_SEQUENCE_TIMEOUT_MS);
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (e.key === '/') {
        const input = document.querySelector('[data-search-input]');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timeoutRef.current);
    };
  }, [navigate]);

  return { helpOpen, closeHelp: () => setHelpOpen(false) };
}
