/**
 * @file Página de la app Vault — galería de modelos `.3mf` / `.gcode.3mf`.
 *
 * Thumbnails locales (extraídos del ZIP del modelo) con prioridad sobre el
 * `thumbnail_url` externo. Cada modelo puede tener un slot `source_file`
 * (`.3mf` editable) y/o `print_file` (`.gcode.3mf` laminado, listo para
 * imprimir desde la cola).
 *
 * @module pages/vault/VaultPage
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Archive,
  ChevronRight,
  Download,
  FileBox,
  HardDrive,
  Pencil,
  Plus,
  Printer,
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
  EmptyState,
  KPI,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  deleteVaultFile,
  downloadVaultPrint,
  downloadVaultSource,
  getVaultFiles,
  getVaultStats,
} from '../../services/api';
import { getThumbnail } from '../../utils/thumbnail';

const ACCENT = '#F43F5E';

const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO');
  } catch {
    return '—';
  }
};

/**
 * Suma source + print en bytes (cualquiera puede ser null). Coincide con
 * `ModelFile.total_size_bytes` del backend; lo necesitamos en frontend
 * para mostrar el tamaño total del modelo en card/row/drawer.
 */
const totalSizeBytes = (f) =>
  (f?.source_file_size || 0) + (f?.print_file_size || 0);

