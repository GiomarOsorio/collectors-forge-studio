/**
 * @file Página de la app Proyectos.
 *
 * Un Proyecto agrupa varios ítems de la cola de impresión (`PrintQueueItem`)
 * bajo un mismo encargo/cliente para seguir su progreso agregado
 * (pendiente / imprimiendo / listo / cancelado). Es puramente organizativo
 * — no afecta inventario ni costos, eso ya lo maneja Queue al marcar 'done'.
 *
 * @module pages/projects/ProjectsPage
 */

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileBox,
  FileText,
  FolderKanban,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Receipt,
  Trash2,
  Upload,
  X,
  XCircle,
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
import { useConfirm } from '../../components/ConfirmDialog';
import {
  createProject,
  deleteProject,
  exportProject,
  getClientQuotes,
  getProjectCoverUrl,
  getProjectFiles,
  getProjectItems,
  getProjects,
  importProject,
  removeProjectFile,
  updateProject,
  uploadProjectCover,
} from '../../services/api';

const ACCENT = '#F59E0B';

//: Paleta sugerida — igual a `SUGGESTED_PROJECT_COLORS` del backend (schemas/project.py).
const COLOR_PALETTE = [
  '#F59E0B', '#3B82F6', '#8B5CF6', '#14B8A6',
  '#F43F5E', '#22C55E', '#EAB308', '#6366F1',
];

const STATUS_META = {
  active:    { label: 'Activo',     tone: 'info',    icon: Play },
  completed: { label: 'Completado', tone: 'done',     icon: CheckCircle2 },
  archived:  { label: 'Archivado',  tone: 'neutral',  icon: Archive },
};

/** Subconjunto liviano del itemView de Queue — solo lo que se muestra aquí. */
function projectItemView(item) {
  const q = item.quote;
  const v = item.vault;
  if (q) {
    return {
      piece_name: q.piece_name, printer_name: q.printer_name,
      weight_grams: q.weight_grams, print_time_hours: q.print_time_hours,
    };
  }
  if (v) {
    return {
      piece_name: v.name, printer_name: v.printer_name,
      weight_grams: v.weight_grams, print_time_hours: v.print_time_hours,
    };
  }
  return { piece_name: item.notes || `Item #${item.id}`, printer_name: null, weight_grams: null, print_time_hours: null };
}

function itemStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'printing')  return { label: 'Imprimiendo', tone: 'printing', icon: Play };
  if (s === 'done')      return { label: 'Listo',       tone: 'done',     icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelado',   tone: 'danger',   icon: XCircle };
  return { label: 'Pendiente', tone: 'pending', icon: Pause };
}

const fmtTimeHours = (h) => (h == null || !Number.isFinite(Number(h)) ? '—' : `${Number(h).toFixed(1)}h`);

// ─── Progress bar ───────────────────────────────────────────────────────────

