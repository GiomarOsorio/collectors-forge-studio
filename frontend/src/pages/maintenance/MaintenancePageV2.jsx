/**
 * @file Página rediseñada de la app Mantenimiento (Claude Design v2).
 *
 * Dos pestañas:
 *  - Dashboard: tarjetas por impresora con badges 🟢🟡🔴 por tipo de mantto.
 *  - Historial: lista cronológica de registros con buscador + filtro impresora.
 *
 * **Reemplaza por completo** las V1 `MaintenanceDashboardPage`, `MaintenanceLogsPage`
 * y `MaintenancePrintersPage`:
 *   - Crear / editar / eliminar logs vive en el `LogFormDrawer` invocado desde
 *     header, FAB, drawer de impresora y drawer de log.
 *   - Actualizar `current_hours` de la impresora vive en `PrinterHoursInlineForm`
 *     dentro del drawer de impresora.
 *   - Crear / eliminar impresoras sigue en `/cost/printers` (fuente única).
 *
 * Lee summary `/api/maintenance/summary/`, logs `/api/maintenance/logs/`,
 * `/printers/` y `/inventory/items/`.
 *
 * @module pages/maintenance/MaintenancePageV2
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  LayoutDashboard,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  Wrench,
  X,
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
  createMaintenanceLog,
  deleteMaintenanceLog,
  getInventoryItems,
  getMaintenanceLogs,
  getMaintenanceSummary,
  getPrinters,
  updateMaintenanceLog,
  updatePrinter,
} from '../../services/api';
import { MAINTENANCE_TYPES, getMaintenanceType } from '../../config/maintenance';

const ACCENT = '#8B5CF6';

const TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'logs',      label: 'Historial',  icon: ClipboardList },
];

const TYPE_BY_VALUE = MAINTENANCE_TYPES.reduce((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

/**
 * Clasifica un tipo de mantto según ratio hours_since/interval_hours.
 *
 * @returns {'ok'|'warning'|'critical'|'unknown'}
 */
function maintLevel(tipo, hoursSince) {
  const def = TYPE_BY_VALUE[tipo];
  if (!def?.interval_hours) return 'unknown';
  const ratio = Number(hoursSince || 0) / def.interval_hours;
  if (ratio >= 1) return 'critical';
  if (ratio >= 0.85) return 'warning';
  return 'ok';
}

const LEVEL_DOT = {
  ok:       { color: '#34D399', label: '🟢' },
  warning:  { color: '#FBBF24', label: '🟡' },
  critical: { color: '#F87171', label: '🔴' },
  unknown:  { color: '#5A6573', label: '⚪' },
};

/**
 * Mapea un level a metadata `StatusPill` (label + tone + icon).
 *
 * Tonos:
 *   - `danger`  → vencido / sobrepasó intervalo
 *   - `warn`    → pronto / ≥85% intervalo
 *   - `done`    → ok / dentro del intervalo
 *   - `neutral` → sin registro previo
 */
function levelBadge(level) {
  if (level === 'critical') return { label: 'Crítico', tone: 'danger', icon: AlertTriangle };
  if (level === 'warning')  return { label: 'Pronto',  tone: 'warn',   icon: Clock };
  if (level === 'ok')       return { label: 'OK',      tone: 'done',   icon: CheckCircle2 };
  return { label: 'Sin reg.', tone: 'neutral', icon: undefined };
}

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '—';
  }
};

// ─── Printer card (dashboard) ───────────────────────────────────────────────