const fmtTime = (seconds) => {
  if (!seconds || !Number.isFinite(Number(seconds))) return null;
  const total = Math.round(Number(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ─── Card / row ─────────────────────────────────────────────────────────────

function VaultCard({ file, onClick }) {
  const thumb = getThumbnail(file);
  return (
    <Card as="button" interactive onClick={() => onClick(file)} className="text-left w-full overflow-hidden flex flex-col">
      <div className="h-40 bg-[var(--color-surf-sidebar)] flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ display: thumb ? 'none' : 'flex' }}
        >
          <Archive size={40} style={{ color: `${ACCENT}55` }} />
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {file.is_print_ready ? (
            <StatusPill tone="done" icon={Printer}>
              Listo para imprimir
            </StatusPill>
          ) : (
            <StatusPill tone="neutral" icon={FileBox}>
              Solo editable
            </StatusPill>
          )}
        </div>
        <p className="text-sm font-semibold text-tech-white truncate" title={file.name}>
          {file.name}
        </p>
        <p className="mono text-[10.5px] text-gunmetal truncate">
          {fmtBytes(totalSizeBytes(file))} · {fmtDate(file.created_at)}
        </p>
        {Array.isArray(file.tags) && file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {file.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="mono text-[9px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel"
              >
                {t}
              </span>
            ))}
            {file.tags.length > 3 && (
              <span className="mono text-[9px] text-gunmetal">+{file.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function VaultRow({ file, onClick }) {
  const thumb = getThumbnail(file);
  return (
    <button
      type="button"
      onClick={() => onClick(file)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <div
        className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center shrink-0"
        style={{ border: `1px solid ${ACCENT}40` }}
      >
        {thumb ? (
          <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <Archive size={18} style={{ color: `${ACCENT}88` }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {file.is_print_ready ? (
            <StatusPill tone="done" icon={Printer}>Listo</StatusPill>
          ) : (
            <StatusPill tone="neutral" icon={FileBox}>Editable</StatusPill>
          )}
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">{file.name}</p>
        <p className="mono text-[10px] text-gunmetal mt-0.5">
          {fmtBytes(totalSizeBytes(file))} · {fmtDate(file.created_at)}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

/**
 * Cuerpo del drawer (read-only). Header (eyebrow + title) lo aporta
 * `DetailDrawer` v2; las acciones viven en `VaultDrawerFooter`. Muestra
 * los dos slots (source / print) por separado + metadatos sliced si los hay.
 */
function VaultDrawerBody({ file }) {
  if (!file) return null;
  const thumb = getThumbnail(file);
  const sliceTime = fmtTime(file.sliced_time_seconds);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="h-48 rounded-lg overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center border border-[var(--color-border)]"
      >
        {thumb ? (
          <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <Archive size={50} style={{ color: `${ACCENT}55` }} />
        )}
      </div>

      {/* Slots de archivos */}
      <div className="flex flex-col gap-2">
        <span className="lbl-eyebrow text-[9px]">Archivos</span>
        <Card className="p-3 flex items-center gap-3">
          <FileBox
            size={18}
            style={{
              color: file.source_file_name ? ACCENT : 'var(--color-gunmetal-dim)',
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-tech-white truncate">
              {file.source_file_name || 'Sin .3mf editable'}
            </p>
            <p className="mono text-[10.5px] text-gunmetal mt-0.5">
              {file.source_file_size != null
                ? `${fmtBytes(file.source_file_size)} · editable`
                : 'No subido'}
            </p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <Printer
            size={18}
            style={{
              color: file.print_file_name ? '#34D399' : 'var(--color-gunmetal-dim)',
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-tech-white truncate">
              {file.print_file_name || 'Sin .gcode.3mf laminado'}
            </p>
            <p className="mono text-[10.5px] text-gunmetal mt-0.5">
              {file.print_file_size != null
                ? `${fmtBytes(file.print_file_size)} · listo para imprimir`
                : 'Lamina en Slicer y vuelve a subir'}
            </p>
          </div>
        </Card>
      </div>

      {/* Metadatos sliced del .gcode.3mf */}
      {(file.sliced_weight_g != null || sliceTime || file.sliced_filament_type) && (
        <div>
          <span className="lbl-eyebrow text-[9px]">Datos del laminado</span>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Card className="p-2.5">
              <span className="lbl-eyebrow text-[9px]">Peso</span>
              <p className="mono text-sm text-tech-white mt-0.5">
                {file.sliced_weight_g != null
                  ? `${Number(file.sliced_weight_g).toFixed(0)} g`
                  : '—'}
              </p>
            </Card>
            <Card className="p-2.5">
              <span className="lbl-eyebrow text-[9px]">Tiempo</span>
              <p className="mono text-sm text-tech-white mt-0.5">{sliceTime || '—'}</p>
            </Card>
            <Card className="p-2.5">
              <span className="lbl-eyebrow text-[9px]">Material</span>
              <p className="mono text-sm text-tech-white mt-0.5">
                {file.sliced_filament_type || '—'}
              </p>
            </Card>
          </div>
        </div>
      )}

      {file.description && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Descripción</span>
          <p className="text-sm text-steel mt-1 whitespace-pre-wrap">{file.description}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Subido</span>
          <p className="mono text-sm text-tech-white mt-0.5">{fmtDate(file.created_at)}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Tamaño total</span>
          <p className="mono text-sm text-tech-white mt-0.5">
            {fmtBytes(totalSizeBytes(file))}
          </p>
        </Card>
        {file.creator_name && (
          <Card className="p-3 col-span-2">
            <span className="lbl-eyebrow text-[9px]">Creador</span>
            <p className="text-sm text-tech-white mt-0.5">{file.creator_name}</p>
            {file.source_url && (
              <a
                href={file.source_url}
                target="_blank"
                rel="noreferrer"
                className="mono text-[11px] text-rose-400 hover:underline truncate block mt-0.5"
              >
                {file.source_platform || 'fuente'} ↗
              </a>
            )}
          </Card>
        )}
      </div>
      {Array.isArray(file.tags) && file.tags.length > 0 && (
        <div>
          <span className="lbl-eyebrow text-[9px]">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {file.tags.map((t) => (
              <span
                key={t}
                className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Footer del drawer: Descargar print/source (lo que esté disponible) +
 * Editar / Eliminar (solo admin). Si solo hay un slot, el botón único
 * descarga ese. Si están los dos, se muestran lado a lado.
 */
function VaultDrawerFooter({
  file,
  isAdmin,
  onDownloadSource,
  onDownloadPrint,
  onDelete,
  onClose,
}) {
  if (!file) return null;
  return (
    <>
      {file.is_print_ready && (
        <Button
          variant="primary"
          size="sm"
          icon={Download}
          onClick={() => onDownloadPrint(file)}
          className="flex-1 justify-center"
          title=".gcode.3mf laminado — listo para impresora"
        >
          Descargar laminado
        </Button>
      )}
      {file.source_file_name && (
        <Button
          variant={file.is_print_ready ? 'ghost' : 'primary'}
          size="sm"
          icon={Download}
          onClick={() => onDownloadSource(file)}
          className={file.is_print_ready ? '' : 'flex-1 justify-center'}
          title=".3mf editable — para abrir en OrcaSlicer/BambuStudio"
        >
          {file.is_print_ready ? 'Editable' : 'Descargar editable'}
        </Button>
      )}
      {isAdmin && (
        <Link
          to={`/vault/upload?replace=${file.id}`}
          className="btn btn-ghost btn-sm"
          aria-label="Editar"
        >
          <Pencil size={13} /> Editar
        </Link>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={async () => {
            const ok = await onDelete(file);
            if (ok) onClose();
          }}
          className="text-rose-400 hover:text-rose-300"
          aria-label="Eliminar"
        />
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { openSidebar } = useOutletContext() || {};
  const isAdmin = user?.role === 'admin';
  const confirm = useConfirm();

  const [query, setQuery] = useState('');
  // Búsqueda debounceada: el input alimenta `query`; tras 300ms inactivos
  // se copia a `debouncedQuery` y se dispara el refetch del backend.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset a página 1 cada vez que cambia el query efectivo.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, pageSize]);

  const load = async () => {
    setLoading(true);
    const params = { page, page_size: pageSize };
    if (debouncedQuery) params.q = debouncedQuery;
    const [f, s] = await Promise.allSettled([
      getVaultFiles(params),
      getVaultStats(),
    ]);
    if (f.status === 'fulfilled') {
      const data = f.value.data;
      const items = Array.isArray(data) ? data : data?.items || [];
      // El backend ya ordena por created_at desc; no re-ordenamos.
      setFiles(items);
      setTotal(typeof data?.total === 'number' ? data.total : items.length);
    }
    if (s.status === 'fulfilled') setStats(s.value.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {
      toast.error('No se pudo cargar el Vault');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedQuery]);

  /**
   * Descarga uno de los slots (source o print) del modelo y dispara la
   * descarga en el browser con el filename correcto del backend.
   */
  const _downloadSlot = async (f, slot) => {
    try {
      const fn = slot === 'print' ? downloadVaultPrint : downloadVaultSource;
      const filename = slot === 'print' ? f.print_file_name : f.source_file_name;
      const res = await fn(f.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `vault-${f.id}.3mf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar');
    }
  };
  const handleDownloadSource = (f) => _downloadSlot(f, 'source');
  const handleDownloadPrint = (f) => _downloadSlot(f, 'print');

  const handleDelete = async (f) => {
    const ok = await confirm(`¿Eliminar "${f.name}"?`, 'Eliminar');
    if (!ok) return false;
    try {
      await deleteVaultFile(f.id);
      toast.success('Archivo eliminado');
      // Si el item borrado era el único de la última página, retrocedemos
      // automáticamente para no quedar en una página vacía.
      if (files.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await load();
      }
      return true;
    } catch {
      toast.error('No se pudo eliminar');
      return false;
    }
  };

  const usedBytes = stats?.used_bytes ?? 0;
  const quotaBytes = stats?.quota_bytes ?? 1;
  const percent = stats?.percent ?? 0;

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Modelos" value={total} unit="docs" sub="en biblioteca" accent={ACCENT} icon={Archive} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Almacenado" value={fmtBytes(usedBytes)} sub={`de ${fmtBytes(quotaBytes)}`} accent="#3B82F6" icon={HardDrive} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Cuota usada" value={`${percent.toFixed(1)}%`} sub={percent > 80 ? 'cerca del límite' : 'al día'} accent={percent > 80 ? '#FBBF24' : '#34D399'} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Con plate render"
          value={files.filter((f) => f.local_thumbnail_url).length}
          unit="docs"
          sub="en esta página"
          accent="#94A0AE"
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Vault"
          appIcon={Archive}
          appAccent={ACCENT}
          title="Galería"
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-3 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Vault</span>
              <span className="mono text-[10px] text-gunmetal">{total} modelos</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="mono text-3xl font-semibold text-tech-white tracking-tight">
                {fmtBytes(usedBytes)}
              </span>
              <span className="mono text-sm text-gunmetal">de {fmtBytes(quotaBytes)}</span>
            </div>
            <div className="relative h-1 bg-white/5 rounded">
              <div
                className="absolute inset-y-0 left-0 rounded transition-all"
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  background: percent > 80 ? '#FBBF24' : ACCENT,
                }}
              />
            </div>
          </Card>
        </div>
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
            <Search size={14} className="text-gunmetal" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Modelo, tag, descripción…"
              className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
            />
          </div>
        </div>
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando Vault…</p>
        ) : files.length === 0 ? (
          <div className="mt-3 pb-28">
            <EmptyState
              icon={Archive}
              accent={ACCENT}
              title={total === 0 && !debouncedQuery ? 'Vault vacío' : 'Sin resultados'}
              hint={
                total === 0 && !debouncedQuery
                  ? 'Sube tu primer .3mf para tener tus modelos organizados aquí.'
                  : 'Cambia el filtro o limpia la búsqueda.'
              }
              action={
                isAdmin && total === 0 && !debouncedQuery ? (
                  <button
                    type="button"
                    onClick={() => navigate('/vault/upload')}
                    className="btn btn-primary btn-sm"
                  >
                    <Upload size={13} /> Subir primer modelo
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <ul className="mt-3">
              {files.map((f) => (
                <li key={f.id}>
                  <VaultRow file={f} onClick={setSelected} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <nav
                className="px-4 pt-3 pb-28 flex items-center gap-2 text-[12px]"
                aria-label="Paginación de modelos"
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Página anterior"
                >
                  ‹
                </button>
                <span className="mono text-gunmetal flex-1 text-center">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Página siguiente"
                >
                  ›
                </button>
              </nav>
            )}
          </>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/vault/upload')}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
            style={{ background: ACCENT, color: '#FFF', boxShadow: `0 8px 24px ${ACCENT}55` }}
            aria-label="Subir modelo"
          >
            <Plus size={16} strokeWidth={2.5} />
            Subir
          </button>
        )}
        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.name || ''}
          height="full"
        >
          <div className="px-5 pt-4 pb-3">
            <VaultDrawerBody file={selected} />
          </div>
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <VaultDrawerFooter
                file={selected}
                isAdmin={isAdmin}
                onDownloadSource={handleDownloadSource}
                onDownloadPrint={handleDownloadPrint}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
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
            <Archive size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Vault</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Galería</span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel ml-1">
            {total} modelos
          </span>
        </div>
        {isAdmin && (
          <Link to="/vault/upload" className="btn btn-primary btn-sm">
            <Upload size={13} /> Subir modelo
          </Link>
        )}
      </header>

      {KPIs}

      <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10 border-b border-[var(--color-border-soft)]">
        <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
          <Search size={13} className="text-gunmetal" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar modelo, tag, descripción…"
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
          {total === 0
            ? 'Sin modelos'
            : `${total} modelo${total === 1 ? '' : 's'} · página ${page} de ${totalPages}`}
        </span>
      </div>

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando Vault…</p>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Archive}
          accent={ACCENT}
          title={total === 0 && !debouncedQuery ? 'Vault vacío' : 'Sin resultados'}
          hint={
            total === 0 && !debouncedQuery
              ? 'Sube tu primer .3mf para tener tus modelos organizados aquí.'
              : 'Cambia el filtro o limpia la búsqueda.'
          }
          action={
            isAdmin && total === 0 && !debouncedQuery ? (
              <Link to="/vault/upload" className="btn btn-primary btn-sm">
                <Upload size={13} /> Subir primer modelo
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <div
            className="px-6 pb-4 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            {files.map((f) => (
              <VaultCard key={f.id} file={f} onClick={setSelected} />
            ))}
          </div>
          {totalPages > 1 && (
            <nav
              className="px-6 pb-8 flex flex-wrap items-center gap-3 text-[12px]"
              aria-label="Paginación de modelos"
            >
              <span className="mono text-gunmetal">
                Página {page} de {totalPages}
              </span>
              <span className="mono text-gunmetal-dim">·</span>
              <span className="mono text-gunmetal">
                Mostrando {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + files.length} de {total}
              </span>
              <span className="flex-1" />
              <label className="flex items-center gap-2 text-gunmetal">
                <span className="mono text-[10px]">Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2 py-1 text-tech-white text-[12px]"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </label>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Primera página"
                >
                  ‹‹
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Página anterior"
                >
                  ‹ Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Página siguiente"
                >
                  Siguiente ›
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                  aria-label="Última página"
                >
                  ››
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? `MODELO · ${fmtBytes(selected.file_size)}` : undefined}
        title={selected?.name || ''}
        width={500}
        footer={
          selected && (
            <VaultDrawerFooter
              file={selected}
              isAdmin={isAdmin}
              onDownloadSource={handleDownloadSource}
              onDownloadPrint={handleDownloadPrint}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
            />
          )
        }
      >
        <VaultDrawerBody file={selected} />
      </DetailDrawer>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{total} modelos</span>
        <span className="mono">{fmtBytes(usedBytes)} de {fmtBytes(quotaBytes)} ({percent.toFixed(1)}%)</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
