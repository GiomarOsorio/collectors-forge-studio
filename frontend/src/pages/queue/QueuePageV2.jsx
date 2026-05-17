/**
 * @file Página rediseñada de la app Queue (Claude Design v2).
 *
 * Dos pestañas:
 *  - Activa: cola de pendientes + en impresión, ordenada por `position`.
 *  - Historial: jobs `done`/`cancelled` con timestamp.
 *
 * Cada item puede provenir de dos fuentes:
 *  - **Quote** (camino histórico): cotización guardada con precio calculado.
 *  - **Vault** (chunk C): modelo `.gcode.3mf` agregado vía `VaultPickerDrawer`.
 *
 * Acciones en cada item: Marcar imprimiendo / Marcar listo / Cancelar / Eliminar.
 * Cuando se marca `done` el backend descuenta inventario y suma horas a impresora.
 *
 * @module pages/queue/QueuePageV2
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ListOrdered,
  Pause,
  Play,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  KPI,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  addToQueueFromVault,
  deleteQueueItem,
  getInventoryItems,
  getPrinters,
  getQueue,
  getQueueHistory,
  getVaultFiles,
  updateQueueStatus,
} from '../../services/api';
import { fmtCOP } from '../../utils/inventoryAdapter';
import { getThumbnail } from '../../utils/thumbnail';

const ACCENT = '#14B8A6';

const TABS = [
  { id: 'activa',    label: 'Cola activa', icon: ListOrdered },
  { id: 'historial', label: 'Historial',   icon: Clock },
];

/**
 * Mapea el status del queue item a metadata `StatusPill` (label + tone + icon).
 *
 * Tonos:
 *   - `printing`  → en impresión (azul)
 *   - `done`      → completado (verde)
 *   - `danger`    → cancelado (rojo)
 *   - `pending`   → en espera (gris)
 */
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'printing')  return { label: 'Imprimiendo', tone: 'printing', icon: Play };
  if (s === 'done')      return { label: 'Listo',       tone: 'done',     icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelado',   tone: 'danger',   icon: XCircle };
  return { label: 'Pendiente', tone: 'pending', icon: Pause };
}

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Vista normalizada de un item de cola: unifica los campos visibles
 * que vienen de Quote (`item.quote`) y Vault (`item.vault`). Permite que
 * Card/Row/Body trabajen con un solo shape sin if/else en cada lectura.
 *
 * Si el item tiene ambos snapshots (no debería pasar) o ninguno, el
 * fallback es el item raw.
 */
function itemView(item) {
  if (!item) return null;
  const q = item.quote;
  const v = item.vault;
  if (q) {
    return {
      source: 'quote',
      piece_name: q.piece_name,
      printer_name: q.printer_name,
      printer_id: q.printer_id,
      weight_grams: q.weight_grams,
      print_time_hours: q.print_time_hours,
      quantity: q.quantity,
      total_price: q.total_price,
      filament_name: null,
      sliced_filament_type: null,
    };
  }
  if (v) {
    return {
      source: 'vault',
      piece_name: v.name,
      printer_name: v.printer_name,
      printer_id: v.printer_id,
      weight_grams: v.weight_grams,
      print_time_hours: v.print_time_hours,
      quantity: v.quantity,
      total_price: null,
      filament_name: v.filament_name,
      sliced_filament_type: v.sliced_filament_type,
    };
  }
  return {
    source: 'unknown',
    piece_name: item.notes || `Item #${item.id}`,
    printer_name: null,
    weight_grams: null,
    print_time_hours: null,
    quantity: 1,
    total_price: null,
    filament_name: null,
    sliced_filament_type: null,
  };
}

const fmtTimeHours = (h) => {
  if (h == null || !Number.isFinite(Number(h))) return '—';
  return `${Number(h).toFixed(1)}h`;
};

// ── Form helpers a module-level (anti bug cursor jump — ver formFieldFocus.test.jsx)

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gunmetal-dim';

