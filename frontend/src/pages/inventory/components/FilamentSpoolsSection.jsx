/**
 * @file Sección de bobinas físicas de un filamento — merge full (PR B) del
 * tracking por-bobina (issue #134) dentro del detalle de Bobinas. Absorbe la
 * antigua `InventorySpoolsPage`: lista de bobinas del tipo, alta en lote,
 * edición (peso/estado/efecto), borrado, selección e impresión de etiquetas QR.
 *
 * Se monta dentro del drawer/sheet de detalle de un filamento (Bobinas). Trae
 * su propio estado de spools (scoped a `filamentId`) y avisa cambios de conteo
 * al padre vía `onCountChange` para refrescar el badge de la lista.
 *
 * @module pages/inventory/components/FilamentSpoolsSection
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus, Printer, Weight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { FilamentSwatch, MobileSheet, DetailDrawer, StatusPill } from '../../../components/ui';
import { useConfirm } from '../../../components/ConfirmDialog';
import {
  createSpools,
  deleteSpool,
  getSpools,
  printSpoolLabels,
  updateSpool,
} from '../../../services/api';
import { FILAMENT_EFFECT_OPTIONS } from '../../../utils/filamentSwatch';
import LabelPrintModal from './LabelPrintModal';
import '../InventoryPage.css';

function percentTone(pct) {
  if (pct < 15) return '#F43F5E';
  if (pct < 40) return '#FBBF24';
  return '#34D399';
}

function statusBadge(status) {
  if (status === 'finished') return { label: 'Agotada', tone: 'neutral' };
  if (status === 'archived') return { label: 'Archivada', tone: 'neutral' };
  return { label: 'Activa', tone: 'done' };
}

function fmtAge(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return '1 día';
  return `${days} días`;
}

// ─── Sub-forms (bulk create / edit) — mk- ───────────────────────────────────

function BulkCreateBody({ form, setForm }) {
  return (
    <div className="flex flex-col gap-3" style={{ '--page-accent': '#3B82F6' }}>
      <div className="mk-form-grid2">
        <label className="mk-field">
          <span className="mk-f-label">Cantidad *</span>
          <input
            type="number" min={1} max={100} className="mk-f-input mono"
            value={form.count}
            onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))}
          />
        </label>
        <label className="mk-field">
          <span className="mk-f-label">Peso por bobina (g)</span>
          <input
            type="number" min={1} className="mk-f-input mono" placeholder="1000"
            value={form.initial_weight_g}
            onChange={(e) => setForm((p) => ({ ...p, initial_weight_g: e.target.value }))}
          />
        </label>
      </div>
      <label className="mk-field">
        <span className="mk-f-label">Costo por bobina (opcional)</span>
        <input
          type="number" min={0} step="0.01" className="mk-f-input mono"
          value={form.cost}
          onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
        />
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Efecto visual</span>
        <select
          className="mk-f-select"
          value={form.visual_effect}
          onChange={(e) => setForm((p) => ({ ...p, visual_effect: e.target.value }))}
        >
          {FILAMENT_EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Colores extra (hex separados por coma)</span>
        <input
          type="text" className="mk-f-input mono" placeholder="ff0000, 00ff00"
          value={form.stops}
          onChange={(e) => setForm((p) => ({ ...p, stops: e.target.value }))}
        />
        <span className="mk-f-hint">Para gradiente / multicolor.</span>
      </label>
      <label className="mk-chk-line">
        <input
          type="checkbox"
          checked={form.add_to_stock}
          onChange={(e) => setForm((p) => ({ ...p, add_to_stock: e.target.checked }))}
        />
        <span>Sumar al stock agregado (compra nueva). Si ya estaban contadas, dejar sin marcar.</span>
      </label>
    </div>
  );
}

function EditSpoolBody({ form, setForm }) {
  return (
    <div className="flex flex-col gap-3" style={{ '--page-accent': '#3B82F6' }}>
      <label className="mk-field">
        <span className="mk-f-label">Peso restante (g) — "pesé la bobina"</span>
        <input
          type="number" min={0} step="0.1" className="mk-f-input mono"
          value={form.remaining_weight_g}
          onChange={(e) => setForm((p) => ({ ...p, remaining_weight_g: e.target.value }))}
        />
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Estado</span>
        <select
          className="mk-f-select"
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Activa</option>
          <option value="finished">Agotada</option>
          <option value="archived">Archivada</option>
        </select>
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Efecto visual</span>
        <select
          className="mk-f-select"
          value={form.visual_effect}
          onChange={(e) => setForm((p) => ({ ...p, visual_effect: e.target.value }))}
        >
          {FILAMENT_EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Colores extra (hex separados por coma)</span>
        <input
          type="text" className="mk-f-input mono" placeholder="ff0000, 00ff00"
          value={form.stops}
          onChange={(e) => setForm((p) => ({ ...p, stops: e.target.value }))}
        />
      </label>
      <label className="mk-field">
        <span className="mk-f-label">Notas</span>
        <textarea
          rows={2} className="mk-f-input" style={{ resize: 'none' }}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </label>
    </div>
  );
}

// ─── Spool card (mk-) ───────────────────────────────────────────────────────

function SpoolCard({ spool, onEdit, onDelete, selected, onToggleSelect }) {
  const pct = Number(spool.percent_remaining) || 0;
  const bar = percentTone(pct);
  const badge = statusBadge(spool.status);
  return (
    <div className="rounded-xl border border-[var(--color-border-legacy)] bg-[var(--color-surf-card)] p-3.5 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(spool.id)}
          aria-label={`Seleccionar ${spool.label_code}`}
          className="mt-1 shrink-0"
        />
        <FilamentSwatch
          rgba={spool.color_hex}
          extraColors={spool.extra_colors?.stops}
          effectType={spool.visual_effect}
          effectSize="card"
          className="w-9 h-9"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="mono text-xs font-semibold text-tech-white">{spool.label_code}</span>
            <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
          </div>
          {spool.color_name && <p className="text-xs text-gunmetal truncate">{spool.color_name}</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="mono text-xs font-semibold" style={{ color: bar }}>{pct.toFixed(0)}%</span>
          <span className="mono text-[10.5px] text-gunmetal">
            {Number(spool.remaining_weight_g).toFixed(0)}g / {Number(spool.initial_weight_g).toFixed(0)}g
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bar }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gunmetal">
        <span>{spool.effective_cost_per_kg != null ? `$${Number(spool.effective_cost_per_kg).toFixed(2)}/kg` : '—'}</span>
        <span>{fmtAge(spool.opened_at || spool.created_at)}</span>
      </div>

      <div className="flex gap-1.5 pt-2 border-t border-[var(--color-border-soft)]">
        <button type="button" onClick={() => onEdit(spool)} className="mk-btn mk-btn-secondary flex-1" style={{ minHeight: 36 }}>
          <Weight size={13} /> Editar
        </button>
        <button
          type="button" onClick={() => onDelete(spool)}
          className="mk-btn mk-btn-secondary" style={{ minHeight: 36, color: 'var(--forge-rose)' }}
          aria-label="Eliminar bobina"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {number} props.filamentId
 * @param {string} [props.filamentName]
 * @param {boolean} props.isMobile
 * @param {(count: number) => void} [props.onCountChange]
 */
