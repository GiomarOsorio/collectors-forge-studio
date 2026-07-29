/**
 * @file Tooltip de ayuda por-campo (ícono ⓘ junto al label).
 *
 * Funciona en desktop y mobile:
 *   - Desktop: aparece al `hover`/`focus` del ícono.
 *   - Mobile: toggle al `tap`; cierra al tocar fuera o con Esc.
 *
 * El panel se renderiza en un portal a `document.body` con `position: fixed`
 * calculada desde el rect del botón, para no quedar recortado por el
 * `overflow` del drawer/sheet que contiene el formulario.
 *
 * @module components/ui/FieldHint
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const PANEL_W = 240;
const GAP = 8;

/**
 * @param {Object} props
 * @param {string} props.text     - Texto de ayuda.
 * @param {string} [props.label]  - Nombre del campo (para el aria-label del botón).
 * @returns {JSX.Element|null}
 */
export default function FieldHint({ text, label }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const spaceBelow = window.innerHeight - r.bottom;
    const below = spaceBelow > 120 || spaceBelow >= r.top;
    let left = r.left + r.width / 2 - PANEL_W / 2;
    left = Math.max(GAP, Math.min(left, vw - PANEL_W - GAP));
    const top = below ? r.bottom + GAP : r.top - GAP;
    setPos({ left, top, below });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span className="inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={label ? `Ayuda: ${label}` : 'Ayuda del campo'}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center text-gunmetal hover:text-steel focus:text-steel focus:outline-none transition-colors cursor-help"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          id={id}
          role="tooltip"
          className="rounded-md border px-2.5 py-1.5 text-[11.5px] leading-snug shadow-lg pointer-events-none normal-case tracking-normal font-normal"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: PANEL_W,
            zIndex: 200,
            transform: pos.below ? 'none' : 'translateY(-100%)',
            background: 'var(--color-surf-sidebar, #1b1f24)',
            borderColor: 'var(--color-border-strong, #3a3f47)',
            color: 'var(--cfs-text-secondary, #cbd5e1)',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
