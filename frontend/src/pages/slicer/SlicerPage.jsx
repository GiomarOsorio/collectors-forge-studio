/**
 * @file Página rediseñada del Slicer (Claude Design port — Día 5).
 *
 * Dos pestañas:
 *  - Subir: 3 tarjetas grandes con los flujos disponibles (.3mf/.gcode,
 *    STL → OrcaSlicer, MakerWorld URL). Cada tarjeta lleva al uploader actual
 *    en `/slicer/upload`.
 *  - Historial: grid de jobs con metadata (filamento, tiempo, peso, status,
 *    dimensiones). Click → DetailDrawer/MobileSheet con plates breakdown.
 *
 * Reusa primitives de `components/ui/`. Desktop y mobile comparten estado.
 *
 * @module pages/slicer/SlicerPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Box,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  FileBox,
  Globe,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, KPI, MobileSheet } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import { deleteSlicingJob, getSlicingJobs } from '../../services/api';

const TABS = [
  { id: 'subir',     label: 'Subir',     icon: Upload },
  { id: 'historial', label: 'Historial', icon: Layers },
];

const ACCENT = '#F59E0B'; // app-slicer

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtTime = (seconds) => {
  if (!seconds || !Number.isFinite(Number(seconds))) return '—';
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
};

const fmtWeight = (g) => {
  if (!g || !Number.isFinite(Number(g))) return '—';
  const v = Number(g);
  if (v >= 1000) return `${(v / 1000).toFixed(2)} kg`;
  return `${Math.round(v)} g`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Mapea status del backend a etiqueta + esquema de color.
 *
 * @param {string} status
 */
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'success') {
    return { label: 'Listo', color: '#34D399', icon: CheckCircle2 };
  }
  if (s === 'failed' || s === 'error') {
    return { label: 'Falló', color: '#F87171', icon: AlertTriangle };
  }
  if (s === 'pending' || s === 'processing' || s === 'queued' || s === 'running') {
    return { label: 'Procesando', color: '#FBBF24', icon: Loader2 };
  }
  return { label: status || '—', color: '#94A0AE', icon: Clock };
}

/**
 * Devuelve el ícono de la fuente del job: .gcode/.3mf, STL, MakerWorld.
 */
function sourceMeta(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('makerworld')) return { icon: Globe, label: 'MakerWorld' };
  if (s.includes('stl')) return { icon: Box, label: 'STL' };
  return { icon: FileBox, label: '.3mf / .gcode' };
}

// ─── KPI strip ──────────────────────────────────────────────────────────────

