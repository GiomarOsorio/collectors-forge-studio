/**
 * @file Fila colapsable de un lote ("Agrupar como lote", issue #133).
 *
 * Muestra el progreso agregado (ej. "2/5") con barra + botón para
 * desagrupar. Al expandir, renderiza los items activos del lote con
 * `renderItem` (el padre decide si son `QueueCard` o `QueueRow` según
 * desktop/mobile).
 *
 * @module pages/queue/components/BatchRow
 */

import { Layers, Ungroup } from 'lucide-react';
import { Button } from '../../../components/ui';
import Collapsible from '../../../components/ui/Collapsible';
import { ACCENT } from '../queueHelpers';

/**
 * @param {Object} props
 * @param {string} props.batchId
 * @param {Object[]} props.items          - Items activos (pending/printing) del lote.
 * @param {{done: number, total: number}} props.progress
 * @param {(item: Object) => React.ReactNode} props.renderItem
 * @param {(batchId: string) => void} props.onUngroup
 * @param {boolean} [props.busy]
 */
export default function BatchRow({ batchId, items, progress, renderItem, onUngroup, busy }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}0A` }}
    >
      <Collapsible
        summary={
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} style={{ color: ACCENT }} className="shrink-0" />
            <span className="text-sm font-semibold text-tech-white">Lote</span>
            <span className="mono text-xs text-gunmetal">
              {progress.done}/{progress.total}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden min-w-[60px] max-w-[140px]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: ACCENT }}
              />
            </div>
            <span className="mono text-[10px] text-gunmetal shrink-0">
              {items.length} activo{items.length === 1 ? '' : 's'}
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon={Ungroup}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onUngroup(batchId);
              }}
              className="text-gunmetal hover:text-tech-white"
            >
              Desagrupar
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.id}>{renderItem(item)}</div>
            ))}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
