/**
 * @file Bobinas individuales de filamento (issue #134) — tracking por
 * bobina física: peso restante, costo, colores/efectos visuales, y
 * consumo automático al marcar impresiones como listas desde Queue.
 *
 * El agregado (`InventoryItem.quantity`) NO se actualiza en tiempo real
 * mientras una bobina está activa — solo en altas (opcional, "sumar al
 * stock") y al agotarse una bobina por completo. Ver
 * `backend/app/models/spool.py` para la regla completa.
 *
 * @module pages/inventory/InventorySpoolsPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, Layers, Plus, Printer, Search, Weight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  FilamentSwatch,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import InventoryNavTabs from './InventoryNavTabs';
import {
  createSpools,
  deleteSpool,
  getInventoryItems,
  getSpools,
  getSpoolsLowStock,
  printSpoolLabels,
  updateSpool,
} from '../../services/api';
import { FILAMENT_EFFECT_OPTIONS } from '../../utils/filamentSwatch';
import LabelPrintModal from './components/LabelPrintModal';

const ACCENT = '#F59E0B';

const STATUS_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'finished', label: 'Agotadas' },
  { value: 'archived', label: 'Archivadas' },
];

function percentTone(pct) {
  if (pct < 15) return { bar: '#F43F5E', label: 'text-rose-400' };
  if (pct < 40) return { bar: '#FBBF24', label: 'text-amber-300' };
  return { bar: '#34D399', label: 'text-emerald-300' };
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

// ─── Bulk create drawer ─────────────────────────────────────────────────────

function BulkCreateBody({ form, setForm, items }) {
  const inputCls =
    'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500';
  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Filamento <span className="text-rose-400">*</span></span>
        <select
          required
          className={inputCls}
          value={form.inventory_item_id}
          onChange={(e) => setForm((p) => ({ ...p, inventory_item_id: e.target.value }))}
        >
          <option value="">— Seleccionar —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Cantidad <span className="text-rose-400">*</span></span>
          <input
            type="number" min={1} max={100} required className={inputCls}
            value={form.count}
            onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Peso por bobina (g)</span>
          <input
            type="number" min={1} className={inputCls} placeholder="1000"
            value={form.initial_weight_g}
            onChange={(e) => setForm((p) => ({ ...p, initial_weight_g: e.target.value }))}
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Costo por bobina (opcional)</span>
        <input
          type="number" min={0} step="0.01" className={inputCls}
          value={form.cost}
          onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Efecto visual</span>
        <select
          className={inputCls}
          value={form.visual_effect}
          onChange={(e) => setForm((p) => ({ ...p, visual_effect: e.target.value }))}
        >
          {FILAMENT_EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">
          Colores extra (hex separados por coma, opcional — para gradiente/multicolor)
        </span>
        <input
          type="text" className={inputCls} placeholder="ff0000, 00ff00"
          value={form.stops}
          onChange={(e) => setForm((p) => ({ ...p, stops: e.target.value }))}
        />
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.add_to_stock}
          onChange={(e) => setForm((p) => ({ ...p, add_to_stock: e.target.checked }))}
        />
        <span className="text-xs text-steel">
          Sumar al stock agregado (compra nueva). Si las bobinas ya estaban contadas en el
          inventario, dejar sin marcar.
        </span>
      </label>
    </div>
  );
}

// ─── Edit drawer ────────────────────────────────────────────────────────────

function EditSpoolBody({ form, setForm }) {
  const inputCls =
    'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500';
  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Peso restante (g) — "pesé la bobina"</span>
        <input
          type="number" min={0} step="0.1" className={inputCls}
          value={form.remaining_weight_g}
          onChange={(e) => setForm((p) => ({ ...p, remaining_weight_g: e.target.value }))}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Estado</span>
        <select
          className={inputCls}
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Activa</option>
          <option value="finished">Agotada</option>
          <option value="archived">Archivada</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Efecto visual</span>
        <select
          className={inputCls}
          value={form.visual_effect}
          onChange={(e) => setForm((p) => ({ ...p, visual_effect: e.target.value }))}
        >
          {FILAMENT_EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Colores extra (hex separados por coma)</span>
        <input
          type="text" className={inputCls} placeholder="ff0000, 00ff00"
          value={form.stops}
          onChange={(e) => setForm((p) => ({ ...p, stops: e.target.value }))}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Notas</span>
        <textarea
          rows={2} className={`${inputCls} resize-none`}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </label>
    </div>
  );
}

// ─── Spool card ─────────────────────────────────────────────────────────────

function SpoolCard({ spool, onEdit, onDelete, highlighted, selected, onToggleSelect }) {
  const pct = spool.percent_remaining;
  const tone = percentTone(pct);
  const badge = statusBadge(spool.status);
  return (
    <Card
      as="div"
      className={`p-4 flex flex-col gap-3 ${highlighted ? 'ring-2 ring-amber-400' : ''} ${selected ? 'ring-2 ring-amber-500/60' : ''}`}
      id={`spool-${spool.id}`}
    >
      <div className="flex items-start gap-3">
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
          className="w-10 h-10"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="mono text-xs font-semibold text-tech-white">{spool.label_code}</span>
            <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
          </div>
          <p className="text-sm font-medium text-tech-white truncate">{spool.inventory_item_name}</p>
          {spool.color_name && (
            <p className="text-xs text-gunmetal truncate">{spool.color_name}</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`mono text-xs font-semibold ${tone.label}`}>{pct.toFixed(0)}%</span>
          <span className="mono text-[10.5px] text-gunmetal">
            {Number(spool.remaining_weight_g).toFixed(0)}g / {Number(spool.initial_weight_g).toFixed(0)}g
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone.bar }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gunmetal">
        <span>
          {spool.effective_cost_per_kg != null ? `$${Number(spool.effective_cost_per_kg).toFixed(2)}/kg` : '—'}
        </span>
        <span>{fmtAge(spool.opened_at || spool.created_at)}</span>
      </div>

      <div className="flex gap-1.5 pt-2 border-t border-[var(--color-border-soft)]">
        <Button variant="ghost" size="sm" icon={Weight} onClick={() => onEdit(spool)} className="flex-1 justify-center">
          Editar
        </Button>
        <Button
          variant="ghost" size="sm" onClick={() => onDelete(spool)}
          className="text-rose-400 hover:text-rose-300"
          aria-label="Eliminar bobina"
        >
          <X size={14} />
        </Button>
      </div>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function InventorySpoolsPage() {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('spool');

  const [spools, setSpools] = useState([]);
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    inventory_item_id: '', count: 1, initial_weight_g: '', cost: '',
    visual_effect: '', stops: '', add_to_stock: false,
  });

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsForm, setLabelsForm] = useState({ template: 'box_62x29', monochrome: false });
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (materialFilter) params.material = materialFilter;
      if (statusFilter) params.status = statusFilter;
      if (query.trim()) params.q = query.trim();
      const [spoolsRes, lowStockRes] = await Promise.all([
        getSpools(params),
        getSpoolsLowStock(),
      ]);
      setSpools(spoolsRes.data || []);
      setLowStock((lowStockRes.data || []).filter((r) => r.below));
    } catch {
      toast.error('No se pudieron cargar las bobinas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getInventoryItems()
      .then((res) => {
        const filaments = (res.data || []).filter((i) => (i.category || '').toLowerCase() === 'filamento');
        setItems(filaments);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialFilter, statusFilter]);

  // Debounce liviano de búsqueda.
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`spool-${highlightId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, spools]);

  const materials = useMemo(
    () => [...new Set(items.map((i) => i.filament_type).filter(Boolean))].sort(),
    [items],
  );

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkSaving(true);
    try {
      const stops = bulkForm.stops.trim()
        ? bulkForm.stops.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
        : [];
      await createSpools({
        inventory_item_id: parseInt(bulkForm.inventory_item_id, 10),
        count: Math.max(1, Math.min(100, parseInt(bulkForm.count, 10) || 1)),
        initial_weight_g: bulkForm.initial_weight_g ? Number(bulkForm.initial_weight_g) : undefined,
        cost: bulkForm.cost ? Number(bulkForm.cost) : undefined,
        visual_effect: bulkForm.visual_effect || undefined,
        extra_colors: stops.length > 0 ? { stops } : undefined,
        add_to_stock: bulkForm.add_to_stock,
      });
      toast.success(`${bulkForm.count} bobina(s) creada(s)`);
      setBulkOpen(false);
      setBulkForm({
        inventory_item_id: '', count: 1, initial_weight_g: '', cost: '',
        visual_effect: '', stops: '', add_to_stock: false,
      });
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

  const clearSelection = () => setSelectedIds(new Set());

  /**
   * Abre el PDF (con QR deep-link) en una pestaña nueva — el servidor
   * manda `Content-Disposition: inline`, así que no forzamos descarga.
   */
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

  const Filters = (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[200px] flex-1 max-w-sm">
        <Search size={13} className="text-gunmetal" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
      </div>
      <select
        value={materialFilter}
        onChange={(e) => setMaterialFilter(e.target.value)}
        className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none"
      >
        <option value="">Todos los materiales</option>
        {materials.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <Button variant="primary" size="sm" icon={Plus} onClick={() => setBulkOpen(true)}>
        Agregar bobinas
      </Button>
    </div>
  );

  const LowStockBanner = lowStock.length > 0 && (
    <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2.5">
      <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
      <div className="text-xs text-rose-200">
        <span className="font-semibold">Stock bajo: </span>
        {lowStock.map((r) => `${r.filament_type} (${Number(r.total_remaining_g).toFixed(0)}g)`).join(', ')}
      </div>
    </div>
  );

  const SelectionBar = selectedIds.size > 0 && (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
      <span className="text-xs text-amber-200 flex-1">
        {selectedIds.size} bobina{selectedIds.size === 1 ? '' : 's'} seleccionada{selectedIds.size === 1 ? '' : 's'}
      </span>
      <Button variant="ghost" size="sm" onClick={clearSelection}>Cancelar</Button>
      <Button variant="primary" size="sm" icon={Printer} onClick={() => setLabelsOpen(true)}>
        Imprimir etiquetas
      </Button>
    </div>
  );

  const Grid = loading ? (
    <p className="py-16 text-center text-gunmetal text-sm">Cargando bobinas…</p>
  ) : spools.length === 0 ? (
    <EmptyState
      icon={Layers}
      accent={ACCENT}
      title="Sin bobinas"
      hint="Agrega bobinas para trackear peso restante, costo y colores por rollo físico."
      action={
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setBulkOpen(true)}>
          Agregar bobinas
        </Button>
      }
    />
  ) : (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {spools.map((s) => (
        <SpoolCard
          key={s.id}
          spool={s}
          onEdit={openEdit}
          onDelete={handleDelete}
          highlighted={String(s.id) === highlightId}
          selected={selectedIds.has(s.id)}
          onToggleSelect={toggleSelect}
        />
      ))}
    </div>
  );

  const BulkFooter = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setBulkOpen(false)} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary" size="sm" type="submit" form="spool-bulk-form"
        disabled={bulkSaving || !bulkForm.inventory_item_id}
        className="flex-1 justify-center"
      >
        {bulkSaving ? 'Creando…' : 'Crear bobinas'}
      </Button>
    </>
  );

  const EditFooter = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary" size="sm" type="submit" form="spool-edit-form"
        disabled={editSaving}
        className="flex-1 justify-center"
      >
        {editSaving ? 'Guardando…' : 'Guardar'}
      </Button>
    </>
  );

  const LabelsFooter = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setLabelsOpen(false)} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary" size="sm" onClick={handlePrintLabels}
        disabled={printing || selectedIds.size === 0}
        className="flex-1 justify-center"
      >
        {printing ? 'Generando…' : 'Imprimir'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <MobileAppHeader appName="Bobinas" appIcon={Layers} appAccent={ACCENT} title="Bobinas" />
        <InventoryNavTabs className="px-4" />
        <div className="px-4 flex flex-col gap-3">
          {LowStockBanner}
          {Filters}
          {SelectionBar}
        </div>
        <div className="px-4 pb-6">{Grid}</div>

        <MobileSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title="Agregar bobinas" height="full">
          <form id="spool-bulk-form" onSubmit={handleBulkSubmit} className="px-5 pt-4 pb-3">
            <BulkCreateBody form={bulkForm} setForm={setBulkForm} items={items} />
          </form>
          {bulkOpen && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              {BulkFooter}
            </div>
          )}
        </MobileSheet>

        <MobileSheet open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.label_code || ''} height="full">
          {editForm && (
            <form id="spool-edit-form" onSubmit={handleEditSubmit} className="px-5 pt-4 pb-3">
              <EditSpoolBody form={editForm} setForm={setEditForm} />
            </form>
          )}
          {editTarget && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              {EditFooter}
            </div>
          )}
        </MobileSheet>

        <MobileSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} title="Imprimir etiquetas" height="full">
          <div className="px-5 pt-4 pb-3">
            <LabelPrintModal form={labelsForm} setForm={setLabelsForm} count={selectedIds.size} />
          </div>
          {labelsOpen && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              {LabelsFooter}
            </div>
          )}
        </MobileSheet>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <Layers size={13} />
        </span>
        <span className="text-sm text-gunmetal">Inventario</span>
        <span className="text-gunmetal-dim">›</span>
        <span className="text-sm font-semibold text-tech-white">Bobinas</span>
      </header>
      <InventoryNavTabs className="border-b border-[var(--color-border)] pb-2" />
      {LowStockBanner}
      {Filters}
      {SelectionBar}
      {Grid}

      <DetailDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        eyebrow="INVENTARIO · BOBINAS"
        title="Agregar bobinas"
        width={460}
        footer={BulkFooter}
      >
        <form id="spool-bulk-form" onSubmit={handleBulkSubmit}>
          <BulkCreateBody form={bulkForm} setForm={setBulkForm} items={items} />
        </form>
      </DetailDrawer>

      <DetailDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        eyebrow="INVENTARIO · BOBINAS"
        title={editTarget?.label_code || ''}
        width={460}
        footer={EditFooter}
      >
        {editForm && (
          <form id="spool-edit-form" onSubmit={handleEditSubmit}>
            <EditSpoolBody form={editForm} setForm={setEditForm} />
          </form>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        eyebrow="INVENTARIO · BOBINAS"
        title="Imprimir etiquetas"
        width={460}
        footer={LabelsFooter}
      >
        <LabelPrintModal form={labelsForm} setForm={setLabelsForm} count={selectedIds.size} />
      </DetailDrawer>
    </div>
  );
}
