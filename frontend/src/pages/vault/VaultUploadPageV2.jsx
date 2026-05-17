/**
 * @file Página rediseñada de subida al Vault (Claude Design v2).
 *
 * Reemplaza por completo la V1 `VaultUploadPage.jsx`. Soporta los dos slots
 * de archivo definidos en `ModelFile`:
 *
 * - **source_file** (`.3mf` editable) — proyecto OrcaSlicer/BambuStudio.
 * - **print_file** (`.gcode.3mf` laminado) — paquete con G-code listo para
 *   imprimir. El backend parsea su header y autollena
 *   `sliced_weight_g` / `sliced_time_seconds` / `sliced_filament_type` para
 *   que el picker de Queue (Chunk C) pueda meterlo directo a cola.
 *
 * Al menos uno de los dos slots tiene que estar presente. Si solo se
 * sube `.3mf` editable, "Agregar a cola" estará deshabilitado (con tooltip
 * "lamina primero en Slicer y vuelve a subir").
 *
 * Solo accesible para usuarios con role='admin'. Los no-admins son
 * redirigidos a /vault al montar el componente.
 *
 * @module pages/vault/VaultUploadPageV2
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileBox,
  Link as LinkIcon,
  Printer,
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
import { fetchVaultMetadata, uploadVaultFile } from '../../services/api';

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

export default function VaultUploadPageV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};

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

  const [sourceFile, setSourceFile] = useState(null); // .3mf editable
  const [printFile, setPrintFile] = useState(null);   // .gcode.3mf laminado
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const lastUpload = useRef(null);

  const canSubmit =
    !uploading &&
    !!form.name.trim() &&
    (sourceFile != null || printFile != null);

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
      }));
      toast.success('Metadata obtenida correctamente');
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
    };

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    if (sourceFile) formData.append('source_file', sourceFile);
    if (printFile) formData.append('print_file', printFile);

    setUploading(true);
    setProgress(0);

    try {
      const res = await uploadVaultFile(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
      });
      lastUpload.current = res.data;
      setDone(true);
      toast.success('Modelo subido correctamente');
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Error al subir el modelo';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', thumbnail_url: '', source_url: '',
      source_platform: '', creator_name: '', creator_url: '', tags: '',
    });
    setSourceFile(null);
    setPrintFile(null);
    setUrlInput('');
    setProgress(0);
    setDone(false);
    lastUpload.current = null;
  };

  // ── Success view (compartida mobile + desktop) ───────────────────────────
  if (done) {
    const uploaded = lastUpload.current;
    return (
      <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
        {isMobile && (
          <MobileAppHeader
            appName="Vault"
            appIcon={Upload}
            appAccent={ACCENT}
            title="Subido"
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
              <h2 className="text-xl font-semibold text-tech-white">¡Modelo subido!</h2>
              <p className="text-sm text-steel mt-1">
                "{uploaded?.name}" está disponible en la galería.
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

  // ── Form view (compartido entre mobile + desktop con layout responsive) ──
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      {isMobile ? (
        <MobileAppHeader
          appName="Vault"
          appIcon={Upload}
          appAccent={ACCENT}
          title="Subir modelo"
          onMenu={() => openSidebar?.()}
        />
      ) : (
        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
              style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
            >
              <Upload size={13} />
            </span>
            <Link to="/vault" className="text-sm text-gunmetal hover:text-tech-white">Vault</Link>
            <span className="text-gunmetal-dim shrink-0">›</span>
            <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Subir modelo</span>
          </div>
          <Link to="/vault" className="btn btn-ghost btn-sm">
            <ArrowLeft size={13} /> Volver al Vault
          </Link>
        </header>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {/* Step 1: opcional URL → metadata */}
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

          {/* Step 2: archivos (dos slots) */}
          <div>
            <FormSectionTitle>Archivos del modelo</FormSectionTitle>
            <p className="text-[11.5px] text-gunmetal mb-3">
              Al menos uno requerido. Subir el laminado permite mandar el modelo a la cola con peso/tiempo ya resueltos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sourceFile ? (
                <FilePreviewCard
                  file={sourceFile}
                  label="Editable · .3mf"
                  accent={ACCENT}
                  icon={FileBox}
                  onClear={() => setSourceFile(null)}
                />
              ) : (
                <DropZone
                  accept=".3mf"
                  accent={ACCENT}
                  icon={FileBox}
                  hint="Suelta el .3mf editable"
                  meta="OrcaSlicer / BambuStudio · proyecto editable"
                  cta="Examinar .3mf"
                  onFiles={handleSourceFiles}
                />
              )}
              {printFile ? (
                <FilePreviewCard
                  file={printFile}
                  label="Laminado · .gcode.3mf"
                  accent={ACCENT_PRINT}
                  icon={Printer}
                  onClear={() => setPrintFile(null)}
                />
              ) : (
                <DropZone
                  accept=".gcode.3mf"
                  accent={ACCENT_PRINT}
                  icon={Printer}
                  hint="Suelta el .gcode.3mf laminado"
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
                <span>Subiendo…</span>
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
            <Button variant="ghost" onClick={resetForm} disabled={uploading}>
              Limpiar
            </Button>
            <Button
              variant="primary"
              icon={Upload}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {uploading ? 'Subiendo…' : 'Subir al Vault'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
