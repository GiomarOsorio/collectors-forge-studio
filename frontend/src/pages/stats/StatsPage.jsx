/**
 * @file Página de la app Stats — dashboard de analytics de impresión y
 * costos (issue #132).
 *
 * KPIs (tasa de éxito, horas, gramos, costos) + selector de rango de
 * fechas (mismos presets que `PrintLogPage`, issue #131) + bucket de
 * tendencias (día/semana/mes) + secciones: tendencias (LineChart),
 * gramos por filamento (BarChart), por impresora (BarChart), fallos por
 * categoría (BarChart). Export CSV de overview y de tendencias.
 *
 * Gráficas: SVG propio (`components/ui/BarChart`, `LineChart`) — cero
 * dependencias externas, ver decisión en el doc local de #132.
 *
 * @module pages/stats/StatsPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock, Coins, Download, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Card, EmptyState, KPI, LineChart } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
  downloadStatsOverviewCsv,
  downloadStatsTrendsCsv,
  getStatsOverview,
  getStatsTrends,
} from '../../services/api';

const ACCENT = '#06B6D4';

const DATE_PRESETS = ['Semana', 'Mes', 'Año', 'Todo'];
const BUCKET_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

function localISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetToRange(preset) {
  const today = new Date();
  if (preset === 'Todo') return { date_from: '', date_to: '' };
  const daysByPreset = { Semana: 6, Mes: 29, Año: 364 };
  const from = new Date(today);
  from.setDate(from.getDate() - daysByPreset[preset]);
  return { date_from: localISODate(from), date_to: localISODate(today) };
}

const fmtGrams = (g) => `${(g / 1000).toFixed(2)}kg`;
const fmtHours = (h) => `${h.toFixed(1)}h`;
const fmtCop = (v) => `$${Math.round(v).toLocaleString('es-CO')}`;

export default function StatsPage() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};

  const [activePreset, setActivePreset] = useState('Mes');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bucket, setBucket] = useState('day');
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const range = presetToRange(activePreset);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
  }, [activePreset]);

  const dateParams = useMemo(
    () => ({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    [dateFrom, dateTo],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getStatsOverview(dateParams),
      getStatsTrends({ ...dateParams, bucket }),
    ])
      .then(([o, t]) => {
        if (cancelled) return;
        if (o.status === 'fulfilled') setOverview(o.value.data);
        if (t.status === 'fulfilled') setTrends(t.value.data);
        if (o.status === 'rejected' || t.status === 'rejected') {
          toast.error('No se pudieron cargar las estadísticas');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateParams, bucket]);

  const handleExportOverview = async () => {
    setExporting(true);
    try {
      await downloadStatsOverviewCsv(dateParams);
    } catch {
      toast.error('No se pudo exportar el overview');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTrends = async () => {
    setExporting(true);
    try {
      await downloadStatsTrendsCsv({ ...dateParams, bucket });
    } catch {
      toast.error('No se pudo exportar las tendencias');
    } finally {
      setExporting(false);
    }
  };

  const trendPrintsData = (trends?.series || []).map((p) => ({
    label: p.bucket_start,
    value: p.prints_done,
  }));
  const gramsData = (overview?.grams_by_filament_type || []).map((e) => ({
    label: e.filament_type,
    value: e.grams,
  }));
  const printerData = (overview?.by_printer || []).map((e) => ({
    label: e.printer_name,
    value: e.prints,
  }));
  const failureData = (overview?.failure_breakdown || []).map((e) => ({
    label: e.category,
    value: e.count,
  }));

  const HeaderControls = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActivePreset(p)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              activePreset === p
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-transparent border-[var(--color-border)] text-steel'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <select
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2 py-1 text-tech-white text-xs focus:outline-none focus:border-cyan-500"
        aria-label="Agrupar tendencias por"
      >
        {BUCKET_OPTIONS.map((b) => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
    </>
  );

  const content = loading ? (
    <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando estadísticas…</p>
  ) : !overview || overview.prints_done + overview.prints_cancelled === 0 ? (
    <EmptyState
      icon={BarChart3}
      accent={ACCENT}
      title="Sin datos en el rango seleccionado"
      hint="Cuando haya impresiones marcadas como listas o canceladas en este rango, aparecerán aquí las métricas."
    />
  ) : (
    <div className="flex flex-col gap-4 px-4 md:px-6 pt-4 pb-8">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px] flex">
          <KPI
            label="Tasa de éxito"
            value={`${Number(overview.success_rate_pct).toFixed(1)}%`}
            sub={`${overview.prints_done} listas · ${overview.prints_cancelled} canceladas`}
            accent={overview.success_rate_pct >= 80 ? '#34D399' : '#FBBF24'}
            icon={CheckCircle2}
          />
        </div>
        <div className="flex-1 min-w-[160px] flex">
          <KPI label="Horas de impresión" value={fmtHours(Number(overview.total_hours))} accent={ACCENT} icon={Clock} />
        </div>
        <div className="flex-1 min-w-[160px] flex">
          <KPI
            label="Filamento consumido"
            value={fmtGrams(overview.grams_by_filament_type.reduce((s, e) => s + Number(e.grams), 0))}
            accent="#3B82F6"
            icon={TrendingUp}
          />
        </div>
        <div className="flex-1 min-w-[160px] flex">
          <KPI
            label="Costo material + electricidad"
            value={fmtCop(Number(overview.material_cost_cop) + Number(overview.electricity_cost_cop))}
            accent="#F59E0B"
            icon={Coins}
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="lbl-eyebrow">Tendencias</span>
          <button
            type="button"
            onClick={handleExportTrends}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-xs text-gunmetal hover:text-tech-white disabled:opacity-40"
          >
            <Download size={12} /> CSV
          </button>
        </div>
        <LineChart data={trendPrintsData} accent={ACCENT} formatValue={(v) => `${v} prints`} />
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        <Card className="p-4">
          <span className="lbl-eyebrow block mb-3">Gramos por filamento</span>
          <BarChart data={gramsData} accent="#3B82F6" formatValue={(v) => `${v.toFixed(0)}g`} />
        </Card>
        <Card className="p-4">
          <span className="lbl-eyebrow block mb-3">Por impresora</span>
          <BarChart data={printerData} accent={ACCENT} formatValue={(v) => `${v}`} />
        </Card>
        <Card className="p-4">
          <span className="lbl-eyebrow block mb-3">Fallos por categoría</span>
          <BarChart data={failureData} accent="#F87171" formatValue={(v) => `${v}`} />
        </Card>
        <Card className="p-4">
          <span className="lbl-eyebrow block mb-3">Por usuario</span>
          <BarChart
            data={(overview.by_user || []).map((e) => ({ label: e.username, value: e.prints }))}
            accent="#8B5CF6"
            formatValue={(v) => `${v}`}
          />
        </Card>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExportOverview}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 text-xs text-gunmetal hover:text-tech-white disabled:opacity-40"
        >
          <Download size={12} /> Exportar overview CSV
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader appName="Stats" appIcon={BarChart3} appAccent={ACCENT} title="Dashboard" onMenu={() => openSidebar?.()} />
        <div className="px-4 mt-3 flex flex-col gap-2">{HeaderControls}</div>
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex flex-wrap items-center gap-3 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <BarChart3 size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Stats</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Dashboard</span>
        </div>
        {HeaderControls}
      </header>
      {content}
    </div>
  );
}
