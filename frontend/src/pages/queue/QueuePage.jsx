/**
 * @file Página de la app Queue.
 *
 * Dos pestañas:
 *  - Activa: cola de pendientes + en impresión, ordenada por `position`.
 *  - Historial: jobs `done`/`cancelled` con timestamp.
 *
 * Cada item puede provenir de dos fuentes:
 *  - **Quote**: cotización guardada con precio calculado.
 *  - **Vault**: modelo `.gcode.3mf` agregado vía `VaultPickerDrawer`.
 *
 * Acciones en cada item: Marcar imprimiendo / Marcar listo / Cancelar / Eliminar.
 * Cuando se marca `done` el backend descuenta inventario y suma horas a impresora.
 *
 * @module pages/queue/QueuePage
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  FileBox,
  FileText,
  GripVertical,
  Layers,
  ListOrdered,
  Play,
  Plus,
  Printer,
  Save,
  Search,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AppTabs,
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
  assignQueueItemProject,
  createQueueBatch,
  deleteQueueBatch,
  deleteQueueItem,
  duplicateQueueItem,
  getInventoryItems,
  getPrinters,
  getProjects,
  getQueue,
  getQueueHistory,
  getSpools,
  getVaultFiles,
  reorderQueue,
  scheduleQueueItem,
  updateQueueStatus,
} from '../../services/api';
import { FAILURE_CATEGORIES } from '../../utils/failureCategories';
import { fmtCOP } from '../../utils/inventoryAdapter';
import { getThumbnail } from '../../utils/thumbnail';
import BatchRow from './components/BatchRow';
import ScheduleModal from './components/ScheduleModal';
import TimelineView from './components/TimelineView';
import {
  ACCENT,
  QUEUE_TABS as TABS,
  fmtDate,
  fmtTimeHours,
  getBatchProgress,
  groupIntoUnits,
  itemView,
  statusBadge,
  unitDndId,
} from './queueHelpers';

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

function QueueCard({
  item, onClick, onAction, busy,
  selectMode, selected, onToggleSelect, onDuplicate, onSchedule,
}) {
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <Card as="div" interactive className="p-4 flex flex-col gap-3" onClick={() => onClick(item)}>
      <div className="flex items-start gap-3">
        {selectMode && item.status === 'pending' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            aria-label={selected ? 'Quitar de selección' : 'Seleccionar'}
            className="shrink-0 text-teal-400"
          >
            {selected ? <CheckSquare size={22} /> : <Square size={22} className="text-gunmetal" />}
          </button>
        ) : (
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
        )}
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
            {item.overdue && (
              <StatusPill tone="danger" icon={CalendarClock}>
                Atrasado
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
            {item.scheduled_at ? ` · ${fmtDate(item.scheduled_at)}` : ''}
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
        {item.status === 'pending' && onSchedule && (
          <Button
            variant="ghost"
            size="sm"
            icon={CalendarClock}
            onClick={() => onSchedule(item)}
            disabled={busy}
            className="text-gunmetal hover:text-tech-white"
          >
            Programar
          </Button>
        )}
        {onDuplicate && (
          <Button
            variant="ghost"
            size="sm"
            icon={Copy}
            onClick={() => onDuplicate(item)}
            disabled={busy}
            className="text-gunmetal hover:text-tech-white"
          >
            Duplicar
          </Button>
        )}
      </div>
    </Card>
  );
}

function QueueRow({ item, onClick, selectMode, selected, onToggleSelect }) {
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); }
      }}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors cursor-pointer"
    >
      {selectMode && item.status === 'pending' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          aria-label={selected ? 'Quitar de selección' : 'Seleccionar'}
          className="shrink-0 text-teal-400"
        >
          {selected ? <CheckSquare size={20} /> : <Square size={20} className="text-gunmetal" />}
        </button>
      ) : (
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
      )}
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
          {item.overdue && (
            <StatusPill tone="danger" icon={CalendarClock}>
              Atrasado
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
          {item.scheduled_at ? ` · ${fmtDate(item.scheduled_at)}` : ''}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </div>
  );
}

// ─── Drag-and-drop reorder (issue #133) ────────────────────────────────────

/**
 * Envuelve una unidad draggable (item suelto o `BatchRow` completo) con
 * `useSortable`. El "handle" de arrastre es el grip a la izquierda — el
 * resto de la unidad conserva su propio `onClick` (abrir drawer) sin
 * interferencia del drag.
 */