function ProjectProgressBar({ project }) {
  const total = project.total_items || 0;
  const donePct = total > 0 ? (project.done_count / total) * 100 : 0;
  const printingPct = total > 0 ? (project.printing_count / total) * 100 : 0;
  const cancelledPct = total > 0 ? (project.cancelled_count / total) * 100 : 0;
  return (
    <div>
      <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden flex">
        <div style={{ width: `${donePct}%`, background: '#34D399' }} />
        <div style={{ width: `${printingPct}%`, background: '#38BDF8' }} />
        <div style={{ width: `${cancelledPct}%`, background: '#F43F5E55' }} />
      </div>
      <p className="mono text-[10.5px] text-gunmetal mt-1">
        {project.done_count}/{total} listos
        {project.printing_count > 0 ? ` · ${project.printing_count} imprimiendo` : ''}
        {project.pending_count > 0 ? ` · ${project.pending_count} pendientes` : ''}
      </p>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen, onEdit, onDelete, onExport }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = STATUS_META[project.status] || STATUS_META.active;
  const accent = project.color || ACCENT;
  return (
    <Card
      as="div" interactive
      className="p-4 flex flex-col gap-3 cursor-pointer"
      style={{ borderLeft: `3px solid ${accent}` }}
      onClick={() => onOpen(project)}
    >
      <div className="flex items-start gap-3">
        {project.has_cover ? (
          <img
            src={getProjectCoverUrl(project.id, project.updated_at)}
            alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
        ) : (
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ background: `${accent}1A`, color: accent, border: `1px solid ${accent}40` }}
          >
            <FolderKanban size={16} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <StatusPill tone={meta.tone} icon={meta.icon}>{meta.label}</StatusPill>
            {project.external_url && (
              <a
                href={project.external_url}
                target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gunmetal hover:text-tech-white"
                aria-label="Link externo"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">{project.name}</p>
          {project.client_name && (
            <p className="mono text-[10.5px] text-gunmetal truncate">{project.client_name}</p>
          )}
          {project.client_quote_code && (
            <p className="mono text-[10.5px] text-amber-300/80 truncate">{project.client_quote_code}</p>
          )}
        </div>
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded text-gunmetal hover:text-tech-white hover:bg-white/5"
            aria-label="Opciones de proyecto"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surf-card)] shadow-xl py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onEdit(project); }}
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onExport(project); }}
                >
                  <Download size={12} /> Exportar
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onDelete(project); }}
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <ProjectProgressBar project={project} />
    </Card>
  );
}

// ─── Form modal (crear/editar) ──────────────────────────────────────────────

