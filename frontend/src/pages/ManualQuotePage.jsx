/**
 * @file Cotización manual v2 (port Claude Design — HANDOFF-manual-quote.md).
 *
 * Layout desktop: header + ClientBar + Items table (USD/COP toggle por
 * fila) + aside resumen sticky (total grande + breakdown + conversión
 * USD card + CTAs). Mobile: vertical scroll + sticky footer con total.
 *
 * Resuelve issues:
 *   #78 — toggle USD|COP por-item. Cuando USD: prefijo $ + step 0.5 +
 *         línea conversión ≈ COP debajo del input. Subtotal línea
 *         siempre en COP. Total general en COP. Card "Conversión USD"
 *         en aside cuando hay items USD.
 *
 * Backend integration: `createClientQuote` payload incluye items con
 * currency + shipping_cop (nuevo, migración q1r2s3t4u5v6).
 *
 * @module pages/ManualQuotePage
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CostNavTabs from './cost/CostNavTabs';
import toast from 'react-hot-toast';
import {
  FileEdit, Plus, X, Building2, Clock, Package,
  Download, Bell, ArrowUpRight, Truck, Loader,
} from 'lucide-react';
import {
  createClientQuote,
  getPrintedItems,
  getExchangeRate,
} from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import { fmtCOP, fmtUSD } from '../utils/inventoryAdapter';
import { LineItems } from '../components/ui';

const ACCENT = '#2DD4BF';     // forge-teal — app-cost
const USD_GREEN = '#34D399';

const todayISO = () => new Date().toISOString().split('T')[0];
const addDays = (dateStr, days) => {
  if (!dateStr || !days) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + parseInt(days, 10));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Cálculo total mixed-currency. Convierte USD → COP usando rate.
function computeTotal(items, shippingCOP, includeIVA, ivaPct, rate) {
  const itemsResolved = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const usd = it.currency === 'USD';
    const lineCOP = usd ? qty * price * (rate || 0) : qty * price;
    const lineUSD = usd ? qty * price : 0;
    return { ...it, lineCOP, lineUSD };
  });
  const subtotalCOP = itemsResolved.reduce((s, it) => s + it.lineCOP, 0);
  const subtotalUSD = itemsResolved.reduce((s, it) => s + it.lineUSD, 0);
  const baseTotal = subtotalCOP + (shippingCOP || 0);
  const ivaCOP = includeIVA ? baseTotal * (ivaPct / 100) : 0;
  const totalCOP = baseTotal + ivaCOP;
  return { itemsResolved, subtotalCOP, subtotalUSD, shippingCOP: shippingCOP || 0, ivaCOP, totalCOP };
}

// ─── Header ───────────────────────────────────────────────────────────────

function MqHeader({ pieceCount }) {
  return (
    <header className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[var(--color-border-soft)] bg-forge-black">
      <div
        className="w-9 h-9 rounded-lg shrink-0 inline-flex items-center justify-center"
        style={{
          background: `color-mix(in oklab, ${ACCENT} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${ACCENT} 32%, transparent)`,
          color: ACCENT,
        }}
      >
        <FileEdit size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
          Cost · Cotización manual
        </div>
        <h1 className="m-0 text-[18px] font-semibold text-tech-white tracking-tight whitespace-nowrap">
          Crear cotización al cliente
        </h1>
      </div>
      <div className="mono text-[10.5px] text-gunmetal whitespace-nowrap">
        {pieceCount} {pieceCount === 1 ? 'ítem' : 'ítems'}
      </div>
    </header>
  );
}

// ─── Client bar ───────────────────────────────────────────────────────────

function ClientBar({ clientName, onClientName, validDays, onValidDays, exchangeRate }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 border-b border-[var(--color-border-soft)] bg-forge-black">
      <div className="flex-1 min-w-[260px] flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)]">
        <div
          className="w-8 h-8 rounded-lg shrink-0 inline-flex items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${ACCENT} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${ACCENT} 28%, transparent)`,
            color: ACCENT,
          }}
        >
          <Building2 size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mono text-[9px] uppercase tracking-[0.14em] text-gunmetal">Cliente *</div>
          <input
            value={clientName}
            onChange={(e) => onClientName(e.target.value)}
            placeholder="Nombre del cliente o empresa"
            className="w-full bg-transparent border-0 outline-0 text-[13px] font-medium text-tech-white placeholder:text-gunmetal-dim"
          />
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)] shrink-0">
        <div
          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${ACCENT} 10%, transparent)`, border: `1px solid color-mix(in oklab, ${ACCENT} 22%, transparent)`, color: ACCENT }}
        >
          <Clock size={14} />
        </div>
        <div>
          <div className="mono text-[9px] uppercase tracking-[0.14em] text-gunmetal">Válida por</div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              min="1"
              value={validDays}
              onChange={(e) => onValidDays(e.target.value)}
              className="w-12 bg-transparent border-0 outline-0 mono text-[13px] font-medium text-tech-white"
            />
            <span className="mono text-[11px] text-gunmetal">días</span>
          </div>
        </div>
      </div>
      {exchangeRate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)] shrink-0">
          <div className="mono text-[9px] uppercase tracking-[0.14em] text-gunmetal mr-1">Tasa USD→COP</div>
          <span className="mono text-[12px] font-medium text-tech-white">
            {Number(exchangeRate).toLocaleString('es-CO')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Items table (P1 LineItems — issue #162, roto en mobile antes) ────────
//
// Desktop: grid con cabecera (igual que antes). Mobile: cards apiladas
// (nombre full-width con notas como línea secundaria bajo el nombre — NO
// como campo del grid, jerarquía del mockup — resto en grid-cols-2, quitar
// 44px, pie con subtotal). Antes era el MISMO grid de px fijos en ambos
// tamaños → rompía la creación de cotizaciones en el celular.

function ItemsTable({ items, itemsResolved, onUpdate, onRemove, onAdd, onSelectFromInventory, exchangeRate }) {
  const columns = [
    {
      key: 'name',
      label: 'Producto',
      width: '1.6fr',
      render: (item, idx) => (
        <div>
          <input
            value={item.name}
            onChange={(e) => onUpdate(idx, 'name', e.target.value)}
            placeholder="Nombre del producto"
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-tech-white text-[13px] outline-0 focus:border-[var(--color-forge-teal)]/60"
          />
          <input
            value={item.notes || ''}
            onChange={(e) => onUpdate(idx, 'notes', e.target.value)}
            placeholder="Notas internas"
            className="w-full px-2.5 py-1 mt-1 bg-transparent border-0 outline-0 text-gunmetal text-[11px]"
          />
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Cant.',
      width: '70px',
      render: (item, idx) => (
        <input
          type="number"
          min="0"
          step="1"
          value={item.quantity}
          onChange={(e) => onUpdate(idx, 'quantity', Number(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-tech-white mono text-[13px] font-semibold text-center outline-0"
        />
      ),
    },
    {
      key: 'currency',
      label: 'Moneda',
      width: '100px',
      render: (item, idx) => (
        <div className="inline-flex w-full gap-0.5 p-0.5 bg-[var(--color-surf-card-2)] border border-[var(--color-border)] rounded-md">
          {['COP', 'USD'].map((cur) => {
            const active = item.currency === cur;
            const activeBg = cur === 'USD' ? 'rgba(52, 211, 153, 0.18)' : 'rgba(45, 212, 191, 0.16)';
            const activeColor = cur === 'USD' ? USD_GREEN : ACCENT;
            return (
              <button
                key={cur}
                type="button"
                onClick={() => onUpdate(idx, 'currency', cur)}
                aria-pressed={active}
                className="flex-1 py-1 rounded mono text-[10.5px] font-semibold tracking-wider transition-colors"
                style={{
                  background: active ? activeBg : 'transparent',
                  color: active ? activeColor : 'var(--color-steel)',
                }}
              >
                {cur}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'unit_price',
      label: 'Precio unit.',
      width: '130px',
      render: (item, idx) => {
        const isUSD = item.currency === 'USD';
        const price = parseFloat(item.unit_price) || 0;
        return (
          <div>
            <div className="flex items-stretch bg-[var(--color-surf-card-2)] border border-[var(--color-border)] rounded-md">
              <span className="mono px-2 self-center text-[11px] text-gunmetal border-r border-[var(--color-border)] inline-flex items-center">
                {isUSD ? '$' : 'COP'}
              </span>
              <input
                type="number"
                min="0"
                step={isUSD ? '0.5' : '1000'}
                value={item.unit_price}
                onChange={(e) => onUpdate(idx, 'unit_price', Number(e.target.value))}
                className="flex-1 min-w-0 px-2 py-1.5 bg-transparent border-0 outline-0 text-tech-white mono text-[12.5px] font-semibold text-right"
              />
            </div>
            {isUSD && exchangeRate && price > 0 && (
              <div className="mono text-[9.5px] text-gunmetal-dim mt-1 text-right">
                ≈ {fmtCOP(price * exchangeRate)} COP
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'subtotal',
      label: 'Subtotal (COP)',
      width: '130px',
      mobile: false, // se muestra en el pie de card (mobileFoot) en vez de duplicarse
      render: (item, idx) => {
        const lineCOP = itemsResolved[idx]?.lineCOP || 0;
        const lineUSD = itemsResolved[idx]?.lineUSD || 0;
        return (
          <div className="text-right">
            <div className="mono text-[14px] font-semibold text-tech-white whitespace-nowrap">
              {fmtCOP(lineCOP)}
            </div>
            {item.currency === 'USD' && lineUSD > 0 && (
              <div className="mono text-[9.5px] mt-0.5" style={{ color: USD_GREEN }}>
                {fmtUSD(lineUSD)} USD
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const addButtons = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[11.5px] font-medium text-steel border border-dashed border-[var(--color-border-strong)] hover:text-tech-white min-h-[44px] lg:min-h-0 lg:py-1.5"
      >
        <Plus size={11} /> Agregar otro ítem
      </button>
      {onSelectFromInventory && (
        <button
          type="button"
          onClick={onSelectFromInventory}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[11.5px] font-medium text-blue-400 border border-blue-400/30 hover:text-blue-300 min-h-[44px] lg:min-h-0 lg:py-1.5"
        >
          <Package size={11} /> Desde inventario
        </button>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="p-8 text-center">
          <Package size={28} className="mx-auto mb-2 text-gunmetal" />
          <div className="text-[12.5px] text-gunmetal mb-3">Toca para agregar el primer ítem</div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold"
            style={{ background: ACCENT, color: '#0A1014' }}
          >
            <Plus size={11} /> Agregar ítem
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <LineItems
        columns={columns}
        items={items}
        itemKey={(item, idx) => item.id || idx}
        onRemove={(item, idx) => onRemove(idx)}
        mobileFoot={(item, idx) => fmtCOP(itemsResolved[idx]?.lineCOP || 0)}
        minWidth={660}
      />
      {addButtons}
    </div>
  );
}

// ─── Aside summary ───────────────────────────────────────────────────────

function MqLine({ label, value, bold, last }) {
  return (
    <div
      className={`flex items-baseline justify-between px-3 py-2.5 ${bold ? 'bg-[rgba(45,212,191,0.06)]' : ''}`}
      style={{ borderBottom: last ? 0 : '1px solid var(--color-border-soft)' }}
    >
      <span className={`${bold ? 'font-semibold text-[13px] text-tech-white' : 'font-medium text-[12px] text-steel'}`}>
        {label}
      </span>
      <span
        className={`mono ${bold ? 'text-[15px] font-semibold' : 'text-[13px] font-semibold'} -tracking-tight`}
        style={{ color: bold ? ACCENT : 'var(--color-tech-white)' }}
      >
        {value}
      </span>
    </div>
  );
}

function MqSummary({
  resolved,
  itemCount,
  exchangeRate,
  shippingCOP,
  onShippingCOP,
  includeIVA,
  onIncludeIVA,
  ivaPct,
  onIvaPct,
  notes,
  onNotes,
  onSave,
  saving,
  disabled,
}) {
  const usdItems = resolved.itemsResolved.filter((i) => i.currency === 'USD');
  return (
    <aside
      // 320px en el punto ciego 1024-1279 (issue #162) — a 360px fijo el
      // aside + sidebar (256px) dejaban muy poco para la tabla de ítems.
      className="w-[320px] xl:w-[360px] shrink-0 border-l border-[var(--color-border-soft)] flex flex-col overflow-y-auto"
      style={{
        background: `linear-gradient(180deg, color-mix(in oklab, ${ACCENT} 4%, var(--color-forge-black)), var(--color-forge-black))`,
      }}
    >
      <div className="px-5 pt-5 pb-3.5">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">Resumen</div>
        <h3 className="m-0 mt-0.5 text-[15px] font-semibold text-tech-white">Totales · COP</h3>
      </div>

      {/* Total grande */}
      <div className="px-5 pb-3.5">
        <div
          className="relative p-4 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-surf-card)',
            border: `1px solid color-mix(in oklab, ${ACCENT} 24%, var(--color-border))`,
          }}
        >
          <div
            className="absolute -top-7 -right-5 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, color-mix(in oklab, ${ACCENT} 18%, transparent), transparent 70%)` }}
          />
          <div className="mono relative text-[9.5px] uppercase tracking-[0.14em] text-gunmetal mb-1.5">
            Total cotización
          </div>
          <div className="relative flex items-baseline gap-1.5">
            <span className="mono text-[30px] font-semibold text-tech-white -tracking-wide">
              {fmtCOP(resolved.totalCOP)}
            </span>
            <span className="mono text-[11px] text-gunmetal">COP</span>
          </div>
          {resolved.subtotalUSD > 0 && (
            <div
              className="mono relative inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10.5px]"
              style={{
                background: 'rgba(52, 211, 153, 0.10)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: USD_GREEN,
              }}
            >
              <ArrowUpRight size={10} />
              Incluye {fmtUSD(resolved.subtotalUSD)} USD convertidos
            </div>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-5 pb-3.5">
        <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
          Desglose
        </h3>
        <div className="rounded-lg overflow-hidden bg-[var(--color-surf-card-2)] border border-[var(--color-border)]">
          <MqLine label={`Subtotal ítems (${itemCount})`} value={fmtCOP(resolved.subtotalCOP)} />
          <MqLine label="Envío" value={fmtCOP(resolved.shippingCOP)} />
          {includeIVA && <MqLine label={`IVA (${ivaPct}%)`} value={fmtCOP(resolved.ivaCOP)} />}
          <MqLine label="Total" value={fmtCOP(resolved.totalCOP)} bold last />
        </div>
      </div>

      {/* Conversión USD card */}
      {usdItems.length > 0 && (
        <div className="px-5 pb-3.5">
          <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
            Conversión USD
          </h3>
          <div className="p-3 rounded-lg bg-[var(--color-surf-card-2)] border border-[var(--color-border)]">
            <div className="mono text-[10px] text-gunmetal mb-1.5">
              {usdItems.length} {usdItems.length === 1 ? 'ítem' : 'ítems'} en USD
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-steel">Subtotal USD</span>
              <span className="mono text-[13px] font-semibold" style={{ color: USD_GREEN }}>
                {fmtUSD(resolved.subtotalUSD)}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1.5 mt-1.5 border-t border-dashed border-[var(--color-border-soft)]">
              <span className="mono text-[10.5px] text-gunmetal">
                × {Number(exchangeRate || 0).toLocaleString('es-CO')}
              </span>
              <span className="mono text-[13px] font-semibold text-tech-white">
                {fmtCOP(resolved.subtotalUSD * (exchangeRate || 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Adicionales: envío + IVA */}
      <div className="px-5 pb-3.5">
        <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
          Adicionales
        </h3>
        <div className="rounded-lg bg-[var(--color-surf-card-2)] border border-[var(--color-border)] divide-y divide-[var(--color-border-soft)]">
          <div className="px-3 py-2.5 flex items-center gap-2">
            <Truck size={13} className="text-gunmetal shrink-0" />
            <span className="flex-1 text-[12px] text-steel">Envío (COP)</span>
            <input
              type="number"
              min="0"
              step="500"
              value={shippingCOP}
              onChange={(e) => onShippingCOP(Number(e.target.value))}
              className="w-24 px-2 py-1 rounded bg-[var(--color-surf-card)] border border-[var(--color-border)] text-tech-white mono text-[12px] font-semibold text-right outline-0"
            />
          </div>
          <div className="px-3 py-2.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeIVA}
              onChange={(e) => onIncludeIVA(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-forge-teal)]"
              id="include-iva"
            />
            <label htmlFor="include-iva" className="flex-1 text-[12px] text-steel cursor-pointer">
              Aplicar IVA
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={ivaPct}
              onChange={(e) => onIvaPct(Number(e.target.value))}
              disabled={!includeIVA}
              className="w-16 px-2 py-1 rounded bg-[var(--color-surf-card)] border border-[var(--color-border)] text-tech-white mono text-[12px] font-semibold text-right outline-0 disabled:opacity-40"
            />
            <span className="mono text-[11px] text-gunmetal">%</span>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="px-5 pb-3.5">
        <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-steel font-semibold">
          Notas al cliente
        </h3>
        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Condiciones, observaciones que aparecerán en el PDF"
          rows={3}
          className="w-full px-3 py-2 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-tech-white text-[12.5px] outline-0 focus:border-[var(--color-forge-teal)]/60 resize-y"
        />
      </div>

      {/* CTAs */}
      <div className="mt-auto px-5 py-5 border-t border-[var(--color-border-soft)] flex flex-col gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-lg text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: ACCENT, color: '#0A1014' }}
        >
          {saving ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
          {saving ? 'Guardando…' : 'Guardar cotización'}
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium text-tech-white bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] opacity-50 cursor-not-allowed"
          title="Próximamente"
        >
          <Bell size={12} /> Enviar al cliente
        </button>
      </div>
    </aside>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function ManualQuotePage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [quoteDate] = useState(todayISO());
  const [validDays, setValidDays] = useState('15');
  const [notes, setNotes] = useState('');
  const [shippingCOP, setShippingCOP] = useState(0);
  const [includeIVA, setIncludeIVA] = useState(false);
  const [ivaPct, setIvaPct] = useState(19);
  const [items, setItems] = useState([
    { id: `I${Date.now()}`, name: '', quantity: 1, unit_price: 0, currency: 'COP', notes: '' },
  ]);
  const [prints, setPrints] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPrintedItems({ limit: 100 }).then((res) => setPrints(res.data.items || [])).catch(() => {});
    getExchangeRate().then((res) => setExchangeRate(Number(res.data.rate_used))).catch(() => {});
  }, []);

  const updateItem = (idx, key, val) => {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  };
  const addItem = () => {
    setItems((cur) => [...cur, { id: `I${Date.now()}`, name: '', quantity: 1, unit_price: 0, currency: 'COP', notes: '' }]);
  };
  const removeItem = (idx) => {
    setItems((cur) => (cur.length === 1 ? cur : cur.filter((_, i) => i !== idx)));
  };
  const selectPrint = (print) => {
    const c = print.currency || 'USD';
    setItems((cur) => [
      ...cur,
      { id: `I${Date.now()}`, name: print.name, quantity: 1, unit_price: print.unit_price != null ? Number(print.unit_price) : 0, currency: c, notes: '' },
    ]);
    setSelectorOpen(false);
  };

  const resolved = useMemo(
    () => computeTotal(items, Number(shippingCOP) || 0, includeIVA, Number(ivaPct) || 0, exchangeRate),
    [items, shippingCOP, includeIVA, ivaPct, exchangeRate],
  );

  // Validación
  const hasUSDItems = items.some((it) => it.currency === 'USD');
  const errors = {
    client: !clientName.trim() ? 'Cliente requerido' : null,
    items: items.length === 0 || items.every((it) => !it.name.trim() || Number(it.unit_price) <= 0)
      ? 'Mínimo 1 ítem con nombre y precio'
      : null,
    rate: hasUSDItems && !exchangeRate
      ? 'Configura la tasa USD→COP antes de mezclar monedas'
      : null,
  };
  const hasErrors = !!errors.client || !!errors.items || !!errors.rate;

  const handleSave = async () => {
    if (errors.client) { toast.error(errors.client); return; }
    if (errors.items) { toast.error(errors.items); return; }
    if (errors.rate) { toast.error(errors.rate); return; }
    setSaving(true);
    try {
      const payload = {
        client_name: clientName.trim(),
        description: description.trim() || null,
        quote_date: quoteDate,
        expiry_days: parseInt(validDays, 10) || 15,
        items: items
          .filter((it) => it.name.trim() && Number(it.unit_price) >= 0)
          .map((it) => ({
            name: it.name.trim(),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            currency: it.currency || 'COP',
          })),
        include_iva: includeIVA,
        iva_percent: Number(ivaPct) || 19,
        shipping_cop: Number(shippingCOP) || 0,
        notes: notes.trim() || null,
      };
      await createClientQuote(payload);
      toast.success('Cotización guardada');
      navigate('/cost');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const itemsTable = (
    <ItemsTable
      items={items}
      itemsResolved={resolved.itemsResolved}
      onUpdate={updateItem}
      onRemove={removeItem}
      onAdd={addItem}
      onSelectFromInventory={prints.length > 0 ? () => setSelectorOpen(true) : null}
      exchangeRate={exchangeRate}
    />
  );

  const expiryLabel = addDays(quoteDate, parseInt(validDays, 10) || 0);

  // ── Mobile shell ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-forge-black">
        <MqHeader pieceCount={items.length} />
        <CostNavTabs className="px-4" />
        <ClientBar
          clientName={clientName}
          onClientName={setClientName}
          validDays={validDays}
          onValidDays={setValidDays}
          exchangeRate={exchangeRate}
        />
        {/* pb-40: despeja la barra sticky (ahora en bottom-20) + su propia
            altura + el bottom nav global debajo de ella. */}
        <main className="flex-1 px-4 py-4 pb-40 overflow-y-auto flex flex-col gap-4">
          {expiryLabel && (
            <div className="mono text-[11px] text-gunmetal">
              Válida hasta <span className="text-forge-teal">{expiryLabel}</span>
            </div>
          )}
          {itemsTable}
          <div className="rounded-lg p-3 bg-[var(--color-surf-card-2)] border border-[var(--color-border)] flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Truck size={13} className="text-gunmetal" />
              <span className="flex-1 text-[12px] text-steel">Envío (COP)</span>
              <input
                type="number"
                value={shippingCOP}
                onChange={(e) => setShippingCOP(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded bg-[var(--color-surf-card)] border border-[var(--color-border)] text-tech-white mono text-[12px] text-right outline-0"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeIVA} onChange={(e) => setIncludeIVA(e.target.checked)} className="w-4 h-4 accent-[var(--color-forge-teal)]" />
              <span className="flex-1 text-[12px] text-steel">Aplicar IVA</span>
              <input
                type="number" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))}
                disabled={!includeIVA}
                className="w-16 px-2 py-1 rounded bg-[var(--color-surf-card)] border border-[var(--color-border)] text-tech-white mono text-[12px] text-right outline-0 disabled:opacity-40"
              />
              <span className="mono text-[11px] text-gunmetal">%</span>
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas al cliente"
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-tech-white text-[12.5px] outline-0 resize-y"
          />
        </main>
        {/* bottom-20 (no bottom-0): despeja el MobileBottomNav global, que
            también vive fixed bottom-0 z-30 — sin esto el botón Guardar
            queda tapado (issue #162). Mismo patrón que los FABs de página
            de Queue/Vault/Maintenance/Projects. */}
        <div className="fixed bottom-20 inset-x-0 z-30 px-4 py-3 bg-[var(--color-surf-sidebar)] border-t border-[var(--color-border-soft)] flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="mono text-[9px] uppercase tracking-wider text-gunmetal">Total</div>
            <div className="mono text-[18px] font-semibold text-tech-white truncate">
              {fmtCOP(resolved.totalCOP)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={hasErrors || saving}
            className="px-3.5 py-2 rounded-md text-[12px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: '#0A1014' }}
          >
            {saving ? '…' : 'Guardar'}
          </button>
        </div>
        {selectorOpen && (
          <PrintsSelectorModal prints={prints} onPick={selectPrint} onClose={() => setSelectorOpen(false)} />
        )}
      </div>
    );
  }

  // ── Desktop shell ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-forge-black">
      <MqHeader pieceCount={items.length} />
      <CostNavTabs className="px-5" />
      <ClientBar
        clientName={clientName}
        onClientName={setClientName}
        validDays={validDays}
        onValidDays={setValidDays}
        exchangeRate={exchangeRate}
      />
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 px-5 py-4 overflow-y-auto flex flex-col gap-4">
          {expiryLabel && (
            <div className="mono text-[11px] text-gunmetal">
              Válida hasta <span className="text-forge-teal">{expiryLabel}</span>
            </div>
          )}
          {itemsTable}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mono text-[10.5px] uppercase tracking-[0.14em] text-gunmetal block mb-1.5">
                Descripción interna
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción general (visible en historial)"
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border)] text-tech-white text-[12.5px] outline-0 focus:border-[var(--color-forge-teal)]/60 resize-y"
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-[11px] text-gunmetal">
              {hasErrors && (
                <span className="text-rose-400 font-medium">
                  {errors.client || errors.items || errors.rate}
                </span>
              )}
            </div>
          </div>
        </main>
        <MqSummary
          resolved={resolved}
          itemCount={items.length}
          exchangeRate={exchangeRate}
          shippingCOP={shippingCOP}
          onShippingCOP={setShippingCOP}
          includeIVA={includeIVA}
          onIncludeIVA={setIncludeIVA}
          ivaPct={ivaPct}
          onIvaPct={setIvaPct}
          notes={notes}
          onNotes={setNotes}
          onSave={handleSave}
          saving={saving}
          disabled={hasErrors}
        />
      </div>
      {selectorOpen && (
        <PrintsSelectorModal prints={prints} onPick={selectPrint} onClose={() => setSelectorOpen(false)} />
      )}
    </div>
  );
}