function SortableUnit({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <span
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing text-gunmetal-dim hover:text-gunmetal touch-none"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={15} />
      </span>
      <div className="pl-5">{children}</div>
    </div>
  );
}

/**
 * Sección "cola activa": `printing` fijos arriba (sin drag), luego
 * `pending` en `SortableContext` — cada unidad es un item suelto o un
 * lote completo (`BatchRow`). `variant` decide si los items sueltos se
 * renderizan como `QueueCard` (grid desktop) o `QueueRow` (lista mobile).
 */
function ActiveQueueList({
  variant, printingItems, pendingUnits, active, history, busy,
  onClick, onAction, sensors, onDragEnd,
  selectMode, selectedIds, onToggleSelect, onDuplicate, onSchedule, onUngroupBatch,
}) {
  const renderSingle = (item) =>
    variant === 'card' ? (
      <QueueCard
        key={item.id}
        item={item}
        onClick={onClick}
        onAction={onAction}
        busy={busy}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={onToggleSelect}
        onDuplicate={onDuplicate}
        onSchedule={onSchedule}
      />
    ) : (
      <QueueRow
        key={item.id}
        item={item}
        onClick={onClick}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={onToggleSelect}
      />
    );

  const gridCls = 'grid gap-3';
  const gridStyle = { gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' };

  return (
    <div className="flex flex-col gap-3">
      {printingItems.length > 0 && (
        <div className={variant === 'card' ? gridCls : 'flex flex-col'} style={variant === 'card' ? gridStyle : undefined}>
          {printingItems.map((item) => renderSingle(item))}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pendingUnits.map(unitDndId)} strategy={verticalListSortingStrategy}>
          <div className={variant === 'card' ? gridCls : 'flex flex-col'} style={variant === 'card' ? gridStyle : undefined}>
            {pendingUnits.map((unit) => (
              <SortableUnit key={unitDndId(unit)} id={unitDndId(unit)}>
                {unit.type === 'batch' ? (
                  <BatchRow
                    batchId={unit.batchId}
                    items={unit.items}
                    progress={getBatchProgress(unit.batchId, active, history)}
                    renderItem={renderSingle}
                    onUngroup={onUngroupBatch}
                    busy={busy}
                  />
                ) : (
                  renderSingle(unit.item)
                )}
              </SortableUnit>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

/**
 * Cuerpo del drawer (info read-only). El header (con eyebrow `COLA · POSICIÓN
 * #N`) lo aporta `DetailDrawer` v2; las acciones viven en `QueueDrawerFooter`.
 */
function QueueDrawerBody({ item, projects, onAssignProject }) {
  if (!item) return null;
  const badge = statusBadge(item.status);
  const v = itemView(item);
  return (
    <div className="flex flex-col gap-4">
      {Array.isArray(projects) && projects.length > 0 && (
        <div>
          <span className="lbl-eyebrow text-[9px] mb-1.5 block">Proyecto</span>
          <select
            value={item.project_id ?? ''}
            onChange={(e) => onAssignProject?.(item, e.target.value === '' ? null : Number(e.target.value))}
            className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500"
          >
            <option value="">— Sin proyecto —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
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
          {item.overdue && (
            <StatusPill tone="danger" icon={CalendarClock} size="lg">
              Atrasado
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

      {item.scheduled_at && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Programado para</span>
          <p className={`mono text-sm mt-0.5 ${item.overdue ? 'text-rose-400' : 'text-tech-white'}`}>
            {fmtDate(item.scheduled_at)}
          </p>
        </Card>
      )}

      {v.source === 'vault' && (v.filament_name || v.sliced_filament_type || v.spool_label_code) && (
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
          {v.spool_label_code && (
            <p className="mono text-[11px] text-amber-300 mt-1">
              Bobina {v.spool_label_code}
              {v.spool_percent_remaining != null && ` · ${v.spool_percent_remaining.toFixed(0)}% restante`}
            </p>
          )}
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
function QueueDrawerFooter({ item, onAction, onDelete, onClose, busy, onDuplicate, onSchedule }) {
  if (!item) return null;
  const isActive = item.status === 'pending' || item.status === 'printing';
  return (
    <>
      {item.status === 'pending' && onSchedule && (
        <Button
          variant="ghost"
          icon={CalendarClock}
          onClick={() => onSchedule(item)}
          disabled={busy}
          className="text-gunmetal hover:text-tech-white"
        >
          Programar
        </Button>
      )}
      {onDuplicate && (
        <Button
          variant="ghost"
          icon={Copy}
          onClick={() => onDuplicate(item)}
          disabled={busy}
          className="text-gunmetal hover:text-tech-white"
        >
          Duplicar
        </Button>
      )}
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
  const ready = !!model.is_print_ready;
  return (
    <button
      type="button"
      onClick={() => {
        if (!ready) {
          toast.error('Sube el .gcode.3mf laminado antes de encolar este modelo');
          return;
        }
        onSelect(model);
      }}
      aria-disabled={!ready}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
        selected
          ? 'bg-teal-500/10 border border-teal-500/40'
          : 'border border-transparent hover:bg-[var(--color-surf-hover)]/40'
      } ${ready ? '' : 'opacity-50 cursor-not-allowed'}`}
    >
      <div
        className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center shrink-0"
        style={{ border: '1px solid var(--color-border-soft)' }}
      >
        {thumb ? (
          <img src={thumb} alt={model.name} className={`w-full h-full object-cover ${ready ? '' : 'grayscale'}`} />
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
      {ready ? (
        <StatusPill tone="done" icon={Printer}>Listo</StatusPill>
      ) : (
        <StatusPill tone="neutral" icon={FileBox}>Solo .3mf</StatusPill>
      )}
    </button>
  );
}

/**
 * Drawer/sheet de "Agregar a cola desde Vault". Reemplaza el `Link to
 * /cost/quotes` antiguo del header/FAB de QueuePage.
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
 * `/vault/upload`.
 */
function VaultPickerDrawer({ open, onClose, onAdded, printers, filaments, projects, isMobile }) {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [form, setForm] = useState({
    printer_id: '',
    filament_id: '',
    spool_id: '',
    quantity: 1,
    notes: '',
    project_id: '',
    split_copies: false,
  });
  const [saving, setSaving] = useState(false);
  const [spools, setSpools] = useState([]);

  // Bobinas activas del filamento elegido (issue #134) — se recargan cada
  // vez que cambia `filament_id`; `spool_id` se resetea porque una bobina
  // pertenece a un solo ítem de inventario.
  useEffect(() => {
    if (!form.filament_id) {
      setSpools([]);
      return;
    }
    getSpools({ inventory_item_id: form.filament_id, status: 'active' })
      .then((res) => setSpools(res.data || []))
      .catch(() => setSpools([]));
  }, [form.filament_id]);

  // Reset cuando abre/cierra.
  useEffect(() => {
    if (!open) return;
    setSelectedModel(null);
    setQuery('');
    setForm({
      printer_id: printers[0]?.id ? String(printers[0].id) : '',
      filament_id: '',
      spool_id: '',
      quantity: 1,
      notes: '',
      project_id: '',
      split_copies: false,
    });
    setLoadingModels(true);
    // Issue #62: mostrar TODOS los modelos (no solo print_ready). Los
    // no-laminados quedan grayed-out + disabled con badge "Solo .3mf",
    // así el usuario ve que existen y entiende qué falta para encolar.
    getVaultFiles({ page_size: 100 })
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
      const quantity = Math.max(1, Math.min(999, parseInt(form.quantity, 10) || 1));
      const res = await addToQueueFromVault({
        vault_model_id: selectedModel.id,
        printer_id: parseInt(form.printer_id, 10),
        filament_id: form.filament_id ? parseInt(form.filament_id, 10) : null,
        spool_id: form.spool_id ? parseInt(form.spool_id, 10) : null,
        quantity,
        notes: form.notes.trim() || null,
        project_id: form.project_id ? parseInt(form.project_id, 10) : null,
        split_copies: form.split_copies && quantity > 1,
      });
      toast.success(
        form.split_copies && quantity > 1
          ? `${quantity} copias agregadas a la cola en lote`
          : `Agregado a cola en posición #${res.data.position}`,
      );
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
          data-search-input
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
          title={models.length === 0 ? 'Sin modelos en el Vault' : 'Sin resultados'}
          hint={
            models.length === 0
              ? 'Sube un modelo al Vault (.3mf editable o .gcode.3mf laminado) para empezar.'
              : 'Cambia el filtro o limpia la búsqueda.'
          }
          action={
            models.length === 0 ? (
              <Link to="/vault/upload" className="btn btn-primary btn-sm">
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
              onChange={(e) => setForm((p) => ({ ...p, filament_id: e.target.value, spool_id: '' }))}
            >
              <option value="">— Sin asignar —</option>
              {filaments.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </FormFieldRow>
          {form.filament_id && spools.length > 0 && (
            <FormFieldRow
              label="Bobina"
              hint="Opcional — si eliges una, el consumo va a esta bobina específica (no al agregado)"
            >
              <select
                className={FORM_INPUT_CLS}
                value={form.spool_id}
                onChange={(e) => setForm((p) => ({ ...p, spool_id: e.target.value }))}
              >
                <option value="">— Sin bobina específica —</option>
                {spools.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.label_code} · {s.percent_remaining.toFixed(0)}% ({Number(s.remaining_weight_g).toFixed(0)}g)
                  </option>
                ))}
              </select>
            </FormFieldRow>
          )}
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
          {Number(form.quantity) > 1 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.split_copies}
                onChange={(e) => setForm((p) => ({ ...p, split_copies: e.target.checked }))}
                className="mt-0.5"
              />
              <span className="text-xs text-steel">
                Separar copias — crea {form.quantity} items independientes (en vez de uno con
                cantidad {form.quantity}) agrupados como lote, para repartirlos entre impresoras
                u horarios distintos.
              </span>
            </label>
          )}
          <FormFieldRow label="Notas">
            <textarea
              rows={2}
              className={`${FORM_INPUT_CLS} resize-none`}
              placeholder="Optional — visible en el item de cola"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormFieldRow>
          {projects?.length > 0 && (
            <FormFieldRow label="Proyecto" hint="Opcional — agrupa este item con otros del mismo encargo">
              <select
                className={FORM_INPUT_CLS}
                value={form.project_id}
                onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))}
              >
                <option value="">— Sin proyecto —</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </FormFieldRow>
          )}
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

/**
 * Modal de motivo de cancelación (issue #130) — categoría + texto libre,
 * ambos opcionales. "Cancelar sin motivo" no bloquea el flujo; alimenta
 * el historial por modelo del Vault y el futuro epic de Stats.
 */
function CancelReasonModal({ item, onConfirm, onClose }) {
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');

  if (!item) return null;

  return (
    <div className="tf-modal-overlay" onClick={onClose}>
      <div className="tf-modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="tf-page-title text-base mb-0">Cancelar impresión</p>
          <button type="button" onClick={onClose} className="text-gunmetal hover:text-tech-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-steel mb-4">
          {item.vault?.name || item.quote?.piece_name || 'Este ítem'} — el motivo es opcional,
          ayuda a llevar el historial de fallos.
        </p>
        <label className="tf-label">Categoría (opcional)</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="tf-input mb-3"
        >
          <option value="">Sin categoría</option>
          {FAILURE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="tf-label">Detalle (opcional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Ej. se despegó de la cama en la capa 40"
          className="tf-input mb-5"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onConfirm('', '')}>
            Omitir y cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={XCircle}
            onClick={() => onConfirm(reason, category)}
          >
            Confirmar cancelación
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();

  // Tab inicial: 'activa' salvo que lleguemos de vuelta desde Bitácora
  // (PrintLogPage navega con state.tab para no perder el tab previo — #181).
  const [tab, setTab] = useState(location.state?.tab || 'activa');
  // Bitácora es una ruta separada (PrintLogPage) fusionada visualmente en
  // el mismo AppTabs — issue #181. Los demás ids son tabs de estado interno.
  const handleTabChange = (id) => {
    if (id === 'bitacora') {
      navigate('/queue/log', { state: { tab } });
      return;
    }
    setTab(id);
  };
  const [query, setQuery] = useState('');
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [filaments, setFilaments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Cada uno solo se marca `true` cuando su fetch respectivo TUVO ÉXITO —
  // así, si getProjects() (o printers/filaments) falla transitoriamente en
  // el primer load, el siguiente load() lo reintenta en vez de quedar
  // deshabilitado en silencio por el resto de la sesión.
  const printersLoaded = useRef(false);
  const filamentsLoaded = useRef(false);
  const projectsLoaded = useRef(false);

  const load = async () => {
    setLoading(true);
    const [a, h, p, f, pr] = await Promise.allSettled([
      getQueue(),
      getQueueHistory(),
      // Cargamos printers/filaments/proyectos solo mientras no hayan
      // cargado con éxito todavía (no cambian seguido) para no pegarle a
      // la API en cada refresh post-mutación.
      printersLoaded.current ? Promise.resolve({ data: null }) : getPrinters(),
      filamentsLoaded.current ? Promise.resolve({ data: null }) : getInventoryItems(),
      projectsLoaded.current ? Promise.resolve({ data: null }) : getProjects(),
    ]);
    if (a.status === 'fulfilled') setActive(a.value.data || []);
    if (h.status === 'fulfilled') setHistory(h.value.data || []);
    if (p.status === 'fulfilled' && p.value.data) {
      const arr = [...p.value.data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es'),
      );
      setPrinters(arr);
      printersLoaded.current = true;
    }
    if (f.status === 'fulfilled' && f.value.data) {
      // Solo filamentos para el picker.
      const arr = [...f.value.data]
        .filter((it) => (it.category || '').toLowerCase() === 'filamento')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
      setFilaments(arr);
      filamentsLoaded.current = true;
    }
    if (pr.status === 'fulfilled' && pr.value.data) {
      setProjects(pr.value.data);
      projectsLoaded.current = true;
    }
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

  const counts = {
    activa: active.length,
    historial: history.length,
    timeline: active.filter((it) => it.scheduled_at).length,
  };

  // ── Queue avanzada: unidades draggable (item suelto o lote completo) —
  // issue #133. Los `printing` van pinneados arriba, fuera del drag-drop.
  const printingItems = useMemo(
    () => filteredActive.filter((it) => it.status === 'printing'),
    [filteredActive],
  );
  const pendingItems = useMemo(
    () => filteredActive.filter((it) => it.status === 'pending'),
    [filteredActive],
  );
  const pendingUnits = useMemo(() => groupIntoUnits(pendingItems), [pendingItems]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [scheduleTarget, setScheduleTarget] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event) => {
    const { active: activeEl, over } = event;
    if (!over || activeEl.id === over.id) return;
    const oldIndex = pendingUnits.findIndex((u) => unitDndId(u) === activeEl.id);
    const newIndex = pendingUnits.findIndex((u) => unitDndId(u) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pendingUnits, oldIndex, newIndex);
    const newOrderIds = reordered.flatMap((u) =>
      u.type === 'batch' ? u.items.map((i) => i.id) : [u.item.id],
    );

    const previousActive = active;
    const positionById = new Map(newOrderIds.map((id, idx) => [id, idx]));
    setActive((cur) =>
      cur.map((it) => (positionById.has(it.id) ? { ...it, position: positionById.get(it.id) } : it)),
    );

    try {
      await reorderQueue(newOrderIds);
    } catch {
      toast.error('No se pudo reordenar');
      setActive(previousActive);
    }
  };

  const handleToggleSelect = (itemId) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleGroupSelected = async () => {
    if (selectedIds.size < 2) return;
    setBusy(true);
    try {
      await createQueueBatch([...selectedIds]);
      toast.success('Items agrupados como lote');
      setSelectedIds(new Set());
      setSelectMode(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo agrupar');
    } finally {
      setBusy(false);
    }
  };

  const handleUngroupBatch = async (batchId) => {
    setBusy(true);
    try {
      await deleteQueueBatch(batchId);
      toast.success('Lote desagrupado');
      await load();
    } catch {
      toast.error('No se pudo desagrupar');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (item) => {
    setBusy(true);
    try {
      await duplicateQueueItem(item.id);
      toast.success('Item duplicado al final de la cola');
      await load();
    } catch {
      toast.error('No se pudo duplicar');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSchedule = async (scheduledAt) => {
    const item = scheduleTarget;
    setScheduleTarget(null);
    setBusy(true);
    try {
      const res = await scheduleQueueItem(item.id, scheduledAt);
      setSelected((cur) => (cur?.id === item.id ? res.data : cur));
      toast.success(scheduledAt ? 'Impresión programada' : 'Programación quitada');
      await load();
    } catch {
      toast.error('No se pudo programar');
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (item, status, extra = {}) => {
    setBusy(true);
    try {
      await updateQueueStatus(item.id, { status, ...extra });
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

  // Item pendiente de confirmar cancelación — issue #130. 'cancelled' no
  // llama a handleAction directo: abre el modal de motivo primero (opcional,
  // no bloqueante — "Cancelar sin motivo" sigue disponible ahí mismo).
  const [cancelTarget, setCancelTarget] = useState(null);

  const handleActionRequest = (item, status) => {
    if (status === 'cancelled') {
      setCancelTarget(item);
      return;
    }
    handleAction(item, status);
  };

  const handleConfirmCancel = (failureReason, failureCategory) => {
    const item = cancelTarget;
    setCancelTarget(null);
    handleAction(item, 'cancelled', {
      failure_reason: failureReason || null,
      failure_category: failureCategory || null,
    });
  };

  const handleAssignProject = async (item, projectId) => {
    try {
      const res = await assignQueueItemProject(item.id, projectId);
      setSelected(res.data);
      toast.success(projectId ? 'Proyecto asignado' : 'Proyecto quitado');
      await load();
    } catch {
      toast.error('No se pudo actualizar el proyecto');
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
    <AppTabs
      items={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
      value={tab}
      onChange={handleTabChange}
      accent={ACCENT}
      className="px-6 border-b border-[var(--color-border)]"
    />
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
        <AppTabs
          items={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
          value={tab}
          onChange={handleTabChange}
          accent={ACCENT}
          className="mt-3 px-4"
        />
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
        {tab === 'activa' && (
          <div className="px-4 mt-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={selectMode ? X : CheckSquare}
              onClick={() => {
                setSelectMode((v) => !v);
                setSelectedIds(new Set());
              }}
            >
              {selectMode ? 'Cancelar selección' : 'Seleccionar'}
            </Button>
            {selectMode && selectedIds.size >= 2 && (
              <Button variant="primary" size="sm" icon={Layers} onClick={handleGroupSelected} disabled={busy}>
                Agrupar como lote ({selectedIds.size})
              </Button>
            )}
          </div>
        )}
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando cola…</p>
        ) : tab === 'timeline' ? (
          <div className="mt-3 pb-28">
            <TimelineView items={active} printers={printers} />
          </div>
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
        ) : tab === 'activa' ? (
          <div className="mt-3 px-4 pb-28">
            <ActiveQueueList
              variant="row"
              printingItems={printingItems}
              pendingUnits={pendingUnits}
              active={active}
              history={history}
              busy={busy}
              onClick={setSelected}
              onAction={handleActionRequest}
              sensors={sensors}
              onDragEnd={handleDragEnd}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onDuplicate={handleDuplicate}
              onSchedule={setScheduleTarget}
              onUngroupBatch={handleUngroupBatch}
            />
          </div>
        ) : (
          <ul className="mt-3 pb-28">
            {filteredHistory.map((it) => (
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
            <QueueDrawerBody item={selected} projects={projects} onAssignProject={handleAssignProject} />
          </div>
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <QueueDrawerFooter
                item={selected}
                onAction={handleActionRequest}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
                busy={busy}
                onDuplicate={handleDuplicate}
                onSchedule={setScheduleTarget}
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
          projects={projects}
          isMobile
        />
        <CancelReasonModal
          item={cancelTarget}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
        <ScheduleModal
          item={scheduleTarget}
          onConfirm={handleConfirmSchedule}
          onClose={() => setScheduleTarget(null)}
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
        {tab === 'activa' && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={selectMode ? X : CheckSquare}
              onClick={() => {
                setSelectMode((v) => !v);
                setSelectedIds(new Set());
              }}
            >
              {selectMode ? 'Cancelar selección' : 'Seleccionar'}
            </Button>
            {selectMode && selectedIds.size >= 2 && (
              <Button variant="primary" size="sm" icon={Layers} onClick={handleGroupSelected} disabled={busy}>
                Agrupar como lote ({selectedIds.size})
              </Button>
            )}
          </div>
        )}
        <span className="mono text-[11px] text-gunmetal">
          {(tab === 'activa' ? filteredActive : filteredHistory).length} de{' '}
          {(tab === 'activa' ? active : history).length}
        </span>
      </div>

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando cola…</p>
      ) : tab === 'timeline' ? (
        <TimelineView items={active} printers={printers} />
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
      ) : tab === 'activa' ? (
        <div className="px-6 pb-8">
          <ActiveQueueList
            variant="card"
            printingItems={printingItems}
            pendingUnits={pendingUnits}
            active={active}
            history={history}
            busy={busy}
            onClick={setSelected}
            onAction={handleActionRequest}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onDuplicate={handleDuplicate}
            onSchedule={setScheduleTarget}
            onUngroupBatch={handleUngroupBatch}
          />
        </div>
      ) : (
        <div
          className="px-6 pb-8 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
        >
          {filteredHistory.map((it) => (
            <QueueCard
              key={it.id}
              item={it}
              onClick={setSelected}
              onAction={handleActionRequest}
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
              onAction={handleActionRequest}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
              busy={busy}
              onDuplicate={handleDuplicate}
              onSchedule={setScheduleTarget}
            />
          )
        }
      >
        <QueueDrawerBody item={selected} projects={projects} onAssignProject={handleAssignProject} />
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
        projects={projects}
        isMobile={false}
      />
      <CancelReasonModal
        item={cancelTarget}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />
      <ScheduleModal
        item={scheduleTarget}
        onConfirm={handleConfirmSchedule}
        onClose={() => setScheduleTarget(null)}
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
