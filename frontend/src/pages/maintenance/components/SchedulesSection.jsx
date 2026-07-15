/**
 * @file Sección "Programados" de Mantenimiento (issue #138) — recordatorios
 * recurrentes por impresora (horas de impresión o días).
 *
 * Auto-contenida: hace su propio fetch de `/api/maintenance/schedules/` y
 * gestiona create/edit/complete/delete, en vez de vivir en el `reload()`
 * de MaintenancePage — evita acoplar el ciclo de esta sección al resto de
 * tabs (dashboard/historial) que tienen su propia cadencia de refresco.
 *
 * @module pages/maintenance/components/SchedulesSection
 */

import { useEffect, useState } from 'react';
import { MoreVertical, Plus, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  MobileSheet,
  ProgressBar,
  StatusPill,
} from '../../../components/ui';
import { useConfirm } from '../../../components/ConfirmDialog';
import {
  completeMaintenanceSchedule,
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getMaintenanceSchedules,
  updateMaintenanceSchedule,
} from '../../../services/api';
import { SCHEDULE_PRESETS } from '../presets';

const ACCENT = '#8B5CF6';

const STATUS_TONE = { ok: 'active', due_soon: 'warn', overdue: 'danger' };
const STATUS_LABEL = { ok: 'Al día', due_soon: 'Pronto', overdue: 'Vencido' };

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-violet-500 placeholder:text-gunmetal-dim';

function emptyForm(printerId) {
  return {
    printer_id: printerId ? String(printerId) : '',
    task_name: '',
    description: '',
    interval_type: 'print_hours',
    interval_value: '300',
  };
}

function scheduleToForm(s) {
  return {
    printer_id: String(s.printer_id),
    task_name: s.task_name,
    description: s.description || '',
    interval_type: s.interval_type,
    interval_value: String(s.interval_value),
  };
}

function remainingLabel(s) {
  const remaining = Math.max(0, Number(s.interval_value) - (Number(s.progress_pct) / 100) * Number(s.interval_value));
  if (s.status === 'overdue') {
    const over = (Number(s.progress_pct) - 100) / 100 * Number(s.interval_value);
    return s.interval_type === 'print_hours'
      ? `Vencido hace ~${over.toFixed(0)}h`
      : `Vencido hace ~${over.toFixed(0)} días`;
  }
  return s.interval_type === 'print_hours'
    ? `Faltan ~${remaining.toFixed(0)}h`
    : `Faltan ~${remaining.toFixed(0)} días`;
}