function FormFieldRow({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gunmetal mb-1">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10.5px] text-gunmetal-dim mt-1">{hint}</span>}
    </label>
  );
}

// ─── Card / row ─────────────────────────────────────────────────────────────

function QueueCard({ item, onClick, onAction, busy }) {
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <Card as="div" interactive className="p-4 flex flex-col gap-3" onClick={() => onClick(item)}>
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{
            background: `${ACCENT}1A`,
            color: ACCENT,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <span className="mono text-xs font-semibold">#{item.position ?? '—'}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <StatusPill tone={badge.tone} icon={badge.icon}>
              {badge.label}
            </StatusPill>
            {v.source === 'vault' && (
              <StatusPill tone="info" icon={Archive}>
                Vault
              </StatusPill>
            )}
            {v.printer_name && (
              <span className="mono text-[9.5px] text-gunmetal">· {v.printer_name}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {v.piece_name || item.notes || `Item #${item.id}`}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">
            {v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)}g` : '—'} ·{' '}
            {fmtTimeHours(v.print_time_hours)}
            {v.total_price != null ? ` · ${fmtCOP(v.total_price)}` : ''}
          </p>
        </div>
      </div>

      {item.notes && (
        <p className="text-xs text-steel border-t border-dashed border-[var(--color-border-soft)] pt-2.5 truncate">
          {item.notes}
        </p>
      )}

      {/* Actions */}
      <div
        className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--color-border-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        {item.status === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            icon={Play}
            onClick={() => onAction(item, 'printing')}
            disabled={busy}
            className="text-amber-300 hover:text-amber-200"
          >
            Iniciar
          </Button>
        )}
        {(item.status === 'pending' || item.status === 'printing') && (
          <>
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              onClick={() => onAction(item, 'done')}
              disabled={busy}
            >
              Marcar listo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={XCircle}
              onClick={() => onAction(item, 'cancelled')}
              disabled={busy}
              className="text-rose-400 hover:text-rose-300"
            >
              Cancelar
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function QueueRow({ item, onClick }) {
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{
          background: `${ACCENT}1A`,
          color: ACCENT,
          border: `1px solid ${ACCENT}40`,
        }}
      >
        <span className="mono text-xs">#{item.position ?? '—'}</span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <StatusPill tone={badge.tone} icon={badge.icon}>
            {badge.label}
          </StatusPill>
          {v.source === 'vault' && (
            <StatusPill tone="info" icon={Archive}>
              Vault
            </StatusPill>
          )}
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">
          {v.piece_name || item.notes || `Item #${item.id}`}
        </p>
        <p className="mono text-[10px] text-gunmetal mt-0.5 truncate">
          {v.printer_name || '—'} ·{' '}
          {v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)}g` : '—'} ·{' '}
          {fmtTimeHours(v.print_time_hours)}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

/**
 * Cuerpo del drawer (info read-only). El header (con eyebrow `COLA · POSICIÓN
 * #N`) lo aporta `DetailDrawer` v2; las acciones viven en `QueueDrawerFooter`.
 */
function QueueDrawerBody({ item }) {
  if (!item) return null;
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <StatusPill tone={badge.tone} icon={badge.icon} size="lg">
            {badge.label}
          </StatusPill>
          {v.source === 'vault' && (
            <StatusPill tone="info" icon={Archive} size="lg">
              Desde Vault
            </StatusPill>
          )}
          {v.source === 'quote' && (
            <StatusPill tone="neutral" icon={FileText} size="lg">
              Desde cotización
            </StatusPill>
          )}
        </div>
        <h2 className="text-lg font-semibold text-tech-white truncate">
          {v.piece_name || item.notes || `Item #${item.id}`}
        </h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5">{fmtDate(item.created_at)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Impresora</span>
          <p className="text-sm text-tech-white mt-0.5 truncate">{v.printer_name || '—'}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Tiempo</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {v.print_time_hours != null ? `${Number(v.print_time_hours).toFixed(2)} h` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Peso</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)} g` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Cantidad</span>
          <p className="mono text-sm text-tech-white mt-0.5">{v.quantity ?? 1}</p>
        </Card>
      </div>

      {v.source === 'vault' && (v.filament_name || v.sliced_filament_type) && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Filamento</span>
          <p className="text-sm text-tech-white mt-0.5 truncate">
            {v.filament_name || '— (no asignado)'}
            {v.sliced_filament_type && (
              <span className="mono text-[11px] text-gunmetal ml-2">
                · {v.sliced_filament_type} sugerido
              </span>
            )}
          </p>
        </Card>
      )}

      {v.total_price != null && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Precio cotización</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">
            {fmtCOP(v.total_price)}
          </p>
        </Card>
      )}

      {item.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{item.notes}</p>
        </Card>
      )}
    </div>
  );
}

/**
 * Footer del drawer: acciones primarias (Iniciar / Marcar listo / Cancelar)
 * + eliminar. Se renderiza en el slot `footer` del `DetailDrawer` v2 (desktop)
 * o inline sticky dentro del `MobileSheet` (mobile).
 */
function QueueDrawerFooter({ item, onAction, onDelete, onClose, busy }) {
  if (!item) return null;
  const isActive = item.status === 'pending' || item.status === 'printing';
  return (
    <>
      {item.status === 'pending' && (
        <Button
          variant="ghost"
          icon={Play}
          onClick={() => onAction(item, 'printing')}
          disabled={busy}
          className="text-amber-300 hover:text-amber-200"
        >
          Iniciar
        </Button>
      )}
      {isActive && (
        <Button
          variant="primary"
          icon={CheckCircle2}
          onClick={() => onAction(item, 'done')}
          disabled={busy}
          className="flex-1 justify-center"
        >
          Marcar listo
        </Button>
      )}
      {isActive && (
        <Button
          variant="ghost"
          icon={XCircle}
          onClick={() => onAction(item, 'cancelled')}
          disabled={busy}
          className="text-rose-400 hover:text-rose-300"
        >
          Cancelar
        </Button>
      )}
      <Button
        variant="ghost"
        icon={Trash2}
        onClick={async () => {
          const ok = await onDelete(item);
          if (ok) onClose();
        }}
        className="text-rose-400 hover:text-rose-300"
        aria-label="Eliminar item"
      />
    </>
  );
}

// ─── VaultPickerDrawer ──────────────────────────────────────────────────────

/**
 * Fila de un modelo del Vault dentro del picker. Mostrada cuando el usuario
 * abrió el drawer pero todavía no seleccionó nada. Click → marca el modelo
 * como elegido y revela el panel de configuración.
 */
function VaultPickerRow({ model, selected, onSelect }) {
  const thumb = getThumbnail(model);
  const time = model.sliced_time_seconds;
  const timeLabel =
    time != null ? `${(time / 3600).toFixed(1)}h` : '—';
  return (
    <button
      type="button"
      onClick={() => onSelect(model)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
        selected
          ? 'bg-teal-500/10 border border-teal-500/40'
          : 'border border-transparent hover:bg-[var(--color-surf-hover)]/40'
      }`}
    >
      <div
        className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center shrink-0"
        style={{ border: '1px solid var(--color-border-soft)' }}
      >
        {thumb ? (
          <img src={thumb} alt={model.name} className="w-full h-full object-cover" />
        ) : (
          <Archive size={18} className="text-gunmetal" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tech-white truncate">{model.name}</p>
        <p className="mono text-[10.5px] text-gunmetal mt-0.5">
          {model.sliced_weight_g != null
            ? `${Number(model.sliced_weight_g).toFixed(0)}g`
            : '—'}{' '}
          · {timeLabel}
          {model.sliced_filament_type ? ` · ${model.sliced_filament_type}` : ''}
        </p>
      </div>
      {model.is_print_ready ? (
        <StatusPill tone="done" icon={Printer}>Listo</StatusPill>
      ) : null}
    </button>
  );
}

/**
 * Drawer/sheet de "Agregar a cola desde Vault". Reemplaza el `Link to
 * /cost/quotes` antiguo del header/FAB de QueuePageV2.
 *
 * Flow:
 * 1. Lista modelos del Vault con `?print_ready_only=true` (vienen ya
 *    laminados con peso/tiempo resueltos).
 * 2. Search inline por nombre.
 * 3. Al seleccionar un modelo aparece el panel de configuración (impresora
 *    *, filamento opcional, cantidad, notas).
 * 4. Submit → `addToQueueFromVault` y refresca la cola.
 *
 * Si no hay modelos `print_ready`, muestra empty state con CTA a
 * `/vault/upload/v2`.
 */
function VaultPickerDrawer({ open, onClose, onAdded, printers, filaments, isMobile }) {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [form, setForm] = useState({
    printer_id: '',
    filament_id: '',
    quantity: 1,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Reset cuando abre/cierra.
  useEffect(() => {
    if (!open) return;
    setSelectedModel(null);
    setQuery('');
    setForm({
      printer_id: printers[0]?.id ? String(printers[0].id) : '',
      filament_id: '',
      quantity: 1,
      notes: '',
    });
    setLoadingModels(true);
    getVaultFiles({ params: { print_ready_only: true, page_size: 100 } })
      .then((res) => {
        const data = res.data;
        setModels(Array.isArray(data) ? data : data?.items || []);
      })
      .catch(() => toast.error('No se pudo cargar el Vault'))
      .finally(() => setLoadingModels(false));
  }, [open, printers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (Array.isArray(m.tags) ? m.tags.join(' ') : '').toLowerCase().includes(q),
    );
  }, [models, query]);

  const canSubmit =
    !saving && selectedModel != null && !!form.printer_id && Number(form.quantity) >= 1;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await addToQueueFromVault({
        vault_model_id: selectedModel.id,
        printer_id: parseInt(form.printer_id, 10),
        filament_id: form.filament_id ? parseInt(form.filament_id, 10) : null,
        quantity: Math.max(1, Math.min(999, parseInt(form.quantity, 10) || 1)),
        notes: form.notes.trim() || null,
      });
      toast.success(`Agregado a cola en posición #${res.data.position}`);
      onAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo agregar a la cola');
    } finally {
      setSaving(false);
    }
  };

  const Body = (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5">
        <Search size={13} className="text-gunmetal" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar modelo o tag…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
      </div>

      {/* Lista */}
      {loadingModels ? (
        <p className="px-4 py-8 text-center text-gunmetal text-sm">Cargando Vault…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Archive}
          accent={ACCENT}
          title={models.length === 0 ? 'Sin modelos laminados' : 'Sin resultados'}
          hint={
            models.length === 0
              ? 'Sube un .gcode.3mf al Vault para encolar modelos directamente desde aquí.'
              : 'Cambia el filtro o limpia la búsqueda.'
          }
          action={
            models.length === 0 ? (
              <Link to="/vault/upload/v2" className="btn btn-primary btn-sm">
                <Plus size={13} /> Subir al Vault
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
          {filtered.map((m) => (
            <li key={m.id}>
              <VaultPickerRow
                model={m}
                selected={selectedModel?.id === m.id}
                onSelect={setSelectedModel}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Panel de configuración (solo si se eligió modelo) */}
      {selectedModel && (
        <form id="vault-picker-form" onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-[var(--color-border-soft)] pt-3">
          <span className="lbl-eyebrow text-[9px]">Configuración del item</span>
          <FormFieldRow label="Impresora" required>
            <select
              required
              className={FORM_INPUT_CLS}
              value={form.printer_id}
              onChange={(e) => setForm((p) => ({ ...p, printer_id: e.target.value }))}
            >
              <option value="">— Seleccionar —</option>
              {printers.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </FormFieldRow>
          <FormFieldRow
            label="Filamento"
            hint={
              selectedModel.sliced_filament_type
                ? `Sugerido por el .gcode.3mf: ${selectedModel.sliced_filament_type}`
                : 'Opcional — si lo eliges, se descontará del inventario al marcar listo'
            }
          >
            <select
              className={FORM_INPUT_CLS}
              value={form.filament_id}
              onChange={(e) => setForm((p) => ({ ...p, filament_id: e.target.value }))}
            >
              <option value="">— Sin asignar —</option>
              {filaments.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </FormFieldRow>
          <div className="grid grid-cols-2 gap-2.5">
            <FormFieldRow label="Cantidad" required>
              <input
                type="number"
                min={1}
                max={999}
                required
                className={FORM_INPUT_CLS}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              />
            </FormFieldRow>
            <FormFieldRow label="Peso/copia">
              <p className="mono text-sm text-tech-white py-1.5">
                {selectedModel.sliced_weight_g != null
                  ? `${Number(selectedModel.sliced_weight_g).toFixed(0)} g`
                  : '—'}
              </p>
            </FormFieldRow>
          </div>
          <FormFieldRow label="Notas">
            <textarea
              rows={2}
              className={`${FORM_INPUT_CLS} resize-none`}
              placeholder="Optional — visible en el item de cola"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormFieldRow>
        </form>
      )}
    </div>
  );

  const Footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        type="submit"
        form="vault-picker-form"
        icon={Save}
        disabled={!canSubmit}
        className="flex-1 justify-center"
      >
        {saving ? 'Agregando…' : 'Agregar a cola'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Agregar a cola desde Vault" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      eyebrow="COLA · NUEVO ITEM"
      title="Elegir modelo del Vault"
      width={540}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QueuePageV2() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();

  const [tab, setTab] = useState('activa');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [filaments, setFilaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const firstLoad = useRef(true);

  const load = async () => {
    setLoading(true);
    const [a, h, p, f] = await Promise.allSettled([
      getQueue(),
      getQueueHistory(),
      // Cargamos printers/filaments solo la primera vez (no cambian seguido)
      // para no pegarle a la API en cada refresh post-mutación.
      firstLoad.current ? getPrinters() : Promise.resolve({ data: null }),
      firstLoad.current ? getInventoryItems() : Promise.resolve({ data: null }),
    ]);
    if (a.status === 'fulfilled') setActive(a.value.data || []);
    if (h.status === 'fulfilled') setHistory(h.value.data || []);
    if (p.status === 'fulfilled' && p.value.data) {
      const arr = [...p.value.data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es'),
      );
      setPrinters(arr);
    }
    if (f.status === 'fulfilled' && f.value.data) {
      // Solo filamentos para el picker.
      const arr = [...f.value.data]
        .filter((it) => (it.category || '').toLowerCase() === 'filamento')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
      setFilaments(arr);
    }
    firstLoad.current = false;
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {
      toast.error('No se pudo cargar la cola');
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    let pending = 0;
    let printing = 0;
    let totalH = 0;
    for (const it of active) {
      if (it.status === 'pending') pending += 1;
      if (it.status === 'printing') printing += 1;
      const v = itemView(it);
      const h = Number(v.print_time_hours || 0) * Number(v.quantity || 1);
      if (Number.isFinite(h)) totalH += h;
    }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const doneToday = history.filter((h) => {
      if ((h.status || '').toLowerCase() !== 'done') return false;
      const t = new Date(h.completed_at || h.created_at).getTime();
      return Number.isFinite(t) && t >= todayStart.getTime();
    }).length;
    return { pending, printing, totalH, doneToday };
  }, [active, history]);

  const _matchesQuery = (item, q) => {
    if (!q) return true;
    const v = itemView(item);
    return (
      (v.piece_name || '').toLowerCase().includes(q) ||
      (v.printer_name || '').toLowerCase().includes(q) ||
      (item.notes || '').toLowerCase().includes(q)
    );
  };

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...active].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return q ? sorted.filter((i) => _matchesQuery(i, q)) : sorted;
  }, [active, query]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...history].sort(
      (a, b) =>
        new Date(b.completed_at || b.created_at).getTime() -
        new Date(a.completed_at || a.created_at).getTime(),
    );
    return q ? sorted.filter((i) => _matchesQuery(i, q)) : sorted;
  }, [history, query]);

  const counts = { activa: active.length, historial: history.length };

  const handleAction = async (item, status) => {
    setBusy(true);
    try {
      await updateQueueStatus(item.id, { status });
      toast.success(
        status === 'done' ? 'Marcado como listo' : status === 'cancelled' ? 'Cancelado' : 'Actualizado',
      );
      await load();
      if (status === 'done' || status === 'cancelled') setSelected(null);
    } catch {
      toast.error('No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm('¿Eliminar este item de la cola?', 'Eliminar');
    if (!ok) return false;
    try {
      await deleteQueueItem(item.id);
      toast.success('Item eliminado');
      setActive((cur) => cur.filter((x) => x.id !== item.id));
      setHistory((cur) => cur.filter((x) => x.id !== item.id));
      return true;
    } catch {
      toast.error('No se pudo eliminar');
      return false;
    }
  };

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Pendientes" value={stats.pending} unit="items" sub={`${stats.printing} imprimiendo`} accent={ACCENT} icon={ListOrdered} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Tiempo en cola" value={stats.totalH.toFixed(1)} unit="h" sub="planificado" accent="#FBBF24" icon={Clock} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Listos hoy" value={stats.doneToday} unit="docs" sub="pasaron a inventario" accent="#34D399" icon={CheckCircle2} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Historial" value={history.length} unit="docs" sub="acumulados" accent="#94A0AE" icon={Clock} />
      </div>
    </div>
  );

  const TabsBar = (
    <div className="flex items-center gap-0.5 px-6 border-b border-[var(--color-border)] overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors whitespace-nowrap -mb-px border-b-2 ${
              isActive ? 'text-tech-white' : 'text-steel border-transparent hover:text-tech-white'
            }`}
            style={isActive ? { borderColor: ACCENT } : undefined}
          >
            <Icon size={13} style={isActive ? { color: ACCENT } : { color: '#7A8494' }} />
            {t.label}
            <span
              className={`mono text-[10px] px-1.5 py-px rounded-full border ${
                isActive ? 'bg-teal-500/14 border-teal-500/30 text-teal-300' : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
              }`}
            >
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );

  // ── Mobile shell ─────────────────────────────────────────────────────────
  if (isMobile) {
    const tabLabel = TABS.find((t) => t.id === tab)?.label || tab;
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Cola"
          appIcon={ListOrdered}
          appAccent={ACCENT}
          title={tabLabel}
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-3 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Cola · resumen</span>
              <span className="mono text-[10px] text-gunmetal">{active.length} en cola</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="mono text-3xl font-semibold text-tech-white tracking-tight">
                {stats.pending}
              </span>
              <span className="mono text-sm text-gunmetal">pendientes · {stats.printing} imprimiendo</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="lbl-eyebrow text-[9px]">Tiempo</span>
                <p className="mono text-sm text-tech-white mt-0.5">{stats.totalH.toFixed(1)}h</p>
              </div>
              <div>
                <span className="lbl-eyebrow text-[9px]">Listos hoy</span>
                <p className="mono text-sm text-emerald-300 mt-0.5">{stats.doneToday}</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="mt-3 px-4 flex gap-1.5">
          {TABS.map((t) => {
            const isActive = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  isActive ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-transparent border-[var(--color-border)] text-steel'
                }`}
              >
                <Icon size={12} />
                {t.label}
                <span className="mono text-[10px] text-gunmetal">{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
            <Search size={14} className="text-gunmetal" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pieza, impresora, notas…"
              className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
            />
          </div>
        </div>
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando cola…</p>
        ) : (tab === 'activa' ? filteredActive : filteredHistory).length === 0 ? (
          <div className="mt-3 pb-28">
            <EmptyState
              icon={tab === 'activa' ? ListOrdered : Clock}
              accent={ACCENT}
              title={tab === 'activa' ? 'Cola vacía' : 'Sin historial'}
              hint={
                tab === 'activa'
                  ? 'Agrega una cotización a la cola para empezar.'
                  : 'Cuando termines o canceles un job aparecerá aquí.'
              }
            />
          </div>
        ) : (
          <ul className="mt-3 pb-28">
            {(tab === 'activa' ? filteredActive : filteredHistory).map((it) => (
              <li key={it.id}>
                <QueueRow item={it} onClick={setSelected} />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
          style={{ background: ACCENT, color: '#0A1014', boxShadow: `0 8px 24px ${ACCENT}55` }}
          aria-label="Agregar a cola"
        >
          <Plus size={16} strokeWidth={2.5} />
          Agregar
        </button>
        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={
            selected
              ? itemView(selected).piece_name ||
                selected.notes ||
                `Item #${selected.id}`
              : ''
          }
          height="full"
        >
          <div className="px-5 pt-4 pb-3">
            <QueueDrawerBody item={selected} />
          </div>
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <QueueDrawerFooter
                item={selected}
                onAction={handleAction}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
                busy={busy}
              />
            </div>
          )}
        </MobileSheet>
        <VaultPickerDrawer
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onAdded={() => {
            setPickerOpen(false);
            load();
          }}
          printers={printers}
          filaments={filaments}
          isMobile
        />
      </div>
    );
  }

  // ── Desktop ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <ListOrdered size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Queue</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">{tab}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setPickerOpen(true)}
          >
            Agregar a cola
          </Button>
        </div>
      </header>

      {KPIs}
      {TabsBar}

      <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
        <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
          <Search size={13} className="text-gunmetal" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pieza, impresora, notas…"
            className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
          />
        </div>
        <span className="flex-1" />
        <span className="mono text-[11px] text-gunmetal">
          {(tab === 'activa' ? filteredActive : filteredHistory).length} de{' '}
          {(tab === 'activa' ? active : history).length}
        </span>
      </div>

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando cola…</p>
      ) : (tab === 'activa' ? filteredActive : filteredHistory).length === 0 ? (
        <EmptyState
          icon={tab === 'activa' ? ListOrdered : Clock}
          accent={ACCENT}
          title={tab === 'activa' ? 'Cola vacía' : 'Sin historial'}
          hint={
            tab === 'activa'
              ? 'Agrega una cotización a la cola para empezar a imprimir.'
              : 'Cuando termines o canceles un job aparecerá en el historial.'
          }
          action={
            tab === 'activa' ? (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setPickerOpen(true)}
              >
                Agregar a cola
              </Button>
            ) : null
          }
        />
      ) : (
        <div
          className="px-6 pb-8 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
        >
          {(tab === 'activa' ? filteredActive : filteredHistory).map((it) => (
            <QueueCard
              key={it.id}
              item={it}
              onClick={setSelected}
              onAction={handleAction}
              busy={busy}
            />
          ))}
        </div>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? `COLA · POSICIÓN #${selected.position ?? '—'}` : undefined}
        title={
          selected
            ? itemView(selected).piece_name ||
              selected.notes ||
              `Item #${selected.id}`
            : ''
        }
        width={460}
        footer={
          selected && (
            <QueueDrawerFooter
              item={selected}
              onAction={handleAction}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
              busy={busy}
            />
          )
        }
      >
        <QueueDrawerBody item={selected} />
      </DetailDrawer>

      <VaultPickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdded={() => {
          setPickerOpen(false);
          load();
        }}
        printers={printers}
        filaments={filaments}
        isMobile={false}
      />

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{active.length} en cola</span>
        <span className="mono">{stats.totalH.toFixed(1)}h planificadas</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
