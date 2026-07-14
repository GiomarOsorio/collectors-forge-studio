/**
 * @file Modal para programar (o quitar programación de) un ítem de la
 * cola — issue #133. Puramente organizativo: NO dispara nada automático.
 *
 * @module pages/queue/components/ScheduleModal
 */

import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { Button } from '../../../components/ui';
import { itemView } from '../queueHelpers';

/** `Date` → valor para `<input type="datetime-local">` (hora local, sin offset). */
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleModal({ item, onConfirm, onClose }) {
  const [value, setValue] = useState(() => toLocalInputValue(item?.scheduled_at));

  if (!item) return null;
  const v = itemView(item);

  const handleSubmit = (e) => {
    e.preventDefault();
    // datetime-local es hora LOCAL sin tz — `new Date(value)` la interpreta
    // como local y `.toISOString()` la convierte a UTC correctamente.
    const scheduledAt = value ? new Date(value).toISOString() : null;
    onConfirm(scheduledAt);
  };

  return (
    <div className="tf-modal-overlay" onClick={onClose}>
      <div className="tf-modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="tf-page-title text-base mb-0">Programar impresión</p>
          <button type="button" onClick={onClose} className="text-gunmetal hover:text-tech-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-steel mb-4 truncate">
          {v.piece_name || item.notes || `Item #${item.id}`}
        </p>
        <form onSubmit={handleSubmit}>
          <label className="tf-label">Fecha y hora (opcional)</label>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tf-input mb-1"
          />
          <p className="text-[10.5px] text-gunmetal-dim mb-5">
            Organizativo — no dispara nada en la impresora. Deja vacío para quitar la programación.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" icon={CalendarClock} type="submit">
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