/** Card individual de un recordatorio, con progreso + menú de acciones. */
function ScheduleCard({ schedule, onEdit, onComplete, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = STATUS_TONE[schedule.status] || 'neutral';
  return (
    <Card className="p-3.5 flex flex-col gap-2.5 industrial-grid relative">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-tech-white truncate">{schedule.task_name}</p>
          <p className="text-[11px] text-gunmetal truncate">{schedule.printer_name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusPill tone={tone}>{STATUS_LABEL[schedule.status]}</StatusPill>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded text-gunmetal hover:text-tech-white"
              aria-label="Más acciones"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-40 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md shadow-xl py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5"
                  onClick={() => { setMenuOpen(false); onComplete(schedule); }}
                >
                  Marcar hecho
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5"
                  onClick={() => { setMenuOpen(false); onEdit(schedule); }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-300 hover:bg-white/5"
                  onClick={() => { setMenuOpen(false); onDelete(schedule); }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProgressBar
        value={Math.min(100, Number(schedule.progress_pct))}
        accent={schedule.status === 'overdue' ? '#F87171' : schedule.status === 'due_soon' ? '#FBBF24' : ACCENT}
        height={5}
      />
      <div className="flex items-center justify-between text-[11px] text-gunmetal">
        <span>{remainingLabel(schedule)}</span>
        <span className="mono">{Number(schedule.progress_pct).toFixed(0)}%</span>
      </div>
    </Card>
  );
}

/** Cuerpo del form crear/editar (compartido entre MobileSheet y DetailDrawer). */
function ScheduleFormBody({ form, setForm, printers, mode }) {
  return (
    <div className="flex flex-col gap-3">
      {mode === 'create' && (
        <div>
          <span className="block text-xs text-gunmetal mb-1.5">Presets rápidos</span>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_PRESETS.map((p) => (
              <button
                key={p.task_name}
                type="button"
                onClick={() => setForm((f) => ({
                  ...f,
                  task_name: p.task_name,
                  interval_type: p.interval_type,
                  interval_value: String(p.interval_value),
                }))}
                className="px-2 py-1 rounded-full text-[10.5px] border border-[var(--color-border-strong)] text-steel hover:text-tech-white hover:border-violet-500/50"
              >
                {p.task_name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Impresora <span className="text-rose-400">*</span></span>
        <select
          value={form.printer_id}
          onChange={(e) => setForm((f) => ({ ...f, printer_id: e.target.value }))}
          className={FORM_INPUT_CLS}
          disabled={mode === 'edit'}
          required
        >
          <option value="">Selecciona…</option>
          {printers.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Tarea <span className="text-rose-400">*</span></span>
        <input
          value={form.task_name}
          onChange={(e) => setForm((f) => ({ ...f, task_name: e.target.value }))}
          className={FORM_INPUT_CLS}
          placeholder="Ej. Lubricar ejes XY"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Tipo de intervalo</span>
          <select
            value={form.interval_type}
            onChange={(e) => setForm((f) => ({ ...f, interval_type: e.target.value }))}
            className={FORM_INPUT_CLS}
          >
            <option value="print_hours">Horas de impresión</option>
            <option value="days">Días</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">
            Cada {form.interval_type === 'print_hours' ? '(h)' : '(días)'} <span className="text-rose-400">*</span>
          </span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={form.interval_value}
            onChange={(e) => setForm((f) => ({ ...f, interval_value: e.target.value }))}
            className={FORM_INPUT_CLS}
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Descripción</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={FORM_INPUT_CLS}
          rows={2}
        />
      </label>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Array}  props.printers
 * @param {boolean} props.isMobile
 * @param {(count: number) => void} [props.onCountChange] - Reporta el total
 *   al padre (MaintenancePage) para el badge de la pestaña, sin duplicar el fetch.
 */
export default function SchedulesSection({ printers, isMobile, onCountChange }) {
  const confirm = useConfirm();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const res = await getMaintenanceSchedules();
      const list = res.data || [];
      setSchedules(list);
      onCountChange?.(list.length);
    } catch {
      toast.error('No se pudieron cargar los recordatorios');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm(printers?.[0]?.id));
    setFormOpen(true);
  };

  const openEdit = (schedule) => {
    setFormMode('edit');
    setEditingId(schedule.id);
    setForm(scheduleToForm(schedule));
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        printer_id: Number(form.printer_id),
        task_name: form.task_name,
        description: form.description || null,
        interval_type: form.interval_type,
        interval_value: Number(form.interval_value),
      };
      if (formMode === 'create') {
        await createMaintenanceSchedule(payload);
        toast.success('Recordatorio creado');
      } else {
        const { printer_id: _printerId, ...updatePayload } = payload;
        await updateMaintenanceSchedule(editingId, updatePayload);
        toast.success('Recordatorio actualizado');
      }
      setFormOpen(false);
      await reload();
    } catch {
      toast.error('No se pudo guardar el recordatorio');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (schedule) => {
    const ok = await confirm(`¿Marcar "${schedule.task_name}" como hecho ahora?`, 'Marcar hecho');
    if (!ok) return;
    try {
      await completeMaintenanceSchedule(schedule.id);
      toast.success('Recordatorio completado');
      await reload();
    } catch {
      toast.error('No se pudo completar el recordatorio');
    }
  };

  const handleDelete = async (schedule) => {
    const ok = await confirm(`¿Eliminar el recordatorio "${schedule.task_name}"?`, 'Eliminar');
    if (!ok) return;
    try {
      await deleteMaintenanceSchedule(schedule.id);
      toast.success('Recordatorio eliminado');
      await reload();
    } catch {
      toast.error('No se pudo eliminar el recordatorio');
    }
  };

  const formValid = form.printer_id && form.task_name.trim() && Number(form.interval_value) > 0;

  const formNode = (
    <ScheduleFormBody form={form} setForm={setForm} printers={printers || []} mode={formMode} />
  );

  const footerNode = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
      <Button
        variant="primary"
        size="sm"
        type="submit"
        form="schedule-form"
        disabled={!formValid || saving}
      >
        {formMode === 'create' ? 'Crear recordatorio' : 'Guardar cambios'}
      </Button>
    </>
  );

  if (loading) {
    return <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando recordatorios…</p>;
  }

  return (
    <div className={isMobile ? 'px-4 mt-3 pb-28' : 'px-6 pt-4 pb-8'}>
      <div className="flex items-center justify-between mb-3">
        <span className="lbl-eyebrow">Recordatorios programados</span>
        <Button variant="primary" size="sm" icon={Plus} onClick={openCreate} disabled={!printers?.length}>
          Nuevo
        </Button>
      </div>
      {schedules.length === 0 ? (
        <EmptyState
          icon={Wrench}
          accent={ACCENT}
          title="Sin recordatorios"
          hint="Crea un recordatorio recurrente (por horas de impresión o por días) para no olvidar mantenimientos periódicos."
          action={
            <Button variant="primary" size="sm" icon={Plus} onClick={openCreate} disabled={!printers?.length}>
              Crear el primero
            </Button>
          }
        />
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onEdit={openEdit}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {isMobile ? (
        <MobileSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={formMode === 'create' ? 'Nuevo recordatorio' : 'Editar recordatorio'}
          height="full"
        >
          <form id="schedule-form" onSubmit={handleSubmit} className="px-5 pt-4 pb-3">
            {formNode}
          </form>
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {footerNode}
          </div>
        </MobileSheet>
      ) : (
        <DetailDrawer
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={formMode === 'create' ? 'Nuevo recordatorio' : 'Editar recordatorio'}
          width={420}
          footer={footerNode}
        >
          <form id="schedule-form" onSubmit={handleSubmit}>
            {formNode}
          </form>
        </DetailDrawer>
      )}
    </div>
  );
}
