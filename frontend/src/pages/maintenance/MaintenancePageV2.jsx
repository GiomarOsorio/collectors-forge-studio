/**
 * @file Página rediseñada de la app Mantenimiento (Claude Design port — Día 7).
 *
 * Tres pestañas:
 *  - Dashboard: tarjetas por impresora con badges 🟢🟡🔴 por tipo de mantto.
 *  - Logs: lista cronológica de registros con buscador.
 *  - Impresoras: link a la gestión de impresoras antigua.
 *
 * Lee summary `/api/maintenance/summary/` y logs `/api/maintenance/logs/`.
 *
 * @module pages/maintenance/MaintenancePageV2
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Plus,
  Printer,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, KPI, MobileSheet } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getMaintenanceLogs, getMaintenanceSummary } from '../../services/api';
import { MAINTENANCE_TYPES } from '../../config/maintenance';

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

  let critical = 0;
  let warning = 0;
  let ok = 0;
  let unknown = 0;
  const tipoLevels = tipos.map((t) => {
    const last = lastPerType[t.value];
    const lvl = last ? maintLevel(t.value, last.hours_since) : 'unknown';
    if (lvl === 'critical') critical += 1;
    else if (lvl === 'warning') warning += 1;
    else if (lvl === 'unknown') unknown += 1;
    else ok += 1;
    return { tipo: t, last, level: lvl };
  });

  const overallLevel = critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'ok';
  const overallColor = LEVEL_DOT[overallLevel].color;

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
            <span
              className="mono inline-flex items-center gap-1 text-[9.5px] px-1.5 py-px rounded-sm tracking-wider"
              style={{
                background: `${overallColor}1A`,
                border: `1px solid ${overallColor}40`,
                color: overallColor,
              }}
            >
              {overallLevel === 'critical' && <AlertTriangle size={9} />}
              {overallLevel === 'ok' && <CheckCircle2 size={9} />}
              {overallLevel === 'critical' ? 'CRÍTICO' : overallLevel === 'warning' ? 'PRONTO' : 'OK'}
            </span>
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

function PrinterDrawerBody({ entry, onClose }) {
  if (!entry) return null;
  const printer = entry.printer || {};
  const lastPerType = entry.last_per_type || {};
  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-tech-white">{printer.name}</h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5">
          {printer.model || '—'} · {Number(printer.current_hours || 0).toFixed(0)}h
        </p>
      </div>

      <div>
        <span className="lbl-eyebrow text-[9px]">Mantenimientos por tipo</span>
        <ul className="mt-2 flex flex-col gap-1.5">
          {MAINTENANCE_TYPES.map((t) => {
            const last = lastPerType[t.value];
            const lvl = last ? maintLevel(t.value, last.hours_since) : 'unknown';
            const dot = LEVEL_DOT[lvl];
            return (
              <li
                key={t.value}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <span style={{ color: dot.color }} className="text-base">
                  {dot.label}
                </span>
                <div className="flex-1 min-w-0">
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

      <Link to={`/maintenance/logs?printer=${printer.id || ''}`} className="btn btn-primary btn-sm self-start">
        <Plus size={13} /> Registrar mantenimiento
      </Link>
    </div>
  );
}

function LogDrawerBody({ log }) {
  if (!log) return null;
  const tipo = TYPE_BY_VALUE[log.maintenance_type] || { label: log.maintenance_type || '—' };
  const items = Array.isArray(log.items) ? log.items : [];
  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-tech-white">{tipo.label}</h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5">
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
      {tipo.wiki_url && (
        <a href={tipo.wiki_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm self-start">
          Ver wiki BambuLab
        </a>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MaintenancePageV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [tab, setTab] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getMaintenanceSummary(), getMaintenanceLogs()]).then(([s, l]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setSummary(s.value.data || []);
      if (l.status === 'fulfilled') setLogs(l.value.data || []);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      toast.error('No se pudo cargar mantenimiento');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

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
    return (
      <div className="flex flex-col -mx-4 -mt-4">
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
          ) : (
            <div className="px-4 mt-3 pb-28 flex flex-col gap-2">
              {summary.map((entry) => (
                <PrinterCard key={entry.printer.id} entry={entry} onClick={setSelectedPrinter} />
              ))}
              {summary.length === 0 && (
                <p className="px-4 py-12 text-center text-gunmetal text-sm">Sin impresoras registradas</p>
              )}
            </div>
          )
        ) : (
          <>
            <div className="px-4 mt-3">
              <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
                <Search size={14} className="text-gunmetal" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tipo, impresora, notas…"
                  className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
                />
              </div>
            </div>
            <ul className="mt-3 pb-28">
              {filteredLogs.map((l) => (
                <li key={l.id}>
                  <LogRow log={l} onClick={setSelectedLog} />
                </li>
              ))}
              {filteredLogs.length === 0 && (
                <li className="px-4 py-12 text-center text-gunmetal text-sm">Sin registros</li>
              )}
            </ul>
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/maintenance/logs')}
          className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
          style={{ background: ACCENT, color: '#0A1014', boxShadow: `0 8px 24px ${ACCENT}55` }}
          aria-label="Registrar mantenimiento"
        >
          <Plus size={16} strokeWidth={2.5} />
          Registrar
        </button>
        <MobileSheet open={!!selectedPrinter} onClose={() => setSelectedPrinter(null)} title={selectedPrinter?.printer?.name || ''} height="full">
          <PrinterDrawerBody entry={selectedPrinter} onClose={() => setSelectedPrinter(null)} />
        </MobileSheet>
        <MobileSheet open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Log" height="full">
          <LogDrawerBody log={selectedLog} />
        </MobileSheet>
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
          <Link to="/maintenance/printers" className="btn btn-ghost btn-sm">
            <Printer size={13} /> Impresoras
          </Link>
          <span className="w-px h-4 bg-[var(--color-border)]" />
          <Link to="/maintenance/logs" className="btn btn-primary btn-sm">
            <Plus size={13} /> Registrar
          </Link>
        </div>
      </header>

      {KPIs}
      {TabsBar}

      {tab === 'dashboard' ? (
        loading ? (
          <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando dashboard…</p>
        ) : summary.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
            <Printer size={28} className="text-gunmetal-dim" />
            <p className="text-sm font-semibold text-tech-white">Sin impresoras registradas</p>
            <Link to="/maintenance/printers" className="btn btn-primary btn-sm">
              Configurar impresoras
            </Link>
          </div>
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
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filteredLogs.length} de {logs.length} logs
            </span>
          </div>
          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando logs…</p>
          ) : (
            <div className="px-6 pb-8 border border-[var(--color-border)] rounded-xl mx-6 overflow-hidden bg-[var(--color-surf-card)]">
              <ul>
                {filteredLogs.map((l) => (
                  <li key={l.id}>
                    <LogRow log={l} onClick={setSelectedLog} />
                  </li>
                ))}
                {filteredLogs.length === 0 && (
                  <li className="px-4 py-12 text-center text-gunmetal text-sm">Sin registros</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <DetailDrawer
        open={!!selectedPrinter}
        onClose={() => setSelectedPrinter(null)}
        title={selectedPrinter?.printer?.name || ''}
        width={460}
      >
        <PrinterDrawerBody entry={selectedPrinter} onClose={() => setSelectedPrinter(null)} />
      </DetailDrawer>

      <DetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Log de mantenimiento"
        width={460}
      >
        <LogDrawerBody log={selectedLog} />
      </DetailDrawer>

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
