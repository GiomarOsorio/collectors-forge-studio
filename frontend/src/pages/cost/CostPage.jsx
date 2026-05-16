/**
 * @file Página rediseñada de la app Cost (Claude Design port — Día 4).
 *
 * Tres pestañas:
 *  - Cotizaciones (cliente): cards con buscador y bottom-sheet/drawer de detalle.
 *  - Historial (impresiones calculadas): lista compacta.
 *  - Calculadora: tarjeta puente al editor existente en `/cost/calculator`.
 *
 * Reusa primitives de `components/ui/` y el adapter `inventoryAdapter` para
 * formato monetario. Desktop y mobile comparten estado y se conmutan vía
 * `useIsMobile()`.
 *
 * @module pages/cost/CostPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Calculator,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  FileEdit,
  FileText,
  History,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, KPI, MobileSheet } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  deleteClientQuote,
  downloadClientQuotePdf,
  getClientQuotes,
  getQuotes,
} from '../../services/api';
import { fmtCOP } from '../../utils/inventoryAdapter';

const TABS = [
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
  { id: 'historial',    label: 'Historial',    icon: History },
  { id: 'calculadora',  label: 'Calculadora',  icon: Calculator },
];

/**
 * Días entre `quote_date` y `expiry_date`. Negativo si vencida.
 *
 * @param {Object} q
 * @returns {number|null}
 */
