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
import { Pencil, X } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.title]
 * @param {string} [props.eyebrow] - Texto pequeño mayúsculas sobre el title (ID/categoría/etc.)
 * @param {React.ReactNode} [props.footer] - Footer fijo con acciones (botones)
 * @param {(() => void)} [props.onEdit] - Si se provee, muestra un Pencil icon button antes del Close
 * @param {number} [props.width=460]
 * @param {React.ReactNode} props.children
 */
export default function DetailDrawer({ open, onClose, title, eyebrow, footer, onEdit, width = 460, children }) {
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
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      {/* Panel — grid layout para garantizar que header/body/footer
          quedan en sus rows sin que el body pueda crecer y empujar al
          footer fuera del viewport (problema reportado con flex). */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 right-0 bottom-0 z-50 bg-[var(--color-surf-card)] border-l border-[var(--color-border)] shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: '100%',
          maxWidth: width,
          display: 'grid',
          gridTemplateRows: footer ? 'auto 1fr auto' : 'auto 1fr',
        }}
      >
        <header
          className="flex items-start gap-3 px-4 pt-3.5 pb-3 border-b border-[var(--color-border-soft)]"
          style={{ minHeight: 0 }}
        >
          <div className="flex-1 min-w-0">
            {eyebrow && (
              <p className="mono text-[9.5px] text-gunmetal uppercase tracking-widest mb-1">
                {eyebrow}
              </p>
            )}
            <h2 className="text-base font-semibold text-tech-white tracking-tight leading-tight truncate">
              {title}
            </h2>
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Editar"
              className="w-7 h-7 rounded-lg bg-transparent border border-[var(--color-border)] text-steel inline-flex items-center justify-center shrink-0 hover:bg-[var(--color-surf-hover)] hover:text-tech-white transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-7 h-7 rounded-lg bg-transparent border border-[var(--color-border)] text-steel inline-flex items-center justify-center shrink-0 hover:bg-[var(--color-surf-hover)] transition-colors"
          >
            <X size={14} />
          </button>
        </header>
        <div
          className="overflow-y-auto p-4"
          style={{ minHeight: 0 }}
        >
          {children}
        </div>
        {footer && (
          <footer
            className="flex items-center gap-2"
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--color-border-soft)',
              background: 'var(--color-surf-card-2)',
              minHeight: 60,
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}