// ─── Inventory picker modal ──────────────────────────────────────────────

function PrintsSelectorModal({ prints, onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(6, 9, 18, 0.66)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-2xl p-4"
        style={{ background: 'var(--color-surf-card)', border: '1px solid var(--color-border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-tech-white font-semibold flex items-center gap-2 text-[14px]">
            <Package size={16} className="text-blue-400" /> Seleccionar impresión
          </h3>
          <button type="button" onClick={onClose} className="text-gunmetal hover:text-tech-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-[11px] text-gunmetal mb-3">Se pre-llenará el nombre y el precio.</p>
        <div className="overflow-y-auto flex flex-col gap-1">
          {prints.length === 0 ? (
            <p className="text-gunmetal text-[12px] text-center py-4">
              No hay impresiones en el inventario.
            </p>
          ) : (
            prints.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--color-surf-card-2)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-tech-white text-[13px] font-medium">{p.name}</span>
                  <span className="mono text-[12px] font-semibold ml-2 shrink-0" style={{ color: ACCENT }}>
                    {p.unit_price != null
                      ? (p.currency === 'COP' ? fmtCOP(Number(p.unit_price)) : `${fmtUSD(Number(p.unit_price))} USD`)
                      : '—'}
                  </span>
                </div>
                <div className="flex gap-2 mt-0.5">
                  {p.category && <span className="text-[11px] text-gunmetal">{p.category}</span>}
                  <span className={`text-[11px] ${p.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {p.quantity} en stock
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

