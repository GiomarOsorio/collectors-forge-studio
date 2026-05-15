/**
 * @file Página rediseñada de Compañía (Claude Design port — Día 9).
 *
 * Dashboard del admin: muestra estado del perfil, paleta PDF, templates y
 * accesos rápidos a las pantallas de edición existentes. Solo admin.
 *
 * @module pages/company/CompanyPageV2
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileCode,
  Image as ImageIcon,
  Mail,
  MapPin,
  Palette,
  Pencil,
  Phone,
  Settings,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, KPI } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getCompany, getCompanyTemplates } from '../../services/api';

const ACCENT = '#6366F1';

export default function CompanyPageV2() {
  const isMobile = useIsMobile();
  const [company, setCompany] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getCompany(), getCompanyTemplates()]).then(([c, t]) => {
      if (cancelled) return;
      if (c.status === 'fulfilled') setCompany(c.value.data);
      if (t.status === 'fulfilled') setTemplates(t.value.data || []);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      toast.error('No se pudo cargar Compañía');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const palette = Array.isArray(company?.pdf_palette) ? company.pdf_palette : [];
  const defaultTemplate = templates.find((t) => t.is_default);

  const sections = [
    {
      to: '/company/profile',
      icon: Building2,
      title: 'Perfil de empresa',
      desc: 'Nombre, logo, datos fiscales, contacto. Aparece en el encabezado de cotizaciones PDF.',
      status: company?.name ? `${company.name}` : 'Sin configurar',
      complete: !!(company?.name && company?.logo_url),
    },
    {
      to: '/company/branding',
      icon: Palette,
      title: 'Marca & Colores',
      desc: 'Define la paleta de colores que se usa en los PDFs (acentos, headers, líneas).',
      status: palette.length > 0 ? `${palette.length} colores` : 'Sin paleta',
      complete: palette.length > 0,
    },
    {
      to: '/company/templates',
      icon: FileCode,
      title: 'Templates PDF',
      desc: 'Templates Liquid HTML personalizados (WeasyPrint). El marcado como default se usa al descargar.',
      status: defaultTemplate ? `Default: ${defaultTemplate.name}` : `${templates.length} templates`,
      complete: !!defaultTemplate,
    },
  ];

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
          <Link key={s.to} to={s.to} className="block">
            <Card interactive className="p-4 h-full flex flex-col gap-3">
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
                      <span className="mono inline-flex items-center gap-1 text-[9.5px] px-1.5 py-px rounded-sm bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 tracking-wider">
                        <CheckCircle2 size={9} /> CONFIGURADO
                      </span>
                    ) : (
                      <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                        PENDIENTE
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-tech-white">{s.title}</p>
                  <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">{s.status}</p>
                </div>
                <ChevronRight size={14} className="text-gunmetal-dim shrink-0 mt-1" />
              </div>
              <p className="text-sm text-steel leading-snug">{s.desc}</p>
            </Card>
          </Link>
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
          <h2 className="text-lg font-semibold text-tech-white truncate">{company.name || 'Sin nombre'}</h2>
          <div className="mono text-[11.5px] text-gunmetal mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {company.tax_id && <span>{company.tax_id}</span>}
            {company.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {company.email}</span>}
            {company.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {company.phone}</span>}
            {company.address && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {company.address}</span>}
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
        <Link to="/company/profile" className="btn btn-ghost btn-sm">
          <Pencil size={13} /> Editar
        </Link>
      </Card>
    </div>
  );

  const TemplatesPreview = templates.length > 0 && (
    <div className={isMobile ? 'px-4 mt-3 pb-28' : 'px-6 pt-2 pb-8'}>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileCode size={14} style={{ color: ACCENT }} />
          <span className="lbl-eyebrow">Templates Liquid</span>
          <span className="mono text-[10px] text-gunmetal">{templates.length} total</span>
          <Link to="/company/templates" className="ml-auto mono text-[11px] text-indigo-400 hover:underline">
            Ver todos
          </Link>
        </div>
        <ul className="flex flex-col gap-1.5">
          {templates.slice(0, 5).map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border-soft)]"
            >
              <FileCode size={14} className="text-gunmetal shrink-0" />
              <span className="text-sm text-tech-white truncate flex-1">{t.name}</span>
              {t.is_default && (
                <span className="mono inline-flex items-center gap-1 text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                  <Star size={9} /> DEFAULT
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col -mx-4 -mt-4 pb-8">
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-2 industrial-grid">
            <span className="lbl-eyebrow">Compañía · estado</span>
            <p className="mono text-2xl font-semibold text-tech-white tracking-tight">
              {sections.filter((s) => s.complete).length}/{sections.length}
            </p>
            <span className="mono text-[11px] text-gunmetal">secciones configuradas</span>
          </Card>
        </div>
        {ProfilePreview}
        {SectionList}
        {TemplatesPreview}
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
          <Link to="/company/profile" className="btn btn-primary btn-sm">
            <Pencil size={13} /> Editar perfil
          </Link>
        </div>
      </header>

      {KPIs}

      {loading ? (
        <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando compañía…</p>
      ) : (
        <>
          {ProfilePreview}
          {SectionList}
          {TemplatesPreview}
        </>
      )}

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{sections.filter((s) => s.complete).length}/{sections.length} secciones configuradas</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
