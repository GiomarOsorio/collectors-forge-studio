/**
 * @file Timeline (Gantt simple) de la cola — issue #133.
 *
 * Filas = impresoras, eje X = tiempo (hoy−1d → +7d, scroll horizontal,
 * zoom fijo). Cada item con `scheduled_at` se dibuja como una barra en su
 * impresora con ancho `print_time_hours × quantity`. Dos barras que se
 * superponen en la misma impresora se resaltan en rojo (solape).
 *
 * SVG/CSS propio — sin librería de gráficos nueva. Items sin
 * `scheduled_at` (o sin impresora asignada) no aparecen; se cuentan
 * aparte ("N sin programar").
 *
 * @module pages/queue/components/TimelineView
 */

import { useMemo } from 'react';
import { AlertTriangle, Printer as PrinterIcon } from 'lucide-react';
import { ACCENT, itemView } from '../queueHelpers';

const PX_PER_HOUR = 40;
const RANGE_DAYS_BEFORE = 1;
const RANGE_DAYS_AFTER = 7;
const ROW_LABEL_WIDTH = 160;

function hoursBetween(a, b) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

/**
 * @param {Object} props
 * @param {Object[]} props.items    - Items activos (pending/printing).
 * @param {Object[]} props.printers - `{id, name}[]`.
 */
export default function TimelineView({ items, printers }) {
  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - RANGE_DAYS_BEFORE);
    return d;
  }, []);

  const rangeEnd = useMemo(() => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + RANGE_DAYS_BEFORE + RANGE_DAYS_AFTER);
    return d;
  }, [rangeStart]);

  const totalWidth = Math.round(hoursBetween(rangeStart, rangeEnd) * PX_PER_HOUR);

  const { barsByPrinter, unscheduledCount } = useMemo(() => {
    const map = new Map();
    let unscheduled = 0;
    for (const item of items) {
      const v = itemView(item);
      const printerId = v.printer_id;
      if (!item.scheduled_at || printerId == null) {
        unscheduled += 1;
        continue;
      }
      const start = new Date(item.scheduled_at);
      const hours = Number(v.print_time_hours || 0) * Number(v.quantity || 1);
      const durationHours = hours > 0 ? hours : 0.5; // barra mínima visible
      const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
      if (!map.has(printerId)) map.set(printerId, []);
      map.get(printerId).push({ item, v, start, end, overlap: false });
    }
    // Solapes: dos barras del mismo printer cuyo rango [start,end) se cruza.
    for (const bars of map.values()) {
      for (let i = 0; i < bars.length; i += 1) {
        for (let j = i + 1; j < bars.length; j += 1) {
          if (bars[i].start < bars[j].end && bars[j].start < bars[i].end) {
            bars[i].overlap = true;
            bars[j].overlap = true;
          }
        }
      }
    }
    return { barsByPrinter: map, unscheduledCount: unscheduled };
  }, [items]);

  const dayMarks = useMemo(() => {
    const marks = [];
    const totalHours = Math.round(hoursBetween(rangeStart, rangeEnd));
    for (let h = 0; h <= totalHours; h += 24) {
      const d = new Date(rangeStart.getTime() + h * 60 * 60 * 1000);
      marks.push({
        left: h * PX_PER_HOUR,
        label: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
      });
    }
    return marks;
  }, [rangeStart, rangeEnd]);

  const nowLeft = Math.round(hoursBetween(rangeStart, new Date()) * PX_PER_HOUR);

  if (!printers.length) {
    return (
      <p className="px-6 py-16 text-center text-gunmetal text-sm">
        Sin impresoras registradas — agrega una en Impresoras para ver el timeline.
      </p>
    );
  }

  return (
    <div className="px-6 pb-8">
      {unscheduledCount > 0 && (
        <p className="mono text-[11px] text-gunmetal mb-3">
          {unscheduledCount} item{unscheduledCount === 1 ? '' : 's'} sin programar — no aparece
          {unscheduledCount === 1 ? '' : 'n'} en el timeline.
        </p>
      )}
      <div className="overflow-x-auto border border-[var(--color-border-soft)] rounded-lg">
        <div style={{ width: totalWidth + ROW_LABEL_WIDTH }}>
          <div className="flex sticky top-0 bg-[var(--color-surf-sidebar)] z-10 border-b border-[var(--color-border-soft)]">
            <div
              className="shrink-0 border-r border-[var(--color-border-soft)]"
              style={{ width: ROW_LABEL_WIDTH }}
            />
            <div className="relative flex-1" style={{ height: 28, width: totalWidth }}>
              {dayMarks.map((m) => (
                <span
                  key={m.left}
                  className="absolute top-0 mono text-[10px] text-gunmetal px-1 border-l border-[var(--color-border-soft)]"
                  style={{ left: m.left }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
          {printers.map((printer) => {
            const bars = barsByPrinter.get(printer.id) || [];
            return (
              <div key={printer.id} className="flex border-b border-[var(--color-border-soft)]">
                <div
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-3 border-r border-[var(--color-border-soft)]"
                  style={{ width: ROW_LABEL_WIDTH }}
                >
                  <PrinterIcon size={12} className="text-gunmetal shrink-0" />
                  <span className="text-xs text-tech-white truncate">{printer.name}</span>
                </div>
                <div className="relative flex-1" style={{ height: 52, width: totalWidth }}>
                  {nowLeft >= 0 && nowLeft <= totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-teal-500/50"
                      style={{ left: nowLeft }}
                    />
                  )}
                  {bars.map((bar) => {
                    const left = Math.round(hoursBetween(rangeStart, bar.start) * PX_PER_HOUR);
                    const width = Math.max(6, Math.round(hoursBetween(bar.start, bar.end) * PX_PER_HOUR));
                    return (
                      <div
                        key={bar.item.id}
                        title={`${bar.v.piece_name || `Item #${bar.item.id}`} — ${bar.start.toLocaleString('es-CO')}`}
                        className={`absolute top-2 h-8 rounded-md px-2 flex items-center gap-1 text-[10.5px] font-medium overflow-hidden ${
                          bar.overlap ? 'border-2 border-rose-500' : 'border border-[var(--color-border-strong)]'
                        }`}
                        style={{
                          left,
                          width,
                          background: bar.overlap ? 'rgba(244,63,94,0.18)' : `${ACCENT}22`,
                          color: bar.overlap ? '#FDA4AF' : '#E8ECEF',
                        }}
                      >
                        {bar.overlap && <AlertTriangle size={11} className="shrink-0" />}
                        <span className="truncate">{bar.v.piece_name || `Item #${bar.item.id}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
