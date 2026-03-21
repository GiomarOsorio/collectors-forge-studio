/**
 * @file Modal para mapear filamentos del slicer a filamentos del inventario.
 *
 * Recibe los filamentos detectados en un archivo/placa y los mapea
 * automáticamente por tipo (filament_type) contra el inventario.
 * Si alguno no tiene match, permite selección manual con dropdown.
 *
 * @module components/slicer/FilamentMapperModal
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { getInventoryFilaments } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * Nombre legible de un item de inventario tipo Filamento.
 *
 * @param {Object} item
 * @returns {string}
 */
function filamentLabel(item) {
  const parts = [item.filament_brand, item.filament_type, item.filament_color].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : item.name;
}

/**
 * Modal de mapeo de filamentos del slicer al inventario.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el modal está visible
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Array} props.slicerFilaments - Filamentos detectados [{filament_type, colour_hex, weight_g}]
 * @param {number|null} props.printTimeSeconds - Tiempo total de impresión
 * @param {Function} props.onConfirm - Callback con datos mapeados ({primaryId, primaryWeight, extras[], printTimeSeconds})
 */
export default function FilamentMapperModal({ open, onClose, slicerFilaments, printTimeSeconds, onConfirm }) {
  const [inventoryFilaments, setInventoryFilaments] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Mapeo: índice del slicerFilament → inventory_item_id seleccionado */
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getInventoryFilaments()
      .then((res) => {
        const items = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        setInventoryFilaments(items);

        // Auto-match por filament_type
        const autoMap = {};
        slicerFilaments.forEach((sf, i) => {
          const match = items.find(
            (inv) => (inv.filament_type || '').toLowerCase() === (sf.filament_type || '').toLowerCase(),
          );
          if (match) autoMap[i] = match.id;
          else autoMap[i] = '';
        });
        setMapping(autoMap);
      })
      .catch(() => toast.error('Error cargando filamentos del inventario'))
      .finally(() => setLoading(false));
  }, [open, slicerFilaments]);

  if (!open) return null;

  const unmapped = slicerFilaments.filter((_, i) => !mapping[i]);
  const allMapped = unmapped.length === 0 && !loading;

  const handleConfirm = () => {
    // Ordenar por peso (mayor primero) para elegir el principal
    const sorted = slicerFilaments
      .map((sf, i) => ({ ...sf, inventoryId: parseInt(mapping[i]), idx: i }))
      .filter((sf) => sf.inventoryId)
      .sort((a, b) => (b.weight_g || 0) - (a.weight_g || 0));

    if (sorted.length === 0) {
      toast.error('Selecciona al menos un filamento');
      return;
    }

    const primary = sorted[0];
    const extras = sorted.slice(1).map((s) => ({
      inventory_item_id: s.inventoryId,
      weight_grams: s.weight_g || 0,
    }));

    onConfirm({
      primaryId: primary.inventoryId,
      primaryWeight: primary.weight_g || 0,
      extras,
      printTimeSeconds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#13171c] border border-[#1e2125] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#13171c] border-b border-[#1e2125] px-6 py-4 flex items-center justify-between">
          <h2 className="text-tech-white font-semibold">Mapear filamentos</h2>
          <button onClick={onClose} className="text-gunmetal hover:text-tech-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 size={24} className="text-amber-400 animate-spin" />
              <p className="text-steel text-sm">Cargando inventario…</p>
            </div>
          ) : (
            <>
              {/* Aviso si hay filamentos sin match */}
              {unmapped.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-400/90 text-xs">
                    {unmapped.length} filamento{unmapped.length > 1 ? 's' : ''} no pudo ser mapeado automáticamente.
                    Selecciona el filamento del inventario manualmente.
                  </p>
                </div>
              )}

              {/* Lista de filamentos a mapear */}
              <div className="space-y-3">
                {slicerFilaments.map((sf, i) => {
                  const isMapped = !!mapping[i];
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-4 space-y-2 ${
                        isMapped
                          ? 'border-[#1e2125] bg-[#0d1014]'
                          : 'border-amber-400/30 bg-amber-400/5'
                      }`}
                    >
                      {/* Filamento del slicer */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-[#3a3d41] shrink-0"
                          style={{ backgroundColor: sf.colour_hex || '#888' }}
                        />
                        <span className="text-tech-white text-sm font-medium">
                          {sf.filament_type || '—'}
                        </span>
                        <span className="text-gunmetal text-xs">{sf.colour_hex}</span>
                        <span className="text-steel text-xs ml-auto font-mono">
                          {(sf.weight_g || 0).toFixed(1)} g
                        </span>
                      </div>

                      {/* Selector de inventario */}
                      <div className="flex items-center gap-2">
                        {isMapped && <Check size={14} className="text-emerald-400 shrink-0" />}
                        <select
                          value={mapping[i] || ''}
                          onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}
                          className="tf-input text-sm py-1.5 flex-1"
                        >
                          <option value="">— Seleccionar del inventario —</option>
                          {inventoryFilaments.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {filamentLabel(inv)}
                              {inv.quantity != null ? ` (${inv.quantity} disponible)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#13171c] border-t border-[#1e2125] px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-steel hover:text-tech-white border border-[#2a2d31] hover:border-[#3a3d41] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allMapped}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Usar en Calculadora
          </button>
        </div>
      </div>
    </div>
  );
}
