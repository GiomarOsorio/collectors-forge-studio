/**
 * @file Página de la app Vault — galería de modelos `.3mf` / `.stl` / `.gcode.3mf`.
 *
 * Thumbnails locales (extraídos del ZIP del modelo, o renderizados
 * server-side para `.stl`) con prioridad sobre el `thumbnail_url` externo.
 * Cada modelo puede tener un slot `source_file` (`.3mf` o `.stl` editable)
 * y/o `print_file` (`.gcode.3mf` laminado, listo para imprimir desde la
 * cola). Los `.stl` obtienen un preview 3D interactivo en el detalle
 * (`StlLivePreview` + `ModelViewer3D`) en vez del thumbnail estático.
 *
 * @module pages/vault/VaultPage
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Archive,
  Boxes,
  ChevronRight,
  Download,
  FileBox,
  Folder,
  FolderPlus,
  HardDrive,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Search,
  Tag,
  Trash,
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
import ModelViewer3D from '../../components/ModelViewer3D';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  createVaultFolder,
  createVaultTag,
  deleteVaultFile,
  deleteVaultFolder,
  deleteVaultTag,
  setActiveVaultPlate,
  downloadVaultPrint,
  downloadVaultSource,
  getVaultFiles,
  getVaultFolders,
  getVaultGcodeContent,
  getVaultStats,
  getVaultTags,
  updateVaultFile,
  updateVaultFolder,
  updateVaultTag,
} from '../../services/api';
import { apiErrorMsg } from '../../utils/apiError';
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

/** Camino de carpetas desde la raíz hasta `folderId` (excluida la raíz). */
const buildBreadcrumb = (folders, folderId) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path = [];
  let current = folderId != null ? byId.get(folderId) : null;
  while (current) {
    path.unshift(current);
    current = current.parent_id != null ? byId.get(current.parent_id) : null;
  }
  return path;
};

/**
 * IDs de todos los descendientes de `folderId` (hijos, nietos, etc.) —
 * usado para excluir del picker "mover a…" los destinos que el backend
 * (`_assert_not_own_descendant`) siempre va a rechazar.
 */
const getDescendantIds = (folders, folderId) => {
  const childrenOf = new Map();
  for (const f of folders) {
    if (f.parent_id != null) {
      if (!childrenOf.has(f.parent_id)) childrenOf.set(f.parent_id, []);
      childrenOf.get(f.parent_id).push(f.id);
    }
  }
  const result = new Set();
  const queue = [...(childrenOf.get(folderId) || [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenOf.get(id) || []));
  }
  return result;
};

// ─── Carpetas ───────────────────────────────────────────────────────────────

/**
 * Tarjeta de carpeta — visualmente distinta de VaultCard (sin thumbnail),
 * mismo tamaño para alinear en el grid. Click navega adentro; el menú
 * "..." (solo admin) abre renombrar/mover/eliminar.
 */
