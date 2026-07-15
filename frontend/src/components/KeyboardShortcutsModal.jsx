/**
 * @file Modal de ayuda de atajos de teclado (issue #140, pieza A).
 *
 * `role="dialog"` — el propio `useKeyboardShortcuts` lo usa como señal de
 * "hay un modal abierto" para no interceptar teclas mientras esto está
 * visible (así `Esc` puede cerrarlo sin competir con el listener global).
 *
 * @module components/KeyboardShortcutsModal
 */

import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NAV_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

function KeyBadge({ children }) {
  return (
    <kbd className="px-2 py-0.5 text-[11px] font-mono bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded text-tech-white">
      {children}
    </kbd>
  );
}

/**
 * @param {Object} props
 * @param {() => void} props.onClose
 */
export default function KeyboardShortcutsModal({ onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="tf-modal-overlay"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts.title')}
      onClick={onClose}
    >
      <div className="tf-modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 text-tech-white text-sm font-semibold">
            <Keyboard size={16} /> {t('shortcuts.title')}
          </span>
          <button type="button" onClick={onClose} className="text-gunmetal-dim hover:text-tech-white" aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="lbl-eyebrow text-[9px] block mb-1.5">{t('shortcuts.navigation')}</span>
            <p className="text-[11px] text-gunmetal-dim mb-2">
              {t('shortcuts.navigationHint', { g: 'g' })}
            </p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(NAV_SHORTCUTS).map(([key, { path, label }]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-tech-white">{t(`nav.${path.slice(1)}`, label)}</span>
                  <div className="flex gap-1">
                    <KeyBadge>g</KeyBadge>
                    <KeyBadge>{key}</KeyBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="lbl-eyebrow text-[9px] block mb-1.5">General</span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-tech-white">{t('shortcuts.search')}</span>
                <KeyBadge>/</KeyBadge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-tech-white">{t('shortcuts.help')}</span>
                <KeyBadge>?</KeyBadge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-tech-white">{t('common.close')}</span>
                <KeyBadge>Esc</KeyBadge>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gunmetal-dim text-center mt-4">
          <KeyBadge>Esc</KeyBadge> {t('shortcuts.closeHint')}
        </p>
      </div>
    </div>
  );
}
