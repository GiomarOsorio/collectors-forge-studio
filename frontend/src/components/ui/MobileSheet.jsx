/**
 * @file MobileSheet primitive: bottom sheet con backdrop.
 *
 * Variante mobile del DetailDrawer. Sube desde abajo, drag-handle visual.
 * `Esc` y click en backdrop cierran. Bloquea scroll del body mientras abierto.
 *
 * Inspirado en `claude design/inventory-mobile.jsx`.
 *
 * @module components/ui/MobileSheet
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.title]
 * @param {('half'|'full')} [props.height='full']
 * @param {React.ReactNode} props.children
 */
export default function MobileSheet({ open, onClose, title, height = 'full', children }) {
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
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed left-0 right-0 bottom-0 z-50 bg-[var(--color-surf-sidebar)] border-t border-[var(--color-border-soft)] rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        } ${height === 'half' ? 'max-h-[60vh]' : 'max-h-[92vh]'}`}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <span className="block w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
        </div>
        <header className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-[var(--color-border-soft)] shrink-0">
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
      </div>
    </>
  );
}
