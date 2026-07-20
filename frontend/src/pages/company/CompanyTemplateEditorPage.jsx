/**
 * @file Editor de templates de cotización Liquid.
 *
 * Permite crear o editar un template con editor monospace, botón de
 * validación que detecta errores Liquid y botón de preview PDF.
 * Ruta: /company/templates/new | /company/templates/:id
 *
 * @module pages/company/CompanyTemplateEditorPage
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCompanyTemplate,
  createCompanyTemplate,
  updateCompanyTemplate,
  validateTemplate,
  previewTemplate,
  getDefaultTemplateContent,
  setDefaultTemplate,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { apiErrorMsg } from '../../utils/apiError';
import { CheckCircle, XCircle, AlertTriangle, Eye, Save, ArrowLeft } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'cot', label: 'COT — Cotizaciones de cliente' },
  { value: 'all', label: 'ALL — Todos los tipos' },
];

export default function CompanyTemplateEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name:          '',
    description:   '',
    template_type: 'cot',
    content:       '',
    is_default:    false,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [validation, setValidation] = useState(null); // {ok, errors, warnings, preview_pdf_b64?}
  // Fix #168: zoom de fuente del editor (usabilidad en tablet/mobile).
  const [fontSize, setFontSize] = useState(12);
  const bumpFont = (delta) => setFontSize((s) => Math.min(20, Math.max(10, s + delta)));

  // Cargar template existente o contenido por defecto
  useEffect(() => {
    const load = async () => {
      if (isNew) {
        try {
          const res = await getDefaultTemplateContent();
          setForm((p) => ({ ...p, content: res.data.content || '' }));
        } catch {
          // No es crítico, el editor quedará vacío
        }
        setLoading(false);
        return;
      }
      try {
        const res = await getCompanyTemplate(id);
        const d = res.data;
        setForm({
          name:          d.name          || '',
          description:   d.description   || '',
          template_type: d.template_type || 'cot',
          content:       d.content       || '',
          is_default:    d.is_default    || false,
        });
      } catch {
        toast.error('Error cargando template');
        navigate('/company/templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew, navigate]);

  const handleValidate = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const res = await validateTemplate({ content: form.content, template_type: form.template_type });
      setValidation(res.data);
      if (res.data.ok) {
        toast.success('Template válido');
      } else {
        toast.error('Template con errores — revisa el panel de validación');
      }
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al validar'));
    } finally {
      setValidating(false);
    }
  };

  const openPdfBlob = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const handlePreview = async () => {
    // Issue #65 fix: auto-valida si no hay validation cached (caso nuevo
    // template sin haber tocado el botón "Validar" todavía).
    setPreviewing(true);
    try {
      let val = validation;
      if (!val || !val.preview_pdf_b64) {
        const res = await validateTemplate({
          content: form.content,
          template_type: form.template_type,
        });
        val = res.data;
        setValidation(val);
      }
      if (val?.ok && val?.preview_pdf_b64) {
        openPdfBlob(val.preview_pdf_b64);
        return;
      }
      // Template inválido — mostrar errores en panel
      if (val && !val.ok) {
        toast.error('Template con errores — revisa el panel de validación');
        return;
      }
      // Fallback: template ya guardado → endpoint preview persistido
      if (id) {
        const res = await previewTemplate(id);
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error generando preview'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre del template es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createCompanyTemplate(form);
        toast.success('Template creado');
        // Si marcó como default, llamar set-default
        if (form.is_default) {
          await setDefaultTemplate(res.data.id);
        }
        navigate(`/company/templates/${res.data.id}`);
      } else {
        await updateCompanyTemplate(id, form);
        if (form.is_default) {
          await setDefaultTemplate(id);
        }
        toast.success('Template actualizado');
      }
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-steel text-sm">Cargando...</div>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/company/templates')}
          className="text-gunmetal hover:text-steel transition-colors"
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="tf-page-title mb-0">
          {isNew ? 'Nuevo template' : 'Editar template'}
        </h2>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Metadatos */}
        <div className="tf-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="tf-label">Nombre del template *</label>
            <input
              className="tf-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Plantilla estándar Collector's Forge"
              required
              disabled={!user?.role === 'admin'}
            />
          </div>
          <div>
            <label className="tf-label">Tipo</label>
            <select
              className="tf-input"
              value={form.template_type}
              onChange={(e) => setForm((p) => ({ ...p, template_type: e.target.value }))}
              disabled={!user?.role === 'admin'}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="is_default"
              checked={form.is_default}
              onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              disabled={!user?.role === 'admin'}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_default" className="text-sm text-steel cursor-pointer">
              Usar como template por defecto para este tipo
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="tf-label">Descripción (opcional)</label>
            <input
              className="tf-input"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ej: Plantilla con diseño oscuro para cotizaciones premium"
              disabled={!user?.role === 'admin'}
            />
          </div>
        </div>

        {/* Editor de código Liquid */}
        <div className="tf-card p-5 space-y-3">
          {/* Fix #168: toolbar sticky (Validar/Preview siempre alcanzables al
              hacer scroll del textarea largo) + zoom de fuente A−/A+ + botones
              con target táctil ≥44px. */}
          <div className="sticky top-0 z-10 -mx-5 -mt-5 px-5 pt-5 pb-3 bg-[var(--color-surf-card)] flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-soft)]">
            <label className="text-sm font-medium text-steel uppercase tracking-wider">
              Código Liquid (HTML)
            </label>
            <div className="flex items-center gap-2">
              {/* Zoom de fuente */}
              <div className="flex items-center rounded-md border border-[var(--color-border-strong)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => bumpFont(-1)}
                  disabled={fontSize <= 10}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-steel hover:bg-[var(--color-surf-hover)] disabled:opacity-40 text-xs"
                  aria-label="Reducir tamaño de fuente"
                >
                  A−
                </button>
                <span className="mono text-[10px] text-gunmetal px-1 tabular-nums">{fontSize}</span>
                <button
                  type="button"
                  onClick={() => bumpFont(1)}
                  disabled={fontSize >= 20}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-steel hover:bg-[var(--color-surf-hover)] disabled:opacity-40 text-base"
                  aria-label="Aumentar tamaño de fuente"
                >
                  A+
                </button>
              </div>
              {/* Botón Validar */}
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating || !form.content.trim()}
                className="tf-btn-secondary text-xs gap-1.5 min-h-[44px] px-4"
              >
                {validating ? 'Validando...' : 'Validar'}
              </button>
              {/* Botón Preview — disponible en cuanto la validación pasa (sin guardar) */}
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || !validation?.ok}
                className="tf-btn-secondary text-xs gap-1.5 min-h-[44px] px-4"
                title={validation?.ok ? 'Abrir PDF de muestra' : 'Valida el template primero'}
              >
                <Eye size={14} />
                {previewing ? 'Generando...' : 'Preview PDF'}
              </button>
            </div>
          </div>

          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            disabled={!user?.role === 'admin'}
            rows={28}
            style={{ fontSize: `${fontSize}px` }}
            className="w-full h-[55dvh] sm:h-auto bg-[#0A0E16] border border-[#222630] rounded-lg p-4 font-mono text-tech-white focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
            placeholder="<!DOCTYPE html>..."
            spellCheck={false}
          />

          {/* Panel de validación */}
          {validation && (
            <div className={`rounded-lg p-4 space-y-2 border ${
              validation.ok
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}>
              {/* Estado */}
              <div className="flex items-center gap-2">
                {validation.ok ? (
                  <>
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-medium">Template válido</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-red-400" />
                    <span className="text-red-400 text-sm font-medium">Template con errores</span>
                  </>
                )}
              </div>

              {/* Errores */}
              {validation.errors.length > 0 && (
                <ul className="space-y-1 pl-6">
                  {validation.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                      <XCircle size={12} className="mt-0.5 flex-shrink-0 text-red-400" />
                      <code className="font-mono">{e}</code>
                    </li>
                  ))}
                </ul>
              )}

              {/* Advertencias */}
              {validation.warnings.length > 0 && (
                <ul className="space-y-1 pl-6">
                  {validation.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-400" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        {user?.role === 'admin' && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="tf-btn-primary gap-2 flex-1 py-2.5"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : isNew ? 'Crear template' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/company/templates')}
              className="tf-btn-secondary py-2.5 px-5"
            >
              Cancelar
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
