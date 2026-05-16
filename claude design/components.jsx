// components.jsx — shared primitives for Collector's Forge Studio
// Reused by Slicer, Cola, Mantto, Vault, Compañía, Configuración.
// Inventory pages keep their own internals for now; we'll migrate later.
//
// All components inline-styled (no Tailwind), using the CFS tokens defined
// in each page's <style>:root{...}. Loads after icons.jsx.

// ─── PageShell ────────────────────────────────────────────────────────────
// Wraps a full app screen: <Sidebar active=… /> + <main>.
// Pass `appAccent` so the page subtly tints (used by KPI / icons / drawer).
function PageShell({ active, appAccent = 'var(--app-inventory)', children }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--forge-black)',
      // CSS var that descendants can read for accent
      ['--page-accent']: appAccent,
    }}>
      <Sidebar active={active} />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────
// Sticky-ish app header w/ eyebrow (app name + accent dot), title, subtitle, actions
function PageHeader({ icon = 'IconPackage', appName, title, subtitle, accent = 'var(--page-accent)', actions, children }) {
  const Icon = window[icon];
  return (
    <header style={{
      padding: '20px 28px 16px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'linear-gradient(180deg, rgba(15, 18, 25, 0) 0%, var(--forge-black) 100%), var(--forge-black)',
      display: 'flex', alignItems: 'flex-start', gap: 18,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: `color-mix(in oklab, ${accent} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 35%, transparent)`,
        color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {appName && (
          <div className="mono" style={{
            fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
            marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: accent }} />
            {appName}
          </div>
        )}
        <h1 style={{
          margin: 0,
          font: '600 22px/1.15 var(--font-sans)',
          color: 'var(--tech-white)',
          letterSpacing: -0.3,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            margin: '5px 0 0',
            font: '400 13px/1.45 var(--font-sans)',
            color: 'var(--steel)',
            maxWidth: 580,
          }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </header>
  );
}

// ─── KPITile ──────────────────────────────────────────────────────────────
// Compact KPI; reads `accent` for value/icon color.
function KPITile({ label, value, unit, sub, icon, accent = 'var(--page-accent)', warn, trend }) {
  const Icon = icon ? window[icon] : null;
  const valueColor = warn ? 'var(--forge-amber)' : 'var(--tech-white)';
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '13px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 5,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
            color: accent,
          }}>
            <Icon size={11} />
          </span>
        )}
        <span className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14,
          textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: valueColor, letterSpacing: -0.3 }}>
          {value}
        </span>
        {unit && <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{unit}</span>}
        {trend && (
          <span className="mono" style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 10.5, color: trend.startsWith('-') ? '#F87171' : '#34D399',
          }}>
            {trend.startsWith('-') ? <IconTrendDown size={10} /> : <IconTrendUp size={10} />}
            {trend.replace(/^[-+]/, '')}
          </span>
        )}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────
// Color-coded label, used for queue/PO/printer state.
const STATUS_PRESETS = {
  active:    { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.30)' },
  printing:  { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.10)',  border: 'rgba(59, 130, 246, 0.32)' },
  pending:   { color: '#94A0AE', bg: 'rgba(148, 160, 174, 0.10)', border: 'rgba(148, 160, 174, 0.25)' },
  paused:    { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.30)' },
  done:      { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.28)' },
  warn:      { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.30)' },
  danger:    { color: '#F87171', bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.30)' },
  info:      { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.30)' },
  neutral:   { color: 'var(--steel)', bg: 'rgba(228, 232, 237, 0.05)', border: 'var(--border)' },
};
function StatusPill({ tone = 'neutral', icon, children, size = 'sm' }) {
  const s = STATUS_PRESETS[tone] || STATUS_PRESETS.neutral;
  const Icon = icon ? window[icon] : null;
  const px = size === 'lg' ? '4px 9px' : '2px 7px';
  const fs = size === 'lg' ? 11 : 9.5;
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: px, borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: fs, fontWeight: 600, letterSpacing: 0.06,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {Icon && <Icon size={fs - 1} />}
      {children}
    </span>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────
function EmptyState({ icon = 'IconBox', title, hint, action, accent = 'var(--page-accent)' }) {
  const Icon = window[icon];
  return (
    <div style={{
      padding: '60px 24px',
      textAlign: 'center',
      maxWidth: 420,
      margin: '0 auto',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px',
        background: `color-mix(in oklab, ${accent} 10%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 22%, transparent)`,
        color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={24} />
      </div>
      <div style={{ font: '600 15px/1.3 var(--font-sans)', color: 'var(--tech-white)', marginBottom: 5 }}>
        {title}
      </div>
      {hint && (
        <div style={{ font: '400 12.5px/1.5 var(--font-sans)', color: 'var(--gunmetal)', marginBottom: action ? 16 : 0 }}>
          {hint}
        </div>
      )}
      {action}
    </div>
  );
}

// ─── DetailDrawer ─────────────────────────────────────────────────────────
// Slide-in right panel. Backdrop + close on outside click + Esc.
function DetailDrawer({ open, onClose, title, eyebrow, width = 460, children, footer }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <React.Fragment>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(6, 9, 18, 0.6)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
          zIndex: 80,
        }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width,
        maxWidth: 'calc(100vw - 64px)',
        background: 'var(--surf-card)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        zIndex: 81,
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{
          padding: '16px 18px 14px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && (
              <div className="mono" style={{
                fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
                textTransform: 'uppercase', marginBottom: 4,
              }}>{eyebrow}</div>
            )}
            <div style={{
              font: '600 16px/1.2 var(--font-sans)', color: 'var(--tech-white)',
              letterSpacing: -0.2,
            }}>{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--steel)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', flexShrink: 0,
            }}
          >
            <IconX size={14} />
          </button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
          {children}
        </div>
        {footer && (
          <footer style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid var(--border-soft)',
            background: 'var(--surf-card-2)',
            display: 'flex', gap: 8,
            flexShrink: 0,
          }}>
            {footer}
          </footer>
        )}
      </aside>
    </React.Fragment>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────
