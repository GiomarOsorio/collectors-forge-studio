/**
 * @file Pedidos de compra v2 (port Claude Design — HANDOFF-inventory-purchases.md).
 *
 * Pantalla dedicada `/inventory/purchases`. Diferente al tab "Compras"
 * dentro de `/inventory` (InventoryPage) — esta es la vista de gestión
 * full-featured con KPI strip, filtros pill, list de POs y drawers v2.
 *
 * Resuelve issues:
 *   #54 — card renderiza `po.supplier` (no "Proveedor sin nombre"),
 *         total = Σ qty × unit_cost, "Sin ítems" cuando items vacío,
 *         copy del form "se suma al inventario" (no "se descuenta").
 *   #73 — validación inline NewPODrawer: supplier requerido + ≥1 ítem,
 *         botón cambia "Crear pedido" ↔ "Faltan campos" y queda
 *         disabled hasta cumplir.
 *
 * @module pages/inventory/InventoryPurchasesPage
 */

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Truck, Plus, Download, Search, Check, X, ChevronRight, Clock,
  Building2, Edit, Box, ShoppingCart, Pencil, Loader,
  Trash2, Package,
} from 'lucide-react';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  arrivePurchaseOrder,
  getInventoryItems,
} from '../../services/api';
import { useConfirm } from '../../components/ConfirmDialog';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { DetailDrawer, KPIStrip as KPIStripBase, LineItems, MobileSheet, StatusPill, EmptyState } from '../../components/ui';
import { fmtCOP } from '../../utils/inventoryAdapter';
import InventoryNavTabs from './InventoryNavTabs';

const APP_ACCENT = '#3B82F6'; // app-inventory

const STATUS_CONFIG = {
  pendiente:   { label: 'Pendiente',  tone: 'pending',  icon: Clock,    color: '#94A0AE' },
  en_transito: { label: 'En tránsito', tone: 'printing', icon: Truck,   color: '#3B82F6' },
  llegado:     { label: 'Llegado',    tone: 'done',     icon: Check,    color: '#34D399' },
  cancelado:   { label: 'Cancelado',  tone: 'danger',   icon: X,        color: '#F87171' },
};

// Backend campos sin total persistido — computamos siempre desde items.
const poTotal = (po) => {
  if (!po || !Array.isArray(po.items)) return 0;
  return po.items.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
};

// ─── Header + KPI strip ──────────────────────────────────────────────────

function PurchasesHeader({ purchases, onNew }) {
  const open = purchases.filter((p) => p.status === 'pendiente' || p.status === 'en_transito');
  const onRoute = open.reduce((s, p) => s + poTotal(p), 0);
  const vendors = new Set(purchases.map((p) => p.supplier).filter(Boolean)).size;
  const arrived = purchases.filter((p) => p.status === 'llegado').length;
  return (
    <>
      <header className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[var(--color-border-soft)] bg-forge-black">
        <div
          className="w-9 h-9 rounded-lg shrink-0 inline-flex items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${APP_ACCENT} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${APP_ACCENT} 32%, transparent)`,
            color: APP_ACCENT,
          }}
        >
          <Truck size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: APP_ACCENT }} />
            Inventario · Pedidos
          </div>
          <h1 className="m-0 text-[18px] font-semibold text-tech-white tracking-tight whitespace-nowrap">
            Compras a proveedores
          </h1>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold"
          style={{ background: APP_ACCENT, color: '#0A1014' }}
        >
          <Plus size={13} /> Nueva orden
        </button>
      </header>
      <InventoryNavTabs className="px-5 border-b border-[var(--color-border-soft)]" />
      {/* KPI strip → shared <KPIStrip> (P5): mobile scroll-snap + fade derecho
          (antes overflow-x-auto sin indicador). Desktop flex-wrap. */}
      <KPIStripBase
        className="px-5 py-3 border-b border-[var(--color-border-soft)] bg-forge-black"
        minWidth={160}
        snapWidth={180}
      >
        <IpKPI label="Órdenes abiertas" icon={Truck} value={open.length} sub={`${purchases.length} totales`} />
        <IpKPI label="En ruta · COP" icon={ShoppingCart} value={fmtCOP(onRoute)} sub="Por recibir" big />
        <IpKPI label="Vendors" icon={Building2} value={vendors} sub="distintos" />
        <IpKPI label="Llegadas" icon={Check} value={arrived} sub="recibidas" />
      </KPIStripBase>
    </>
  );
}

