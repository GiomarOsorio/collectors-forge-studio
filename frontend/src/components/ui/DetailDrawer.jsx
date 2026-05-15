/**
 * @file DetailDrawer primitive: panel deslizable derecho con backdrop.
 *
 * Aparece cuando `open=true`, sale por derecha con animación CSS. `Esc` o
 * click en backdrop cierra. Bloquea scroll del body mientras está abierto.
 *
 * Inspirado en `claude design/inventory.jsx::DetailDrawer`.
 *
 * @module components/ui/DetailDrawer
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.title]
 * @param {number} [props.width=420]
 * @param {React.ReactNode} props.children
 */
export default function DetailDrawer({ open, onClose, title, width = 420, children }) {
  // ESC cierra; lock body scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 right-0 bottom-0 z-50 bg-[var(--color-surf-sidebar)] border-l border-[var(--color-border-soft)] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '100%', maxWidth: width }}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] shrink-0">
          <h2 className="text-sm font-semibold text-tech-white truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
