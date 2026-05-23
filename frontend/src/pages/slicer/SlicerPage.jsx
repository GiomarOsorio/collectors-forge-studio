/**
 * @file Página de la app Slicer.
 *
 * Dos pestañas:
 *  - Subir: 3 tarjetas grandes con los flujos disponibles (.3mf/.gcode,
 *    STL → OrcaSlicer, MakerWorld URL).
 *  - Historial: grid de jobs con metadata (filamento, tiempo, peso, status,
 *    dimensiones). Click → DetailDrawer/MobileSheet con plates breakdown.
 *
 * Desktop y mobile comparten estado.
 *
 * @module pages/slicer/SlicerPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
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
import {
  Button,
  Card,
  DetailDrawer,
  DropZone,
  EmptyState,
  KPI,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  deleteSlicingJob,
  fetchMakerworld,
  getInventoryFilaments,
  getSlicingJobs,
  uploadGcode,
  uploadStl,
} from '../../services/api';

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
 * Mapea status del backend a metadata para `StatusPill` (label + tone + icon).
 *
 * Tonos:
 *   - `done`     → completado / éxito (verde)
 *   - `danger`   → fallido / error (rojo)
 *   - `warn`     → procesando / queued (amber, con loader animado)
 *   - `neutral`  → estado desconocido
 */
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'success') {
    return { label: 'Listo', tone: 'done', icon: CheckCircle2, spin: false };
  }
  if (s === 'failed' || s === 'error') {
    return { label: 'Falló', tone: 'danger', icon: AlertTriangle, spin: false };
  }
  if (s === 'pending' || s === 'processing' || s === 'queued' || s === 'running') {
    return { label: 'Procesando', tone: 'warn', icon: Loader2, spin: true };
  }
  return { label: status || 'Sin estado', tone: 'neutral', icon: Clock, spin: false };
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

/**
 * Detecta el tipo de archivo por extensión y devuelve cómo procesarlo.
 *
 * @param {File} file
 * @returns {{ kind: 'gcode'|'stl'|'unknown', label: string }}
 */
function detectFileKind(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.3mf') || name.endsWith('.gcode')) {
    return { kind: 'gcode', label: '.3mf / .gcode (parse inmediato)' };
  }
  if (name.endsWith('.stl')) {
    return { kind: 'stl', label: 'STL (lamina con OrcaSlicer en background)' };
  }
  return { kind: 'unknown', label: 'extensión no soportada' };
}

/**
 * Upload UI inline — reemplaza el flujo viejo `/slicer/upload`.
 *
 * Tres flujos:
 *   - Drop / pick `.3mf|.gcode` → `uploadGcode` (parse inmediato, job listo)
 *   - Drop / pick `.stl`        → `uploadStl`   (background slice ~30-90s)
 *   - Pegar URL de MakerWorld   → `fetchMakerworld` (auto-fetch + parse)
 *
 * `onJobCreated` dispara con el job recién creado para que la página lo
 * inserte en la lista local sin re-fetch.
 */
