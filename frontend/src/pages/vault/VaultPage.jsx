/**
 * @file Galería de modelos .3mf del Vault.
 *
 * Muestra una barra de almacenamiento (usado/cuota) en la parte superior
 * y un grid de cards responsive con los archivos almacenados. Los admins
 * ven botones de edición e eliminación en cada card.
 *
 * @module pages/vault/VaultPage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, Download, Loader2, Pencil, Trash2, Search, X, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import {
  getVaultFiles,
  getVaultStats,
  downloadVaultFile,
  updateVaultFile,
  deleteVaultFile,
} from '../../services/api';

// ─── Barra de almacenamiento ───────────────────────────────────────────────

function StorageBar({ stats }) {
  if (!stats) return null;
  const { used_bytes, quota_bytes, percent } = stats;

  const fmt = (b) => {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  const barColor =
    percent >= 98 ? 'bg-red-500' :
    percent >= 90 ? 'bg-orange-400' :
    'bg-rose-500';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-steel">Almacenamiento usado</span>
        <span className="font-mono text-xs text-gunmetal">
          {fmt(used_bytes)} / {fmt(quota_bytes)}
        </span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gunmetal mt-1 font-mono">{percent.toFixed(1)}% usado</p>
    </div>
  );
}

// ─── Modal de edición ─────────────────────────────────────────────────────

function EditModal({ file, onSave, onClose }) {
  const [form, setForm] = useState({
    name: file.name,
    description: file.description || '',
    source_url: file.source_url || '',
    tags: (file.tags || []).join(', '),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagsArr = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave(file.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        source_url: form.source_url.trim() || null,
        tags: tagsArr,
      });
      onClose();
    } catch {
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-steel">Editar archivo</h3>
          <button className="tf-btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gunmetal mb-1">Nombre</label>
            <input
              className="tf-input w-full"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">Descripción</label>
            <textarea
              className="tf-input w-full h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">URL de origen</label>
            <input
              className="tf-input w-full"
              value={form.source_url}
              onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">
              Tags <span className="text-gunmetal/60">(separados por coma)</span>
            </label>
            <input
              className="tf-input w-full"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="tf-btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="tf-btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de modelo ────────────────────────────────────────────────────────

const PLATFORM_LABELS = {
  makerworld: 'MakerWorld',
  printables: 'Printables',
  thingiverse: 'Thingiverse',
  otro: 'Otro',
};

function ModelCard({ file, isAdmin, onDownload, onEdit, onDelete, downloadingIds }) {
  const isDownloading = downloadingIds.has(file.id);

  const fmt = (b) => {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col hover:border-rose-500/40 transition-colors">
      {/* Thumbnail */}
      <div className="h-40 bg-bg flex items-center justify-center overflow-hidden">
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ display: file.thumbnail_url ? 'none' : 'flex' }}
        >
          <Archive size={40} className="text-rose-500/30" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1">
        <p className="font-medium text-sm text-steel truncate" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {file.source_platform && file.source_platform !== 'otro' && (
            <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full">
              {PLATFORM_LABELS[file.source_platform] ?? file.source_platform}
            </span>
          )}
          <span className="text-xs text-gunmetal font-mono">{fmt(file.file_size)}</span>
        </div>
        {file.creator_name && (
          <p className="text-xs text-gunmetal truncate">por {file.creator_name}</p>
        )}
        {file.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {file.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-border px-1.5 py-0.5 rounded text-gunmetal">
                {tag}
              </span>
            ))}
            {file.tags.length > 3 && (
              <span className="text-xs text-gunmetal/60">+{file.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <button
          className="tf-btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
          onClick={() => onDownload(file)}
          disabled={isDownloading}
        >
          {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Descargar
        </button>
        {isAdmin && (
          <>
            <button className="tf-btn-icon" onClick={() => onEdit(file)} title="Editar">
              <Pencil size={13} />
            </button>
            <button className="tf-btn-danger tf-btn-icon" onClick={() => onDelete(file)} title="Eliminar">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function VaultPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.is_admin;

  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [inputSearch, setInputSearch] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  const PAGE_SIZE = 20;
  const debounceRef = useRef(null);

  const load = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: PAGE_SIZE };
      if (q) params.q = q;
      const [filesRes, statsRes] = await Promise.all([
        getVaultFiles(params),
        getVaultStats(),
      ]);
      setFiles(filesRes.data.items);
      setTotal(filesRes.data.total);
      setStats(statsRes.data);
    } catch {
      toast.error('Error al cargar el Vault');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(search, page);
  }, [search, page, load]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setInputSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
  };

  const handleDownload = async (file) => {
    setDownloadingIds((prev) => new Set(prev).add(file.id));
    try {
      const res = await downloadVaultFile(file.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar el archivo');
    } finally {
      setDownloadingIds((prev) => { const s = new Set(prev); s.delete(file.id); return s; });
    }
  };

  const handleEdit = (file) => setEditingFile(file);

  const handleSaveEdit = async (id, data) => {
    const res = await updateVaultFile(id, data);
    setFiles((prev) => prev.map((f) => (f.id === id ? res.data : f)));
    toast.success('Archivo actualizado');
    await getVaultStats().then((r) => setStats(r.data));
  };

  const handleDelete = async (file) => {
    const ok = await confirm(
      `¿Eliminar "${file.name}"? Esta acción no se puede deshacer.`,
      'Eliminar'
    );
    if (!ok) return;
    try {
      await deleteVaultFile(file.id);
      toast.success('Archivo eliminado');
      load(search, page);
    } catch {
      toast.error('Error al eliminar el archivo');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-steel">Vault</h1>
          <p className="text-sm text-gunmetal mt-0.5">
            Modelos .3mf probados y listos para imprimir
          </p>
        </div>
      </div>

      <StorageBar stats={stats} />

      {/* Barra de búsqueda */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gunmetal pointer-events-none" />
        <input
          className="tf-input w-full pl-9 pr-9"
          placeholder="Buscar por nombre…"
          value={inputSearch}
          onChange={handleSearchChange}
        />
        {inputSearch && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gunmetal hover:text-steel"
            onClick={() => { setInputSearch(''); setSearch(''); setPage(1); }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="h-40 tf-skeleton" />
              <div className="p-3 space-y-2">
                <div className="tf-skeleton h-4 w-3/4 rounded" />
                <div className="tf-skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Archive}
          title={search ? 'Sin resultados' : 'El Vault está vacío'}
          description={
            search
              ? `No hay modelos que coincidan con "${search}"`
              : isAdmin
              ? 'Sube tu primer modelo .3mf desde la sección "Subir modelo"'
              : 'No hay modelos disponibles aún'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <ModelCard
                key={file.id}
                file={file}
                isAdmin={isAdmin}
                onDownload={handleDownload}
                onEdit={handleEdit}
                onDelete={handleDelete}
                downloadingIds={downloadingIds}
              />
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm">
              <p className="text-gunmetal font-mono text-xs">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} modelos
              </p>
              <div className="flex gap-2">
                <button
                  className="tf-btn-ghost text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <button
                  className="tf-btn-ghost text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de edición */}
      {editingFile && (
        <EditModal
          file={editingFile}
          onSave={handleSaveEdit}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
