// sidebar.jsx — StudioSidebar (global app nav)
// Fixed aside w-64 on desktop. Apps list with active state + live badges.
// "Inventario" is active here. Sections (Compras / Importar) are collapsible.

const APPS = [
  { id: 'cost',       label: 'Costos',         icon: 'IconCalculator',  accent: '#2DD4BF', route: '/cost',         badge: null },
  { id: 'inventory',  label: 'Inventario',     icon: 'IconPackage',     accent: '#3B82F6', route: '/inventory',    badge: { count: 7, kind: 'warn', tip: '7 ítems bajos' }, active: true },
  { id: 'slicer',     label: 'Slicer',         icon: 'IconCpu',         accent: '#F59E0B', route: '/slicer',       badge: null },
  { id: 'maintenance',label: 'Mantenimiento',  icon: 'IconWrench',      accent: '#8B5CF6', route: '/maintenance',  badge: { count: 2, kind: 'warn', tip: '2 venc.' } },
  { id: 'queue',      label: 'Cola',           icon: 'IconListOrdered', accent: '#14B8A6', route: '/queue',        badge: { count: 4, kind: 'info', tip: '4 pend.' } },
  { id: 'vault',      label: 'Vault',          icon: 'IconArchive',     accent: '#F43F5E', route: '/vault',        badge: null },
  { id: 'company',    label: 'Compañía',       icon: 'IconBuilding',    accent: '#6366F1', route: '/company',      badge: null },
];

function AppRow({ app, active, onClick }) {
  const Icon = window[app.icon];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid transparent',
        background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        borderColor: active ? 'rgba(59, 130, 246, 0.22)' : 'transparent',
        color: active ? '#E4E8ED' : '#94A0AE',
        cursor: 'default',
        position: 'relative',
        textAlign: 'left',
        font: '500 13px/1.2 var(--font-sans)',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) { e.currentTarget.style.background = '#1A2030'; e.currentTarget.style.color = '#E4E8ED'; }
      }}
      onMouseLeave={(e) => {
        if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A0AE'; }
      }}
    >
      {/* drag handle stub */}
      <span style={{ display: 'inline-flex', width: 8, height: 14, color: '#3F4654', flexShrink: 0 }}>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="3" r="1" />
          <circle cx="6" cy="3" r="1" />
          <circle cx="2" cy="7" r="1" />
          <circle cx="6" cy="7" r="1" />
          <circle cx="2" cy="11" r="1" />
          <circle cx="6" cy="11" r="1" />
        </svg>
      </span>
      <span style={{ color: app.accent, display: 'inline-flex' }}>
        <Icon size={16} />
      </span>
      <span style={{ flex: 1 }}>{app.label}</span>
      {app.badge && (
        <span
          title={app.badge.tip}
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 999,
            background: app.badge.kind === 'warn' ? 'rgba(251, 191, 36, 0.14)' : 'rgba(45, 212, 191, 0.14)',
            color: app.badge.kind === 'warn' ? '#FBBF24' : '#2DD4BF',
            border: app.badge.kind === 'warn' ? '1px solid rgba(251, 191, 36, 0.25)' : '1px solid rgba(45, 212, 191, 0.25)',
          }}
        >
          {app.badge.count}
        </span>
      )}
      {active && (
        <span style={{
          position: 'absolute',
          left: -1, top: 6, bottom: 6,
          width: 2,
          background: app.accent,
          borderRadius: 2,
        }} />
      )}
    </button>
  );
}

function SidebarSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 10px',
          background: 'transparent',
          border: 0,
          cursor: 'default',
          color: '#5A6573',
        }}
      >
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 160ms ease' }}>
          <IconChevronRight size={11} />
        </span>
        <span className="lbl-eyebrow" style={{ fontSize: 10 }}>{title}</span>
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? 400 : 0,
        opacity: open ? 1 : 0,
        transition: 'max-height 220ms ease, opacity 160ms ease',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarSubItem({ label, icon, accent = '#94A0AE', badge }) {
  const Icon = icon ? window[icon] : null;
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 10px 6px 26px',
        borderRadius: 6,
        border: 0,
        background: 'transparent',
        color: '#94A0AE',
        font: '400 12.5px/1.2 var(--font-sans)',
        cursor: 'default',
        textAlign: 'left',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1A2030'; e.currentTarget.style.color = '#E4E8ED'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A0AE'; }}
    >
      {Icon && <Icon size={13} style={{ color: accent }} />}
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && <span className="mono" style={{ fontSize: 10, color: '#5A6573' }}>{badge}</span>}
    </button>
  );
}

function Sidebar({ active = 'inventory' }) {
  return (
    <aside style={{
      width: 256,
      flexShrink: 0,
      background: 'var(--surf-sidebar)',
      borderRight: '1px solid var(--border-soft)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* brand */}
      <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)' }}>
        {/* logo mark — placeholder geometric "forge anvil" */}
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0A0E16', fontWeight: 700, fontSize: 14,
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 0 0 1px rgba(45,212,191,0.3), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}>
          CF
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E4E8ED', letterSpacing: 0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Collector's Forge</span>
          <span className="mono" style={{ fontSize: 10, color: '#5A6573', letterSpacing: 0.08, whiteSpace: 'nowrap' }}>STUDIO · v0.4</span>
        </div>
      </div>

      {/* search */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 9px',
          background: '#0F1219',
          border: '1px solid #1C2230',
          borderRadius: 7,
          color: '#5A6573',
        }}>
          <IconSearch size={13} />
          <span style={{ fontSize: 12, flex: 1 }}>Buscar…</span>
          <span className="mono" style={{ fontSize: 10, padding: '1px 5px', border: '1px solid #1C2230', borderRadius: 3 }}>⌘K</span>
        </div>
      </div>

      {/* apps list */}
      <div style={{ padding: '4px 8px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidebarSection title="Apps" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
            {APPS.map((app) => (
              <AppRow key={app.id} app={app} active={app.id === active} />
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="Inventario" defaultOpen>
          <SidebarSubItem label="Filamentos"     icon="IconDroplet"  accent="#3B82F6" badge={22} />
          <SidebarSubItem label="Insumos"        icon="IconBox"      accent="#3B82F6" badge={5} />
          <SidebarSubItem label="Herramientas"   icon="IconScissors" accent="#3B82F6" badge={4} />
          <SidebarSubItem label="Consumibles"    icon="IconBeaker"   accent="#3B82F6" badge={4} />
          <SidebarSubItem label="Compras"        icon="IconCart"     accent="#3B82F6" badge={3} />
        </SidebarSection>

        <SidebarSection title="Acciones" defaultOpen={false}>
          <SidebarSubItem label="Importar CSV"   icon="IconUpload" />
          <SidebarSubItem label="Exportar"       icon="IconDownload" />
        </SidebarSection>
      </div>

      {/* footer / user */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: '#1A2030',
          border: '1px solid #303642',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#E4E8ED',
          fontFamily: 'var(--font-mono)',
        }}>
          G
        </div>
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#E4E8ED' }}>Giomar</div>
          <div className="mono" style={{ fontSize: 10, color: '#5A6573' }}>admin · medellín</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ padding: 6 }}
          aria-label="Configuración"
        >
          <IconSettings size={14} />
        </button>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar, APPS });