// Used by Slicer (.3mf/.gcode) and Vault (.stl/.3mf/.step) for uploads.
function DropZone({ accept = '.3mf, .gcode', hint = 'Suelta tu archivo aquí', icon = 'IconUpload', accent = 'var(--page-accent)', cta = 'Examinar archivos', meta }) {
  const [hover, setHover] = React.useState(false);
  const Icon = window[icon];
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); }}
      style={{
        padding: '36px 24px',
        border: `1.5px dashed ${hover ? accent : 'var(--border-strong)'}`,
        borderRadius: 14,
        background: hover
          ? `color-mix(in oklab, ${accent} 6%, var(--surf-card))`
          : 'var(--surf-card)',
        textAlign: 'center',
        transition: 'border-color 160ms ease, background 160ms ease',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, margin: '0 auto 12px',
        background: `color-mix(in oklab, ${accent} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 32%, transparent)`,
        color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} />
      </div>
      <div style={{ font: '600 15px/1.2 var(--font-sans)', color: 'var(--tech-white)', marginBottom: 4 }}>
        {hint}
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)', marginBottom: 14, letterSpacing: 0.04 }}>
        {meta || `o pulsa para seleccionar · ${accept}`}
      </div>
      <button type="button" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        background: accent, color: '#0A1014',
        border: 0,
        font: '600 12.5px var(--font-sans)',
        cursor: 'default',
      }}>
        <IconUpload size={12} /> {cta}
      </button>
    </div>
  );
}

// ─── Toolbar primitives ───────────────────────────────────────────────────
function ToolbarRow({ children, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 28px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SearchField({ value, onChange, placeholder = 'Buscar…', width = 260 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 10px', borderRadius: 7,
      background: 'var(--surf-card)',
      border: '1px solid var(--border-strong)',
      width,
    }}>
      <IconSearch size={13} style={{ color: 'var(--gunmetal)' }} />
      <input
        value={value || ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0,
          background: 'transparent', border: 0, outline: 0,
          color: 'var(--tech-white)',
          font: '400 12.5px var(--font-sans)',
        }}
      />
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────
function ProgressBar({ value, max = 100, accent = 'var(--page-accent)', warnAt = 0.2, height = 4, width = '100%' }) {
  const pctVal = Math.max(0, Math.min(100, (value / max) * 100));
  const warn = (value / max) <= warnAt;
  return (
    <div style={{ width, height, background: 'rgba(228, 232, 237, 0.06)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        width: `${pctVal}%`, height: '100%',
        background: warn ? 'var(--forge-amber)' : accent,
        borderRadius: height / 2,
        transition: 'width 240ms ease',
      }} />
    </div>
  );
}

// ─── expose ───────────────────────────────────────────────────────────────
Object.assign(window, {
  PageShell, PageHeader,
  KPITile, StatusPill, EmptyState,
  DetailDrawer, DropZone,
  ToolbarRow, SearchField, ProgressBar,
});