function FolderCard({ folder, folders, isAdmin, onOpen, onRename, onMove, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Excluye la carpeta misma Y sus descendientes — moverla ahí siempre
  // lo rechaza el backend (_assert_not_own_descendant), así que no se
  // ofrecen como destino válido en el picker.
  const excludedIds = getDescendantIds(folders, folder.id);
  const otherFolders = folders.filter((f) => f.id !== folder.id && !excludedIds.has(f.id));
  return (
    <Card className="relative text-left w-full overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(folder.id)}
        className="h-40 bg-[var(--color-surf-sidebar)] flex items-center justify-center w-full"
      >
        <Folder size={40} style={{ color: `${ACCENT}88` }} />
      </button>
      <div className="p-3 flex items-center gap-2">
        <button type="button" onClick={() => onOpen(folder.id)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-tech-white truncate" title={folder.name}>
            {folder.name}
          </p>
          <p className="mono text-[10.5px] text-gunmetal truncate">
            {folder.file_count} archivo{folder.file_count === 1 ? '' : 's'}
          </p>
        </button>
        {isAdmin && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="p-1.5 rounded text-gunmetal hover:text-tech-white hover:bg-white/5"
              aria-label="Opciones de carpeta"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surf-card)] shadow-xl py-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5 flex items-center gap-2"
                    onClick={() => { setMenuOpen(false); onRename(folder); }}
                  >
                    <Pencil size={12} /> Renombrar
                  </button>
                  {otherFolders.length > 0 && (
                    <div className="px-3 py-1.5">
                      <span className="block text-[10px] text-gunmetal mb-1">Mover a…</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          setMenuOpen(false);
                          if (val === '__root__') onMove(folder, null);
                          else if (val) onMove(folder, Number(val));
                        }}
                        className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded text-[11px] text-tech-white px-1.5 py-1"
                      >
                        <option value="" disabled>— elegir —</option>
                        <option value="__root__">Raíz (Vault)</option>
                        {otherFolders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    onClick={() => { setMenuOpen(false); onDelete(folder); }}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Modal simple (crear/renombrar carpeta) — reusa las clases globales tf-modal*. */
function FolderNameModal({ mode, initialName, onCancel, onSave }) {
  const [name, setName] = useState(initialName || '');
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };
  return (
    <div className="tf-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="tf-modal max-w-sm">
        <p className="text-tech-white text-sm font-semibold mb-3">
          {mode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Nombre de la carpeta"
          className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-rose-500 mb-5"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="tf-btn-ghost">Cancelar</button>
          <button onClick={submit} className="tf-btn-primary" disabled={!name.trim()}>
            {mode === 'rename' ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de gestión del catálogo de tags — crear nuevo, renombrar y
 * eliminar. Cada fila existente es rename-inline (blur/Enter para
 * guardar) + botón eliminar; arriba un input para crear uno nuevo.
 */
function TagsManageModal({ tags, onClose, onCreate, onRename, onDelete }) {
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState({}); // { [tagId]: draftName }

  const submitCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
  };

  const submitRename = (tag) => {
    const draft = (drafts[tag.id] ?? tag.name).trim();
    if (!draft || draft === tag.name) return;
    onRename(tag.id, draft);
  };

  return (
    <div className="tf-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="tf-modal max-w-sm">
        <p className="text-tech-white text-sm font-semibold mb-3">Gestionar tags</p>

        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
            placeholder="Nuevo tag…"
            className="flex-1 bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-rose-500"
          />
          <button onClick={submitCreate} className="tf-btn-primary" disabled={!newName.trim()}>
            Crear
          </button>
        </div>

        {tags.length === 0 ? (
          <p className="text-xs text-gunmetal text-center py-4">Sin tags todavía.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto mb-5">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <input
                  value={drafts[t.id] ?? t.name}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                  onBlur={() => submitRename(t)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  className="flex-1 bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2 py-1 text-tech-white text-xs focus:outline-none focus:border-rose-500"
                />
                <span className="mono text-[10px] text-gunmetal shrink-0">{t.file_count}</span>
                <button
                  onClick={() => onDelete(t)}
                  className="p-1 rounded text-gunmetal hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                  aria-label={`Eliminar tag ${t.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="tf-btn-ghost">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

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
/**
 * Preview 3D interactivo para archivos `.stl` en el detalle del Vault
 * (issue #129). Descarga el `.stl` autenticado como blob — el `STLLoader`
 * de three.js hace su propio `fetch` interno y no puede enviar el header
 * `Authorization`, por eso no se le puede pasar la URL del endpoint
 * directo (`/api/vault/{id}/download/source`), sino un blob: URL local.
 */
function StlLivePreview({ fileId, fileName }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setLoading(true);
    setError(false);
    downloadVaultSource(fileId)
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (error) return null;
  if (loading || !blobUrl) {
    return (
      <div className="h-48 rounded-lg overflow-hidden bg-[var(--color-surf-sidebar)] border border-[var(--color-border)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }
  return <ModelViewer3D url={blobUrl} fileName={fileName} />;
}

/**
 * Modal del visor de G-code (`gcode-preview`, WebGL) para archivos con
 * `.gcode.3mf` laminado (issue #129). Descarga el G-code plano del plate
 * activo vía `getVaultGcodeContent` (autenticado, ya viene como texto) y
 * lo renderiza capa por capa. `dispose()` en el cleanup evita acumular
 * contextos WebGL si React StrictMode monta el efecto dos veces en dev.
 */
function GCodeViewerModal({ fileId, fileName, onClose }) {
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [maxLayer, setMaxLayer] = useState(0);
  const [layer, setLayer] = useState(0);
  const [showTravel, setShowTravel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // `gcode-preview` carga bundleado su propia copia de three.js (dep
    // directa, no peer — versión distinta a la de @react-three/fiber) —
    // import dinámico para que ese peso solo se pague al abrir el visor,
    // no en cada carga de VaultPage.
    Promise.all([getVaultGcodeContent(fileId), import('gcode-preview')])
      .then(([res, { init }]) => {
        if (cancelled || !canvasRef.current) return;
        const preview = init({ canvas: canvasRef.current, renderTravel: false });
        previewRef.current = preview;
        preview.processGCode(res.data);
        preview.render();
        const top = preview.maxLayerIndex ?? 0;
        setMaxLayer(top);
        setLayer(top);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMsg(err, 'No se pudo cargar el G-code'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      previewRef.current?.dispose?.();
      previewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Slider de capas: no re-parsea el gcode, solo re-dibuja hasta `layer`.
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.endLayer = layer;
    previewRef.current.render();
  }, [layer]);

  // Toggle travel moves: los segmentos ya están parseados (processGCode los
  // guarda a ambos), solo cambia si `render()` los dibuja o no.
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.renderTravel = showTravel;
    previewRef.current.render();
  }, [showTravel]);

  return (
    <div className="tf-modal-overlay" onClick={onClose}>
      <div
        className="bg-surf-panel border border-border-legacy rounded-xl w-full max-w-3xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-soft)]">
          <p className="text-sm font-semibold text-tech-white truncate">{fileName}</p>
          <button type="button" onClick={onClose} className="text-gunmetal hover:text-tech-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="relative w-full h-[420px] bg-black">
          <canvas ref={canvasRef} className="w-full h-full block" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="w-7 h-7 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="mono text-[10.5px] text-gunmetal shrink-0 w-24">
              Capa {layer + 1} / {maxLayer + 1}
            </span>
            <input
              type="range"
              min={0}
              max={maxLayer}
              value={layer}
              onChange={(e) => setLayer(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-steel cursor-pointer">
            <input
              type="checkbox"
              checked={showTravel}
              onChange={(e) => setShowTravel(e.target.checked)}
            />
            Mostrar movimientos de desplazamiento (travel)
          </label>
        </div>
      </div>
    </div>
  );
}

function VaultDrawerBody({ file, onActivePlateChange, isAdmin, folders, onMoveFile }) {
  if (!file) return null;
  const thumb = getThumbnail(file);
  const isStlSource = file.source_file_name?.toLowerCase().endsWith('.stl');
  const sliceTime = fmtTime(file.sliced_time_seconds);
  const plates = Array.isArray(file.plates) ? file.plates : [];
  const hasMultiplePlates = plates.length > 1;
  const activeIdx = file.active_plate_index ?? 0;
  const currentFolder = folders?.find((f) => f.id === file.folder_id);
  return (
    <div className="flex flex-col gap-4">
      {isAdmin && Array.isArray(folders) && (
        <div>
          <span className="lbl-eyebrow text-[9px] mb-1.5 block">Carpeta</span>
          <select
            value={file.folder_id ?? ''}
            onChange={(e) => onMoveFile?.(file, e.target.value === '' ? null : Number(e.target.value))}
            className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-rose-500"
          >
            <option value="">Raíz (Vault)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}
      {!isAdmin && currentFolder && (
        <p className="mono text-[10.5px] text-gunmetal -mb-2">📁 {currentFolder.name}</p>
      )}
      {isStlSource ? (
        <StlLivePreview fileId={file.id} fileName={file.source_file_name} />
      ) : (
        <div
          className="h-48 rounded-lg overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center border border-[var(--color-border)]"
        >
          {thumb ? (
            // object-contain + object-center: el modelo siempre se ve completo
            // y centrado aunque el container cambie de ancho (sidebar abriendo).
            // Issue #72 — el bug previo era object-cover que recortaba y movía
            // el "centro visible" cuando cambiaba el ancho del drawer.
            <img src={thumb} alt={file.name} className="w-full h-full object-contain object-center" />
          ) : (
            <Archive size={50} style={{ color: `${ACCENT}55` }} />
          )}
        </div>
      )}

      {/* Plate picker — issue #68. Solo aparece si hay >1 plate. */}
      {hasMultiplePlates && (
        <div>
          <span className="lbl-eyebrow text-[9px] mb-1.5 block">
            Plates ({plates.length}) · principal: #{activeIdx + 1}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {plates.map((p) => {
              const active = p.plate_index === activeIdx;
              return (
                <button
                  key={p.plate_index}
                  type="button"
                  onClick={() => onActivePlateChange?.(p.plate_index)}
                  className="shrink-0 rounded-md overflow-hidden flex flex-col items-stretch transition-all"
                  style={{
                    border: active
                      ? `2px solid ${ACCENT}`
                      : '2px solid var(--color-border)',
                    background: 'var(--color-surf-sidebar)',
                    width: 80,
                  }}
                  title={`Plate ${p.plate_index + 1}${p.weight_g ? ` · ${Math.round(p.weight_g)}g` : ''}`}
                >
                  <div className="h-16 flex items-center justify-center bg-[var(--color-surf-sidebar)]">
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={`Plate ${p.plate_index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Archive size={20} style={{ color: `${ACCENT}88` }} />
                    )}
                  </div>
                  <div
                    className="mono text-[9px] py-1 text-center"
                    style={{
                      background: active ? `${ACCENT}25` : 'transparent',
                      color: active ? ACCENT : 'var(--color-steel)',
                    }}
                  >
                    #{p.plate_index + 1}
                    {p.weight_g ? ` · ${Math.round(p.weight_g)}g` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              {file.source_file_name || 'Sin .3mf/.stl editable'}
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
                : 'Lamina con tu slicer y vuelve a subir'}
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
  onViewGcode,
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
      {file.is_print_ready && (
        <Button
          variant="ghost"
          size="sm"
          icon={Boxes}
          onClick={() => onViewGcode(file)}
          title="Visor 3D del G-code, capa por capa"
        >
          Ver G-code
        </Button>
      )}
      {file.source_file_name && (
        <Button
          variant={file.is_print_ready ? 'ghost' : 'primary'}
          size="sm"
          icon={Download}
          onClick={() => onDownloadSource(file)}
          className={file.is_print_ready ? '' : 'flex-1 justify-center'}
          title="Editable — .3mf para OrcaSlicer/BambuStudio, .stl para cualquier slicer"
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
          aria-label="Mover a papelera"
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
  const [gcodeViewerFile, setGcodeViewerFile] = useState(null);

  // Carpetas — `currentFolderId=null` es la raíz del Vault. `folders` es
  // la lista plana completa (para armar breadcrumb + subcarpetas + el
  // selector "mover a carpeta" del drawer).
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderModal, setFolderModal] = useState(null); // { mode: 'create'|'rename', folder? }

  // Tags — catálogo global (independiente de la carpeta actual) + filtro
  // activo (multi-select AND: el archivo debe tener TODOS los tags elegidos).
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const childFolders = folders.filter((f) => (f.parent_id ?? null) === currentFolderId);
  const breadcrumb = buildBreadcrumb(folders, currentFolderId);

  // Reset a página 1 cada vez que cambia el query efectivo.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, pageSize, currentFolderId, activeTagIds]);

  const loadFolders = async () => {
    try {
      const res = await getVaultFolders();
      setFolders(res.data || []);
    } catch {
      // Silencioso — el Vault sigue usable sin árbol de carpetas.
    }
  };

  const loadTags = async () => {
    try {
      const res = await getVaultTags();
      setTags(res.data || []);
    } catch {
      // Silencioso — el Vault sigue usable sin catálogo de tags.
    }
  };

  const load = async () => {
    setLoading(true);
    const params = { page, page_size: pageSize };
    if (debouncedQuery) {
      // Una búsqueda activa ignora el filtro de carpeta — busca en todo
      // el Vault. Si no, el usuario podría creer que un archivo se perdió
      // solo porque está parado en otra carpeta.
      params.q = debouncedQuery;
    } else if (currentFolderId != null) {
      params.folder_id = currentFolderId;
    } else {
      params.root_only = true;
    }
    if (activeTagIds.length > 0) params.tag_ids = activeTagIds.join(',');
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
    loadFolders();
    loadTags();
  }, []);

  useEffect(() => {
    load().catch(() => {
      toast.error('No se pudo cargar el Vault');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedQuery, currentFolderId, activeTagIds]);

  const handleCreateFolder = async (name) => {
    try {
      await createVaultFolder({ name, parent_id: currentFolderId });
      setFolderModal(null);
      toast.success('Carpeta creada');
      await loadFolders();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo crear la carpeta');
    }
  };

  const handleRenameFolder = async (name) => {
    try {
      await updateVaultFolder(folderModal.folder.id, { name });
      setFolderModal(null);
      toast.success('Carpeta renombrada');
      await loadFolders();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo renombrar la carpeta');
    }
  };

  const handleMoveFolder = async (folder, newParentId) => {
    try {
      if (newParentId == null) {
        await updateVaultFolder(folder.id, { move_to_root: true });
      } else {
        await updateVaultFolder(folder.id, { parent_id: newParentId });
      }
      toast.success('Carpeta movida');
      await loadFolders();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo mover la carpeta');
    }
  };

  const handleDeleteFolder = async (folder) => {
    const hasChildren = folders.some((f) => f.parent_id === folder.id);
    const msg = hasChildren
      ? `"${folder.name}" tiene subcarpetas — se eliminarán también. Los archivos dentro subirán a la raíz. ¿Continuar?`
      : `¿Eliminar la carpeta "${folder.name}"? Los archivos dentro subirán a la raíz.`;
    const ok = await confirm(msg, 'Eliminar');
    if (!ok) return;
    try {
      await deleteVaultFolder(folder.id);
      toast.success('Carpeta eliminada');
      await loadFolders();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar la carpeta');
    }
  };

  const handleCreateTag = async (name) => {
    try {
      await createVaultTag(name);
      toast.success('Tag creado');
      await loadTags();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo crear el tag');
    }
  };

  const handleRenameTag = async (tagId, name) => {
    try {
      await updateVaultTag(tagId, name);
      toast.success('Tag renombrado');
      await loadTags();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo renombrar el tag');
    }
  };

  const handleDeleteTag = async (tag) => {
    const ok = await confirm(
      `¿Eliminar el tag "${tag.name}"? Los archivos que lo tienen no se borran, solo pierden esa etiqueta.`,
      'Eliminar',
    );
    if (!ok) return;
    try {
      await deleteVaultTag(tag.id);
      toast.success('Tag eliminado');
      setActiveTagIds((cur) => cur.filter((id) => id !== tag.id));
      await loadTags();
      await load();
    } catch {
      toast.error('No se pudo eliminar el tag');
    }
  };

  const handleToggleTagFilter = (tagId) => {
    setActiveTagIds((cur) =>
      cur.includes(tagId) ? cur.filter((id) => id !== tagId) : [...cur, tagId],
    );
  };

  /** Mueve el archivo del drawer a otra carpeta (o a la raíz con folderId=null). */
  const handleMoveFile = async (file, folderId) => {
    try {
      const res = await updateVaultFile(file.id, { folder_id: folderId });
      setSelected(res.data);
      toast.success('Archivo movido');
      await load();
      await loadFolders();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo mover el archivo');
    }
  };

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

  /**
   * Cambia el plate activo del modelo seleccionado (issue #68). Actualiza
   * el `selected` local + recarga la lista para reflejar el nuevo thumbnail
   * en el grid.
   */
  const handleActivePlateChange = async (plateIndex) => {
    if (!selected) return;
    try {
      const res = await setActiveVaultPlate(selected.id, plateIndex);
      setSelected(res.data);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cambiar el plate activo');
    }
  };

  const handleDelete = async (f) => {
    const ok = await confirm(`¿Mover "${f.name}" a la papelera? Puedes restaurarlo después.`, 'Mover a papelera');
    if (!ok) return false;
    try {
      await deleteVaultFile(f.id);
      toast.success('Archivo movido a la papelera');
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

  const FolderBreadcrumb = (
    <div className="flex flex-wrap items-center gap-1.5 px-4 md:px-6 pt-1">
      <button
        type="button"
        onClick={() => setCurrentFolderId(null)}
        className={`mono text-[11px] px-1.5 py-0.5 rounded hover:bg-white/5 ${currentFolderId === null ? 'text-tech-white font-semibold' : 'text-gunmetal'}`}
      >
        Vault
      </button>
      {breadcrumb.map((f) => (
        <span key={f.id} className="flex items-center gap-1.5">
          <ChevronRight size={11} className="text-gunmetal-dim" />
          <button
            type="button"
            onClick={() => setCurrentFolderId(f.id)}
            className={`mono text-[11px] px-1.5 py-0.5 rounded hover:bg-white/5 ${f.id === currentFolderId ? 'text-tech-white font-semibold' : 'text-gunmetal'}`}
          >
            {f.name}
          </button>
        </span>
      ))}
      <span className="flex-1" />
      {isAdmin && (
        <button
          type="button"
          onClick={() => setFolderModal({ mode: 'create' })}
          className="mono text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-strong)] text-gunmetal hover:text-tech-white hover:border-rose-500/40 flex items-center gap-1.5"
        >
          <FolderPlus size={12} /> Nueva carpeta
        </button>
      )}
    </div>
  );

  // Cuando hay búsqueda activa, `load()` ignora el filtro de carpeta y
  // busca en todo el Vault — este aviso evita que el breadcrumb (que
  // sigue mostrando la carpeta actual) parezca contradecir los resultados.
  const SearchScopeHint = debouncedQuery && currentFolderId != null && (
    <p className="px-4 md:px-6 -mt-0.5 mono text-[10.5px] text-gunmetal">
      Buscando en todo el Vault, no solo en esta carpeta
    </p>
  );

  // Copy del empty-state: distingue "el Vault entero está vacío" de
  // "esta carpeta puntual está vacía" — antes ambos casos mostraban
  // "Vault vacío", lo cual confunde en una carpeta reciente sin archivos.
  const isEmptyNoQuery = total === 0 && !debouncedQuery;
  const emptyTitle = isEmptyNoQuery ? (currentFolderId ? 'Carpeta vacía' : 'Vault vacío') : 'Sin resultados';
  const emptyHint = isEmptyNoQuery
    ? (currentFolderId
        ? 'Sube un modelo aquí o muévelo desde otra carpeta.'
        : 'Sube tu primer .3mf para tener tus modelos organizados aquí.')
    : 'Cambia el filtro o limpia la búsqueda.';

  const FolderGrid = childFolders.length > 0 && (
    <div
      className="px-4 md:px-6 pb-3 pt-2 grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
    >
      {childFolders.map((f) => (
        <FolderCard
          key={f.id}
          folder={f}
          folders={folders}
          isAdmin={isAdmin}
          onOpen={setCurrentFolderId}
          onRename={(folder) => setFolderModal({ mode: 'rename', folder })}
          onMove={handleMoveFolder}
          onDelete={handleDeleteFolder}
        />
      ))}
    </div>
  );

  // Fila de chips de tags — filtro multi-select AND. Se omite por completo
  // si el catálogo está vacío (nada que filtrar todavía).
  const TagsFilterRail = tags.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5 px-4 md:px-6 pt-1">
      {tags.map((t) => {
        const active = activeTagIds.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => handleToggleTagFilter(t.id)}
            className={`inline-flex items-center gap-1 mono text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${
              active
                ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                : 'bg-transparent border-[var(--color-border)] text-gunmetal hover:text-tech-white'
            }`}
          >
            <Tag size={10} />
            {t.name}
            {active && <X size={10} />}
          </button>
        );
      })}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setTagsModalOpen(true)}
          className="mono text-[10.5px] text-gunmetal hover:text-tech-white underline underline-offset-2 ml-1"
        >
          gestionar tags
        </button>
      )}
    </div>
  );

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
        <div className="mt-3">{FolderBreadcrumb}</div>
        {SearchScopeHint}
        {TagsFilterRail}
        {FolderGrid}
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando Vault…</p>
        ) : files.length === 0 ? (
          <div className="mt-3 pb-28">
            {childFolders.length === 0 && (
              <EmptyState
                icon={Archive}
                accent={ACCENT}
                title={emptyTitle}
                hint={emptyHint}
                action={
                  isAdmin && isEmptyNoQuery ? (
                    <button
                      type="button"
                      onClick={() => navigate(currentFolderId ? `/vault/upload?folder=${currentFolderId}` : '/vault/upload')}
                      className="btn btn-primary btn-sm"
                    >
                      <Upload size={13} /> Subir modelo
                    </button>
                  ) : null
                }
              />
            )}
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
            onClick={() => navigate(currentFolderId ? `/vault/upload?folder=${currentFolderId}` : '/vault/upload')}
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
            <VaultDrawerBody
              file={selected}
              onActivePlateChange={handleActivePlateChange}
              isAdmin={isAdmin}
              folders={folders}
              onMoveFile={handleMoveFile}
            />
          </div>
          {selected && (
            <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
              <VaultDrawerFooter
                file={selected}
                isAdmin={isAdmin}
                onDownloadSource={handleDownloadSource}
                onDownloadPrint={handleDownloadPrint}
                onViewGcode={setGcodeViewerFile}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </MobileSheet>
        {folderModal && (
          <FolderNameModal
            mode={folderModal.mode}
            initialName={folderModal.folder?.name}
            onCancel={() => setFolderModal(null)}
            onSave={folderModal.mode === 'rename' ? handleRenameFolder : handleCreateFolder}
          />
        )}
        {tagsModalOpen && (
          <TagsManageModal
            tags={tags}
            onClose={() => setTagsModalOpen(false)}
            onCreate={handleCreateTag}
            onRename={handleRenameTag}
            onDelete={handleDeleteTag}
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
          <Link
            to={currentFolderId ? `/vault/upload?folder=${currentFolderId}` : '/vault/upload'}
            className="btn btn-primary btn-sm"
          >
            <Upload size={13} /> Subir modelo
          </Link>
        )}
      </header>

      {KPIs}
      {FolderBreadcrumb}
      {SearchScopeHint}
      {TagsFilterRail}
      {FolderGrid}

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
        childFolders.length === 0 && (
          <EmptyState
            icon={Archive}
            accent={ACCENT}
            title={emptyTitle}
            hint={emptyHint}
            action={
              isAdmin && isEmptyNoQuery ? (
                <Link
                  to={currentFolderId ? `/vault/upload?folder=${currentFolderId}` : '/vault/upload'}
                  className="btn btn-primary btn-sm"
                >
                  <Upload size={13} /> Subir modelo
                </Link>
              ) : null
            }
          />
        )
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
              onViewGcode={setGcodeViewerFile}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
            />
          )
        }
      >
        <VaultDrawerBody
          file={selected}
          onActivePlateChange={handleActivePlateChange}
          isAdmin={isAdmin}
          folders={folders}
          onMoveFile={handleMoveFile}
        />
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

      {folderModal && (
        <FolderNameModal
          mode={folderModal.mode}
          initialName={folderModal.folder?.name}
          onCancel={() => setFolderModal(null)}
          onSave={folderModal.mode === 'rename' ? handleRenameFolder : handleCreateFolder}
        />
      )}
      {tagsModalOpen && (
        <TagsManageModal
          tags={tags}
          onClose={() => setTagsModalOpen(false)}
          onCreate={handleCreateTag}
          onRename={handleRenameTag}
          onDelete={handleDeleteTag}
        />
      )}
      {gcodeViewerFile && (
        <GCodeViewerModal
          fileId={gcodeViewerFile.id}
          fileName={gcodeViewerFile.print_file_name || gcodeViewerFile.name}
          onClose={() => setGcodeViewerFile(null)}
        />
      )}
    </div>
  );
}
