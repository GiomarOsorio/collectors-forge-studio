/**
 * @file Página rediseñada del Vault (Claude Design port — Día 8).
 *
 * Galería de modelos `.3mf` con thumbnails locales (extraídos del ZIP en Fase 4)
 * con prioridad sobre `thumbnail_url` externo.
 *
 * @module pages/vault/VaultPageV2
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Archive,
  ChevronRight,
  Download,
  HardDrive,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, KPI, MobileSheet } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  deleteVaultFile,
  downloadVaultFile,
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
        <p className="text-sm font-semibold text-tech-white truncate" title={file.name}>
          {file.name}
        </p>
        <p className="mono text-[10.5px] text-gunmetal truncate">
          {fmtBytes(file.file_size)} · {fmtDate(file.created_at)}
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
        <p className="text-sm font-semibold text-tech-white truncate">{file.name}</p>
        <p className="mono text-[10px] text-gunmetal mt-0.5">
          {fmtBytes(file.file_size)} · {fmtDate(file.created_at)}
        </p>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

// ─── Drawer body ────────────────────────────────────────────────────────────

function VaultDrawerBody({ file, isAdmin, onDownload, onDelete, onClose }) {
  if (!file) return null;
  const thumb = getThumbnail(file);
  return (
    <div className="p-5 flex flex-col gap-4">
      <div
        className="h-48 rounded-lg overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center border border-[var(--color-border)]"
      >
        {thumb ? (
          <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <Archive size={50} style={{ color: `${ACCENT}55` }} />
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-tech-white truncate">{file.name}</h2>
        <p className="mono text-[11.5px] text-gunmetal mt-0.5 truncate">{file.file_name}</p>
      </div>
      {file.description && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Descripción</span>
          <p className="text-sm text-steel mt-1 whitespace-pre-wrap">{file.description}</p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Tamaño</span>
          <p className="mono text-sm text-tech-white mt-0.5">{fmtBytes(file.file_size)}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Subido</span>
          <p className="mono text-sm text-tech-white mt-0.5">{fmtDate(file.created_at)}</p>
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
      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <Button variant="primary" icon={Download} onClick={() => onDownload(file)} className="flex-1">
          Descargar .3mf
        </Button>
        {isAdmin && (
          <>
            <Link to={`/vault/upload?replace=${file.id}`} className="btn btn-ghost btn-sm">
              <Pencil size={13} /> Editar
            </Link>
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={async () => {
                const ok = await onDelete(file);
                if (ok) onClose();
              }}
              className="text-rose-400 hover:text-rose-300"
              aria-label="Eliminar"
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VaultPageV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { openSidebar } = useOutletContext() || {};
  const isAdmin = user?.role === 'admin';
  const confirm = useConfirm();

  const [query, setQuery] = useState('');
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const [f, s] = await Promise.allSettled([getVaultFiles({ params: { page_size: 100 } }), getVaultStats()]);
    if (f.status === 'fulfilled') {
      const data = f.value.data;
      setFiles(Array.isArray(data) ? data : data?.items || []);
    }
    if (s.status === 'fulfilled') setStats(s.value.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => {
      toast.error('No se pudo cargar el Vault');
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...files].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (Array.isArray(f.tags) ? f.tags.join(' ') : '').toLowerCase().includes(q),
    );
  }, [files, query]);

  const handleDownload = async (f) => {
    try {
      const res = await downloadVaultFile(f.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = f.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar');
    }
  };

  const handleDelete = async (f) => {
    const ok = await confirm(`¿Eliminar "${f.name}"?`, 'Eliminar');
    if (!ok) return false;
    try {
      await deleteVaultFile(f.id);
      toast.success('Archivo eliminado');
      setFiles((cur) => cur.filter((x) => x.id !== f.id));
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
        <KPI label="Modelos" value={files.length} unit="docs" sub="en biblioteca" accent={ACCENT} icon={Archive} />
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
          value={files.filter((f) => f.local_thumbnail_path).length}
          unit="docs"
          sub="thumbnails locales"
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
              <span className="mono text-[10px] text-gunmetal">{files.length} modelos</span>
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
        ) : (
          <ul className="mt-3 pb-28">
            {filtered.map((f) => (
              <li key={f.id}>
                <VaultRow file={f} onClick={setSelected} />
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-12 text-center text-gunmetal text-sm">
                {files.length === 0 ? 'Vault vacío' : 'Sin resultados'}
              </li>
            )}
          </ul>
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
        <MobileSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name} height="full">
          <VaultDrawerBody
            file={selected}
            isAdmin={isAdmin}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
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
            {files.length} modelos
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
          {filtered.length} de {files.length} modelos
        </span>
      </div>

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando Vault…</p>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
          <Archive size={28} className="text-gunmetal-dim" />
          <p className="text-sm font-semibold text-tech-white">
            {files.length === 0 ? 'Vault vacío' : 'Sin resultados'}
          </p>
          {isAdmin && files.length === 0 && (
            <Link to="/vault/upload" className="btn btn-primary btn-sm">
              <Upload size={13} /> Subir primer modelo
            </Link>
          )}
        </div>
      ) : (
        <div
          className="px-6 pb-8 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {filtered.map((f) => (
            <VaultCard key={f.id} file={f} onClick={setSelected} />
          ))}
        </div>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        width={500}
      >
        <VaultDrawerBody
          file={selected}
          isAdmin={isAdmin}
          onDownload={handleDownload}
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
        <span className="mono">{files.length} modelos</span>
        <span className="mono">{fmtBytes(usedBytes)} de {fmtBytes(quotaBytes)} ({percent.toFixed(1)}%)</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
