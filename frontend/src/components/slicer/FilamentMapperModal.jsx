/**
 * @file Modal para mapear filamentos del slicer a filamentos del inventario.
 *
 * Recibe los filamentos detectados en un archivo/placa, los agrupa por
 * tipo+color (sumando pesos de placas distintas), y los mapea contra el
 * inventario. Auto-match por filament_type; si alguno no matchea, permite
 * selección manual con dropdown.
 *
 * @module components/slicer/FilamentMapperModal
 */

import { useState, useEffect, useMemo } from 'react';
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
 * Agrupa filamentos por tipo+color, sumando pesos.
 *
 * @param {Array} filaments - [{filament_type, colour_hex, weight_g}]
 * @returns {Array} [{filament_type, colour_hex, weight_g (sumado), key}]
 */
function groupFilaments(filaments) {
  const map = {};
  filaments.forEach((f) => {
    const key = `${(f.filament_type || '').toLowerCase()}|${(f.colour_hex || '').toLowerCase()}`;
    if (!map[key]) {
      map[key] = { ...f, weight_g: 0, key };
    }
    map[key].weight_g += f.weight_g || 0;
  });
  return Object.values(map);
}

/**
 * Modal de mapeo de filamentos del slicer al inventario.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el modal está visible
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Array} props.slicerFilaments - Filamentos detectados [{filament_type, colour_hex, weight_g}]
 * @param {number|null} props.printTimeSeconds - Tiempo total de impresión
 * @param {Function} props.onConfirm - Callback con datos mapeados
 */
export default function FilamentMapperModal({ open, onClose, slicerFilaments, printTimeSeconds, onConfirm }) {
  const [inventoryFilaments, setInventoryFilaments] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Mapeo: key del grupo → inventory_item_id seleccionado */
  const [mapping, setMapping] = useState({});

  /** Filamentos agrupados por tipo+color con pesos sumados. */
  const grouped = useMemo(() => groupFilaments(slicerFilaments || []), [slicerFilaments]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getInventoryFilaments()
      .then((res) => {
        const items = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        setInventoryFilaments(items);

        // Auto-match por filament_type
        const autoMap = {};
        grouped.forEach((gf) => {
          const match = items.find(
            (inv) => (inv.filament_type || '').toLowerCase() === (gf.filament_type || '').toLowerCase(),
          );
          autoMap[gf.key] = match ? String(match.id) : '';
        });
        setMapping(autoMap);
      })
      .catch(() => toast.error('Error cargando filamentos del inventario'))
      .finally(() => setLoading(false));
  }, [open, grouped]);

  if (!open) return null;

  const unmappedCount = grouped.filter((gf) => !mapping[gf.key]).length;
  const allMapped = unmappedCount === 0 && !loading;

  const handleConfirm = () => {
    const mapped = grouped
      .map((gf) => ({
        inventoryId: parseInt(mapping[gf.key]),
        weight_g: gf.weight_g,
        filament_type: gf.filament_type,
      }))
      .filter((m) => m.inventoryId)
      .sort((a, b) => b.weight_g - a.weight_g);

    if (mapped.length === 0) {
      toast.error('Selecciona al menos un filamento');
      return;
    }

    const primary = mapped[0];
    const extras = mapped.slice(1).map((m) => ({
      inventory_item_id: m.inventoryId,
      weight_grams: m.weight_g || 0,
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
      <div className="relative bg-[#111520] border border-[#222630] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#111520] border-b border-[#222630] px-6 py-4 flex items-center justify-between">
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
              {unmappedCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-400/90 text-xs">
                    {unmappedCount} filamento{unmappedCount > 1 ? 's' : ''} no pudo ser mapeado
                    automáticamente. Selecciona del inventario manualmente.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {grouped.map((gf) => {
                  const isMapped = !!mapping[gf.key];
                  return (
                    <div
                      key={gf.key}
                      className={`rounded-lg border p-4 space-y-2 ${
                        isMapped
                          ? 'border-[#222630] bg-[#0A0E16]'
                          : 'border-amber-400/30 bg-amber-400/5'
                      }`}
                    >
                      {/* Filamento del slicer */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-[#363C47] shrink-0"
                          style={{ backgroundColor: gf.colour_hex || '#888' }}
                        />
                        <span className="text-tech-white text-sm font-medium">
                          {gf.filament_type || '—'}
                        </span>
                        <span className="text-gunmetal text-xs">{gf.colour_hex}</span>
                        <span className="text-steel text-xs ml-auto font-mono">
                          {gf.weight_g.toFixed(1)} g
                        </span>
                      </div>

                      {/* Selector de inventario */}
                      <div className="flex items-center gap-2">
                        {isMapped && <Check size={14} className="text-emerald-400 shrink-0" />}
                        <select
                          value={mapping[gf.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [gf.key]: e.target.value })}
                          className="tf-input text-sm py-1.5 flex-1"
                        >
                          <option value="">— Seleccionar del inventario —</option>
                          {inventoryFilaments.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {filamentLabel(inv)}
                              {inv.quantity != null ? ` (${Number(inv.quantity).toFixed(0)}g)` : ''}
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
        <div className="sticky bottom-0 bg-[#111520] border-t border-[#222630] px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-steel hover:text-tech-white border border-[#2A2F38] hover:border-[#363C47] transition-colors"
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
