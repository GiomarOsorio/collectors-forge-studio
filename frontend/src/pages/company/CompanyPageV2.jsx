/**
 * @file Página rediseñada de Compañía (Claude Design v2).
 *
 * Reemplaza por completo la V1 de:
 *   - `/company/profile`  → `ProfileFormDrawer` integrado
 *   - `/company/branding` → `BrandingFormDrawer` integrado
 *   - `/company/templates` → `TemplatesDrawer` integrado (lista + acciones)
 *
 * El editor de templates Liquid sigue siendo una ruta dedicada
 * (`/company/templates/new` y `/company/templates/:id`) por su tamaño
 * (textarea HTML grande + preview + validate). Migrarlo a v2 se hará en
 * un PR aparte (chunk B futuro).
 *
 * Solo admin. Los no-admins redirigen a `/` desde la AdminRoute.
 *
 * @module pages/company/CompanyPageV2
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCode,
  Image as ImageIcon,
  Mail,
  MapPin,
  Palette,
  Pencil,
  Phone,
  Plus,
  Save,
  Settings,
  Star,
  Trash2,
  Upload,
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
import { useAuth } from '../../context/AuthContext';
import {
  deleteCompanyTemplate,
  getCompany,
  getCompanyTemplates,
  previewTemplate,
  setDefaultTemplate,
  updateCompany,
  uploadCompanyLogo,
} from '../../services/api';
import { apiErrorMsg } from '../../utils/apiError';

const ACCENT = '#6366F1';

// ── Module-level form helpers (anti bug cursor jump — ver formFieldFocus.test) ──

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gunmetal-dim';

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

// ─── ProfileFormDrawer ──────────────────────────────────────────────────────

/**
 * Form drawer para editar el perfil de la empresa. Reemplaza V1
 * `/company/profile`. Incluye upload de logo con preview inline.
 */