function KPIStrip({ stats }) {
  return (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Total jobs"
          value={stats.total}
          unit="docs"
          sub={`${stats.completed} completados`}
          accent={ACCENT}
          icon={Layers}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Jobs hoy"
          value={stats.today}
          unit="hoy"
          sub={`${stats.last7} en últimos 7 días`}
          accent="#3B82F6"
          icon={Clock}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Tiempo acumulado"
          value={fmtTime(stats.totalSeconds)}
          sub="impresión laminada"
          accent="#94A0AE"
          icon={Clock}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Material laminado"
          value={fmtWeight(stats.totalGrams)}
          sub={stats.failed > 0 ? `${stats.failed} fallidos` : 'sin fallos'}
          accent="#2DD4BF"
          icon={Box}
        />
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function SlicerTabs({ value, onChange, counts }) {
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
            style={active ? { borderColor: ACCENT } : undefined}
          >
            <Icon size={13} style={active ? { color: ACCENT } : { color: '#7A8494' }} />
            {t.label}
            {counts[t.id] != null && (
              <span
                className={`mono text-[10px] px-1.5 py-px rounded-full border ${
                  active
                    ? 'bg-amber-500/14 border-amber-500/30 text-amber-300'
                    : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
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

// ─── Subir: 3 flow cards ────────────────────────────────────────────────────

function UploadFlowCards() {
  const flows = [
    {
      to: '/slicer/upload',
      icon: FileBox,
      title: '.3mf / .gcode',
      desc: 'Sube un archivo ya laminado y se parsea al instante: tiempo, peso, filamento, dimensiones. Si trae plate render embebido lo extraemos y se muestra en Vault.',
      tag: 'Inmediato',
      tagColor: '#2DD4BF',
    },
    {
      to: '/slicer/upload',
      icon: Box,
      title: 'STL',
      desc: 'Lamina con OrcaSlicer en background. Se procesa en cola y aparece en historial cuando termina (~30-90s típico). Ideal para diseños propios.',
      tag: 'Background',
      tagColor: '#FBBF24',
    },
    {
      to: '/slicer/upload',
      icon: Globe,
      title: 'MakerWorld URL',
      desc: 'Pega un link de MakerWorld y se descarga + parsea automáticamente. Trae metadata del modelo (creator, thumbnail, descripción).',
      tag: 'Auto-fetch',
      tagColor: '#3B82F6',
    },
  ];
  return (
    <div className="px-6 pt-4 pb-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {flows.map((f) => {
        const Icon = f.icon;
        return (
          <Link key={f.title} to={f.to} className="block">
            <Card interactive className="p-5 h-full flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
                  style={{
                    background: `${f.tagColor}1A`,
                    color: f.tagColor,
                    border: `1px solid ${f.tagColor}40`,
                  }}
                >
                  <Icon size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-tech-white">{f.title}</h3>
                  <span
                    className="mono text-[10px] px-1.5 py-px rounded-sm tracking-wider mt-1 inline-block"
                    style={{
                      background: `${f.tagColor}1A`,
                      border: `1px solid ${f.tagColor}40`,
                      color: f.tagColor,
                    }}
                  >
                    {f.tag}
                  </span>
                </div>
              </div>
              <p className="text-sm text-steel leading-snug">{f.desc}</p>
              <span className="mt-auto text-xs text-amber-400 inline-flex items-center gap-1 font-medium">
                Iniciar flujo <ChevronRight size={12} />
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Job card (historial) ───────────────────────────────────────────────────

function JobCard({ job, onClick }) {
  const badge = statusBadge(job.status);
  const Badge = badge.icon;
  const src = sourceMeta(job.source);
  const SrcIcon = src.icon;
  const platesCount = Array.isArray(job.plates_data) ? job.plates_data.length : 0;
  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(job)}
      className="text-left w-full p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          style={{
            background: `${ACCENT}1A`,
            color: ACCENT,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          <SrcIcon size={16} />
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
              <Badge size={9} className={badge.label === 'Procesando' ? 'animate-spin' : ''} />
              {badge.label.toUpperCase()}
            </span>
            <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {src.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {job.original_filename || job.makerworld_url || `Job #${job.id}`}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">{fmtDate(job.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <div className="flex flex-col">
          <span className="lbl-eyebrow text-[9px]">Tiempo</span>
          <span className="mono text-tech-white">{fmtTime(job.print_time_seconds)}</span>
        </div>
        <div className="flex flex-col">
          <span className="lbl-eyebrow text-[9px]">Peso</span>
          <span className="mono text-tech-white">{fmtWeight(job.filament_weight_g)}</span>
        </div>
        <div className="flex flex-col">
          <span className="lbl-eyebrow text-[9px]">Material</span>
          <span className="mono text-tech-white truncate">{job.filament_type || '—'}</span>
        </div>
      </div>

      {platesCount > 1 && (
        <span className="absolute top-3 right-3 mono text-[9.5px] text-gunmetal">
          {platesCount} placas
        </span>
      )}
    </Card>
  );
}

// ─── Job row mobile ─────────────────────────────────────────────────────────

function JobRow({ job, onClick }) {
  const badge = statusBadge(job.status);
  const Badge = badge.icon;
  const src = sourceMeta(job.source);
  const SrcIcon = src.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(job)}
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
        <SrcIcon size={15} />
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
            <Badge size={9} className={badge.label === 'Procesando' ? 'animate-spin' : ''} />
            {badge.label.toUpperCase()}
          </span>
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">
          {job.original_filename || job.makerworld_url || `Job #${job.id}`}
        </p>
        <p className="mono text-[10px] text-gunmetal mt-0.5">
          {fmtTime(job.print_time_seconds)} · {fmtWeight(job.filament_weight_g)} · {job.filament_type || '—'}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

function JobDrawerBody({ job, onDelete, onClose }) {
  const navigate = useNavigate();
  if (!job) return null;
  const badge = statusBadge(job.status);
  const Badge = badge.icon;
  const plates = Array.isArray(job.plates_data) ? job.plates_data : [];

  const useInCalculator = () => {
    const w = job.filament_weight_g;
    const t = (job.print_time_seconds || 0) / 3600;
    const params = new URLSearchParams();
    if (w) params.set('weight_grams', String(w));
    if (t) params.set('print_time_hours', String(t));
    if (job.filament_type) params.set('filament_type', job.filament_type);
    navigate(`/cost/calculator?${params.toString()}`);
  };

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Hero */}
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
            <Badge size={11} className={badge.label === 'Procesando' ? 'animate-spin' : ''} />
            {badge.label.toUpperCase()}
          </span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
            {sourceMeta(job.source).label}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-tech-white truncate">
          {job.original_filename || job.makerworld_url || `Job #${job.id}`}
        </h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5">{fmtDate(job.created_at)}</p>
        {job.error_message && (
          <p className="text-xs text-rose-400 mt-2 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/20">
            {job.error_message}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Tiempo total</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">
            {fmtTime(job.print_time_seconds)}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Peso filamento</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">
            {fmtWeight(job.filament_weight_g)}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Material</span>
          <p className="mono text-sm text-tech-white mt-0.5">{job.filament_type || '—'}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Layer height</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {job.layer_height_mm ? `${Number(job.layer_height_mm).toFixed(2)} mm` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Boquilla</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {job.nozzle_temp ? `${job.nozzle_temp} °C` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Cama</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {job.bed_temp ? `${job.bed_temp} °C` : '—'}
          </p>
        </Card>
      </div>

      {/* Dimensiones */}
      {(job.model_x_mm || job.model_y_mm || job.model_z_mm) && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Dimensiones (X · Y · Z)</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {Number(job.model_x_mm || 0).toFixed(1)} × {Number(job.model_y_mm || 0).toFixed(1)} ×{' '}
            {Number(job.model_z_mm || 0).toFixed(1)} mm
          </p>
        </Card>
      )}

      {/* Plates */}
      {plates.length > 0 && (
        <div>
          <span className="lbl-eyebrow text-[9px]">Placas ({plates.length})</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {plates.map((p) => (
              <li
                key={p.plate_number}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-tech-white">Placa {p.plate_number}</p>
                  <p className="mono text-[11px] text-gunmetal">
                    {fmtTime(p.print_time_seconds)} · {fmtWeight(p.filament_weight_g)}
                  </p>
                </div>
                {Array.isArray(p.filaments) && p.filaments.length > 0 && (
                  <span className="mono text-[10px] text-gunmetal shrink-0">
                    {p.filaments.length} filamento{p.filaments.length === 1 ? '' : 's'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <Button variant="primary" icon={Calculator} onClick={useInCalculator} className="flex-1">
          Usar en Calculadora
        </Button>
        <Link to={`/slicer/jobs/${job.id}`} className="btn btn-ghost btn-sm">
          Ver detalle completo
        </Link>
        <Button
          variant="ghost"
          icon={Trash2}
          onClick={async () => {
            const ok = await onDelete(job);
            if (ok) onClose();
          }}
          className="text-rose-400 hover:text-rose-300"
          aria-label="Eliminar job"
        />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SlicerPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const confirm = useConfirm();

  const [tab, setTab] = useState('historial');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all|completed|failed|processing
  const [selected, setSelected] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getSlicingJobs();
      // Backend puede retornar { items, total } o el array directo.
      const list = Array.isArray(res?.data) ? res.data : res?.data?.items || [];
      setJobs(list);
    } catch {
      toast.error('No se pudo cargar el historial de slicer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const cutoff7 = now.getTime() - 7 * 86_400_000;
    let totalSeconds = 0;
    let totalGrams = 0;
    let completed = 0;
    let failed = 0;
    let today = 0;
    let last7 = 0;
    for (const j of jobs) {
      totalSeconds += Number(j.print_time_seconds || 0);
      totalGrams += Number(j.filament_weight_g || 0);
      const s = (j.status || '').toLowerCase();
      if (['completed', 'done', 'success'].includes(s)) completed += 1;
      if (['failed', 'error'].includes(s)) failed += 1;
      const t = new Date(j.created_at).getTime();
      if (Number.isFinite(t)) {
        if (t >= todayStart) today += 1;
        if (t >= cutoff7) last7 += 1;
      }
    }
    return { total: jobs.length, completed, failed, today, last7, totalSeconds, totalGrams };
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (statusFilter !== 'all') {
      const targets = {
        completed: ['completed', 'done', 'success'],
        failed: ['failed', 'error'],
        processing: ['pending', 'processing', 'queued', 'running'],
      }[statusFilter];
      list = list.filter((j) => targets.includes((j.status || '').toLowerCase()));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (j) =>
          (j.original_filename || '').toLowerCase().includes(q) ||
          (j.makerworld_url || '').toLowerCase().includes(q) ||
          (j.filament_type || '').toLowerCase().includes(q),
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [jobs, statusFilter, query]);

  const counts = { subir: null, historial: jobs.length };

  const handleDelete = async (j) => {
    const ok = await confirm('¿Eliminar este job de slicer?', 'Eliminar');
    if (!ok) return false;
    try {
      await deleteSlicingJob(j.id);
      toast.success('Job eliminado');
      setJobs((cur) => cur.filter((x) => x.id !== j.id));
      return true;
    } catch {
      toast.error('No se pudo eliminar');
      return false;
    }
  };

  const STATUS_CHIPS = [
    { id: 'all',        label: 'Todos' },
    { id: 'completed',  label: 'Listos' },
    { id: 'processing', label: 'Procesando' },
    { id: 'failed',     label: 'Fallidos' },
  ];

  // ── Mobile shell ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col -mx-4 -mt-4">
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-3 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Slicer · resumen</span>
              <span className="mono text-[10px] text-gunmetal">{stats.total} jobs</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="mono text-3xl font-semibold text-tech-white tracking-tight">
                {fmtTime(stats.totalSeconds).replace('h ', 'h ')}
              </span>
              <span className="mono text-sm text-gunmetal">acumulado</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="lbl-eyebrow text-[9px]">Material</span>
                <p className="mono text-sm text-tech-white mt-0.5">{fmtWeight(stats.totalGrams)}</p>
              </div>
              <div>
                <span className="lbl-eyebrow text-[9px]">Hoy</span>
                <p className="mono text-sm text-tech-white mt-0.5">
                  {stats.today} <span className="text-gunmetal text-[10px]">jobs</span>
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
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
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

        {tab === 'subir' ? (
          <UploadFlowCards />
        ) : (
          <>
            <div className="px-4 mt-3">
              <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
                <Search size={14} className="text-gunmetal" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Archivo, URL, material…"
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

            <div className="mt-2 px-4 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
              {STATUS_CHIPS.map((c) => {
                const active = c.id === statusFilter;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setStatusFilter(c.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
                      active
                        ? 'bg-amber-500/12 border-amber-500/45 text-amber-300'
                        : 'bg-transparent border-[var(--color-border)] text-steel'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando jobs…</p>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
                <Layers size={22} className="text-gunmetal-dim" />
                <p className="text-sm font-semibold text-tech-white">
                  {jobs.length === 0 ? 'Aún no hay jobs' : 'Sin resultados'}
                </p>
                <p className="text-xs text-gunmetal max-w-xs">
                  {jobs.length === 0
                    ? 'Toca + para subir tu primer modelo.'
                    : 'Cambia el filtro o limpia la búsqueda.'}
                </p>
              </div>
            ) : (
              <ul className="mt-3 pb-28">
                {filtered.map((j) => (
                  <li key={j.id}>
                    <JobRow job={j} onClick={setSelected} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => navigate('/slicer/upload')}
          className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
          style={{
            background: ACCENT,
            color: '#0A1014',
            boxShadow: `0 8px 24px ${ACCENT}55`,
          }}
          aria-label="Subir modelo"
        >
          <Plus size={16} strokeWidth={2.5} />
          Subir
        </button>

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected ? `Job #${selected.id}` : ''}
          height="full"
        >
          <JobDrawerBody
            job={selected}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        </MobileSheet>
      </div>
    );
  }

  // ── Desktop shell ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{
              background: `${ACCENT}1F`,
              color: ACCENT,
              border: `1px solid ${ACCENT}40`,
            }}
          >
            <Cpu size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Slicer</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">
            {tab}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cost/calculator" className="btn btn-ghost btn-sm">
            <Calculator size={13} /> Ir a calculadora
          </Link>
          <span className="w-px h-4 bg-[var(--color-border)]" />
          <Link to="/slicer/upload" className="btn btn-primary btn-sm">
            <Upload size={13} /> Subir modelo
          </Link>
        </div>
      </header>

      <KPIStrip stats={stats} />

      <SlicerTabs value={tab} onChange={setTab} counts={counts} />

      {tab === 'subir' ? (
        <UploadFlowCards />
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
              <Search size={13} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Archivo, URL MakerWorld, material…"
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
            <div className="flex gap-1.5 items-center flex-wrap">
              <span className="lbl-eyebrow mr-1">Estado</span>
              {STATUS_CHIPS.map((c) => {
                const active = c.id === statusFilter;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setStatusFilter(c.id)}
                    className={`chip ${active ? 'chip-active' : ''}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filtered.length} de {jobs.length} jobs
            </span>
          </div>

          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando jobs…</p>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: `${ACCENT}1A`,
                  border: `1px solid ${ACCENT}40`,
                  color: ACCENT,
                }}
              >
                <Layers size={22} />
              </div>
              <p className="text-sm font-semibold text-tech-white">
                {jobs.length === 0 ? 'Aún no hay jobs' : 'Sin resultados'}
              </p>
              <p className="text-xs text-gunmetal max-w-sm">
                {jobs.length === 0
                  ? 'Sube tu primer modelo para empezar a usarlo en la calculadora.'
                  : 'Cambia el filtro o limpia la búsqueda.'}
              </p>
              {jobs.length === 0 && (
                <Link to="/slicer/upload" className="btn btn-primary btn-sm">
                  <Upload size={13} /> Subir modelo
                </Link>
              )}
            </div>
          ) : (
            <div
              className="px-6 pb-8 grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {filtered.map((j) => (
                <JobCard key={j.id} job={j} onClick={setSelected} />
              ))}
            </div>
          )}
        </div>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Job #${selected.id}` : ''}
        width={460}
      >
        <JobDrawerBody
          job={selected}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      </DetailDrawer>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 6px #34D39966' }}
          />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{stats.total} jobs</span>
        <span className="mono">{fmtTime(stats.totalSeconds)} laminado</span>
        <span className="mono">{fmtWeight(stats.totalGrams)}</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