function daysToExpiry(q) {
  if (!q?.expiry_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(q.expiry_date);
  return Math.ceil((exp - today) / 86_400_000);
}

const fmtDate = (str) => {
  if (!str) return '—';
  const [y, m, d] = String(str).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

const padCot = (id) => `COT-${String(id).padStart(4, '0')}`;

// ─── KPI strip ──────────────────────────────────────────────────────────────

function KPIStrip({ stats }) {
  return (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Capital cotizado · 30d"
          value={`$${(stats.capital30d / 1_000_000).toFixed(2)}M`}
          unit="COP"
          sub={`${stats.count30d} cotizaciones`}
          accent="#2DD4BF"
          icon={TrendingUp}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Total cotizaciones"
          value={stats.totalCount}
          unit="docs"
          sub={`${stats.totalItems} ítems acumulados`}
          accent="#3B82F6"
          icon={FileText}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Ticket promedio"
          value={fmtCOP(stats.avgTicket)}
          sub="por cotización"
          accent="#94A0AE"
          icon={Calculator}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Vencen pronto"
          value={stats.expiringSoon}
          unit="≤7 días"
          sub={stats.expired > 0 ? `${stats.expired} vencidas` : 'al día'}
          accent="#FBBF24"
          icon={Calendar}
        />
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function CostTabs({ value, onChange, counts, accent = '#2DD4BF' }) {
  return (
    <div className="flex items-center gap-0.5 px-6 border-b border-[var(--color-border)] overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors whitespace-nowrap -mb-px border-b-2 ${
              active ? 'text-tech-white' : 'text-steel border-transparent hover:text-tech-white'
            }`}
            style={active ? { borderColor: accent } : undefined}
          >
            <Icon size={13} style={active ? { color: accent } : { color: '#7A8494' }} />
            {t.label}
            {counts[t.id] != null && (
              <span
                className={`mono text-[10px] px-1.5 py-px rounded-full border ${
                  active ? 'bg-teal-500/14 border-teal-500/30 text-teal-300' : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
                }`}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Quote card (cotización cliente) ─────────────────────────────────────────

function QuoteCard({ q, onClick }) {
  const dte = daysToExpiry(q);
  const expired = dte != null && dte < 0;
  const expiresSoon = dte != null && dte >= 0 && dte <= 7;
  const items = Array.isArray(q.items) ? q.items.length : 0;
  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(q)}
      className="text-left w-full p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{
            background: 'rgba(45, 212, 191, 0.12)',
            color: '#2DD4BF',
            border: '1px solid rgba(45, 212, 191, 0.25)',
          }}
        >
          <FileText size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="mono text-[10.5px] text-gunmetal tracking-wider">{padCot(q.id)}</span>
            {expired && (
              <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-rose-500/15 border border-rose-500/30 text-rose-300">
                VENCIDA
              </span>
            )}
            {expiresSoon && (
              <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400">
                EN {dte}d
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">{q.client_name}</p>
          {q.description && (
            <p className="text-xs text-gunmetal truncate mt-0.5">{q.description}</p>
          )}
        </div>
        <span className="mono text-base font-semibold text-forge-teal whitespace-nowrap shrink-0">
          {fmtCOP(q.subtotal)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gunmetal border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <span className="inline-flex items-center gap-1">
          <Calendar size={11} />
          {fmtDate(q.quote_date)}
        </span>
        <span>·</span>
        <span>
          {items} ítem{items === 1 ? '' : 's'}
        </span>
        <span>·</span>
        <span className="mono">vence {fmtDate(q.expiry_date)}</span>
      </div>
    </Card>
  );
}

// ─── Quote drawer body ───────────────────────────────────────────────────────

function QuoteDrawerBody({ q, onDownloadPdf, onDelete, onClose }) {
  if (!q) return null;
  const dte = daysToExpiry(q);
  const items = Array.isArray(q.items) ? q.items : [];
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl"
          style={{
            background: 'rgba(45, 212, 191, 0.12)',
            color: '#2DD4BF',
            border: '1px solid rgba(45, 212, 191, 0.25)',
          }}
        >
          <FileText size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="mono text-[10.5px] text-gunmetal tracking-wider">{padCot(q.id)}</div>
          <h2 className="text-lg font-semibold text-tech-white truncate">{q.client_name}</h2>
          {q.description && <p className="text-xs text-gunmetal mt-0.5">{q.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Subtotal</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">{fmtCOP(q.subtotal)}</p>
          {q.include_iva && (
            <p className="mono text-[10px] text-gunmetal mt-0.5">+ {q.iva_percent}% IVA</p>
          )}
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Vigencia</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {dte != null ? (dte < 0 ? `Vencida ${Math.abs(dte)}d` : `${dte}d restantes`) : '—'}
          </p>
          <p className="mono text-[10px] text-gunmetal mt-0.5">vence {fmtDate(q.expiry_date)}</p>
        </Card>
      </div>

      <div>
        <span className="lbl-eyebrow text-[9px]">Ítems ({items.length})</span>
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((it, i) => {
            const subtotal = Number(it.unit_price || 0) * Number(it.quantity || 0);
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-tech-white truncate">{it.name}</p>
                  <p className="mono text-[11px] text-gunmetal">
                    {it.quantity} × {fmtCOP(it.unit_price)}
                  </p>
                </div>
                <span className="mono text-xs text-tech-white whitespace-nowrap">
                  {fmtCOP(subtotal)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {q.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{q.notes}</p>
        </Card>
      )}

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <Button variant="primary" icon={Download} onClick={() => onDownloadPdf(q)} className="flex-1">
          Descargar PDF
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={async () => {
            const ok = await onDelete(q);
            if (ok) onClose();
          }}
          className="text-rose-400 hover:text-rose-300"
          aria-label="Eliminar cotización"
        />
      </div>
    </div>
  );
}

// ─── Print history row ───────────────────────────────────────────────────────

function PrintHistoryRow({ q, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(q)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{
          background: 'rgba(59, 130, 246, 0.10)',
          color: '#3B82F6',
          border: '1px solid rgba(59, 130, 246, 0.22)',
        }}
      >
        <Printer size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tech-white truncate">{q.piece_name || `Pieza #${q.id}`}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gunmetal">
          {q.client_name && <span className="truncate inline-flex items-center gap-1"><User size={10} />{q.client_name}</span>}
          {q.client_name && <span>·</span>}
          <span className="mono inline-flex items-center gap-1">
            <Clock size={10} /> {Number(q.print_time_hours || 0).toFixed(1)}h
          </span>
          <span>·</span>
          <span className="mono">{Number(q.weight_grams || 0).toFixed(0)}g</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="mono text-sm font-semibold text-tech-white">{fmtCOP(q.total_price)}</span>
        <span className="mono text-[10px] text-gunmetal">margen {Math.round(Number(q.margin_percent || 0))}%</span>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Calculator promo card ───────────────────────────────────────────────────

function CalculatorPromo() {
  return (
    <div className="px-6 pt-6">
      <Card className="p-6 flex flex-col md:flex-row gap-5 items-start">
        <span
          className="inline-flex items-center justify-center w-14 h-14 rounded-xl shrink-0"
          style={{
            background: 'rgba(45, 212, 191, 0.10)',
            color: '#2DD4BF',
            border: '1px solid rgba(45, 212, 191, 0.25)',
          }}
        >
          <Calculator size={26} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-tech-white">Calculadora de impresión 3D</h3>
          <p className="text-sm text-steel mt-1 max-w-xl">
            Ingresa peso, tiempo, filamento, impresora y la calculadora te entrega el costo real
            (material, electricidad, mantenimiento, depreciación, mano de obra) más el margen.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to="/cost/calculator" className="btn btn-primary btn-sm">
              <Calculator size={13} /> Calcular pieza
            </Link>
            <Link to="/cost/manual" className="btn btn-ghost btn-sm">
              <FileEdit size={13} /> Cotización manual
            </Link>
            <Link to="/cost/printers" className="btn btn-ghost btn-sm">
              <Printer size={13} /> Impresoras
            </Link>
            <Link to="/cost/settings" className="btn btn-ghost btn-sm">
              Tarifa &amp; ajustes
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CostPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const { openSidebar } = useOutletContext() || {};

  const [tab, setTab] = useState('cotizaciones');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedPrint, setSelectedPrint] = useState(null);

  const [clientQuotes, setClientQuotes] = useState([]);
  const [printQuotes, setPrintQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.allSettled([getClientQuotes(), getQuotes()]);
    if (c.status === 'fulfilled') setClientQuotes(c.value.data || []);
    if (p.status === 'fulfilled') setPrintQuotes(p.value.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {
      toast.error('No se pudo cargar Cost');
      setLoading(false);
    });
  }, []);

  // Stats agregadas para el KPI strip
  const stats = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 30 * 86_400_000;
    const recent = clientQuotes.filter((q) => {
      const t = new Date(q.created_at || q.quote_date).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    const sumRecent = recent.reduce((s, q) => s + Number(q.subtotal || 0), 0);
    const totalSum = clientQuotes.reduce((s, q) => s + Number(q.subtotal || 0), 0);
    const totalItems = clientQuotes.reduce(
      (s, q) => s + (Array.isArray(q.items) ? q.items.length : 0),
      0,
    );
    let expiringSoon = 0;
    let expired = 0;
    for (const q of clientQuotes) {
      const d = daysToExpiry(q);
      if (d == null) continue;
      if (d < 0) expired += 1;
      else if (d <= 7) expiringSoon += 1;
    }
    return {
      capital30d: sumRecent,
      count30d: recent.length,
      totalCount: clientQuotes.length,
      totalItems,
      avgTicket: clientQuotes.length ? totalSum / clientQuotes.length : 0,
      expiringSoon,
      expired,
    };
  }, [clientQuotes]);

  const filteredQuotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...clientQuotes].sort((a, b) => {
      const da = new Date(a.created_at || a.quote_date).getTime();
      const db = new Date(b.created_at || b.quote_date).getTime();
      return db - da;
    });
    if (!q) return sorted;
    return sorted.filter((cq) => {
      return (
        cq.client_name?.toLowerCase().includes(q) ||
        cq.description?.toLowerCase().includes(q) ||
        padCot(cq.id).toLowerCase().includes(q)
      );
    });
  }, [clientQuotes, query]);

  const filteredPrints = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...printQuotes].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
    if (!q) return sorted;
    return sorted.filter((p) => {
      return (
        (p.piece_name || '').toLowerCase().includes(q) ||
        (p.client_name || '').toLowerCase().includes(q)
      );
    });
  }, [printQuotes, query]);

  const counts = {
    cotizaciones: clientQuotes.length,
    historial: printQuotes.length,
    calculadora: null,
  };

  const handleDownloadPdf = async (q) => {
    try {
      const res = await downloadClientQuotePdf(q.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${padCot(q.id)}_${(q.client_name || '').replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar el PDF');
    }
  };

  const handleDelete = async (q) => {
    const ok = await confirm('¿Eliminar esta cotización?', 'Eliminar');
    if (!ok) return false;
    try {
      await deleteClientQuote(q.id);
      toast.success('Cotización eliminada');
      setClientQuotes((cur) => cur.filter((c) => c.id !== q.id));
      return true;
    } catch {
      toast.error('No se pudo eliminar');
      return false;
    }
  };

  // ── Mobile shell ──────────────────────────────────────────────────────────
  if (isMobile) {
    const tabLabel = TABS.find((t) => t.id === tab)?.label || tab;
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Cost"
          appIcon={Calculator}
          appAccent="#2DD4BF"
          title={tabLabel}
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-3 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Cost · resumen</span>
              <span className="mono text-[10px] text-gunmetal">
                {stats.totalCount} docs
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="mono text-3xl font-semibold text-tech-white tracking-tight">
                ${(stats.capital30d / 1_000_000).toFixed(2)}M
              </span>
              <span className="mono text-sm text-gunmetal">cotizado · 30d</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="lbl-eyebrow text-[9px]">Ticket promedio</span>
                <p className="mono text-sm text-tech-white mt-0.5">{fmtCOP(stats.avgTicket)}</p>
              </div>
              <div>
                <span className="lbl-eyebrow text-[9px]">Vencen pronto</span>
                <p
                  className={`mono text-sm mt-0.5 ${
                    stats.expired > 0 ? 'text-rose-300' : stats.expiringSoon > 0 ? 'text-amber-400' : 'text-tech-white'
                  }`}
                >
                  {stats.expiringSoon}{' '}
                  <span className="text-gunmetal text-[10px]">({stats.expired} venc.)</span>
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-3 px-4 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
                  active
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                    : 'bg-transparent border-[var(--color-border)] text-steel'
                }`}
              >
                <Icon size={12} />
                {t.label}
                {counts[t.id] != null && (
                  <span className="mono text-[10px] text-gunmetal">{counts[t.id]}</span>
                )}
              </button>
            );
          })}
        </div>

        {tab !== 'calculadora' && (
          <div className="px-4 mt-3">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
              <Search size={14} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === 'cotizaciones' ? 'Cliente, COT-XXXX…' : 'Pieza, cliente…'}
                className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-gunmetal hover:text-tech-white"
                  aria-label="Limpiar"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'cotizaciones' ? (
          loading ? (
            <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando cotizaciones…</p>
          ) : filteredQuotes.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
              <FileText size={22} className="text-gunmetal-dim" />
              <p className="text-sm font-semibold text-tech-white">
                {clientQuotes.length === 0 ? 'Aún no hay cotizaciones' : 'Sin resultados'}
              </p>
              <p className="text-xs text-gunmetal max-w-xs">
                {clientQuotes.length === 0
                  ? 'Toca + para crear la primera cotización manual.'
                  : 'Ajusta la búsqueda.'}
              </p>
            </div>
          ) : (
            <ul className="px-4 mt-3 pb-28 flex flex-col gap-2">
              {filteredQuotes.map((q) => (
                <li key={q.id}>
                  <QuoteCard q={q} onClick={setSelected} />
                </li>
              ))}
            </ul>
          )
        ) : tab === 'historial' ? (
          loading ? (
            <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando historial…</p>
          ) : filteredPrints.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
              <Printer size={22} className="text-gunmetal-dim" />
              <p className="text-sm font-semibold text-tech-white">Sin cálculos guardados</p>
            </div>
          ) : (
            <ul className="mt-3 pb-28">
              {filteredPrints.map((q) => (
                <li key={q.id}>
                  <PrintHistoryRow q={q} onClick={setSelectedPrint} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <CalculatorPromo />
        )}

        {/* FAB cotización manual */}
        <button
          type="button"
          onClick={() => navigate('/cost/manual')}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-forge-teal text-[#0A1014] font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(45, 212, 191, 0.35)' }}
          aria-label="Nueva cotización"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nueva
        </button>

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected ? padCot(selected.id) : ''}
          height="full"
        >
          <QuoteDrawerBody
            q={selected}
            onDownloadPdf={handleDownloadPdf}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        </MobileSheet>
      </div>
    );
  }

  // ── Desktop shell ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{
              background: 'rgba(45, 212, 191, 0.12)',
              color: '#2DD4BF',
              border: '1px solid rgba(45, 212, 191, 0.25)',
            }}
          >
            <Calculator size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Cost</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">
            {tab}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cost/calculator" className="btn btn-ghost btn-sm">
            <Calculator size={13} /> Calcular
          </Link>
          <Link to="/company/templates" className="btn btn-ghost btn-sm">
            <FileText size={13} /> Templates PDF
          </Link>
          <span className="w-px h-4 bg-[var(--color-border)]" />
          <Link to="/cost/manual" className="btn btn-primary btn-sm">
            <Plus size={13} /> Nueva cotización
          </Link>
        </div>
      </header>

      <KPIStrip stats={stats} />

      <CostTabs value={tab} onChange={setTab} counts={counts} />

      {tab === 'cotizaciones' && (
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
              <Search size={13} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, descripción o COT-XXXX…"
                className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-gunmetal hover:text-tech-white"
                  aria-label="Limpiar"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filteredQuotes.length} de {clientQuotes.length} cotizaciones
            </span>
          </div>

          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando cotizaciones…</p>
          ) : filteredQuotes.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(45, 212, 191, 0.10)',
                  border: '1px solid rgba(45, 212, 191, 0.22)',
                  color: '#2DD4BF',
                }}
              >
                <FileText size={22} />
              </div>
              <p className="text-sm font-semibold text-tech-white">
                {clientQuotes.length === 0 ? 'Aún no hay cotizaciones' : 'Sin resultados'}
              </p>
              <p className="text-xs text-gunmetal max-w-sm">
                {clientQuotes.length === 0
                  ? 'Crea tu primera cotización manual para clientes.'
                  : 'Ajusta la búsqueda para ver todas las cotizaciones.'}
              </p>
              {clientQuotes.length === 0 && (
                <Link to="/cost/manual" className="btn btn-primary btn-sm">
                  <Plus size={13} /> Nueva cotización
                </Link>
              )}
            </div>
          ) : (
            <div
              className="px-6 pb-8 grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {filteredQuotes.map((q) => (
                <QuoteCard key={q.id} q={q} onClick={setSelected} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
              <Search size={13} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pieza o cliente…"
                className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-gunmetal hover:text-tech-white"
                  aria-label="Limpiar"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filteredPrints.length} de {printQuotes.length} cálculos
            </span>
          </div>

          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando historial…</p>
          ) : filteredPrints.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Printer size={28} className="text-gunmetal-dim" />
              <p className="text-sm font-semibold text-tech-white">Sin cálculos guardados</p>
              <Link to="/cost/calculator" className="btn btn-primary btn-sm">
                <Calculator size={13} /> Ir a la calculadora
              </Link>
            </div>
          ) : (
            <div className="px-6 pb-8 border border-[var(--color-border)] rounded-xl mx-6 overflow-hidden bg-[var(--color-surf-card)]">
              <ul>
                {filteredPrints.map((q) => (
                  <li key={q.id}>
                    <PrintHistoryRow q={q} onClick={setSelectedPrint} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'calculadora' && <CalculatorPromo />}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? padCot(selected.id) : ''}
        width={460}
      >
        <QuoteDrawerBody
          q={selected}
          onDownloadPdf={handleDownloadPdf}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      </DetailDrawer>

      <DetailDrawer
        open={!!selectedPrint}
        onClose={() => setSelectedPrint(null)}
        title={selectedPrint ? `Cálculo · ${selectedPrint.piece_name || `#${selectedPrint.id}`}` : ''}
        width={460}
      >
        {selectedPrint && (
          <div className="p-5 flex flex-col gap-4">
            <div>
              <span className="lbl-eyebrow text-[9px]">Pieza</span>
              <h2 className="text-lg font-semibold text-tech-white mt-0.5">
                {selectedPrint.piece_name || `#${selectedPrint.id}`}
              </h2>
              {selectedPrint.client_name && (
                <p className="text-xs text-gunmetal mt-0.5 inline-flex items-center gap-1">
                  <User size={11} /> {selectedPrint.client_name}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Card className="p-3">
                <span className="lbl-eyebrow text-[9px]">Total</span>
                <p className="mono text-base font-semibold text-forge-teal mt-0.5">
                  {fmtCOP(selectedPrint.total_price)}
                </p>
              </Card>
              <Card className="p-3">
                <span className="lbl-eyebrow text-[9px]">Margen</span>
                <p className="mono text-base font-semibold text-tech-white mt-0.5">
                  {Math.round(Number(selectedPrint.margin_percent || 0))}%
                </p>
              </Card>
              <Card className="p-3">
                <span className="lbl-eyebrow text-[9px]">Peso</span>
                <p className="mono text-sm text-tech-white mt-0.5">
                  {Number(selectedPrint.weight_grams || 0).toFixed(0)} g
                </p>
              </Card>
              <Card className="p-3">
                <span className="lbl-eyebrow text-[9px]">Tiempo</span>
                <p className="mono text-sm text-tech-white mt-0.5">
                  {Number(selectedPrint.print_time_hours || 0).toFixed(2)} h
                </p>
              </Card>
            </div>
            <Link to="/cost/history" className="btn btn-ghost btn-sm self-start">
              Ver historial completo
            </Link>
          </div>
        )}
      </DetailDrawer>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{stats.totalCount} cotizaciones</span>
        <span className="mono">{fmtCOP(stats.capital30d)} · 30d</span>
        <span className="flex-1" />
        <span className="mono">es-CO · COP</span>
      </footer>
    </div>
  );
}