function IpKPI({ label, value, sub, icon: Icon, big }) {
  return (
    <div className="flex-1 min-w-[160px] p-3 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)] flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className="w-[18px] h-[18px] rounded inline-flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${APP_ACCENT} 14%, transparent)`, color: APP_ACCENT }}
        >
          <Icon size={11} />
        </span>
        <span className="mono text-[9px] uppercase tracking-[0.14em] text-gunmetal">{label}</span>
      </div>
      <div className={`mono font-semibold text-tech-white -tracking-tight truncate ${big ? 'text-[18px]' : 'text-[20px]'}`}>
        {value}
      </div>
      {sub && <div className="mono text-[10px] text-gunmetal-dim truncate">{sub}</div>}
    </div>
  );
}

// ─── Filters bar ─────────────────────────────────────────────────────────

function PurchasesFilters({ purchases, statusFilter, onStatus, query, onQuery }) {
  const counts = useMemo(() => {
    const c = { all: purchases.length };
    Object.keys(STATUS_CONFIG).forEach((k) => {
      c[k] = purchases.filter((p) => p.status === k).length;
    });
    return c;
  }, [purchases]);
  const items = [
    { id: 'all', label: 'Todas', color: 'var(--color-steel)' },
    ...Object.entries(STATUS_CONFIG).map(([id, s]) => ({ id, label: s.label, color: s.color })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 border-b border-[var(--color-border-soft)] bg-forge-black">
      <div className="flex gap-1 flex-wrap">
        {items.map((it) => {
          const active = statusFilter === it.id;
          const color = it.color;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onStatus(it.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: active ? `color-mix(in oklab, ${color} 14%, transparent)` : 'transparent',
                border: `1px solid ${active ? `color-mix(in oklab, ${color} 38%, transparent)` : 'var(--color-border)'}`,
                color: active ? color : 'var(--color-steel)',
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: color }} />
              {it.label}
              <span
                className="mono text-[9.5px] px-1.5 rounded-full border border-[var(--color-border-soft)]"
                style={{
                  background: active ? `color-mix(in oklab, ${color} 18%, transparent)` : 'rgba(228, 232, 237, 0.05)',
                  color: active ? color : 'var(--color-gunmetal)',
                }}
              >
                {counts[it.id] || 0}
              </span>
            </button>
          );
        })}
      </div>
      <div className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] w-60 max-w-full">
        <Search size={12} className="text-gunmetal shrink-0" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar PO o proveedor…"
          className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-tech-white text-[12px]"
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} className="text-gunmetal hover:text-tech-white">
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PO card (lista principal) ───────────────────────────────────────────

function POCard({ po, onClick }) {
  const status = STATUS_CONFIG[po.status] || STATUS_CONFIG.pendiente;
  const StatusIcon = status.icon;
  const total = poTotal(po);
  const linesCount = (po.items || []).length;
  return (
    <button
      type="button"
      onClick={() => onClick(po)}
      className="w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)] hover:bg-[var(--color-surf-card-2)] hover:border-[var(--color-border-bright)] transition-colors"
    >
      <div className="flex flex-col gap-1 shrink-0 min-w-[110px]">
        <span className="mono text-[13px] font-semibold text-tech-white">
          PO-{String(po.id).padStart(4, '0')}
        </span>
        <StatusPill tone={status.tone} icon={StatusIcon}>{status.label}</StatusPill>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div
            className="w-[22px] h-[22px] rounded shrink-0 inline-flex items-center justify-center"
            style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#A5B4FC',
            }}
          >
            <Building2 size={11} />
          </div>
          <span className="text-[13.5px] font-semibold text-tech-white truncate">
            {po.supplier || 'Sin proveedor'}
          </span>
        </div>
        <div className="mono text-[10.5px] text-gunmetal flex items-center gap-1.5 truncate">
          <Clock size={10} />
          <span>
            Colocada {po.created_at ? String(po.created_at).split('T')[0] : '—'}
          </span>
          {po.estimated_arrival && (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-gunmetal-dim" />
              <Truck size={10} />
              <span>llega {String(po.estimated_arrival).split('T')[0]}</span>
            </>
          )}
          {po.tracking_number && (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-gunmetal-dim" />
              <span className="text-blue-400 mono truncate max-w-[180px]">
                {po.tracking_number}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right min-w-[130px]">
        <div className="mono text-[10.5px] text-gunmetal uppercase tracking-[0.12em]">
          {linesCount === 0 ? 'Sin ítems' : `${linesCount} ${linesCount === 1 ? 'ítem' : 'ítems'}`}
        </div>
        <div className="mono text-[16px] font-semibold text-tech-white -tracking-tight mt-0.5 whitespace-nowrap">
          {linesCount === 0 ? 'Sin ítems' : fmtCOP(total)}
        </div>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── PO detail drawer ────────────────────────────────────────────────────

function PODrawerBody({ po, onEdit, onArrive, onDelete }) {
  const status = STATUS_CONFIG[po.status] || STATUS_CONFIG.pendiente;
  const StatusIcon = status.icon;
  const total = poTotal(po);
  const items = po.items || [];
  const linkedCount = items.filter((l) => l.inventory_item_id).length;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div
        className="p-3.5 rounded-xl flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${APP_ACCENT} 8%, transparent), transparent), var(--color-surf-card-2)`,
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="w-11 h-11 rounded-xl inline-flex items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${APP_ACCENT} 16%, transparent)`,
            border: `1px solid color-mix(in oklab, ${APP_ACCENT} 32%, transparent)`,
            color: APP_ACCENT,
          }}
        >
          <Truck size={20} />
        </div>
        <div className="flex-1">
          <StatusPill tone={status.tone} icon={StatusIcon} size="lg">{status.label}</StatusPill>
          <div className="mono text-[10.5px] text-gunmetal mt-1">
            {po.created_at ? `Colocada ${String(po.created_at).split('T')[0]}` : ''}
            {po.estimated_arrival ? ` · ETA ${String(po.estimated_arrival).split('T')[0]}` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-[9.5px] text-gunmetal uppercase tracking-[0.14em]">Total</div>
          <div className="mono text-[20px] font-semibold text-tech-white -tracking-tight">
            {items.length === 0 ? 'Sin ítems' : fmtCOP(total)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="m-0 mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
          Ítems ({items.length})
        </h3>
        <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surf-card-2)]">
          {items.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-gunmetal-dim">Sin ítems</div>
          ) : (
            items.map((l, i) => (
              <div
                key={l.id || i}
                className="grid items-center gap-2.5 px-3 py-2.5"
                style={{
                  gridTemplateColumns: 'minmax(0, 1fr) 60px 100px 110px',
                  borderBottom: i === items.length - 1 ? 0 : '1px solid var(--color-border-soft)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] text-tech-white truncate">{l.name}</div>
                  <div className="mono text-[9.5px] text-gunmetal-dim mt-0.5 flex items-center gap-1.5">
                    {l.inventory_item_id && (
                      <span className="text-[#3B82F6]">↳ inv #{l.inventory_item_id}</span>
                    )}
                    {l.notes && <span className="truncate">{l.notes}</span>}
                  </div>
                </div>
                <span className="mono text-[12px] text-steel text-right">×{l.quantity}</span>
                <span className="mono text-[11px] text-steel text-right">{fmtCOP(Number(l.unit_cost) || 0)}</span>
                <span className="mono text-[13px] font-semibold text-tech-white text-right">
                  {fmtCOP((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}
                </span>
              </div>
            ))
          )}
          {items.length > 0 && (
            <div className="flex items-baseline justify-between px-3 py-2.5 bg-[var(--color-surf-card)] border-t border-[var(--color-border)]">
              <span className="text-[12.5px] font-semibold text-tech-white">Total</span>
              <span className="mono text-[16px] font-semibold text-tech-white -tracking-tight">
                {fmtCOP(total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {po.notes && (
        <div>
          <h3 className="m-0 mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
            Notas internas
          </h3>
          <div className="px-3 py-2.5 rounded-lg bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-[12.5px] leading-[1.5] text-steel">
            {po.notes}
          </div>
        </div>
      )}

      {po.status === 'en_transito' && (
        <div
          className="px-3 py-2.5 rounded-lg flex items-center gap-2.5"
          style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.28)' }}
        >
          <Check size={15} className="text-emerald-400" />
          <div className="flex-1">
            <div className="text-[12.5px] font-medium text-tech-white">
              Al marcar como Llegado se suma al inventario
            </div>
            <div className="mono text-[10px] text-gunmetal mt-0.5">
              {linkedCount} de {items.length} ítems vinculados al inventario
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-steel border border-[var(--color-border-strong)] hover:text-tech-white"
        >
          <Pencil size={13} /> Editar
        </button>
        {po.status !== 'llegado' && po.status !== 'cancelado' && (
          <button
            type="button"
            onClick={onArrive}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold"
            style={{ background: '#34D399', color: '#0A2716' }}
          >
            <Check size={13} /> Marcar como Llegado
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] text-rose-400 border border-[var(--color-border-strong)] hover:border-rose-400/40"
          title="Eliminar pedido"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── New PO drawer (form con validación #73) ──────────────────────────────

const EMPTY_LINE = () => ({
  id: `L${Date.now()}`,
  name: '',
  quantity: 1,
  unit_cost: 0,
  inventory_item_id: null,
  notes: '',
});

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-3 py-2 text-[13px] text-tech-white outline-none focus:border-[#3B82F6]/60';

function NewPOForm({ initial, inventoryItems, onSave, onCancel, mode = 'create', saving }) {
  const [form, setForm] = useState(() => initial || {
    supplier: '',
    carrier: '',
    tracking_number: '',
    estimated_arrival: '',
    notes: '',
    items: [],
    status: 'pendiente',
  });
  const set = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));
  const addLine = () => set('items', [...(form.items || []), EMPTY_LINE()]);
  const updateLine = (idx, key, val) => {
    const next = [...(form.items || [])];
    next[idx] = { ...next[idx], [key]: val };
    set('items', next);
  };
  const removeLine = (idx) => {
    const next = [...(form.items || [])];
    next.splice(idx, 1);
    set('items', next);
  };

  // Validation — issue #73
  const errors = useMemo(() => ({
    supplier: !form.supplier.trim() ? 'Requerido' : null,
    items: (form.items || []).length === 0 ? 'Mínimo 1 ítem' : null,
    lines: (form.items || []).map((l) => ({
      name: !l.name.trim() ? 'Nombre requerido' : null,
      quantity: !(Number(l.quantity) > 0) ? '> 0' : null,
    })),
  }), [form]);
  const hasErrors = !!errors.supplier || !!errors.items ||
    errors.lines.some((e) => e.name || e.quantity);

  const total = (form.items || []).reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
    0,
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <div
        className="p-3 rounded-lg text-[12.5px] leading-[1.55] text-steel"
        style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.20)' }}
      >
        Los campos marcados con <span className="text-rose-400 font-semibold">*</span> son obligatorios.
        La orden empieza en estado <span className="text-tech-white font-semibold">Pendiente</span>;
        al marcar como <span className="text-emerald-400 font-semibold">Llegado</span> se suma al
        inventario cualquier ítem vinculado.
      </div>

      <FormSection title="Proveedor">
        <FormFieldRow label="Proveedor" required error={errors.supplier}>
          <input
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="ej. 3D Hardware Colombia"
            className={FORM_INPUT_CLS}
            autoFocus
          />
        </FormFieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FormFieldRow label="Transportista">
            <input
              value={form.carrier || ''}
              onChange={(e) => set('carrier', e.target.value)}
              placeholder="UPS, FedEx…"
              className={FORM_INPUT_CLS}
            />
          </FormFieldRow>
          <FormFieldRow label="Tracking">
            <input
              value={form.tracking_number || ''}
              onChange={(e) => set('tracking_number', e.target.value)}
              placeholder="1Z..."
              className={`${FORM_INPUT_CLS} mono`}
            />
          </FormFieldRow>
        </div>
        <FormFieldRow label="ETA esperado" hint="ej. fecha estimada de llegada">
          <input
            type="date"
            value={form.estimated_arrival || ''}
            onChange={(e) => set('estimated_arrival', e.target.value)}
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        {mode === 'edit' && (
          <FormFieldRow label="Estado">
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className={FORM_INPUT_CLS}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </FormFieldRow>
        )}
      </FormSection>

      <FormSection title="Ítems del pedido">
        {(form.items || []).length === 0 ? (
          <div
            className="p-5 rounded-lg text-center"
            style={{
              background: 'var(--color-surf-card)',
              border: errors.items ? '1px dashed #FB7185' : '1px dashed var(--color-border-strong)',
            }}
          >
            <Box size={20} className="mx-auto mb-1.5 text-gunmetal" />
            <div className={`text-[12.5px] font-medium mb-2 ${errors.items ? 'text-rose-400' : 'text-steel'}`}>
              {errors.items || 'Sin ítems'}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold"
              style={{ background: APP_ACCENT, color: '#0A1014' }}
            >
              <Plus size={11} /> Agregar ítem
            </button>
          </div>
        ) : (
          <>
            {/* Fix #5 (P1 LineItems): antes grid fijo '80px 120px 1fr 110px'
                dentro del sheet dejaba el select "vincular" ilegible en 375px.
                Ahora: cards apiladas <1024 (vínculo full-width, cant+costo en
                grid-cols-2, subtotal al pie) / grid con minmax(0,fr) ≥1024.
                Ref: inventory.html §NewPOForm. */}
            <LineItems
              columns={[
                {
                  key: 'name', label: 'Ítem', width: '1.7fr',
                  render: (l, idx) => (
                    <>
                      <input
                        value={l.name}
                        onChange={(e) => updateLine(idx, 'name', e.target.value)}
                        placeholder="Nombre del ítem"
                        className={`${FORM_INPUT_CLS} ${errors.lines[idx]?.name ? 'border-rose-400/60' : ''}`}
                      />
                      {errors.lines[idx]?.name && (
                        <span className="block mt-0.5 text-[10px] text-rose-400">{errors.lines[idx].name}</span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'quantity', label: 'Cant.', width: '0.6fr',
                  render: (l, idx) => (
                    <>
                      <input
                        type="number" min="1" step="1" value={l.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className={`${FORM_INPUT_CLS} mono text-right ${errors.lines[idx]?.quantity ? 'border-rose-400/60' : ''}`}
                      />
                      {errors.lines[idx]?.quantity && (
                        <span className="block mt-0.5 text-[10px] text-rose-400">{errors.lines[idx].quantity}</span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'unit_cost', label: 'Costo unit. COP', width: '0.9fr',
                  render: (l, idx) => (
                    <input
                      type="number" min="0" step="0.01" value={l.unit_cost}
                      onChange={(e) => updateLine(idx, 'unit_cost', Number(e.target.value))}
                      className={`${FORM_INPUT_CLS} mono text-right`}
                    />
                  ),
                },
                {
                  key: 'inventory_item_id', label: 'Vincular a inventario', width: '1.4fr', full: true,
                  render: (l, idx) => (
                    <select
                      value={l.inventory_item_id || ''}
                      onChange={(e) => updateLine(idx, 'inventory_item_id', e.target.value ? Number(e.target.value) : null)}
                      className={FORM_INPUT_CLS}
                    >
                      <option value="">Sin vincular</option>
                      {Object.entries(
                        inventoryItems.reduce((acc, inv) => {
                          const cat = inv.category || 'Sin categoría';
                          (acc[cat] = acc[cat] || []).push(inv);
                          return acc;
                        }, {}),
                      ).map(([cat, items]) => (
                        <optgroup key={cat} label={cat}>
                          {items.map((inv) => (
                            <option key={inv.id} value={inv.id}>{inv.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ),
                },
                {
                  key: 'subtotal', label: 'Subtotal', width: '0.9fr', mobile: false,
                  render: (l) => (
                    <span className="mono text-[13px] font-semibold text-tech-white">
                      {fmtCOP((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}
                    </span>
                  ),
                },
              ]}
              items={form.items}
              itemKey={(l, idx) => l.id || idx}
              onRemove={(_l, idx) => removeLine(idx)}
              mobileFoot={(l) => fmtCOP((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}
              minWidth={660}
            />
            <button
              type="button"
              onClick={addLine}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium text-steel border border-dashed border-[var(--color-border-strong)] hover:text-tech-white"
            >
              <Plus size={11} /> Agregar otro ítem
            </button>
            <div
              className="flex items-baseline justify-between px-3 py-2.5 rounded-lg mt-1 bg-[var(--color-surf-card-2)] border border-[var(--color-border)]"
            >
              <span className="text-[12.5px] font-semibold text-tech-white">Total estimado</span>
              <span className="mono text-[17px] font-semibold -tracking-tight" style={{ color: APP_ACCENT }}>
                {fmtCOP(total)}
              </span>
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Notas internas">
        <textarea
          value={form.notes || ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Detalles para el equipo (no se envía al proveedor)"
          rows={3}
          className={`${FORM_INPUT_CLS} resize-y min-h-[70px] leading-relaxed`}
        />
      </FormSection>

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-steel border border-[var(--color-border-strong)] hover:text-tech-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={hasErrors || saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold disabled:cursor-not-allowed"
          style={{
            background: hasErrors ? 'var(--color-surf-card-2)' : APP_ACCENT,
            color: hasErrors ? 'var(--color-gunmetal)' : '#0A1014',
            border: hasErrors ? '1px solid var(--color-border-strong)' : 0,
          }}
        >
          {saving ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
          {hasErrors ? 'Faltan campos' : (mode === 'edit' ? 'Guardar cambios' : 'Crear pedido')}
        </button>
      </div>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <section>
      <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.16em] text-steel font-semibold whitespace-nowrap">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function FormFieldRow({ label, required, hint, error, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="mono text-[9.5px] uppercase tracking-[0.12em] text-gunmetal">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {error && <span className="text-[10.5px] font-medium text-rose-400 whitespace-nowrap">{error}</span>}
      </div>
      {children}
      {hint && !error && (
        <div className="mono mt-0.5 text-[9.5px] text-gunmetal-dim">{hint}</div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function InventoryPurchasesPage() {
  const isMobile = useIsMobile();
  const confirm = useConfirm();

  const [purchases, setPurchases] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingInitial, setEditingInitial] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        getPurchaseOrders(),
        getInventoryItems(),
      ]);
      setPurchases(ordersRes.data || []);
      setInventoryItems(
        [...(itemsRes.data || [])].sort((a, b) =>
          (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es'),
        ),
      );
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = statusFilter === 'all' ? purchases : purchases.filter((p) => p.status === statusFilter);
    if (q) {
      arr = arr.filter((p) =>
        (p.supplier || '').toLowerCase().includes(q) ||
        (p.tracking_number || '').toLowerCase().includes(q) ||
        String(p.id).includes(q),
      );
    }
    return arr.sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );
  }, [purchases, statusFilter, query]);

  const openCreate = () => {
    setEditingInitial(null);
    setFormMode('create');
  };

  const openEdit = (po) => {
    setEditingInitial({
      id: po.id,
      supplier: po.supplier || '',
      carrier: po.carrier || '',
      tracking_number: po.tracking_number || '',
      estimated_arrival: po.estimated_arrival ? String(po.estimated_arrival).split('T')[0] : '',
      notes: po.notes || '',
      status: po.status,
      items: (po.items || []).map((it) => ({
        id: it.id || `L${Date.now()}_${Math.random()}`,
        name: it.name || '',
        quantity: Number(it.quantity) || 1,
        unit_cost: Number(it.unit_cost) || 0,
        inventory_item_id: it.inventory_item_id || null,
        notes: it.notes || '',
      })),
    });
    setFormMode('edit');
    setSelected(null);
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      // Detect transición a llegado en edit — necesita /arrive endpoint
      const isLlegadoTransition =
        formMode === 'edit'
        && form.status === 'llegado'
        && editingInitial?.status !== 'llegado';
      const payload = {
        supplier: form.supplier.trim(),
        carrier: (form.carrier || '').trim() || null,
        tracking_number: (form.tracking_number || '').trim() || null,
        estimated_arrival: form.estimated_arrival || null,
        notes: (form.notes || '').trim() || null,
        items: form.items.map((l) => ({
          name: l.name.trim(),
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost) || 0,
          inventory_item_id: l.inventory_item_id || null,
          notes: (l.notes || '').trim() || null,
        })),
      };
      if (formMode === 'edit' && !isLlegadoTransition) payload.status = form.status;
      if (formMode === 'edit') {
        await updatePurchaseOrder(editingInitial.id, payload);
        if (isLlegadoTransition) {
          await arrivePurchaseOrder(editingInitial.id);
        }
      } else {
        await createPurchaseOrder(payload);
      }
      toast.success(
        isLlegadoTransition
          ? `Orden marcada como llegada. Stock actualizado.`
          : (formMode === 'edit' ? 'Pedido actualizado' : 'Pedido creado'),
      );
      setFormMode(null);
      setEditingInitial(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleArrive = async (po) => {
    if (!await confirm(`Marcar PO-${po.id} como llegado? El stock vinculado se sumará al inventario.`, 'Confirmar')) return;
    try {
      await arrivePurchaseOrder(po.id);
      toast.success('Pedido marcado como llegado · stock actualizado');
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al marcar llegado');
    }
  };

  const handleDelete = async (po) => {
    if (!await confirm(`¿Eliminar PO-${po.id}? Esta acción no se puede deshacer.`, 'Eliminar')) return;
    try {
      await deletePurchaseOrder(po.id);
      toast.success('Pedido eliminado');
      setSelected(null);
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-forge-black">
      <PurchasesHeader
        purchases={purchases}
        onNew={openCreate}
      />
      <PurchasesFilters
        purchases={purchases}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        query={query}
        onQuery={setQuery}
      />
      <main className="flex-1 px-5 py-4 overflow-y-auto">
        {loading ? (
          <p className="py-16 text-center text-gunmetal text-sm">Cargando pedidos…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            accent={APP_ACCENT}
            title={purchases.length === 0 ? 'Sin pedidos de compra' : 'Sin resultados'}
            hint={
              purchases.length === 0
                ? 'Crea uno para empezar a llevar control de las compras a tus proveedores.'
                : 'Ajusta los filtros o limpia la búsqueda.'
            }
            action={
              purchases.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold"
                  style={{ background: APP_ACCENT, color: '#0A1014' }}
                >
                  <Plus size={12} /> Crear orden
                </button>
              ) : null
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <POCard key={p.id} po={p} onClick={setSelected} />
            ))}
          </div>
        )}
      </main>

      {/* Detail drawer / sheet */}
      {!isMobile ? (
        <DetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          eyebrow={selected ? `Pedido · PO-${String(selected.id).padStart(4, '0')}` : ''}
          title={selected?.supplier || ''}
          width={520}
        >
          {selected && (
            <PODrawerBody
              po={selected}
              onEdit={() => openEdit(selected)}
              onArrive={() => handleArrive(selected)}
              onDelete={() => handleDelete(selected)}
            />
          )}
        </DetailDrawer>
      ) : (
        <MobileSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.supplier || ''}>
          {selected && (
            <PODrawerBody
              po={selected}
              onEdit={() => openEdit(selected)}
              onArrive={() => handleArrive(selected)}
              onDelete={() => handleDelete(selected)}
            />
          )}
        </MobileSheet>
      )}

      {/* New / edit drawer / sheet */}
      {!isMobile ? (
        <DetailDrawer
          open={formMode !== null}
          onClose={() => { setFormMode(null); setEditingInitial(null); }}
          eyebrow={formMode === 'edit' ? `Editar · PO-${String(editingInitial?.id).padStart(4, '0')}` : 'Nuevo pedido'}
          title={formMode === 'edit' ? 'Editar orden de compra' : 'Crear orden de compra'}
          width={560}
        >
          {formMode !== null && (
            <NewPOForm
              initial={editingInitial}
              inventoryItems={inventoryItems}
              onSave={handleSave}
              onCancel={() => { setFormMode(null); setEditingInitial(null); }}
              mode={formMode}
              saving={saving}
            />
          )}
        </DetailDrawer>
      ) : (
        <MobileSheet
          open={formMode !== null}
          onClose={() => { setFormMode(null); setEditingInitial(null); }}
          title={formMode === 'edit' ? 'Editar pedido' : 'Nuevo pedido'}
        >
          {formMode !== null && (
            <NewPOForm
              initial={editingInitial}
              inventoryItems={inventoryItems}
              onSave={handleSave}
              onCancel={() => { setFormMode(null); setEditingInitial(null); }}
              mode={formMode}
              saving={saving}
            />
          )}
        </MobileSheet>
      )}
    </div>
  );
}
