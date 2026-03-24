/**
 * @file Dialog de visor 3D de G-code de una placa.
 *
 * Carga el G-code de una placa vía API y lo muestra en el GcodeViewer.
 * Se abre con el botón "3D" en cada card de placa.
 *
 * @module components/slicer/GcodeViewerDialog
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { X, Loader2, Box } from 'lucide-react';
import api from '../../services/api';

const GcodeViewer = lazy(() => import('./GcodeViewer'));

/**
 * Dialog para visualizar el G-code de una placa en 3D.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el dialog está visible
 * @param {Function} props.onClose - Callback al cerrar
 * @param {number} props.jobId - ID del trabajo de laminado
 * @param {number} props.plateNumber - Número de placa
 */
export default function GcodeViewerDialog({ open, onClose, jobId, plateNumber }) {
  const [gcodeText, setGcodeText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !jobId || !plateNumber) return;
    setLoading(true);
    setError(null);
    setGcodeText(null);

    api.get(`/slicer/jobs/${jobId}/plate/${plateNumber}/gcode`, { responseType: 'text' })
      .then((res) => setGcodeText(res.data))
      .catch((err) => {
        const msg = err.response?.data?.detail || 'Error al cargar el G-code';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [open, jobId, plateNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#13171c] border border-[#1e2125] rounded-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2125] shrink-0">
          <div className="flex items-center gap-2">
            <Box size={16} className="text-amber-400" />
            <h2 className="text-tech-white font-semibold text-sm">
              Vista 3D — Placa {plateNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gunmetal hover:text-tech-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewer */}
        <div className="flex-1 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={28} className="text-amber-400 animate-spin" />
              <p className="text-steel text-sm">Cargando G-code…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {gcodeText && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={28} className="text-amber-400 animate-spin" />
                </div>
              }
            >
              <GcodeViewer gcodeText={gcodeText} className="h-full" initialView="3d" />
            </Suspense>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-[#1e2125] text-gunmetal text-xs shrink-0">
          Arrastra para rotar · Scroll para zoom · Click derecho para desplazar
        </div>
      </div>
    </div>
  );
}
