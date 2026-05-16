/**
 * @file Página rediseñada de la app Queue (Claude Design port — Día 6).
 *
 * Dos pestañas:
 *  - Activa: cola de pendientes + en impresión, ordenada por `position`.
 *  - Historial: jobs `done`/`cancelled` con timestamp.
 *
 * Acciones en cada item: Marcar imprimiendo / Marcar listo / Cancelar / Eliminar.
 * Cuando se marca `done` el backend descuenta inventario y suma horas a impresora.
 *
 * @module pages/queue/QueuePageV2
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  ListOrdered,
  Pause,
  Play,
  Plus,
  Printer,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, KPI, MobileSheet } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  deleteQueueItem,
  getQueue,
  getQueueHistory,
  updateQueueStatus,
} from '../../services/api';
import { fmtCOP } from '../../utils/inventoryAdapter';

const ACCENT = '#14B8A6';

const TABS = [
  { id: 'activa',    label: 'Cola activa', icon: ListOrdered },
  { id: 'historial', label: 'Historial',   icon: Clock },
];

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'printing') return { label: 'Imprimiendo', color: '#FBBF24', icon: Play };
  if (s === 'done')     return { label: 'Listo',       color: '#34D399', icon: CheckCircle2 };
  if (s === 'cancelled')return { label: 'Cancelado',   color: '#F87171', icon: XCircle };
  return { label: 'Pendiente', color: '#94A0AE', icon: Pause };
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

// ─── Card / row ─────────────────────────────────────────────────────────────

function QueueCard({ item, onClick, onAction, busy }) {
  const badge = statusBadge(item.status);
  const Badge = badge.icon;
  const q = item.quote || {};
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
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="mono inline-flex items-center gap-1 text-[9.5px] px-1.5 py-px rounded-sm tracking-wider"
              style={{
                background: `${badge.color}1A`,
                border: `1px solid ${badge.color}40`,
                color: badge.color,
              }}
            >
              <Badge size={9} />
              {badge.label.toUpperCase()}
            </span>
            {q.printer_name && (
              <span className="mono text-[9.5px] text-gunmetal">· {q.printer_name}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {q.piece_name || item.notes || `Item #${item.id}`}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">
            {q.weight_grams != null ? `${Number(q.weight_grams).toFixed(0)}g` : '—'} ·{' '}
            {q.print_time_hours != null ? `${Number(q.print_time_hours).toFixed(1)}h` : '—'}
            {q.total_price != null ? ` · ${fmtCOP(q.total_price)}` : ''}
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
  const Badge = badge.icon;
  const q = item.quote || {};
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
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="mono inline-flex items-center gap-0.5 text-[9.5px] px-1 py-px rounded-sm"
            style={{
              background: `${badge.color}1A`,
              border: `1px solid ${badge.color}40`,
              color: badge.color,
            }}
          >
            <Badge size={9} />
            {badge.label.toUpperCase()}
          </span>
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">
          {q.piece_name || item.notes || `Item #${item.id}`}
        </p>
        <p className="mono text-[10px] text-gunmetal mt-0.5 truncate">
          {q.printer_name || '—'} · {q.weight_grams != null ? `${Number(q.weight_grams).toFixed(0)}g` : '—'} ·{' '}
          {q.print_time_hours != null ? `${Number(q.print_time_hours).toFixed(1)}h` : '—'}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

function QueueDrawerBody({ item, onAction, onDelete, onClose }) {
  if (!item) return null;
  const badge = statusBadge(item.status);
  const Badge = badge.icon;
  const q = item.quote || {};
  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="mono inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm tracking-wider"
            style={{
              background: `${badge.color}1A`,
              border: `1px solid ${badge.color}40`,
              color: badge.color,
            }}
          >
            <Badge size={11} />
            {badge.label.toUpperCase()}
          </span>
          <span className="mono text-[10px] text-gunmetal">
            posición #{item.position ?? '—'}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-tech-white truncate">
          {q.piece_name || item.notes || `Item #${item.id}`}
        </h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5">{fmtDate(item.created_at)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Impresora</span>
          <p className="text-sm text-tech-white mt-0.5 truncate">{q.printer_name || '—'}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Tiempo</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {q.print_time_hours != null ? `${Number(q.print_time_hours).toFixed(2)} h` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Peso</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {q.weight_grams != null ? `${Number(q.weight_grams).toFixed(0)} g` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Cantidad</span>
          <p className="mono text-sm text-tech-white mt-0.5">{q.quantity ?? 1}</p>
        </Card>
      </div>

      {q.total_price != null && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Precio cotización</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">
            {fmtCOP(q.total_price)}
          </p>
        </Card>
      )}

      {item.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{item.notes}</p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        {item.status === 'pending' && (
          <Button variant="ghost" icon={Play} onClick={() => onAction(item, 'printing')}>
            Iniciar
          </Button>
        )}
        {(item.status === 'pending' || item.status === 'printing') && (
          <>
            <Button variant="primary" icon={CheckCircle2} onClick={() => onAction(item, 'done')} className="flex-1">
              Marcar listo
            </Button>
            <Button
              variant="ghost"
              icon={XCircle}
              onClick={() => onAction(item, 'cancelled')}
              className="text-rose-400 hover:text-rose-300"
            >
              Cancelar
            </Button>
          </>
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
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QueuePageV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();

  const [tab, setTab] = useState('activa');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const [a, h] = await Promise.allSettled([getQueue(), getQueueHistory()]);
    if (a.status === 'fulfilled') setActive(a.value.data || []);
    if (h.status === 'fulfilled') setHistory(h.value.data || []);
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
      const h = Number(it?.quote?.print_time_hours || 0);
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

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...active].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (!q) return sorted;
    return sorted.filter(
      (i) =>
        (i.quote?.piece_name || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.quote?.printer_name || '').toLowerCase().includes(q),
    );
  }, [active, query]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...history].sort(
      (a, b) =>
        new Date(b.completed_at || b.created_at).getTime() -
        new Date(a.completed_at || a.created_at).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter(
      (i) =>
        (i.quote?.piece_name || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q),
    );
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
        ) : (
          <ul className="mt-3 pb-28">
            {(tab === 'activa' ? filteredActive : filteredHistory).map((it) => (
              <li key={it.id}>
                <QueueRow item={it} onClick={setSelected} />
              </li>
            ))}
            {(tab === 'activa' ? filteredActive : filteredHistory).length === 0 && (
              <li className="px-4 py-12 text-center text-gunmetal text-sm">
                {tab === 'activa' ? 'Cola vacía' : 'Sin historial'}
              </li>
            )}
          </ul>
        )}
        <button
          type="button"
          onClick={() => navigate('/cost/quotes')}
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
          title={selected ? `#${selected.position ?? '—'}` : ''}
          height="full"
        >
          <QueueDrawerBody
            item={selected}
            onAction={handleAction}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        </MobileSheet>
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
          <Link to="/cost/quotes" className="btn btn-primary btn-sm">
            <Plus size={13} /> Agregar a cola
          </Link>
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
          {(tab === 'activa' ? filteredActive : filteredHistory).length === 0 && (
            <div className="col-span-full px-6 py-16 flex flex-col items-center gap-3 text-center">
              <Printer size={28} className="text-gunmetal-dim" />
              <p className="text-sm font-semibold text-tech-white">
                {tab === 'activa' ? 'Cola vacía' : 'Sin historial'}
              </p>
              {tab === 'activa' && (
                <Link to="/cost/quotes" className="btn btn-primary btn-sm">
                  <Plus size={13} /> Agregar a cola
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Cola #${selected.position ?? '—'}` : ''}
        width={460}
      >
        <QueueDrawerBody
          item={selected}
          onAction={handleAction}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      </DetailDrawer>

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
