/**
 * @file Página de subida al Vault — admin only.
 *
 * Soporta los dos slots de archivo definidos en `ModelFile`:
 *
 * - **source_file** (`.3mf` editable) — proyecto OrcaSlicer/BambuStudio.
 * - **print_file** (`.gcode.3mf` laminado) — paquete con G-code listo para
 *   imprimir. El backend parsea su header y autollena
 *   `sliced_weight_g` / `sliced_time_seconds` / `sliced_filament_type` para
 *   que el picker de Queue pueda meterlo directo a cola.
 *
 * Al menos uno de los dos slots tiene que estar presente. Si solo se
 * sube `.3mf` editable, "Agregar a cola" estará deshabilitado (con tooltip
 * "lamina primero con tu slicer y vuelve a subir").
 *
 * Los no-admins son redirigidos a /vault al montar el componente.
 *
 * @module pages/vault/VaultUploadPage
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileBox,
  Link as LinkIcon,
  Printer,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  DropZone,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import {
  fetchVaultMetadata,
  getVaultFile,
  getVaultFolders,
  replaceVaultPrint,
  replaceVaultSource,
  updateVaultFile,
  uploadVaultFile,
} from '../../services/api';

const ACCENT = '#F43F5E';
const ACCENT_PRINT = '#34D399';

const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

// ── Module-level form helpers (anti-pattern: NO definir dentro del componente
//    para evitar el bug cursor jump — ver formFieldFocus.test.jsx). ──────────

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-rose-500 placeholder:text-gunmetal-dim';

function FormSectionTitle({ children }) {
  return (
    <span className="lbl-eyebrow text-[9px] block mt-3 mb-1.5 first:mt-0">
      {children}
    </span>
  );
}

function FormFieldRow({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gunmetal mb-1">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10.5px] text-gunmetal-dim mt-1">{hint}</span>}
    </label>
  );
}

/**
 * Tarjeta visual de un slot ya seleccionado (filename + tamaño + botón
 * quitar). Se muestra en lugar del DropZone cuando el slot tiene archivo.
 */