function PrinterCard({ entry, onClick }) {
  const printer = entry.printer || {};
  const lastPerType = entry.last_per_type || {};
  const tipos = MAINTENANCE_TYPES.filter((t) => t.interval_hours);

  // Derivar level por tipo sin mutar contadores durante render (react-compiler
  // se queja de reassign — refactor a derivación funcional).
  const tipoLevels = tipos.map((t) => {
    const last = lastPerType[t.value];
    const lvl = last ? maintLevel(t.value, last.hours_since) : 'unknown';
    return { tipo: t, last, level: lvl };
  });
  const critical = tipoLevels.filter((x) => x.level === 'critical').length;
  const warning = tipoLevels.filter((x) => x.level === 'warning').length;
  const unknown = tipoLevels.filter((x) => x.level === 'unknown').length;
  const ok = tipoLevels.filter((x) => x.level === 'ok').length;

  const overallLevel = critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'ok';
  const overallColor = LEVEL_DOT[overallLevel].color;
  const overallBadge = levelBadge(overallLevel);

  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(entry)}
      className="text-left w-full p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          style={{
            background: `${overallColor}1A`,
            color: overallColor,
            border: `1px solid ${overallColor}40`,
          }}
        >
          <Printer size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <StatusPill tone={overallBadge.tone} icon={overallBadge.icon}>
              {overallBadge.label}
            </StatusPill>
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {printer.name || `Impresora #${printer.id}`}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">
            {Number(printer.current_hours || 0).toFixed(0)}h impresión acumulada
          </p>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-4 gap-1.5 text-[11px] border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <div className="flex flex-col items-center">
          <span className="text-rose-400 mono text-base">{critical}</span>
          <span className="lbl-eyebrow text-[8.5px]">crítico</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-amber-400 mono text-base">{warning}</span>
          <span className="lbl-eyebrow text-[8.5px]">pronto</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-emerald-400 mono text-base">{ok}</span>
          <span className="lbl-eyebrow text-[8.5px]">ok</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gunmetal mono text-base">{unknown}</span>
          <span className="lbl-eyebrow text-[8.5px]">sin reg.</span>
        </div>
      </div>

      {/* Top 3 alerts */}
      {(critical > 0 || warning > 0) && (
        <ul className="flex flex-col gap-1 border-t border-[var(--color-border-soft)] pt-2.5">
          {tipoLevels
            .filter((x) => x.level === 'critical' || x.level === 'warning')
            .slice(0, 3)
            .map(({ tipo, last, level }) => (
              <li key={tipo.value} className="flex items-center gap-2 text-[11px]">
                <span style={{ color: LEVEL_DOT[level].color }}>{LEVEL_DOT[level].label}</span>
                <span className="text-tech-white truncate flex-1">{tipo.label}</span>
                <span className="mono text-gunmetal shrink-0">
                  {last ? `${Math.round(Number(last.hours_since))}/${tipo.interval_hours}h` : '—'}
                </span>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Log row ────────────────────────────────────────────────────────────────

function LogRow({ log, onClick }) {
  const tipo = TYPE_BY_VALUE[log.maintenance_type] || { label: log.maintenance_type || '—' };
  return (
    <button
      type="button"
      onClick={() => onClick(log)}
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
        <Wrench size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tech-white truncate">{tipo.label}</p>
        <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">
          {fmtDate(log.performed_at)} · {Number(log.hours_at_maintenance || 0).toFixed(0)}h
          {log.printer_name ? ` · ${log.printer_name}` : ''}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

/**
 * Form inline para actualizar `current_hours` de la impresora sin salir del
 * drawer. Reemplaza al modal aparte que tenía la V1 `MaintenancePrintersPage`.
 *
 * Este valor se usa en la depreciación de la Calculadora de Costos y en el
 * cálculo de ratio de mantenimientos vencidos.
 */
function PrinterHoursInlineForm({ printer, onSaved }) {
  const [hours, setHours] = useState(String(printer.current_hours ?? ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHours(String(printer.current_hours ?? ''));
  }, [printer.current_hours, printer.id]);

  const dirty = hours.trim() !== String(printer.current_hours ?? '').trim();

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      await updatePrinter(printer.id, { current_hours: parseFloat(hours) || 0 });
      toast.success('Horas actualizadas');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo actualizar las horas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-3 flex flex-col gap-2">
      <span className="lbl-eyebrow text-[9px]">Horas acumuladas</span>
      <form onSubmit={save} className="flex items-end gap-2">
        <div className="flex-1">
          <input
            type="number"
            min="0"
            step="0.1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={FORM_INPUT_CLS}
            aria-label="Horas acumuladas de la impresora"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={Save}
          disabled={!dirty || saving}
        >
          {saving ? '…' : 'Guardar'}
        </Button>
      </form>
      <p className="text-[10.5px] text-gunmetal">
        Afecta la depreciación en la calculadora y los badges de mantenimiento vencido.
      </p>
    </Card>
  );
}

/**
 * Cuerpo del drawer de impresora. Header (eyebrow + title) lo aporta
 * `DetailDrawer` v2; el CTA "Registrar mantenimiento" va al slot `footer`
 * (`PrinterDrawerFooter`). Aquí adentro va el form inline de horas y la lista
 * de mantenimientos por tipo.
 */
function PrinterDrawerBody({ entry, onHoursSaved }) {
  if (!entry) return null;
  const printer = entry.printer || {};
  const lastPerType = entry.last_per_type || {};
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mono text-[11.5px] text-gunmetal">
          {printer.model || '—'} · {Number(printer.current_hours || 0).toFixed(0)}h impresión acumulada
        </p>
      </div>

      <PrinterHoursInlineForm printer={printer} onSaved={onHoursSaved} />

      <div>
        <span className="lbl-eyebrow text-[9px]">Mantenimientos por tipo</span>
        <ul className="mt-2 flex flex-col gap-1.5">
          {MAINTENANCE_TYPES.map((t) => {
            const last = lastPerType[t.value];
            const lvl = last ? maintLevel(t.value, last.hours_since) : 'unknown';
            const badge = levelBadge(lvl);
            return (
              <li
                key={t.value}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <StatusPill tone={badge.tone} icon={badge.icon}>
                      {badge.label}
                    </StatusPill>
                  </div>
                  <p className="text-sm text-tech-white truncate">{t.label}</p>
                  <p className="mono text-[10.5px] text-gunmetal">
                    {last
                      ? `Último ${fmtDate(last.performed_at)} · ${Math.round(
                          Number(last.hours_since),
                        )}h ago`
                      : 'Sin registro'}
                    {t.interval_hours ? ` · cada ${t.interval_hours}h` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Footer del drawer de impresora: CTA único "Registrar mantenimiento" que
 * abre el `LogFormDrawer` en create mode prefilled con `printer_id`.
 */
function PrinterDrawerFooter({ entry, onRegister }) {
  if (!entry) return null;
  return (
    <Button
      variant="primary"
      size="sm"
      icon={Plus}
      onClick={() => onRegister(entry.printer)}
      className="flex-1 justify-center"
    >
      Registrar mantenimiento
    </Button>
  );
}

/**
 * Cuerpo del drawer de log (read-only). Header lo aporta `DetailDrawer` v2;
 * CTA externo "Wiki BambuLab" va al footer si el tipo tiene `wiki_url`.
 */
function LogDrawerBody({ log }) {
  if (!log) return null;
  const tipo = TYPE_BY_VALUE[log.maintenance_type] || { label: log.maintenance_type || '—' };
  const items = Array.isArray(log.items) ? log.items : [];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mono text-[11.5px] text-gunmetal">
          {fmtDate(log.performed_at)} · {Number(log.hours_at_maintenance || 0).toFixed(0)}h
          {log.printer_name ? ` · ${log.printer_name}` : ''}
        </p>
      </div>
      {tipo.description && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Descripción</span>
          <p className="text-sm text-steel mt-1">{tipo.description}</p>
        </Card>
      )}
      {log.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{log.notes}</p>
        </Card>
      )}
      {items.length > 0 && (
        <div>
          <span className="lbl-eyebrow text-[9px]">Items usados ({items.length})</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <p className="text-sm text-tech-white truncate">{it.name || it.item_name || '—'}</p>
                <span className="mono text-xs text-gunmetal">{it.quantity || 1}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Footer del drawer de log: Editar / Eliminar + link a wiki BambuLab si aplica.
 * Las dos primeras acciones disparan el `LogFormDrawer` (edit mode) y un
 * `confirm()` + `deleteMaintenanceLog()` respectivamente.
 */
function LogDrawerFooter({ log, onEdit, onDelete, onClose }) {
  if (!log) return null;
  const tipo = TYPE_BY_VALUE[log.maintenance_type];
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        icon={Pencil}
        onClick={() => onEdit(log)}
        className="flex-1 justify-center"
      >
        Editar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={Trash2}
        onClick={async () => {
          const ok = await onDelete(log);
          if (ok) onClose();
        }}
        className="text-rose-400 hover:text-rose-300"
        aria-label="Eliminar log"
      />
      {tipo?.wiki_url && (
        <a
          href={tipo.wiki_url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost btn-sm"
          title="Ver cómo se hace en el wiki de BambuLab"
        >
          <ExternalLink size={13} /> Wiki
        </a>
      )}
    </>
  );
}

// ─── Form helpers (module-level — anti-pattern guard) ───────────────────────

/**
 * Clase reutilizable para inputs/selects/textarea del LogFormDrawer.
 * Mismo patrón que en Inventory para mantener la UI consistente.
 */
const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-violet-500 placeholder:text-gunmetal-dim';

/**
 * Eyebrow de sección dentro del LogFormDrawer (Identificación, Detalle, etc.).
 */
function FormSectionTitle({ children }) {
  return (
    <span className="lbl-eyebrow text-[9px] block mt-3 mb-1.5 first:mt-0">
      {children}
    </span>
  );
}

/**
 * Row label + input para el LogFormDrawer. Mantener a module-level para
 * evitar el bug "cursor jump" (ver `frontend/src/__tests__/formFieldFocus.test.jsx`).
 */
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

/** Estado vacío de un ítem del LogFormDrawer (create mode). */
const EMPTY_ITEM = {
  name: '',
  quantity: '1',
  unit_cost: '0',
  inventory_item_id: '',
  notes: '',
};

/**
 * Convierte los `suggested_items` del tipo de mantto en filas del formulario.
 */
function suggestedToFormItems(typeDef) {
  if (!typeDef?.suggested_items?.length) return [];
  return typeDef.suggested_items.map((si) => ({
    ...EMPTY_ITEM,
    name: si.name,
    quantity: String(si.quantity),
  }));
}

/**
 * Estado inicial del LogFormDrawer en create mode. Si `prefill.printer_id` o
 * `prefill.printer` se proveen, autollena impresora + horas actuales.
 */
function emptyLogForm({ printer, printers } = {}) {
  const defaultType = MAINTENANCE_TYPES[0];
  const target = printer || printers?.[0] || null;
  return {
    printer_id: target?.id ? String(target.id) : '',
    maintenance_type: defaultType.value,
    hours_at_maintenance: target ? String(target.current_hours ?? '') : '',
    description: '',
    performed_at: new Date().toISOString().split('T')[0],
  };
}

/** Convierte un log existente a la forma del formulario (edit mode). */
function logToEditForm(log) {
  return {
    printer_id: log.printer?.id ? String(log.printer.id) : '',
    maintenance_type: log.maintenance_type || '',
    hours_at_maintenance: String(log.hours_at_maintenance ?? ''),
    description: log.description ?? '',
    performed_at: log.performed_at ? log.performed_at.split('T')[0] : '',
  };
}

// ─── LogFormDrawer ──────────────────────────────────────────────────────────

/**
 * Drawer para crear / editar logs de mantenimiento.
 *
 * - **Create**: form completo con impresora, tipo, horas, fecha, descripción
 *   y array de items[] vinculables al inventario. Auto-prefilled con
 *   `suggested_items` del tipo seleccionado si los items aún están vacíos.
 * - **Edit**: solo permite cambiar fecha, horas, tipo y descripción. Los items
 *   no se editan (ya fueron descontados del inventario al crear el log).
 *
 * Se renderiza como `DetailDrawer` (desktop) o `MobileSheet` (mobile) según
 * `isMobile`. Footer fijo con Cancelar / Guardar.
 */
function LogFormDrawer({
  open,
  mode, // 'create' | 'edit'
  initialForm,
  printers,
  inventoryItems,
  editingLog,
  onClose,
  onSaved,
  isMobile,
}) {
  const [form, setForm] = useState(initialForm);
  const [formItems, setFormItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    if (mode === 'create') {
      const defaultType = getMaintenanceType(initialForm.maintenance_type);
      setFormItems(suggestedToFormItems(defaultType));
    } else {
      setFormItems([]);
    }
    setSaving(false);
  }, [open, initialForm, mode]);

  const handlePrinterChange = (printerId) => {
    const p = printers.find((pr) => String(pr.id) === printerId);
    setForm((prev) => ({
      ...prev,
      printer_id: printerId,
      hours_at_maintenance: p ? String(p.current_hours ?? '') : prev.hours_at_maintenance,
    }));
  };

  const handleTypeChange = (newType) => {
    setForm((prev) => ({ ...prev, maintenance_type: newType }));
    if (mode !== 'create') return;
    const allEmpty = formItems.every((it) => !it.name.trim());
    if (allEmpty) {
      const typeDef = getMaintenanceType(newType);
      setFormItems(suggestedToFormItems(typeDef));
    }
  };

  const handleInventoryItemChange = (index, itemId) => {
    const invItem = inventoryItems.find((i) => String(i.id) === itemId);
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventory_item_id: itemId,
        name: invItem ? invItem.name : updated[index].name,
        unit_cost: invItem ? String(invItem.unit_cost ?? '0') : updated[index].unit_cost,
      };
      return updated;
    });
  };

  const updateItem = (index, field, value) =>
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

  const addItem = () => setFormItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index) =>
    setFormItems((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const performedIso = form.performed_at ? `${form.performed_at}T00:00:00` : null;
      if (mode === 'create') {
        const payload = {
          printer_id: parseInt(form.printer_id, 10),
          maintenance_type: form.maintenance_type,
          hours_at_maintenance: parseFloat(form.hours_at_maintenance) || 0,
          description: form.description.trim() || null,
          performed_at: performedIso,
          items: formItems
            .filter((it) => it.name.trim())
            .map((it) => ({
              inventory_item_id: it.inventory_item_id
                ? parseInt(it.inventory_item_id, 10)
                : null,
              name: it.name.trim(),
              quantity: parseFloat(it.quantity) || 1,
              unit_cost: parseFloat(it.unit_cost) || 0,
              notes: it.notes.trim() || null,
            })),
        };
        await createMaintenanceLog(payload);
        toast.success('Registro creado');
      } else if (mode === 'edit' && editingLog) {
        await updateMaintenanceLog(editingLog.id, {
          performed_at: performedIso,
          hours_at_maintenance: parseFloat(form.hours_at_maintenance) || 0,
          maintenance_type: form.maintenance_type,
          description: form.description.trim() || null,
        });
        toast.success('Registro actualizado');
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const inventoryByCategory = useMemo(() => {
    return inventoryItems.reduce((acc, inv) => {
      const cat = inv.category || 'Sin categoría';
      (acc[cat] = acc[cat] || []).push(inv);
      return acc;
    }, {});
  }, [inventoryItems]);

  const title = mode === 'edit' ? 'Editar registro' : 'Nuevo registro';
  const eyebrow = mode === 'edit' ? 'MANTENIMIENTO · EDITAR' : 'MANTENIMIENTO · NUEVO';

  const Body = (
    <form id="log-form" onSubmit={handleSave} className="flex flex-col">
      <FormSectionTitle>Identificación</FormSectionTitle>
      <FormFieldRow label="Impresora" required>
        <select
          required
          disabled={mode === 'edit'}
          className={FORM_INPUT_CLS}
          value={form.printer_id}
          onChange={(e) => handlePrinterChange(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {printers.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
      </FormFieldRow>
      <FormFieldRow
        label="Tipo de mantenimiento"
        required
        hint={getMaintenanceType(form.maintenance_type)?.description}
      >
        <select
          required
          className={FORM_INPUT_CLS}
          value={form.maintenance_type}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {MAINTENANCE_TYPES.map((t) => (
            <option key={t.value} value={t.value} title={t.description}>{t.label}</option>
          ))}
        </select>
      </FormFieldRow>

      <FormSectionTitle>Detalle</FormSectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <FormFieldRow label="Fecha" required>
          <input
            type="date"
            required
            className={FORM_INPUT_CLS}
            value={form.performed_at}
            onChange={(e) => setForm((prev) => ({ ...prev, performed_at: e.target.value }))}
          />
        </FormFieldRow>
        <FormFieldRow label="Horas al realizar" required>
          <input
            type="number"
            min="0"
            step="0.1"
            required
            className={FORM_INPUT_CLS}
            value={form.hours_at_maintenance}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hours_at_maintenance: e.target.value }))
            }
          />
        </FormFieldRow>
      </div>
      <FormFieldRow label="Descripción">
        <textarea
          rows={2}
          className={`${FORM_INPUT_CLS} resize-none`}
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe brevemente el mantenimiento realizado…"
        />
      </FormFieldRow>

      {mode === 'create' && (
        <>
          <div className="flex items-center justify-between mt-3 mb-1.5">
            <span className="lbl-eyebrow text-[9px]">Ítems usados</span>
            <button
              type="button"
              onClick={addItem}
              className="text-[11px] text-violet-300 hover:text-violet-200"
            >
              + Agregar ítem
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {formItems.length === 0 && (
              <p className="text-[11px] text-gunmetal italic">Sin ítems para descontar del inventario.</p>
            )}
            {formItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[var(--color-surf-card)] border border-[var(--color-border-soft)] rounded-md p-2.5 flex flex-col gap-2"
              >
                <FormFieldRow label="Ítem del inventario (opcional)">
                  <select
                    className={FORM_INPUT_CLS}
                    value={item.inventory_item_id}
                    onChange={(e) => handleInventoryItemChange(idx, e.target.value)}
                  >
                    <option value="">— Sin vincular —</option>
                    {Object.entries(inventoryByCategory).map(([category, items]) => (
                      <optgroup key={category} label={category}>
                        {items.map((inv) => (
                          <option key={inv.id} value={String(inv.id)}>{inv.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </FormFieldRow>
                <div className="grid grid-cols-3 gap-2">
                  <FormFieldRow label="Nombre" required>
                    <input
                      required
                      className={FORM_INPUT_CLS}
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="Grasa sintética…"
                    />
                  </FormFieldRow>
                  <FormFieldRow label="Cantidad">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      className={FORM_INPUT_CLS}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                  </FormFieldRow>
                  <FormFieldRow label="Costo unit.">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={FORM_INPUT_CLS}
                      value={item.unit_cost}
                      onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                    />
                  </FormFieldRow>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <FormFieldRow label="Notas">
                      <input
                        className={FORM_INPUT_CLS}
                        value={item.notes}
                        onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                        placeholder="Opcional…"
                      />
                    </FormFieldRow>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 rounded text-gunmetal hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    title="Quitar ítem"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'edit' && (
        <p className="text-[11px] text-gunmetal mt-3 italic">
          Los ítems no se pueden modificar (ya se descontaron del inventario).
        </p>
      )}
    </form>
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
        form="log-form"
        icon={Save}
        disabled={saving}
        className="flex-1 justify-center"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title} height="full">
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
      eyebrow={eyebrow}
      title={title}
      width={560}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MaintenancePageV2() {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const { openSidebar } = useOutletContext() || {};

  const [tab, setTab] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [filterPrinter, setFilterPrinter] = useState('');
  const [summary, setSummary] = useState([]);
  const [logs, setLogs] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  // Estado del LogFormDrawer (create + edit modes).
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [logFormMode, setLogFormMode] = useState('create');
  const [logFormInitial, setLogFormInitial] = useState(emptyLogForm());
  const [editingLog, setEditingLog] = useState(null);

  /**
   * Recarga summary + logs + printers + inventory items en paralelo. Se
   * invoca al montar la página y después de cada mutación (create / edit /
   * delete log, update hours).
   */
  const reload = async () => {
    const [s, l, p, inv] = await Promise.allSettled([
      getMaintenanceSummary(),
      getMaintenanceLogs(filterPrinter || null),
      getPrinters(),
      getInventoryItems(),
    ]);
    if (s.status === 'fulfilled') setSummary(s.value.data || []);
    if (l.status === 'fulfilled') setLogs(l.value.data || []);
    if (p.status === 'fulfilled') {
      const arr = [...(p.value.data || [])].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es'),
      );
      setPrinters(arr);
    }
    if (inv.status === 'fulfilled') {
      const arr = [...(inv.value.data || [])].sort(
        (a, b) =>
          (a.category || '').localeCompare(b.category || '', 'es') ||
          (a.name || '').localeCompare(b.name || '', 'es'),
      );
      setInventoryItems(arr);
    }
  };

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch(() => {
        if (cancelled) return;
        toast.error('No se pudo cargar mantenimiento');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPrinter]);

  /** Abre LogFormDrawer en create mode, opcionalmente prefilled. */
  const openCreateLog = (printer) => {
    setLogFormMode('create');
    setEditingLog(null);
    setLogFormInitial(emptyLogForm({ printer, printers }));
    setLogFormOpen(true);
  };

  /** Abre LogFormDrawer en edit mode con el log seleccionado. */
  const openEditLog = (log) => {
    setLogFormMode('edit');
    setEditingLog(log);
    setLogFormInitial(logToEditForm(log));
    setLogFormOpen(true);
  };

  /** Confirma + elimina log. Retorna true si efectivamente se eliminó. */
  const handleDeleteLog = async (log) => {
    const typeDef = TYPE_BY_VALUE[log.maintenance_type];
    const ok = await confirm(
      `¿Eliminar el registro de "${typeDef?.label ?? log.maintenance_type}" del ${fmtDate(log.performed_at)}?`,
      'Eliminar',
    );
    if (!ok) return false;
    try {
      await deleteMaintenanceLog(log.id);
      toast.success('Registro eliminado');
      setSelectedLog(null);
      await reload();
      return true;
    } catch {
      toast.error('No se pudo eliminar el registro');
      return false;
    }
  };

  const handleLogSaved = async () => {
    setLogFormOpen(false);
    await reload();
  };

  const handleHoursSaved = async () => {
    await reload();
    // Refrescar el entry seleccionado con los datos nuevos del summary.
    setSelectedPrinter((curr) => {
      if (!curr) return curr;
      const updated = summary.find((e) => e.printer?.id === curr.printer?.id);
      return updated || curr;
    });
  };

  const stats = useMemo(() => {
    let totalCritical = 0;
    let totalWarning = 0;
    for (const entry of summary) {
      const lastPerType = entry.last_per_type || {};
      for (const [tipo, info] of Object.entries(lastPerType)) {
        const lvl = maintLevel(tipo, info.hours_since);
        if (lvl === 'critical') totalCritical += 1;
        else if (lvl === 'warning') totalWarning += 1;
      }
    }
    const monthAgo = Date.now() - 30 * 86_400_000;
    const recent = logs.filter((l) => new Date(l.performed_at).getTime() >= monthAgo).length;
    return {
      printers: summary.length,
      critical: totalCritical,
      warning: totalWarning,
      logs30d: recent,
      totalLogs: logs.length,
    };
  }, [summary, logs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...logs].sort(
      (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter((l) => {
      const tipo = TYPE_BY_VALUE[l.maintenance_type];
      return (
        (tipo?.label || '').toLowerCase().includes(q) ||
        (l.printer_name || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q)
      );
    });
  }, [logs, query]);

  const counts = { dashboard: summary.length, logs: logs.length };

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Impresoras" value={stats.printers} unit="docs" sub={`${stats.totalLogs} logs totales`} accent={ACCENT} icon={Printer} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Vencidos" value={stats.critical} unit="ítems" sub="acción inmediata" accent="#F87171" icon={AlertTriangle} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Pronto" value={stats.warning} unit="ítems" sub="≥85% intervalo" accent="#FBBF24" icon={Clock} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Logs · 30d" value={stats.logs30d} unit="docs" sub="último mes" accent="#34D399" icon={CheckCircle2} />
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
                isActive ? 'bg-violet-500/14 border-violet-500/30 text-violet-300' : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
              }`}
            >
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    const tabLabel = TABS.find((t) => t.id === tab)?.label || tab;
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Mantenimiento"
          appIcon={Wrench}
          appAccent={ACCENT}
          title={tabLabel}
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-3 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Mantenimiento</span>
              <span className="mono text-[10px] text-gunmetal">{stats.printers} impresoras</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`mono text-3xl font-semibold tracking-tight ${
                  stats.critical > 0 ? 'text-rose-300' : stats.warning > 0 ? 'text-amber-400' : 'text-tech-white'
                }`}
              >
                {stats.critical + stats.warning}
              </span>
              <span className="mono text-sm text-gunmetal">pendientes</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="lbl-eyebrow text-[9px]">Vencidos</span>
                <p className="mono text-sm text-rose-300 mt-0.5">{stats.critical}</p>
              </div>
              <div>
                <span className="lbl-eyebrow text-[9px]">Pronto</span>
                <p className="mono text-sm text-amber-400 mt-0.5">{stats.warning}</p>
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
                  isActive ? 'bg-violet-500/15 border-violet-500/40 text-violet-300' : 'bg-transparent border-[var(--color-border)] text-steel'
                }`}
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === 'dashboard' ? (
          loading ? (
            <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando…</p>
          ) : summary.length === 0 ? (
            <div className="mt-3 pb-28">
              <EmptyState
                icon={Printer}
                accent={ACCENT}
                title="Sin impresoras registradas"
                hint="Las impresoras se crean en Cost › Impresoras. Una vez registradas aparecen aquí para llevar su mantenimiento."
                action={
                  <Link to="/cost/printers" className="btn btn-primary btn-sm">
                    <Plus size={13} /> Crear en Cost
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="px-4 mt-3 pb-28 flex flex-col gap-2">
              {summary.map((entry) => (
                <PrinterCard key={entry.printer.id} entry={entry} onClick={setSelectedPrinter} />
              ))}
            </div>
          )
        ) : (
          <>
            <div className="px-4 mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
                <Search size={14} className="text-gunmetal" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tipo, impresora, notas…"
                  className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
                />
              </div>
              {printers.length > 1 && (
                <select
                  value={filterPrinter}
                  onChange={(e) => setFilterPrinter(e.target.value)}
                  className={FORM_INPUT_CLS}
                  aria-label="Filtrar por impresora"
                >
                  <option value="">Todas las impresoras</option>
                  {printers.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            {filteredLogs.length === 0 ? (
              <div className="mt-3 pb-28">
                <EmptyState
                  icon={ClipboardList}
                  accent={ACCENT}
                  title={logs.length === 0 ? 'Sin registros aún' : 'Sin resultados'}
                  hint={
                    logs.length === 0
                      ? 'Cuando registres un mantenimiento aparecerá en este historial.'
                      : 'Cambia el filtro o limpia la búsqueda.'
                  }
                  action={
                    logs.length === 0 ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={() => openCreateLog()}
                      >
                        Registrar primer mantenimiento
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <ul className="mt-3 pb-28">
                {filteredLogs.map((l) => (
                  <li key={l.id}>
                    <LogRow log={l} onClick={setSelectedLog} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => openCreateLog()}
          disabled={printers.length === 0}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: ACCENT, color: '#0A1014', boxShadow: `0 8px 24px ${ACCENT}55` }}
          aria-label="Registrar mantenimiento"
          title={printers.length === 0 ? 'Crea una impresora primero en Cost' : ''}
        >
          <Plus size={16} strokeWidth={2.5} />
          Registrar
        </button>
        <MobileSheet
          open={!!selectedPrinter}
          onClose={() => setSelectedPrinter(null)}
          title={selectedPrinter?.printer?.name || ''}
          height="full"
        >
          <div className="px-5 pt-4 pb-3">
            <PrinterDrawerBody entry={selectedPrinter} onHoursSaved={handleHoursSaved} />
          </div>
          {selectedPrinter && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <PrinterDrawerFooter
                entry={selectedPrinter}
                onRegister={(printer) => {
                  setSelectedPrinter(null);
                  openCreateLog(printer);
                }}
              />
            </div>
          )}
        </MobileSheet>
        <MobileSheet
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={
            selectedLog
              ? TYPE_BY_VALUE[selectedLog.maintenance_type]?.label ||
                selectedLog.maintenance_type ||
                'Log'
              : ''
          }
          height="full"
        >
          <div className="px-5 pt-4 pb-3">
            <LogDrawerBody log={selectedLog} />
          </div>
          {selectedLog && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <LogDrawerFooter
                log={selectedLog}
                onEdit={(log) => {
                  setSelectedLog(null);
                  openEditLog(log);
                }}
                onDelete={handleDeleteLog}
                onClose={() => setSelectedLog(null)}
              />
            </div>
          )}
        </MobileSheet>
        <LogFormDrawer
          open={logFormOpen}
          mode={logFormMode}
          initialForm={logFormInitial}
          printers={printers}
          inventoryItems={inventoryItems}
          editingLog={editingLog}
          onClose={() => setLogFormOpen(false)}
          onSaved={handleLogSaved}
          isMobile
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <Wrench size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Mantenimiento</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">{tab}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => openCreateLog()}
            disabled={printers.length === 0}
            title={printers.length === 0 ? 'Crea una impresora primero en Cost' : ''}
          >
            Registrar
          </Button>
        </div>
      </header>

      {KPIs}
      {TabsBar}

      {tab === 'dashboard' ? (
        loading ? (
          <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando dashboard…</p>
        ) : summary.length === 0 ? (
          <EmptyState
            icon={Printer}
            accent={ACCENT}
            title="Sin impresoras registradas"
            hint="Las impresoras se crean en Cost › Impresoras. Una vez registradas aparecen aquí para llevar su mantenimiento."
            action={
              <Link to="/cost/printers" className="btn btn-primary btn-sm">
                <Plus size={13} /> Crear en Cost
              </Link>
            }
          />
        ) : (
          <div
            className="px-6 pt-4 pb-8 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
          >
            {summary.map((entry) => (
              <PrinterCard key={entry.printer.id} entry={entry} onClick={setSelectedPrinter} />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
              <Search size={13} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tipo, impresora, notas…"
                className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gunmetal hover:text-tech-white" aria-label="Limpiar">
                  <X size={12} />
                </button>
              )}
            </div>
            {printers.length > 1 && (
              <select
                value={filterPrinter}
                onChange={(e) => setFilterPrinter(e.target.value)}
                className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-violet-500 min-w-[180px]"
                aria-label="Filtrar por impresora"
              >
                <option value="">Todas las impresoras</option>
                {printers.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            )}
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filteredLogs.length} de {logs.length} logs
            </span>
          </div>
          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando logs…</p>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              accent={ACCENT}
              title={logs.length === 0 ? 'Sin registros aún' : 'Sin resultados'}
              hint={
                logs.length === 0
                  ? 'Cuando registres un mantenimiento aparecerá en este historial.'
                  : 'Cambia el filtro o limpia la búsqueda.'
              }
              action={
                logs.length === 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => openCreateLog()}
                    disabled={printers.length === 0}
                  >
                    Registrar primer mantenimiento
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="pb-8 border border-[var(--color-border)] rounded-xl mx-6 overflow-hidden bg-[var(--color-surf-card)]">
              <ul>
                {filteredLogs.map((l) => (
                  <li key={l.id}>
                    <LogRow log={l} onClick={setSelectedLog} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <DetailDrawer
        open={!!selectedPrinter}
        onClose={() => setSelectedPrinter(null)}
        eyebrow={
          selectedPrinter
            ? `IMPRESORA · ${Number(selectedPrinter.printer?.current_hours || 0).toFixed(0)}H`
            : undefined
        }
        title={selectedPrinter?.printer?.name || ''}
        width={460}
        footer={
          selectedPrinter && (
            <PrinterDrawerFooter
              entry={selectedPrinter}
              onRegister={(printer) => {
                setSelectedPrinter(null);
                openCreateLog(printer);
              }}
            />
          )
        }
      >
        <PrinterDrawerBody entry={selectedPrinter} onHoursSaved={handleHoursSaved} />
      </DetailDrawer>

      <DetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        eyebrow={selectedLog ? `LOG · ${fmtDate(selectedLog.performed_at)}` : undefined}
        title={
          selectedLog
            ? TYPE_BY_VALUE[selectedLog.maintenance_type]?.label ||
              selectedLog.maintenance_type ||
              'Log de mantenimiento'
            : ''
        }
        width={460}
        footer={
          selectedLog && (
            <LogDrawerFooter
              log={selectedLog}
              onEdit={(log) => {
                setSelectedLog(null);
                openEditLog(log);
              }}
              onDelete={handleDeleteLog}
              onClose={() => setSelectedLog(null)}
            />
          )
        }
      >
        <LogDrawerBody log={selectedLog} />
      </DetailDrawer>

      <LogFormDrawer
        open={logFormOpen}
        mode={logFormMode}
        initialForm={logFormInitial}
        printers={printers}
        inventoryItems={inventoryItems}
        editingLog={editingLog}
        onClose={() => setLogFormOpen(false)}
        onSaved={handleLogSaved}
        isMobile={false}
      />

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{stats.printers} impresoras</span>
        <span className="mono">{stats.totalLogs} logs</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