export default function FilamentSpoolsSection({ filamentId, filamentName, isMobile, onCountChange }) {
  const confirm = useConfirm();
  const [spools, setSpools] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    count: 1, initial_weight_g: '', cost: '', visual_effect: '', stops: '', add_to_stock: false,
  });

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsForm, setLabelsForm] = useState({ template: 'box_62x29', monochrome: false });
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    if (!filamentId) return;
    setLoading(true);
    try {
      // El backend devuelve todas las bobinas; filtramos por este filamento.
      const res = await getSpools({ inventory_item_id: filamentId });
      const all = res.data || [];
      const mine = all.filter((s) => s.inventory_item_id === filamentId);
      setSpools(mine);
      onCountChange?.(mine.filter((s) => s.status === 'active').length);
    } catch {
      toast.error('No se pudieron cargar las bobinas');
    } finally {
      setLoading(false);
    }
  }, [filamentId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkSaving(true);
    try {
      const stops = bulkForm.stops.trim()
        ? bulkForm.stops.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
        : [];
      await createSpools({
        inventory_item_id: filamentId,
        count: Math.max(1, Math.min(100, parseInt(bulkForm.count, 10) || 1)),
        initial_weight_g: bulkForm.initial_weight_g ? Number(bulkForm.initial_weight_g) : undefined,
        cost: bulkForm.cost ? Number(bulkForm.cost) : undefined,
        visual_effect: bulkForm.visual_effect || undefined,
        extra_colors: stops.length > 0 ? { stops } : undefined,
        add_to_stock: bulkForm.add_to_stock,
      });
      toast.success(`${bulkForm.count} bobina(s) creada(s)`);
      setBulkOpen(false);
      setBulkForm({ count: 1, initial_weight_g: '', cost: '', visual_effect: '', stops: '', add_to_stock: false });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo crear la(s) bobina(s)');
    } finally {
      setBulkSaving(false);
    }
  };

  const openEdit = (spool) => {
    setEditTarget(spool);
    setEditForm({
      remaining_weight_g: spool.remaining_weight_g,
      status: spool.status,
      visual_effect: spool.visual_effect || '',
      stops: (spool.extra_colors?.stops || []).join(', '),
      notes: spool.notes || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const stops = editForm.stops.trim()
        ? editForm.stops.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
        : [];
      await updateSpool(editTarget.id, {
        remaining_weight_g: Number(editForm.remaining_weight_g),
        status: editForm.status,
        visual_effect: editForm.visual_effect || null,
        extra_colors: { stops },
        notes: editForm.notes.trim() || null,
      });
      toast.success('Bobina actualizada');
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo actualizar');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (spool) => {
    const ok = await confirm(`¿Eliminar la bobina ${spool.label_code}?`, 'Eliminar');
    if (!ok) return;
    try {
      await deleteSpool(spool.id);
      toast.success('Bobina eliminada');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(spool.id);
        return next;
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudo eliminar');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrintLabels = async () => {
    setPrinting(true);
    try {
      const res = await printSpoolLabels({
        spool_ids: [...selectedIds],
        template: labelsForm.template,
        monochrome: labelsForm.monochrome,
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setLabelsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'No se pudieron generar las etiquetas');
    } finally {
      setPrinting(false);
    }
  };

  const bulkFooter = (
    <div className="flex gap-2 w-full" style={{ '--page-accent': '#3B82F6' }}>
      <button type="button" onClick={() => setBulkOpen(false)} className="mk-btn mk-btn-secondary flex-1">Cancelar</button>
      <button type="submit" form="spool-bulk-form" disabled={bulkSaving} className="mk-btn mk-btn-primary flex-1">
        {bulkSaving ? 'Creando…' : 'Crear bobinas'}
      </button>
    </div>
  );

  const editFooter = (
    <div className="flex gap-2 w-full" style={{ '--page-accent': '#3B82F6' }}>
      <button type="button" onClick={() => setEditTarget(null)} className="mk-btn mk-btn-secondary flex-1">Cancelar</button>
      <button type="submit" form="spool-edit-form" disabled={editSaving} className="mk-btn mk-btn-primary flex-1">
        {editSaving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );

  const labelsFooter = (
    <div className="flex gap-2 w-full" style={{ '--page-accent': '#3B82F6' }}>
      <button type="button" onClick={() => setLabelsOpen(false)} className="mk-btn mk-btn-secondary flex-1">Cancelar</button>
      <button
        type="button" onClick={handlePrintLabels} disabled={printing || selectedIds.size === 0}
        className="mk-btn mk-btn-primary flex-1"
      >
        {printing ? 'Generando…' : 'Imprimir'}
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="mk-section-title flex items-center gap-2">
          Bobinas físicas
          <span className="mono text-[11px] text-gunmetal font-normal">{spools.length}</span>
        </div>
        <button type="button" onClick={() => setBulkOpen(true)} className="mk-btn mk-btn-secondary" style={{ minHeight: 36, '--page-accent': '#3B82F6' }}>
          <Plus size={13} /> Agregar
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 mb-2.5">
          <span className="text-xs text-blue-200 flex-1">
            {selectedIds.size} bobina{selectedIds.size === 1 ? '' : 's'} seleccionada{selectedIds.size === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-gunmetal hover:text-tech-white">Cancelar</button>
          <button type="button" onClick={() => setLabelsOpen(true)} className="mk-btn mk-btn-secondary" style={{ minHeight: 32, '--page-accent': '#3B82F6' }}>
            <Printer size={13} /> Etiquetas
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-gunmetal text-sm">Cargando bobinas…</p>
      ) : spools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center">
          <p className="text-sm text-tech-white font-medium">Sin bobinas físicas</p>
          <p className="text-xs text-gunmetal mt-0.5">Agrega bobinas para trackear peso, costo y colores por rollo.</p>
        </div>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {spools.map((s) => (
            <SpoolCard
              key={s.id}
              spool={s}
              onEdit={openEdit}
              onDelete={handleDelete}
              selected={selectedIds.has(s.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Alta en lote */}
      {isMobile ? (
        <MobileSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Agregar bobinas · ${filamentName || ''}`} height="full">
          <form id="spool-bulk-form" onSubmit={handleBulkSubmit} className="px-5 pt-4 pb-3">
            <BulkCreateBody form={bulkForm} setForm={setBulkForm} />
          </form>
          {bulkOpen && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">{bulkFooter}</div>
          )}
        </MobileSheet>
      ) : (
        <DetailDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} eyebrow="BOBINAS · NUEVAS" title={`Agregar bobinas`} width={460} footer={bulkFooter}>
          <form id="spool-bulk-form" onSubmit={handleBulkSubmit}>
            <BulkCreateBody form={bulkForm} setForm={setBulkForm} />
          </form>
        </DetailDrawer>
      )}

      {/* Editar bobina */}
      {isMobile ? (
        <MobileSheet open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.label_code || ''} height="full">
          {editForm && (
            <form id="spool-edit-form" onSubmit={handleEditSubmit} className="px-5 pt-4 pb-3">
              <EditSpoolBody form={editForm} setForm={setEditForm} />
            </form>
          )}
          {editTarget && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">{editFooter}</div>
          )}
        </MobileSheet>
      ) : (
        <DetailDrawer open={!!editTarget} onClose={() => setEditTarget(null)} eyebrow="BOBINAS · EDITAR" title={editTarget?.label_code || ''} width={460} footer={editFooter}>
          {editForm && (
            <form id="spool-edit-form" onSubmit={handleEditSubmit}>
              <EditSpoolBody form={editForm} setForm={setEditForm} />
            </form>
          )}
        </DetailDrawer>
      )}

      {/* Etiquetas */}
      {isMobile ? (
        <MobileSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} title="Imprimir etiquetas" height="full">
          <div className="px-5 pt-4 pb-3"><LabelPrintModal form={labelsForm} setForm={setLabelsForm} count={selectedIds.size} /></div>
          {labelsOpen && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">{labelsFooter}</div>
          )}
        </MobileSheet>
      ) : (
        <DetailDrawer open={labelsOpen} onClose={() => setLabelsOpen(false)} eyebrow="BOBINAS · ETIQUETAS" title="Imprimir etiquetas" width={460} footer={labelsFooter}>
          <LabelPrintModal form={labelsForm} setForm={setLabelsForm} count={selectedIds.size} />
        </DetailDrawer>
      )}
    </div>
  );
}