function SlicerUploadPanel({ onJobCreated }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [makerworldUrl, setMakerworldUrl] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    const { kind, label } = detectFileKind(file);
    if (kind === 'unknown') {
      toast.error(`Archivo no soportado: ${file.name}. Usa .3mf, .gcode o .stl.`);
      return;
    }
    setUploading(true);
    setProgress(`Procesando ${file.name} · ${label}…`);
    try {
      const res = kind === 'gcode' ? await uploadGcode(file) : await uploadStl(file);
      toast.success(
        kind === 'stl'
          ? `${file.name} en cola — se actualizará al terminar`
          : `${file.name} parseado correctamente`,
      );
      if (res?.data) onJobCreated?.(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al subir el archivo';
      toast.error(typeof msg === 'string' ? msg : 'Error al subir');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const handleFiles = (filesLike) => {
    const arr = Array.from(filesLike || []);
    if (!arr.length) return;
    if (arr.length > 1) {
      toast('Sube los archivos uno por uno — el siguiente queda en cola.');
    }
    handleFile(arr[0]);
  };

  const handleMakerworld = async () => {
    const url = makerworldUrl.trim();
    if (!url) {
      toast.error('Pega una URL de MakerWorld primero');
      return;
    }
    if (!/^https?:\/\//.test(url) || !url.toLowerCase().includes('makerworld')) {
      toast.error('La URL no parece ser de MakerWorld');
      return;
    }
    setUploading(true);
    setProgress(`Descargando desde MakerWorld…`);
    try {
      const res = await fetchMakerworld(url);
      toast.success('Modelo descargado y parseado');
      if (res?.data) onJobCreated?.(res.data);
      setMakerworldUrl('');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al traer el modelo';
      toast.error(typeof msg === 'string' ? msg : 'Error MakerWorld');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  return (
    <div className="px-6 pt-4 pb-8 flex flex-col gap-5 max-w-3xl mx-auto w-full">
      {/* DropZone — flujo principal */}
      <div style={{ ['--page-accent']: ACCENT }}>
        <DropZone
          accept=".3mf,.gcode,.stl"
          hint={uploading ? progress : 'Suelta tu modelo aquí'}
          meta="o pulsa para seleccionar · .3mf · .gcode · .stl"
          cta={uploading ? 'Procesando…' : 'Examinar archivos'}
          accent={ACCENT}
          onFiles={uploading ? () => {} : handleFiles}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-3.5 flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ background: 'rgba(45, 212, 191, 0.14)', color: '#2DD4BF', border: '1px solid rgba(45, 212, 191, 0.32)' }}
          >
            <FileBox size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tech-white">.3mf / .gcode</p>
            <p className="mono text-[10.5px] text-gunmetal mt-0.5">Inmediato · parse + plate render</p>
            <p className="text-[11.5px] text-steel mt-1 leading-snug">
              Sube un archivo ya laminado y queda listo al instante.
            </p>
          </div>
        </Card>
        <Card className="p-3.5 flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ background: 'rgba(251, 191, 36, 0.14)', color: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.32)' }}
          >
            <Box size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tech-white">STL</p>
            <p className="mono text-[10.5px] text-gunmetal mt-0.5">Background · OrcaSlicer ~30-90s</p>
            <p className="text-[11.5px] text-steel mt-1 leading-snug">
              Lamina en el servidor con los presets por defecto.
            </p>
          </div>
        </Card>
      </div>

      {/* MakerWorld URL */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
            style={{ background: 'rgba(59, 130, 246, 0.14)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.32)' }}
          >
            <Globe size={14} />
          </span>
          <h3 className="text-sm font-semibold text-tech-white">Importar desde MakerWorld</h3>
          <span className="mono text-[10px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
            Auto-fetch
          </span>
        </div>
        <p className="text-[12px] text-gunmetal">
          Pega un link de MakerWorld y traemos el modelo + metadata (creator, thumbnail, descripción).
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="url"
            value={makerworldUrl}
            onChange={(e) => setMakerworldUrl(e.target.value)}
            placeholder="https://makerworld.com/en/models/…"
            disabled={uploading}
            className="flex-1 min-w-[260px] bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm placeholder:text-gunmetal-dim outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <Button
            variant="primary"
            icon={Globe}
            onClick={handleMakerworld}
            disabled={uploading || !makerworldUrl.trim()}
          >
            {uploading ? 'Procesando…' : 'Traer modelo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Job card (historial) ───────────────────────────────────────────────────

function JobCard({ job, onClick }) {
  const badge = statusBadge(job.status);
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
            <StatusPill tone={badge.tone} icon={badge.icon}>
              {badge.label}
            </StatusPill>
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
          <StatusPill tone={badge.tone} icon={badge.icon}>
            {badge.label}
          </StatusPill>
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

function JobDrawerBody({ job }) {
  if (!job) return null;
  const badge = statusBadge(job.status);
  const plates = Array.isArray(job.plates_data) ? job.plates_data : [];

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <StatusPill tone={badge.tone} icon={badge.icon} size="lg">
            {badge.label}
          </StatusPill>
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

    </div>
  );
}

/**
 * Diálogo de mapeo filamentos → inventario (issue #74).
 *
 * Cuando un job tiene N filaments (multi-material o single), abre un modal
 * donde el usuario asigna cada slot del slicer (filament_type + colour_hex
 * + weight_g) a un filamento real del inventario. Auto-match por tipo
 * inicial. Submit construye query params con inventory_item_id (slot 0) +
 * extra_id_1..N + extra_weight_1..N + weight_grams + print_time_hours.
 */
function FilamentMappingDialog({ open, onClose, job, onConfirm }) {
  const [filaments, setFilaments] = useState([]);
  const [mapping, setMapping] = useState({}); // {slot_idx: inventory_item_id}
  const [loading, setLoading] = useState(false);

  // Slots = filaments del primer plate (si multi-plate, requiere selección).
  // Caso single-plate: el array filaments del plate 0 es el set completo.
  const plate0 = (job?.plates || [])[0];
  const slots = Array.isArray(plate0?.filaments) && plate0.filaments.length > 0
    ? plate0.filaments
    : (job?.filament_type
        ? [{ filament_type: job.filament_type, colour_hex: '', weight_g: job.filament_weight_g || 0 }]
        : []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getInventoryFilaments()
      .then((res) => {
        const list = (res.data || []).filter((f) => f.quantity > 0 && f.is_active !== false);
        setFilaments(list);
        // Auto-match: para cada slot, intentar matching por filament_type
        const init = {};
        slots.forEach((s, idx) => {
          const match = list.find(
            (f) => (f.filament_type || '').toLowerCase() === (s.filament_type || '').toLowerCase(),
          );
          if (match) init[idx] = match.id;
        });
        setMapping(init);
      })
      .catch(() => toast.error('No se pudieron cargar filamentos del inventario'))
      .finally(() => setLoading(false));
  }, [open, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const canSubmit = slots.length > 0 && slots.every((_, i) => mapping[i]);

  const handleSubmit = () => {
    const params = new URLSearchParams();
    const totalWeight = slots.reduce((s, x) => s + (Number(x.weight_g) || 0), 0)
      || job.filament_weight_g || 0;
    if (totalWeight) params.set('weight_grams', String(totalWeight.toFixed(0)));
    if (job.print_time_seconds) {
      params.set('print_time_hours', String((job.print_time_seconds / 3600).toFixed(4)));
    }
    // Slot 0 → filamento principal
    if (mapping[0]) params.set('inventory_item_id', String(mapping[0]));
    if (slots[0]?.weight_g) {
      // El backend ya recibe weight_grams como total; el inventory_item_id
      // principal usa el peso del slot 0. Si user en calc quiere ajustar,
      // lo hace ahí.
    }
    // Slots adicionales → extra_id_N + extra_weight_N (1-based, max 4)
    slots.slice(1, 5).forEach((s, i) => {
      const idx = i + 1;
      if (mapping[idx]) {
        params.set(`extra_id_${idx}`, String(mapping[idx]));
        params.set(`extra_weight_${idx}`, String((Number(s.weight_g) || 0).toFixed(0)));
      }
    });
    if (slots.length > 1) {
      params.set('color_changes', String(plate0?.color_changes || slots.length - 1));
    }
    onConfirm(params);
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] backdrop-blur-sm"
        style={{ background: 'rgba(6, 9, 18, 0.66)' }}
      />
      <div
        role="dialog"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[min(560px,calc(100vw-32px))] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-surf-card)', border: '1px solid var(--color-border-strong)' }}
      >
        <header className="p-4 border-b border-[var(--color-border-soft)]">
          <h2 className="text-[15px] font-semibold text-tech-white">Mapear filamentos al inventario</h2>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">
            {slots.length} {slots.length === 1 ? 'slot' : 'slots'} en el .gcode.3mf
            {slots.length > 4 && ' · máx 4 multi-material (calc soporta hasta 5 filamentos)'}
          </p>
        </header>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <p className="text-[12px] text-gunmetal text-center py-6">Cargando filamentos…</p>
          ) : slots.length === 0 ? (
            <p className="text-[12px] text-gunmetal text-center py-6">
              Este job no tiene filaments definidos en el .gcode.3mf.
            </p>
          ) : (
            slots.slice(0, 5).map((s, idx) => {
              const compatibleFilaments = filaments.filter(
                (f) => !s.filament_type
                  || (f.filament_type || '').toLowerCase() === s.filament_type.toLowerCase(),
              );
              const others = filaments.filter((f) => !compatibleFilaments.includes(f));
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surf-card-2)] flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    {s.colour_hex && (
                      <span
                        className="w-5 h-5 rounded-full border border-black/30 shrink-0"
                        style={{ background: s.colour_hex }}
                      />
                    )}
                    <span className="text-[12.5px] font-semibold text-tech-white">
                      Slot {idx + 1}
                    </span>
                    <span className="mono text-[10.5px] text-gunmetal">
                      {s.filament_type || '—'} · {Number(s.weight_g || 0).toFixed(0)}g
                    </span>
                  </div>
                  <select
                    value={mapping[idx] || ''}
                    onChange={(e) =>
                      setMapping((cur) => ({ ...cur, [idx]: Number(e.target.value) || '' }))
                    }
                    className="w-full h-[36px] bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-3 text-[12.5px] text-tech-white outline-none"
                  >
                    <option value="">Selecciona filamento…</option>
                    {compatibleFilaments.length > 0 && (
                      <optgroup label="Compatibles">
                        {compatibleFilaments.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} · {f.filament_type || '?'} · {Math.round(Number(f.quantity) || 0)}g
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {others.length > 0 && (
                      <optgroup label="Otros tipos">
                        {others.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} · {f.filament_type || '?'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })
          )}
        </div>
        <footer className="p-3 border-t border-[var(--color-border-soft)] flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={Calculator}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 justify-center disabled:opacity-50"
          >
            {canSubmit ? 'Ir a Calculadora' : 'Selecciona todos los slots'}
          </Button>
        </footer>
      </div>
    </>
  );
}

/**
 * Footer del JobDetailDrawer: acciones primarias + secundarias.
 * Se renderiza en el slot `footer` del DetailDrawer v2 (desktop) o inline
 * en el MobileSheet (mobile).
 */
function JobDrawerFooter({ job, onDelete, onClose }) {
  const navigate = useNavigate();
  const [mappingOpen, setMappingOpen] = useState(false);
  if (!job) return null;
  const hasMultipleSlots = (job.plates?.[0]?.filaments?.length || 0) > 1;
  // Issue #74: si hay multi-material o el user quiere mapear, abrir el dialog.
  // Si el job es single sin filaments definidos, fallback al flujo legacy
  // (solo weight + time + type heurístico).
  const useInCalculator = () => {
    if (hasMultipleSlots || (job.plates?.[0]?.filaments?.length || 0) > 0) {
      setMappingOpen(true);
      return;
    }
    const w = job.filament_weight_g;
    const t = (job.print_time_seconds || 0) / 3600;
    const params = new URLSearchParams();
    if (w) params.set('weight_grams', String(w));
    if (t) params.set('print_time_hours', String(t));
    if (job.filament_type) params.set('filament_type', job.filament_type);
    navigate(`/cost/calculator?${params.toString()}`);
  };
  return (
    <>
      <Button variant="primary" icon={Calculator} onClick={useInCalculator} className="flex-1 justify-center">
        Usar en Calculadora
      </Button>
      <FilamentMappingDialog
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        job={job}
        onConfirm={(params) => {
          setMappingOpen(false);
          navigate(`/cost/calculator?${params.toString()}`);
        }}
      />
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
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SlicerPage() {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const { openSidebar } = useOutletContext() || {};

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
    const tabLabel = TABS.find((t) => t.id === tab)?.label || tab;
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Slicer"
          appIcon={Cpu}
          appAccent={ACCENT}
          title={tabLabel}
          onMenu={() => openSidebar?.()}
        />
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
          <SlicerUploadPanel
            onJobCreated={(job) => {
              setJobs((cur) => [job, ...cur]);
              setTab('historial');
            }}
          />
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
              <EmptyState
                icon={Layers}
                accent={ACCENT}
                title={jobs.length === 0 ? 'Aún no hay jobs' : 'Sin resultados'}
                hint={
                  jobs.length === 0
                    ? 'Toca + para subir tu primer modelo.'
                    : 'Cambia el filtro o limpia la búsqueda.'
                }
              />
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

        {tab !== 'subir' && (
          <button
            type="button"
            onClick={() => setTab('subir')}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
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
        )}

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={
            selected?.original_filename ||
            (selected ? `Job #${selected.id}` : '')
          }
          height="full"
        >
          <JobDrawerBody job={selected} />
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <JobDrawerFooter
                job={selected}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
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
          <button
            type="button"
            onClick={() => setTab('subir')}
            className="btn btn-primary btn-sm"
          >
            <Upload size={13} /> Subir modelo
          </button>
        </div>
      </header>

      <KPIStrip stats={stats} />

      <SlicerTabs value={tab} onChange={setTab} counts={counts} />

      {tab === 'subir' ? (
        <SlicerUploadPanel
          onJobCreated={(job) => {
            setJobs((cur) => [job, ...cur]);
            setTab('historial');
          }}
        />
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
            <EmptyState
              icon={Layers}
              accent={ACCENT}
              title={jobs.length === 0 ? 'Aún no hay jobs' : 'Sin resultados'}
              hint={
                jobs.length === 0
                  ? 'Sube tu primer modelo para empezar a usarlo en la calculadora.'
                  : 'Cambia el filtro o limpia la búsqueda.'
              }
              action={
                jobs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('subir')}
                    className="btn btn-primary btn-sm"
                  >
                    <Upload size={13} /> Subir modelo
                  </button>
                ) : null
              }
            />
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
        eyebrow={selected ? `JOB-${String(selected.id).padStart(4, '0')}` : undefined}
        title={
          selected?.original_filename ||
          (selected ? `Job #${selected.id}` : '')
        }
        width={480}
        footer={
          selected && (
            <JobDrawerFooter
              job={selected}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
            />
          )
        }
      >
        <JobDrawerBody job={selected} />
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
