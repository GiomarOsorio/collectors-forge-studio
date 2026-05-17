/**
 * @file DetailDrawer primitive: panel deslizable derecho con backdrop.
 *
 * Estructura interna usa **posicionamiento absoluto** para garantizar
 * layout determinístico header/body/footer:
 *
 *   aside (fixed top/right/bottom — full viewport height)
 *     ├ header (absolute top:0 — altura HEADER_H)
 *     ├ body   (absolute top:HEADER_H bottom:footer? FOOTER_H : 0 — scroll interno)
 *     └ footer (absolute bottom:0 — altura FOOTER_H, solo si se provee)
 *
 * Esto es a prueba de balas vs. flex/grid quirks que reportaron el
 * footer cortado en distintos browsers/viewports. Si `open=false`, el
 * componente retorna `null` (no DOM zombi).
 *
 * `Esc` o click en backdrop cierra. Bloquea scroll del body mientras
 * está abierto.
 *
 * Inspirado en `claude design/inventory.jsx::DetailDrawer`.
 *
 * @module components/ui/DetailDrawer
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';

const HEADER_HEIGHT = 64; // px — header con eyebrow + title + acciones
const FOOTER_HEIGHT = 64; // px — footer con botones (Cancelar/Guardar)

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

  // Guard temprano: si está cerrado, NO renderizamos NADA. Previene la
  // regresión del "menú lateral vacío" reportada por Giomar.
  if (!open) return null;

  // Renderizamos en un PORTAL al document.body para sacarnos de cualquier
  // parent que pueda tener `transform`/`filter`/`perspective` — esos
  // crean un nuevo containing block que rompe `position: fixed` (el
  // fixed se vuelve relativo al parent, no al viewport). Bug clásico
  // que explica por qué el footer "apenas se ve" en ciertos layouts.
  const drawer = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      {/* Panel — todas las dimensiones inline para evitar quirks de
          Tailwind/flex/grid que han roto el footer en distintos viewports. */}
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: width,
          zIndex: 50,
          background: 'var(--color-surf-card)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* HEADER — pinned al top, altura fija */}
        <header
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border-soft)',
            background: 'var(--color-surf-card)',
          }}
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

        {/* BODY — entre header y footer, scroll interno */}
        <div
          style={{
            position: 'absolute',
            top: HEADER_HEIGHT,
            bottom: footer ? FOOTER_HEIGHT : 0,
            left: 0,
            right: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 16,
          }}
        >
          {children}
        </div>

        {/* FOOTER — pinned al bottom, altura fija. Solo si se provee. */}
        {footer && (
          <footer
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: FOOTER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderTop: '1px solid var(--color-border-soft)',
              background: 'var(--color-surf-card-2)',
              zIndex: 1,
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </>
  );

  return createPortal(drawer, document.body);
}
