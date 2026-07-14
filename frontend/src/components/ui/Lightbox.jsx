/**
 * @file Visor de imágenes en pantalla completa con navegación ←/→ y Esc.
 *
 * Genérico — no depende del Vault. Usado por la sección de fotos del
 * detalle del Vault (issue #130), reutilizable donde haga falta.
 *
 * @module components/ui/Lightbox
 */

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * @typedef {Object} LightboxImage
 * @property {string} url
 * @property {string} [caption]
 */

/**
 * @param {Object} props
 * @param {LightboxImage[]} props.images
 * @param {number} props.index - Índice actualmente mostrado
 * @param {(index: number) => void} props.onIndexChange
 * @param {() => void} props.onClose
 */
export default function Lightbox({ images, index, onIndexChange, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onIndexChange((index - 1 + images.length) % images.length);
      else if (e.key === 'ArrowRight') onIndexChange((index + 1) % images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, images.length, onIndexChange, onClose]);

  if (!images.length) return null;
  const current = images[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        aria-label="Cerrar"
      >
        <X size={28} />
      </button>
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + images.length) % images.length);
          }}
          className="absolute left-4 text-white/70 hover:text-white"
          aria-label="Anterior"
        >
          <ChevronLeft size={36} />
        </button>
      )}
      <div
        className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.caption || ''}
          className="max-w-full max-h-[75vh] object-contain rounded-lg"
        />
        {current.caption && (
          <p className="text-white/80 text-sm text-center">{current.caption}</p>
        )}
        {images.length > 1 && (
          <p className="mono text-white/50 text-xs">
            {index + 1} / {images.length}
          </p>
        )}
      </div>
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % images.length);
          }}
          className="absolute right-4 text-white/70 hover:text-white"
          aria-label="Siguiente"
        >
          <ChevronRight size={36} />
        </button>
      )}
    </div>
  );
}