function FilePreviewCard({ file, label, accent, icon: Icon, onClear }) {
  return (
    <Card className="p-4 flex flex-col gap-2.5" style={{ borderColor: `${accent}40` }}>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
          style={{ background: `${accent}1A`, color: accent, border: `1px solid ${accent}40` }}
        >
          <Icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="lbl-eyebrow text-[9px]">{label}</span>
          <p className="text-sm font-semibold text-tech-white truncate mt-0.5">
            {file.name}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5">{fmtBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 rounded text-gunmetal hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          aria-label={`Quitar ${label}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VaultUploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};

  // Modo edición: el path trae `?replace=<id>` apuntando al ModelFile a editar.
  // El form se pre-llena con la metadata existente; los DropZones quedan
  // opcionales y reemplazan el slot correspondiente si traen un archivo.
  const [searchParams] = useSearchParams();
  const replaceParam = searchParams.get('replace');
  const replaceId = replaceParam ? Number(replaceParam) : null;
  const isEditMode = !!replaceId;
  const [existing, setExisting] = useState(null); // ModelFile original en edit-mode
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);

  // Carpeta destino. En upload-mode toma el `?folder=<id>` de la carpeta
  // donde estaba parado el admin al hacer click en "Subir modelo"; en
  // edit-mode se sobreescribe con `existing.folder_id` al cargar.
  const folderParam = searchParams.get('folder');
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState(folderParam ? Number(folderParam) : null);

  useEffect(() => {
    getVaultFolders()
      .then((res) => setFolders(res.data || []))
      .catch(() => {});
  }, []);

  // Redirigir si no es admin (mismo flujo que la V1).
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/vault', { replace: true });
    }
  }, [user, navigate]);

  const [urlInput, setUrlInput] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    thumbnail_url: '',
    source_url: '',
    source_platform: '',
    creator_name: '',
    creator_url: '',
    tags: '',
  });

  const [sourceFile, setSourceFile] = useState(null); // .3mf editable nuevo (reemplaza)
  const [printFile, setPrintFile] = useState(null);   // .gcode.3mf laminado nuevo (reemplaza)
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  // `lastUpload` se renderiza en la success view, por eso va como state
  // (no ref): los refs no deben leerse durante render — react-hooks/refs.
  const [lastUpload, setLastUpload] = useState(null);

  // En edit-mode, cargar el modelo existente y pre-llenar el formulario.
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    setLoadingExisting(true);
    getVaultFile(replaceId)
      .then((res) => {
        if (cancelled) return;
        const m = res.data;
        setExisting(m);
        setForm({
          name: m.name ?? '',
          description: m.description ?? '',
          thumbnail_url: m.thumbnail_url ?? '',
          source_url: m.source_url ?? '',
          source_platform: m.source_platform ?? '',
          creator_name: m.creator_name ?? '',
          creator_url: m.creator_url ?? '',
          tags: Array.isArray(m.tags) ? m.tags.join(', ') : '',
        });
        setFolderId(m.folder_id ?? null);
      })
      .catch(() => {
        toast.error('No se pudo cargar el modelo a editar');
        navigate('/vault', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, replaceId, navigate]);

  // En upload-mode hace falta nombre + al menos un archivo; en edit-mode
  // basta con que haya nombre (los archivos quedan como están si no se
  // suben de nuevo).
  const canSubmit =
    !uploading &&
    !!form.name.trim() &&
    (isEditMode || sourceFile != null || printFile != null);

  const handleFetchMeta = async () => {
    if (!urlInput.trim()) return;
    setFetchingMeta(true);
    try {
      const res = await fetchVaultMetadata(urlInput.trim());
      const m = res.data;
      setForm((prev) => ({
        ...prev,
        name:            m.name            ?? prev.name,
        description:     m.description     ?? prev.description,
        thumbnail_url:   m.thumbnail_url   ?? prev.thumbnail_url,
        source_url:      urlInput.trim(),
        source_platform: m.source_platform ?? prev.source_platform,
        creator_name:    m.creator_name    ?? prev.creator_name,
        creator_url:     m.creator_url     ?? prev.creator_url,
        // Issue #71 — fallback al link para weight/time/material si el
        // parser local del .gcode.3mf no los encuentra. Persistimos en
        // form para incluirlos en el `metadata` del upload POST.
        link_weight_g:     m.weight_g       ?? prev.link_weight_g,
        link_time_seconds: m.time_seconds   ?? prev.link_time_seconds,
        link_filament_type: m.filament_type ?? prev.link_filament_type,
      }));
      const extra = [m.weight_g && 'peso', m.time_seconds && 'tiempo', m.filament_type && 'material']
        .filter(Boolean).join('/');
      toast.success(
        extra
          ? `Metadata obtenida (+ ${extra} como fallback)`
          : 'Metadata obtenida correctamente',
      );
    } catch {
      toast.error('No se pudo obtener la metadata de esa URL');
    } finally {
      setFetchingMeta(false);
    }
  };

  /**
   * Acepta archivos del DropZone source. Valida extensión .3mf (rechaza
   * .gcode.3mf, que pertenece al slot print). Si no hay name aún, lo
   * deriva del filename para que el admin no tenga que tipearlo.
   */
  const handleSourceFiles = (files) => {
    const f = files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.gcode.3mf')) {
      toast.error('Ese archivo es laminado, súbelo al slot "Laminado"');
      return;
    }
    if (!lower.endsWith('.3mf')) {
      toast.error('El editable debe terminar en .3mf');
      return;
    }
    setSourceFile(f);
    if (!form.name.trim()) {
      const base = f.name.replace(/\.3mf$/i, '');
      setForm((prev) => ({ ...prev, name: base }));
    }
  };

  /**
   * Acepta archivos del DropZone print. Valida extensión .gcode.3mf.
   */
  const handlePrintFiles = (files) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.gcode.3mf')) {
      toast.error('El laminado debe terminar en .gcode.3mf');
      return;
    }
    setPrintFile(f);
    if (!form.name.trim()) {
      const base = f.name.replace(/\.gcode\.3mf$/i, '');
      setForm((prev) => ({ ...prev, name: base }));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;

    const tagsArr = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const metadata = {
      name:            form.name.trim(),
      description:     form.description.trim() || null,
      thumbnail_url:   form.thumbnail_url.trim() || null,
      source_url:      form.source_url.trim() || null,
      source_platform: form.source_platform || null,
      creator_name:    form.creator_name.trim() || null,
      creator_url:     form.creator_url.trim() || null,
      tags:            tagsArr,
      folder_id:       folderId,
      // Issue #71 — fallback al link. Backend usa estos campos como
      // respaldo si el parser local del .gcode.3mf no encuentra los datos.
      weight_g:        form.link_weight_g ?? null,
      time_seconds:    form.link_time_seconds ?? null,
      filament_type:   form.link_filament_type ?? null,
    };

    setUploading(true);
    setProgress(0);

    try {
      if (isEditMode) {
        // 1) Actualizar metadata.
        const res = await updateVaultFile(replaceId, metadata);
        let latest = res.data;

        // 2) Si el admin subió archivos nuevos, reemplazar los slots.
        //    Cada reemplazo regresa el ModelFile actualizado; nos quedamos
        //    con el último para el view de éxito.
        if (sourceFile) {
          const r = await replaceVaultSource(replaceId, sourceFile, (evt) => {
            if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
          });
          latest = r.data;
        }
        if (printFile) {
          const r = await replaceVaultPrint(replaceId, printFile, (evt) => {
            if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
          });
          latest = r.data;
        }

        setLastUpload(latest);
        setDone(true);
        toast.success('Modelo actualizado');
      } else {
        // Upload-mode: subir source + print + metadata en una sola request.
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(metadata));
        if (sourceFile) formData.append('source_file', sourceFile);
        if (printFile) formData.append('print_file', printFile);

        const res = await uploadVaultFile(formData, (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        });
        setLastUpload(res.data);
        setDone(true);
        toast.success('Modelo subido correctamente');
      }
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Error al guardar el modelo';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    if (isEditMode && existing) {
      // En edit-mode "Limpiar" restaura los valores originales del modelo,
      // no deja el form en blanco.
      setForm({
        name: existing.name ?? '',
        description: existing.description ?? '',
        thumbnail_url: existing.thumbnail_url ?? '',
        source_url: existing.source_url ?? '',
        source_platform: existing.source_platform ?? '',
        creator_name: existing.creator_name ?? '',
        creator_url: existing.creator_url ?? '',
        tags: Array.isArray(existing.tags) ? existing.tags.join(', ') : '',
      });
      setFolderId(existing.folder_id ?? null);
    } else {
      setForm({
        name: '', description: '', thumbnail_url: '', source_url: '',
        source_platform: '', creator_name: '', creator_url: '', tags: '',
      });
      setFolderId(folderParam ? Number(folderParam) : null);
    }
    setSourceFile(null);
    setPrintFile(null);
    setUrlInput('');
    setProgress(0);
    setDone(false);
    setLastUpload(null);
  };

  // ── Success view (compartida mobile + desktop) ───────────────────────────
  if (done) {
    const uploaded = lastUpload;
    return (
      <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
        {isMobile && (
          <MobileAppHeader
            appName="Vault"
            appIcon={isEditMode ? Save : Upload}
            appAccent={ACCENT}
            title={isEditMode ? 'Guardado' : 'Subido'}
            onMenu={() => openSidebar?.()}
          />
        )}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: `${ACCENT}1A`,
                color: ACCENT,
                border: `1px solid ${ACCENT}40`,
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-tech-white">
                {isEditMode ? '¡Modelo actualizado!' : '¡Modelo subido!'}
              </h2>
              <p className="text-sm text-steel mt-1">
                "{uploaded?.name}" {isEditMode ? 'se actualizó en la galería.' : 'está disponible en la galería.'}
              </p>
            </div>
            {uploaded?.is_print_ready ? (
              <StatusPill tone="done" icon={Printer}>
                Listo para imprimir
              </StatusPill>
            ) : (
              <StatusPill tone="neutral" icon={FileBox}>
                Solo editable — lamina para meter a cola
              </StatusPill>
            )}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              <Button variant="ghost" size="sm" onClick={() => navigate('/vault')}>
                Ver galería
              </Button>
              <Button variant="primary" size="sm" icon={Upload} onClick={resetForm}>
                Subir otro
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── Loading view (solo en edit-mode mientras fetcheamos el modelo) ───────
  if (loadingExisting) {
    return (
      <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
        {isMobile && (
          <MobileAppHeader
            appName="Vault"
            appIcon={Save}
            appAccent={ACCENT}
            title="Cargando…"
            onMenu={() => openSidebar?.()}
          />
        )}
        <p className="flex-1 flex items-center justify-center text-gunmetal text-sm">
          Cargando modelo…
        </p>
      </div>
    );
  }

  // ── Form view (compartido entre mobile + desktop con layout responsive) ──
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      {isMobile ? (
        <MobileAppHeader
          appName="Vault"
          appIcon={isEditMode ? Save : Upload}
          appAccent={ACCENT}
          title={isEditMode ? `Editar · ${existing?.name ?? '#' + replaceId}` : 'Subir modelo'}
          onMenu={() => openSidebar?.()}
        />
      ) : (
        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
              style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
            >
              {isEditMode ? <Save size={13} /> : <Upload size={13} />}
            </span>
            <Link to="/vault" className="text-sm text-gunmetal hover:text-tech-white">Vault</Link>
            <span className="text-gunmetal-dim shrink-0">›</span>
            <span className="text-sm font-semibold text-tech-white whitespace-nowrap">
              {isEditMode ? `Editar · ${existing?.name ?? '#' + replaceId}` : 'Subir modelo'}
            </span>
          </div>
          <Link to="/vault" className="btn btn-ghost btn-sm">
            <ArrowLeft size={13} /> Volver al Vault
          </Link>
        </header>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {/* Step 1: opcional URL → metadata. En edit-mode lo ocultamos
              porque solo aplica para sembrar un modelo nuevo. */}
          {!isEditMode && (
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                style={{ background: `${ACCENT}1A`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
              >
                <LinkIcon size={14} />
              </span>
              <span className="lbl-eyebrow text-[9.5px]">
                Opcional · pega URL del modelo para auto-llenar metadata
              </span>
            </div>
            <div className="flex gap-2">
              <input
                className={`${FORM_INPUT_CLS} flex-1`}
                placeholder="https://makerworld.com/en/models/…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchMeta()}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleFetchMeta}
                disabled={fetchingMeta || !urlInput.trim()}
              >
                {fetchingMeta ? 'Obteniendo…' : 'Obtener'}
              </Button>
            </div>
          </Card>
          )}

          {/* Step 2: archivos (dos slots) */}
          <div>
            <FormSectionTitle>
              {isEditMode ? 'Archivos del modelo (opcional reemplazo)' : 'Archivos del modelo'}
            </FormSectionTitle>
            <p className="text-[11.5px] text-gunmetal mb-3">
              {isEditMode
                ? 'Suelta un archivo solo si quieres reemplazar ese slot. Los slots vacíos conservan el binario actual.'
                : 'Al menos uno requerido. Subir el laminado permite mandar el modelo a la cola con peso/tiempo ya resueltos.'}
            </p>
            {isEditMode && existing && (
              <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {existing.source_file_name && (
                  <Card className="p-3 flex items-center gap-2.5" style={{ borderColor: `${ACCENT}33` }}>
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                      style={{ background: `${ACCENT}1A`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
                    >
                      <FileBox size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="lbl-eyebrow text-[9px]">Actual · editable</span>
                      <p className="text-xs text-tech-white truncate mt-0.5">{existing.source_file_name}</p>
                      <p className="mono text-[10.5px] text-gunmetal mt-0.5">{fmtBytes(existing.source_file_size)}</p>
                    </div>
                  </Card>
                )}
                {existing.print_file_name && (
                  <Card className="p-3 flex items-center gap-2.5" style={{ borderColor: `${ACCENT_PRINT}33` }}>
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                      style={{ background: `${ACCENT_PRINT}1A`, color: ACCENT_PRINT, border: `1px solid ${ACCENT_PRINT}40` }}
                    >
                      <Printer size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="lbl-eyebrow text-[9px]">Actual · laminado</span>
                      <p className="text-xs text-tech-white truncate mt-0.5">{existing.print_file_name}</p>
                      <p className="mono text-[10.5px] text-gunmetal mt-0.5">{fmtBytes(existing.print_file_size)}</p>
                    </div>
                  </Card>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sourceFile ? (
                <FilePreviewCard
                  file={sourceFile}
                  label={isEditMode ? 'Reemplazar editable · .3mf' : 'Editable · .3mf'}
                  accent={ACCENT}
                  icon={FileBox}
                  onClear={() => setSourceFile(null)}
                />
              ) : (
                <DropZone
                  accept=".3mf"
                  accent={ACCENT}
                  icon={FileBox}
                  hint={isEditMode ? 'Suelta para reemplazar el .3mf editable' : 'Suelta el .3mf editable'}
                  meta="OrcaSlicer / BambuStudio · proyecto editable"
                  cta="Examinar .3mf"
                  onFiles={handleSourceFiles}
                />
              )}
              {printFile ? (
                <FilePreviewCard
                  file={printFile}
                  label={isEditMode ? 'Reemplazar laminado · .gcode.3mf' : 'Laminado · .gcode.3mf'}
                  accent={ACCENT_PRINT}
                  icon={Printer}
                  onClear={() => setPrintFile(null)}
                />
              ) : (
                <DropZone
                  accept=".gcode.3mf"
                  accent={ACCENT_PRINT}
                  icon={Printer}
                  hint={isEditMode ? 'Suelta para reemplazar el .gcode.3mf' : 'Suelta el .gcode.3mf laminado'}
                  meta="paquete con G-code · listo para imprimir"
                  cta="Examinar .gcode.3mf"
                  onFiles={handlePrintFiles}
                />
              )}
            </div>
          </div>

          {/* Step 3: metadata */}
          <Card className="p-4 flex flex-col">
            <FormSectionTitle>Identificación</FormSectionTitle>
            <FormFieldRow label="Nombre" required hint="Aparece en la galería y en el picker de cola">
              <input
                className={FORM_INPUT_CLS}
                placeholder="Nombre display del modelo"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </FormFieldRow>
            <FormFieldRow label="Descripción">
              <textarea
                className={`${FORM_INPUT_CLS} resize-none`}
                rows={3}
                placeholder="Notas de impresión, posicionamiento, soportes…"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormFieldRow>
            <FormFieldRow label="Carpeta" hint="Dónde se guarda dentro del Vault">
              <select
                className={FORM_INPUT_CLS}
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Raíz (Vault)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </FormFieldRow>

            <FormSectionTitle>Origen</FormSectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <FormFieldRow label="Plataforma">
                <select
                  className={FORM_INPUT_CLS}
                  value={form.source_platform}
                  onChange={(e) => setForm((p) => ({ ...p, source_platform: e.target.value }))}
                >
                  <option value="">— Seleccionar —</option>
                  <option value="makerworld">MakerWorld</option>
                  <option value="printables">Printables</option>
                  <option value="thingiverse">Thingiverse</option>
                  <option value="otro">Otro</option>
                </select>
              </FormFieldRow>
              <FormFieldRow label="Creador">
                <input
                  className={FORM_INPUT_CLS}
                  placeholder="Nombre del diseñador"
                  value={form.creator_name}
                  onChange={(e) => setForm((p) => ({ ...p, creator_name: e.target.value }))}
                />
              </FormFieldRow>
              <FormFieldRow label="URL de origen">
                <input
                  className={FORM_INPUT_CLS}
                  placeholder="https://…"
                  value={form.source_url}
                  onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))}
                />
              </FormFieldRow>
              <FormFieldRow label="URL miniatura">
                <input
                  className={FORM_INPUT_CLS}
                  placeholder="https://…/thumbnail.jpg"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
                />
              </FormFieldRow>
            </div>

            <FormSectionTitle>Tags</FormSectionTitle>
            <FormFieldRow label="Etiquetas" hint="Separadas por coma — útil para filtrar luego">
              <input
                className={FORM_INPUT_CLS}
                placeholder="ej: minis, soporte, PLA"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              />
            </FormFieldRow>
          </Card>

          {/* Progress + actions */}
          {uploading && (
            <Card className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gunmetal">
                <span>{isEditMode ? 'Guardando…' : 'Subiendo…'}</span>
                <span className="mono">{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: ACCENT }}
                />
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2 justify-end pb-6">
            <Button variant="ghost" onClick={resetForm} disabled={uploading || loadingExisting}>
              {isEditMode ? 'Restaurar' : 'Limpiar'}
            </Button>
            <Button
              variant="primary"
              icon={isEditMode ? Save : Upload}
              onClick={handleSubmit}
              disabled={!canSubmit || loadingExisting}
            >
              {uploading
                ? (isEditMode ? 'Guardando…' : 'Subiendo…')
                : (isEditMode ? 'Guardar cambios' : 'Subir al Vault')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