function ProfileFormDrawer({ open, company, onClose, onSaved, isMobile }) {
  const [form, setForm] = useState({
    name: '', slogan: '', address: '', phone: '', contact_email: '', nit: '',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      name:          company?.name          || '',
      slogan:        company?.slogan        || '',
      address:       company?.address       || '',
      phone:         company?.phone         || '',
      contact_email: company?.contact_email || '',
      nit:           company?.nit           || '',
    });
    setLogoPreview(company?.logo_url || null);
    setSaving(false);
    setUploadingLogo(false);
  }, [open, company]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await uploadCompanyLogo(file);
      setLogoPreview(res.data.logo_url || null);
      toast.success('Logo actualizado');
      onSaved?.(res.data, { silent: true });
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al subir logo'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const res = await updateCompany(form);
      toast.success('Perfil de empresa actualizado');
      onSaved?.(res.data);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const Body = (
    <form id="profile-form" onSubmit={handleSave} className="flex flex-col">
      <FormSectionTitle>Logo</FormSectionTitle>
      <Card className="p-3 flex items-center gap-4">
        {logoPreview ? (
          <img
            src={logoPreview}
            alt="Logo"
            className="h-16 w-auto rounded-lg border border-[var(--color-border)] object-contain bg-[var(--color-surf-sidebar)] p-1"
          />
        ) : (
          <div
            className="h-16 w-24 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}40` }}
          >
            <Building2 size={22} style={{ color: ACCENT }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Upload}
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? 'Subiendo…' : 'Cambiar logo'}
          </Button>
          <p className="text-[10.5px] text-gunmetal mt-1">
            JPG / PNG / WebP — aparece en el header del PDF de cotización.
          </p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </Card>

      <FormSectionTitle>Identificación</FormSectionTitle>
      <FormFieldRow label="Nombre de la empresa" required>
        <input
          required
          className={FORM_INPUT_CLS}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Ej: Collector's Forge"
        />
      </FormFieldRow>
      <FormFieldRow label="Slogan">
        <input
          className={FORM_INPUT_CLS}
          value={form.slogan}
          onChange={(e) => setForm((p) => ({ ...p, slogan: e.target.value }))}
          placeholder="Ej: Impresión 3D de calidad"
        />
      </FormFieldRow>
      <FormFieldRow label="NIT" hint="Aparece junto al nombre en el header del PDF">
        <input
          className={FORM_INPUT_CLS}
          value={form.nit}
          onChange={(e) => setForm((p) => ({ ...p, nit: e.target.value }))}
          placeholder="900.000.000-0"
        />
      </FormFieldRow>

      <FormSectionTitle>Contacto</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <FormFieldRow label="Teléfono">
          <input
            className={FORM_INPUT_CLS}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+57 300 000 0000"
          />
        </FormFieldRow>
        <FormFieldRow label="Email">
          <input
            type="email"
            className={FORM_INPUT_CLS}
            value={form.contact_email}
            onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
            placeholder="hola@empresa.com"
          />
        </FormFieldRow>
      </div>
      <FormFieldRow label="Dirección">
        <input
          className={FORM_INPUT_CLS}
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          placeholder="Medellín, Antioquia, Colombia"
        />
      </FormFieldRow>
    </form>
  );

  const Footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        type="submit"
        form="profile-form"
        icon={Save}
        disabled={saving}
        className="flex-1 justify-center"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Perfil de empresa" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      eyebrow="COMPAÑÍA · PERFIL"
      title="Editar perfil de empresa"
      width={520}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── BrandingFormDrawer ─────────────────────────────────────────────────────

const DEFAULT_PALETTE = [
  { name: 'primary',    hex: '#1A1A1A' },
  { name: 'accent',     hex: '#B67E3A' },
  { name: 'highlight',  hex: '#A33221' },
  { name: 'table_text', hex: '#D1A054' },
];

/**
 * Form drawer para editar la paleta de colores PDF + términos de pago.
 * Reemplaza V1 `/company/branding`.
 */
function BrandingFormDrawer({ open, company, onClose, onSaved, isMobile }) {
  const [palette, setPalette] = useState(DEFAULT_PALETTE.map((c) => ({ ...c })));
  const [pdfTerms, setPdfTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const incoming =
      Array.isArray(company?.pdf_palette) && company.pdf_palette.length > 0
        ? company.pdf_palette.map((c) => ({ name: c.name || '', hex: c.hex || '#000000' }))
        : DEFAULT_PALETTE.map((c) => ({ ...c }));
    setPalette(incoming);
    setPdfTerms(company?.pdf_terms || '');
    setSaving(false);
  }, [open, company]);

  const addColor = () => setPalette((p) => [...p, { name: '', hex: '#AAAAAA' }]);
  const removeColor = (idx) => setPalette((p) => p.filter((_, i) => i !== idx));
  const updateColor = (idx, field, value) =>
    setPalette((p) => p.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const handleSave = async (e) => {
    e?.preventDefault?.();
    // Validaciones cliente.
    for (const c of palette) {
      if (!c.name.trim()) {
        toast.error('Todos los colores necesitan un nombre');
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(c.hex)) {
        toast.error(`Hex inválido para "${c.name}": ${c.hex}`);
        return;
      }
    }
    const names = palette.map((c) => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error('Los nombres de los colores deben ser únicos');
      return;
    }

    setSaving(true);
    try {
      const res = await updateCompany({
        pdf_palette: palette.map((c) => ({
          name: c.name.trim(),
          hex: c.hex.toUpperCase(),
        })),
        pdf_terms: pdfTerms,
      });
      toast.success('Configuración de marca guardada');
      onSaved?.(res.data);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const Body = (
    <form id="branding-form" onSubmit={handleSave} className="flex flex-col gap-2">
      <FormSectionTitle>Paleta de colores PDF</FormSectionTitle>
      <p className="text-[11px] text-gunmetal mb-1">
        En templates Liquid usar <code className="mono text-indigo-300">{'{{ palette.nombre }}'}</code>{' '}
        o iterar con <code className="mono text-indigo-300">{'{% for c in colors %}'}</code>.
      </p>

      <div className="flex flex-col gap-2">
        {palette.map((color, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_44px_96px_28px] gap-2 items-center"
          >
            <input
              type="text"
              value={color.name}
              onChange={(e) => updateColor(idx, 'name', e.target.value)}
              placeholder="ej: primary"
              className={`${FORM_INPUT_CLS} mono text-xs`}
            />
            <input
              type="color"
              value={color.hex}
              onChange={(e) => updateColor(idx, 'hex', e.target.value)}
              className="w-11 h-9 rounded-md border border-[var(--color-border-strong)] cursor-pointer bg-transparent p-0.5"
              title={color.name || 'Elegir color'}
            />
            <input
              type="text"
              value={color.hex}
              onChange={(e) => updateColor(idx, 'hex', e.target.value)}
              pattern="^#[0-9A-Fa-f]{6}$"
              maxLength={7}
              placeholder="#RRGGBB"
              className={`${FORM_INPUT_CLS} mono text-xs`}
            />
            <button
              type="button"
              onClick={() => removeColor(idx)}
              disabled={palette.length <= 1}
              className="p-1.5 rounded text-gunmetal hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Eliminar color"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addColor}
        className="text-[11px] text-indigo-300 hover:text-indigo-200 self-start mt-1"
      >
        + Añadir color
      </button>

      <FormSectionTitle>Pie de cotización</FormSectionTitle>
      <FormFieldRow
        label="Términos de pago"
        hint="Cada línea se muestra como un ítem separado en el pie del PDF."
      >
        <textarea
          rows={5}
          className={`${FORM_INPUT_CLS} resize-y mono text-xs`}
          value={pdfTerms}
          onChange={(e) => setPdfTerms(e.target.value)}
          placeholder={`• Pago del 50% al aprobar la cotización.\n• Saldo antes del envío.\n• Los gastos de envío corren por cuenta del cliente.`}
        />
      </FormFieldRow>
    </form>
  );

  const Footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        type="submit"
        form="branding-form"
        icon={Save}
        disabled={saving}
        className="flex-1 justify-center"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Marca & Colores" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      eyebrow="COMPAÑÍA · MARCA"
      title="Marca & Colores PDF"
      width={560}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── TemplatesDrawer ────────────────────────────────────────────────────────

/**
 * Drawer/sheet con la lista de templates Liquid. Cada fila tiene acciones
 * de Default / Preview / Editar / Eliminar. Reemplaza V1 `/company/templates`.
 *
 * Editar y Crear nuevo redirigen al editor dedicado (`/company/templates/:id`
 * o `/company/templates/new`) — esa ruta sigue en V1 por ahora; se migra
 * en un chunk B futuro.
 */
function TemplatesDrawer({ open, templates, onClose, onChanged, isMobile }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);

  const handleSetDefault = async (id) => {
    setBusyId(id);
    try {
      await setDefaultTemplate(id);
      toast.success('Template marcado como default');
      onChanged?.();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al establecer default'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (tpl) => {
    const ok = await confirm(`¿Eliminar el template "${tpl.name}"?`, 'Eliminar');
    if (!ok) return;
    setBusyId(tpl.id);
    try {
      await deleteCompanyTemplate(tpl.id);
      toast.success('Template eliminado');
      onChanged?.();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al eliminar'));
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (id) => {
    setPreviewingId(id);
    try {
      const res = await previewTemplate(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error generando preview'));
    } finally {
      setPreviewingId(null);
    }
  };

  const Body = templates.length === 0 ? (
    <EmptyState
      icon={FileCode}
      accent={ACCENT}
      title="Sin templates Liquid"
      hint="Crea tu primer template para personalizar el diseño del PDF de cotización."
      action={
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => navigate('/company/templates/new')}
        >
          Crear template
        </Button>
      }
    />
  ) : (
    <ul className="flex flex-col gap-1.5">
      {templates.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
        >
          <FileCode size={15} className="text-gunmetal shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              {t.is_default && (
                <StatusPill tone="warn" icon={Star}>
                  Default
                </StatusPill>
              )}
              <span className="text-sm font-semibold text-tech-white truncate">
                {t.name}
              </span>
            </div>
            {t.description && (
              <p className="text-[10.5px] text-gunmetal truncate">{t.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!t.is_default && (
              <button
                type="button"
                onClick={() => handleSetDefault(t.id)}
                disabled={busyId === t.id}
                className="p-1.5 rounded text-gunmetal hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                title="Marcar como default"
                aria-label="Default"
              >
                <Star size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePreview(t.id)}
              disabled={previewingId === t.id}
              className="p-1.5 rounded text-gunmetal hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
              title="Previsualizar PDF"
              aria-label="Preview"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigate(`/company/templates/${t.id}`)}
              className="p-1.5 rounded text-gunmetal hover:text-tech-white hover:bg-[var(--color-surf-hover)] transition-colors"
              title="Editar"
              aria-label="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(t)}
              disabled={busyId === t.id}
              className="p-1.5 rounded text-gunmetal hover:text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
              title="Eliminar"
              aria-label="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  const Footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
        Cerrar
      </Button>
      <Button
        variant="primary"
        size="sm"
        icon={Plus}
        onClick={() => navigate('/company/templates/new')}
        className="flex-1 justify-center"
      >
        Nuevo template
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Templates PDF" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      eyebrow={`COMPAÑÍA · TEMPLATES (${templates.length})`}
      title="Templates Liquid del PDF"
      width={520}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompanyPageV2() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [company, setCompany] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [profileOpen, setProfileOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const loadTemplates = async () => {
    try {
      const res = await getCompanyTemplates();
      setTemplates(res.data || []);
    } catch {
      toast.error('No se pudieron cargar los templates');
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getCompany(), getCompanyTemplates()])
      .then(([c, t]) => {
        if (cancelled) return;
        if (c.status === 'fulfilled') setCompany(c.value.data);
        if (t.status === 'fulfilled') setTemplates(t.value.data || []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const palette = useMemo(
    () => (Array.isArray(company?.pdf_palette) ? company.pdf_palette : []),
    [company],
  );
  const defaultTemplate = useMemo(
    () => templates.find((t) => t.is_default),
    [templates],
  );

  const sections = [
    {
      id: 'profile',
      icon: Building2,
      title: 'Perfil de empresa',
      desc: 'Nombre, slogan, logo, NIT y datos de contacto. Aparece en el header del PDF.',
      status: company?.name || 'Sin configurar',
      complete: !!(company?.name && company?.logo_url),
      onClick: () => setProfileOpen(true),
    },
    {
      id: 'branding',
      icon: Palette,
      title: 'Marca & Colores',
      desc: 'Paleta de colores PDF + términos de pago del pie de cotización.',
      status: palette.length > 0 ? `${palette.length} colores` : 'Sin paleta',
      complete: palette.length > 0,
      onClick: () => setBrandingOpen(true),
    },
    {
      id: 'templates',
      icon: FileCode,
      title: 'Templates PDF',
      desc: 'Templates Liquid HTML personalizados (WeasyPrint). El default se usa al descargar.',
      status: defaultTemplate
        ? `Default: ${defaultTemplate.name}`
        : templates.length > 0
        ? `${templates.length} templates`
        : 'Usar ReportLab',
      complete: !!defaultTemplate,
      onClick: () => setTemplatesOpen(true),
    },
  ];

  const completedCount = sections.filter((s) => s.complete).length;

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Perfil" value={company?.name ? '✓' : '—'} sub={company?.name || 'sin nombre'} accent={ACCENT} icon={Building2} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Logo" value={company?.logo_url ? '✓' : '—'} sub={company?.logo_url ? 'cargado' : 'sin logo'} accent="#3B82F6" icon={ImageIcon} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Paleta PDF" value={palette.length} unit="colores" sub={palette.length > 0 ? 'configurada' : 'usar default'} accent="#FBBF24" icon={Palette} />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI label="Templates" value={templates.length} unit="docs" sub={defaultTemplate ? `default: ${defaultTemplate.name}` : 'usar ReportLab'} accent="#34D399" icon={FileCode} />
      </div>
    </div>
  );

  const SectionList = (
    <div
      className={isMobile ? 'flex flex-col gap-2 px-4 mt-3 pb-8' : 'px-6 pt-4 pb-8 grid gap-3'}
      style={isMobile ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
    >
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <Card
            key={s.id}
            as="button"
            interactive
            onClick={s.onClick}
            className="text-left w-full p-4 h-full flex flex-col gap-3"
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
                <Icon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {s.complete ? (
                    <StatusPill tone="done" icon={CheckCircle2}>
                      Configurado
                    </StatusPill>
                  ) : (
                    <StatusPill tone="warn">Pendiente</StatusPill>
                  )}
                </div>
                <p className="text-base font-semibold text-tech-white">{s.title}</p>
                <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">{s.status}</p>
              </div>
              <ChevronRight size={14} className="text-gunmetal-dim shrink-0 mt-1" />
            </div>
            <p className="text-sm text-steel leading-snug">{s.desc}</p>
          </Card>
        );
      })}
    </div>
  );

  const ProfilePreview = company && (
    <div className={isMobile ? 'px-4 mt-3' : 'px-6 pt-2'}>
      <Card className="p-4 flex flex-col md:flex-row gap-4 items-start">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-20 h-20 rounded-xl object-cover border border-[var(--color-border)] shrink-0"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}40` }}
          >
            <Building2 size={28} style={{ color: ACCENT }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-tech-white truncate">
            {company.name || 'Sin nombre'}
          </h2>
          {company.slogan && (
            <p className="text-[12.5px] text-steel italic">{company.slogan}</p>
          )}
          <div className="mono text-[11.5px] text-gunmetal mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {company.nit && <span>{company.nit}</span>}
            {company.contact_email && (
              <span className="inline-flex items-center gap-1">
                <Mail size={11} /> {company.contact_email}
              </span>
            )}
            {company.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={11} /> {company.phone}
              </span>
            )}
            {company.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {company.address}
              </span>
            )}
          </div>
          {palette.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="lbl-eyebrow text-[9px]">Paleta PDF</span>
              {palette.slice(0, 6).map((c, i) => (
                <span
                  key={i}
                  className="w-5 h-5 rounded-full border border-[var(--color-border)]"
                  style={{ background: c.hex }}
                  title={`${c.name} · ${c.hex}`}
                />
              ))}
              {palette.length > 6 && (
                <span className="mono text-[10px] text-gunmetal">+{palette.length - 6}</span>
              )}
            </div>
          )}
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={() => setProfileOpen(true)}
          >
            Editar
          </Button>
        )}
      </Card>
    </div>
  );

  // Drawers compartidos mobile + desktop (state lifted al componente raíz).
  const Drawers = (
    <>
      <ProfileFormDrawer
        open={profileOpen}
        company={company}
        onClose={() => setProfileOpen(false)}
        onSaved={(data, opts) => {
          setCompany(data);
          if (!opts?.silent) setProfileOpen(false);
        }}
        isMobile={isMobile}
      />
      <BrandingFormDrawer
        open={brandingOpen}
        company={company}
        onClose={() => setBrandingOpen(false)}
        onSaved={(data) => {
          setCompany(data);
          setBrandingOpen(false);
        }}
        isMobile={isMobile}
      />
      <TemplatesDrawer
        open={templatesOpen}
        templates={templates}
        onClose={() => setTemplatesOpen(false)}
        onChanged={loadTemplates}
        isMobile={isMobile}
      />
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col pb-8">
        <MobileAppHeader
          appName="Compañía"
          appIcon={Building2}
          appAccent={ACCENT}
          title="Resumen"
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-2 industrial-grid">
            <span className="lbl-eyebrow">Compañía · estado</span>
            <p className="mono text-2xl font-semibold text-tech-white tracking-tight">
              {completedCount}/{sections.length}
            </p>
            <span className="mono text-[11px] text-gunmetal">secciones configuradas</span>
          </Card>
        </div>
        {loading ? (
          <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando…</p>
        ) : !company ? (
          <div className="mt-3 pb-28">
            <EmptyState
              icon={Building2}
              accent={ACCENT}
              title="Sin compañía configurada"
              hint="Configura el perfil para personalizar tus cotizaciones."
              action={
                isAdmin ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Pencil}
                    onClick={() => setProfileOpen(true)}
                  >
                    Configurar
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            {ProfilePreview}
            {SectionList}
          </>
        )}
        {Drawers}
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
            <Building2 size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Compañía</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Resumen</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings/account" className="btn btn-ghost btn-sm">
            <Settings size={13} /> Cuenta
          </Link>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={Pencil}
              onClick={() => setProfileOpen(true)}
            >
              Editar perfil
            </Button>
          )}
        </div>
      </header>

      {KPIs}

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando compañía…</p>
      ) : !company ? (
        <EmptyState
          icon={Building2}
          accent={ACCENT}
          title="Sin compañía configurada"
          hint="Configura el perfil para personalizar tus cotizaciones."
          action={
            isAdmin ? (
              <Button
                variant="primary"
                size="sm"
                icon={Pencil}
                onClick={() => setProfileOpen(true)}
              >
                Configurar perfil
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {ProfilePreview}
          {SectionList}
        </>
      )}

      {Drawers}

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">
          {completedCount}/{sections.length} secciones configuradas
        </span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