function ProjectFormModal({ mode, initial, onCancel, onSave, onCoverUploaded }) {
  const [name, setName] = useState(initial?.name || '');
  const [clientName, setClientName] = useState(initial?.client_name || '');
  const [status, setStatus] = useState(initial?.status || 'active');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [color, setColor] = useState(initial?.color || '');
  const [externalUrl, setExternalUrl] = useState(initial?.external_url || '');
  const [clientQuoteId, setClientQuoteId] = useState(initial?.client_quote_id ? String(initial.client_quote_id) : '');
  const [quotes, setQuotes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    getClientQuotes()
      .then((res) => setQuotes(res.data || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        client_name: clientName.trim() || null,
        ...(mode === 'edit' ? { status } : {}),
        notes: notes.trim() || null,
        color: color || null,
        external_url: externalUrl.trim() || null,
        client_quote_id: clientQuoteId ? parseInt(clientQuoteId, 10) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !initial?.id) return;
    setUploadingCover(true);
    try {
      const res = await uploadProjectCover(initial.id, file);
      toast.success('Portada actualizada');
      onCoverUploaded?.(res.data);
    } catch {
      toast.error('No se pudo subir la portada');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const isMobile = useIsMobile();
  const title = mode === 'edit' ? 'Editar proyecto' : 'Nuevo proyecto';

  const body = (
    <>
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-xs text-gunmetal mb-1">Nombre <span className="text-rose-400">*</span></span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Encargo boda Ana & Luis"
              className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gunmetal mb-1">Cliente</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="ej. Ana Gómez"
              className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gunmetal mb-1">Cotización vinculada</span>
            <select
              value={clientQuoteId}
              onChange={(e) => setClientQuoteId(e.target.value)}
              className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm"
            >
              <option value="">Sin cotización vinculada</option>
              {quotes.map((q) => (
                <option key={q.id} value={String(q.id)}>
                  {`COT-${String(q.id).padStart(4, '0')} · ${q.client_name}`}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gunmetal mb-1">Link externo</span>
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://makerworld.com/models/…"
              className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <div>
            <span className="block text-xs text-gunmetal mb-1.5">Color</span>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c === color ? '' : c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform"
                  style={{ background: c, borderColor: color === c ? '#fff' : 'transparent', transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          {mode === 'edit' && (
            <label className="block">
              <span className="block text-xs text-gunmetal mb-1">Estado</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm"
              >
                <option value="active">Activo</option>
                <option value="completed">Completado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
          )}
          {mode === 'edit' && (
            <label className="block">
              <span className="block text-xs text-gunmetal mb-1">Foto de portada</span>
              <div className="flex items-center gap-2">
                {initial?.has_cover && (
                  <img
                    src={getProjectCoverUrl(initial.id, initial.updated_at)}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                )}
                <label className="tf-btn-ghost inline-flex items-center gap-1.5 cursor-pointer text-xs">
                  <Upload size={12} />
                  {uploadingCover ? 'Subiendo…' : initial?.has_cover ? 'Reemplazar' : 'Subir imagen'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    aria-label="Subir foto de portada"
                    onChange={handleCoverChange} disabled={uploadingCover}
                  />
                </label>
              </div>
            </label>
          )}
          <label className="block">
            <span className="block text-xs text-gunmetal mb-1">Notas</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm resize-y"
            />
          </label>
        </div>
    </>
  );

  const footer = (
    <div className="flex gap-2 w-full">
      <button onClick={onCancel} className="tf-btn-ghost flex-1" disabled={saving}>Cancelar</button>
      <button onClick={submit} className="tf-btn-primary flex-1" disabled={saving || !name.trim()}>
        {saving ? 'Guardando…' : mode === 'edit' ? 'Guardar' : 'Crear'}
      </button>
    </div>
  );

  // Fix #167 (P6): antes modal centrado `tf-modal-overlay max-w-md` en ambos
  // shells — única inconsistencia de una página ya dual. Ahora MobileSheet
  // desde abajo <1024 / DetailDrawer lateral ≥1024. Ref: projects-history.html
  // §Projects (drawers de SettingsPage).
  if (isMobile) {
    return (
      <MobileSheet open onClose={onCancel} title={title} height="full">
        <div className="px-5 pt-4 pb-4">{body}</div>
        <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">
          {footer}
        </div>
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open
      onClose={onCancel}
      eyebrow={mode === 'edit' ? 'PROYECTO' : 'NUEVO PROYECTO'}
      title={title}
      width={460}
      footer={footer}
    >
      {body}
    </DetailDrawer>
  );
}

// ─── Detail (items del proyecto) ───────────────────────────────────────────

function ProjectItemRow({ item }) {
  const v = projectItemView(item);
  const badge = itemStatusBadge(item.status);
  return (
    <Card className="p-3 flex items-center gap-3">
      <StatusPill tone={badge.tone} icon={badge.icon}>{badge.label}</StatusPill>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-tech-white truncate">{v.piece_name}</p>
        <p className="mono text-[10.5px] text-gunmetal truncate">
          {v.printer_name || '—'} ·{' '}
          {v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)}g` : '—'} ·{' '}
          {fmtTimeHours(v.print_time_hours)}
        </p>
      </div>
    </Card>
  );
}

function ProjectFileThumb({ file, onRemove }) {
  return (
    <div className="relative group">
      <div className="w-full aspect-square rounded-md bg-[var(--color-surf-sidebar)] overflow-hidden flex items-center justify-center">
        {file.local_thumbnail_url ? (
          <img src={file.local_thumbnail_url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileBox size={20} className="text-gunmetal" />
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Quitar ${file.name} del proyecto`}
      >
        <X size={11} />
      </button>
      <p className="text-[10px] text-gunmetal truncate mt-1" title={file.name}>{file.name}</p>
    </div>
  );
}

function ProjectDetailBody({ project, items, loadingItems, linkedFiles, loadingFiles, onRemoveFile }) {
  if (!project) return null;
  return (
    <div className="flex flex-col gap-4">
      {project.has_cover && (
        <img
          src={getProjectCoverUrl(project.id, project.updated_at)}
          alt=""
          className="w-full h-32 rounded-lg object-cover"
        />
      )}
      {project.external_url && (
        <a
          href={project.external_url}
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200"
        >
          <ExternalLink size={13} /> Ver link externo
        </a>
      )}
      {project.client_quote_code && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Cotización vinculada</span>
          <p className="text-sm text-tech-white mt-0.5 flex items-center gap-1.5">
            <Receipt size={13} className="text-amber-300" />
            {project.client_quote_code}
            {project.client_quote_client_name ? ` · ${project.client_quote_client_name}` : ''}
          </p>
        </Card>
      )}
      {project.client_name && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Cliente</span>
          <p className="text-sm text-tech-white mt-0.5">{project.client_name}</p>
        </Card>
      )}
      {project.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{project.notes}</p>
        </Card>
      )}
      <ProjectProgressBar project={project} />
      <div>
        <span className="lbl-eyebrow text-[9px] mb-1.5 block">
          Archivos vinculados ({linkedFiles?.length || 0})
        </span>
        {loadingFiles ? (
          <p className="text-xs text-gunmetal py-4 text-center">Cargando…</p>
        ) : !linkedFiles || linkedFiles.length === 0 ? (
          <p className="text-xs text-gunmetal py-3 text-center">
            Sin archivos vinculados — asígnalos desde Vault (selección múltiple → "Asignar a proyecto").
          </p>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
            {linkedFiles.map((f) => (
              <ProjectFileThumb key={f.id} file={f} onRemove={onRemoveFile} />
            ))}
          </div>
        )}
      </div>
      <div>
        <span className="lbl-eyebrow text-[9px] mb-1.5 block">
          Items de cola ({project.total_items || 0})
        </span>
        {loadingItems ? (
          <p className="text-xs text-gunmetal py-4 text-center">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gunmetal py-4 text-center">
            Este proyecto todavía no tiene items encolados.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ProjectItemRow key={it.id} item={it} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(null); // { mode: 'create'|'edit', project? }
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [linkedFiles, setLinkedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getProjects();
      setProjects(res.data || []);
    } catch {
      toast.error('No se pudo cargar los proyectos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Mantiene `selected` (el drawer abierto) sincronizado con `projects`
  // cada vez que se refresca la lista (tras editar/borrar/cambiar un
  // item de cola) — sin esto, el drawer seguía mostrando el progreso
  // capturado al abrirlo aunque `projects` ya tuviera datos nuevos.
  useEffect(() => {
    setSelected((cur) => {
      if (!cur) return cur;
      const updated = projects.find((p) => p.id === cur.id);
      return updated || cur;
    });
  }, [projects]);

  const openProject = async (project) => {
    setSelected(project);
    setLoadingItems(true);
    setLoadingFiles(true);
    try {
      const res = await getProjectItems(project.id);
      setItems(res.data || []);
    } catch {
      toast.error('No se pudo cargar los items del proyecto');
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
    try {
      const res = await getProjectFiles(project.id);
      setLinkedFiles(res.data || []);
    } catch {
      setLinkedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleRemoveFile = async (fileId) => {
    if (!selected) return;
    try {
      await removeProjectFile(selected.id, fileId);
      setLinkedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      toast.error('No se pudo quitar el archivo del proyecto');
    }
  };

  const handleSave = async (payload) => {
    try {
      if (formModal.mode === 'edit') {
        await updateProject(formModal.project.id, payload);
        toast.success('Proyecto actualizado');
      } else {
        await createProject(payload);
        toast.success('Proyecto creado');
      }
      setFormModal(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo guardar el proyecto');
    }
  };

  const handleDelete = async (project) => {
    const ok = await confirm(
      `¿Eliminar el proyecto "${project.name}"? Los items de cola no se borran, solo quedan sin agrupar.`,
      'Eliminar',
    );
    if (!ok) return;
    try {
      await deleteProject(project.id);
      toast.success('Proyecto eliminado');
      if (selected?.id === project.id) setSelected(null);
      await load();
    } catch {
      toast.error('No se pudo eliminar el proyecto');
    }
  };

  const handleExport = async (project) => {
    try {
      await exportProject(project.id, project.name);
    } catch {
      toast.error('No se pudo exportar el proyecto');
    }
  };

  const [importing, setImporting] = useState(false);
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      await importProject(file);
      toast.success('Proyecto importado');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo importar el proyecto');
    } finally {
      setImporting(false);
    }
  };

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const totalItems = projects.reduce((acc, p) => acc + (p.total_items || 0), 0);

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Proyectos" value={projects.length} unit="docs" sub={`${activeCount} activos`} accent={ACCENT} icon={FolderKanban} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Completados" value={completedCount} unit="docs" sub="listos" accent="#34D399" icon={CheckCircle2} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Items agrupados" value={totalItems} unit="items" sub="en todos los proyectos" accent="#38BDF8" icon={FileText} />
      </div>
    </div>
  );

  const Grid = (
    <div
      className="px-4 md:px-6 pb-8 grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
    >
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          onOpen={openProject}
          onEdit={(proj) => setFormModal({ mode: 'edit', project: proj })}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      ))}
    </div>
  );

  const Empty = (
    <EmptyState
      icon={FolderKanban}
      accent={ACCENT}
      title="Sin proyectos todavía"
      hint="Crea un proyecto para agrupar varias impresiones de un mismo encargo o cliente."
      action={
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setFormModal({ mode: 'create' })}>
          Nuevo proyecto
        </Button>
      }
    />
  );

  const detailFooter = selected && (
    <Button
      variant="ghost"
      icon={Pencil}
      onClick={() => setFormModal({ mode: 'edit', project: selected })}
      className="flex-1 justify-center"
    >
      Editar proyecto
    </Button>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Proyectos"
          appIcon={FolderKanban}
          appAccent={ACCENT}
          title="Proyectos"
          onMenu={() => openSidebar?.()}
        />
        <div className="mt-1">{KPIs}</div>
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando proyectos…</p>
        ) : projects.length === 0 ? (
          <div className="mt-3 pb-28">{Empty}</div>
        ) : (
          <div className="pb-28">{Grid}</div>
        )}
        <button
          type="button"
          onClick={() => setFormModal({ mode: 'create' })}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
          style={{ background: ACCENT, color: '#0A1014', boxShadow: `0 8px 24px ${ACCENT}55` }}
          aria-label="Nuevo proyecto"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nuevo
        </button>
        <MobileSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} height="full">
          <div className="px-5 pt-4 pb-3">
            <ProjectDetailBody
              project={selected} items={items} loadingItems={loadingItems}
              linkedFiles={linkedFiles} loadingFiles={loadingFiles} onRemoveFile={handleRemoveFile}
            />
          </div>
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              {detailFooter}
            </div>
          )}
        </MobileSheet>
        {formModal && (
          <ProjectFormModal
            mode={formModal.mode}
            initial={formModal.project}
            onCancel={() => setFormModal(null)}
            onSave={handleSave}
            onCoverUploaded={load}
          />
        )}
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
            <FolderKanban size={13} />
          </span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Proyectos</span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel ml-1">
            {projects.length}
          </span>
        </div>
        <label className="btn btn-ghost btn-sm cursor-pointer">
          <Upload size={13} /> {importing ? 'Importando…' : 'Importar'}
          <input
            type="file" accept=".zip" className="hidden"
            aria-label="Importar proyecto (ZIP)"
            onChange={handleImportFile} disabled={importing}
          />
        </label>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setFormModal({ mode: 'create' })}>
          Nuevo proyecto
        </Button>
      </header>

      {KPIs}

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando proyectos…</p>
      ) : projects.length === 0 ? (
        Empty
      ) : (
        Grid
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? `PROYECTO · ${STATUS_META[selected.status]?.label || selected.status}` : undefined}
        title={selected?.name || ''}
        width={460}
        footer={detailFooter}
      >
        <ProjectDetailBody
              project={selected} items={items} loadingItems={loadingItems}
              linkedFiles={linkedFiles} loadingFiles={loadingFiles} onRemoveFile={handleRemoveFile}
            />
      </DetailDrawer>

      {formModal && (
        <ProjectFormModal
          mode={formModal.mode}
          initial={formModal.project}
          onCancel={() => setFormModal(null)}
          onSave={handleSave}
          onCoverUploaded={load}
        />
      )}
    </div>
  );
}
