// company.jsx — Compañía (desktop)
// Single page with tabbed sections: Información · Branding · Tarifas ·
// Clientes · Proveedores · Empleados.
// Detail drawer when clicking a client or vendor.

const CACC = 'var(--app-company)'; // #6366F1 indigo
const CACC_HEX = '#6366F1';

const cFmtCOP = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`;
const cCopK   = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

// ─── header ───────────────────────────────────────────────────────────────
function CompanyHeader() {
  return (
    <header style={{
      padding: '14px 22px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `color-mix(in oklab, ${CACC} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${CACC} 32%, transparent)`,
        color: CACC,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBuilding size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
          textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: CACC }} />
          Compañía
        </div>
        <h1 style={{
          margin: 0, font: '600 18px/1.2 var(--font-sans)',
          color: 'var(--tech-white)', letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {COMPANY_PROFILE.name}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={cGhost}>
          <IconDownload size={13} /> Exportar perfil
        </button>
        <button type="button" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 7,
          background: CACC_HEX, color: '#0E0F2C',
          border: 0,
          font: '600 12px var(--font-sans)',
          cursor: 'default',
        }}>
          <IconEdit size={13} /> Editar perfil
        </button>
      </div>
    </header>
  );
}

// ─── tab nav ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'info',      label: 'Información',  icon: 'IconBuilding' },
  { id: 'branding',  label: 'Branding',     icon: 'IconEdit' },
  { id: 'rates',     label: 'Tarifas',      icon: 'IconCalculator' },
  { id: 'clients',   label: 'Clientes',     icon: 'IconBuilding', badgeFn: () => CLIENTS.length },
  { id: 'vendors',   label: 'Proveedores',  icon: 'IconCart',     badgeFn: () => VENDORS.length },
  { id: 'team',      label: 'Equipo',       icon: 'IconBuilding', badgeFn: () => EMPLOYEES.filter((e) => e.active).length },
];

function TabBar({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      padding: '10px 22px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
    }}>
      {TABS.map((t) => {
        const Icon = window[t.icon];
        const active = value === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7,
            background: active ? 'rgba(99, 102, 241, 0.10)' : 'transparent',
            border: `1px solid ${active ? 'rgba(99, 102, 241, 0.34)' : 'transparent'}`,
            color: active ? '#A5B4FC' : 'var(--steel)',
            font: '500 12.5px var(--font-sans)',
            cursor: 'default',
            transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
          }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--tech-white)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--steel)'; }}
          >
            <Icon size={12} style={{ color: active ? CACC : 'var(--gunmetal)' }} />
            {t.label}
            {t.badgeFn && (
              <span className="mono" style={{
                fontSize: 9.5,
                padding: '1px 5px', borderRadius: 999,
                background: active ? 'rgba(99, 102, 241, 0.15)' : 'rgba(228, 232, 237, 0.05)',
                color: active ? '#A5B4FC' : 'var(--gunmetal)',
                border: `1px solid ${active ? 'rgba(99, 102, 241, 0.25)' : 'var(--border)'}`,
              }}>
                {t.badgeFn()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── INFO tab ─────────────────────────────────────────────────────────────
function TabInfo() {
  const profile = COMPANY_PROFILE;
  return (
    <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      {/* fiscal */}
      <Card title="Datos fiscales" icon="IconBuilding" tone={CACC}>
        <FieldRow label="Razón social" value={profile.legalName} />
        <FieldRow label="NIT" value={profile.nit} mono />
        <FieldRow label="Nombre comercial" value={profile.name} />
        <FieldRow label="Fundada" value={profile.founded} />
        <FieldRow label="País" value={profile.country} />
        <FieldRow label="Ciudad" value={profile.city} />
        <FieldRow label="Dirección" value={profile.address} last />
      </Card>

      {/* contact */}
      <Card title="Contacto" icon="IconBell" tone="#34D399">
        <FieldRow label="Email" value={profile.email} mono />
        <FieldRow label="Teléfono" value={profile.phone} mono />
        <FieldRow label="Web" value={profile.web} mono last />
        <div style={{ marginTop: 10, padding: 10, background: 'rgba(45, 212, 191, 0.05)', border: '1px solid rgba(45, 212, 191, 0.18)', borderRadius: 8 }}>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase', marginBottom: 4 }}>
            Conexiones activas
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Bambu Cloud', 'Mainsail', 'Wompi'].map((c) => (
              <span key={c} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 999,
                background: 'rgba(52, 211, 153, 0.10)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: '#34D399',
                font: '500 11px var(--font-sans)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
                {c}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function FieldRow({ label, value, mono, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 14,
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <span className="mono" style={{
        flex: '0 0 130px',
        fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span className={mono ? 'mono' : ''} style={{
        flex: 1,
        font: `${mono ? '500 13px var(--font-mono)' : '500 13px var(--font-sans)'}`,
        color: 'var(--tech-white)',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── BRANDING tab ─────────────────────────────────────────────────────────
function TabBranding() {
  return (
    <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="Logo" icon="IconEdit" tone={CACC}>
        <div style={{
          height: 150, borderRadius: 10,
          background: COMPANY_BRANDING.logoBg,
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
          marginBottom: 10,
        }}>
          {/* logo placeholder — CFS monogram */}
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            background: `linear-gradient(135deg, ${COMPANY_BRANDING.primary}, ${COMPANY_BRANDING.accent})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#0A1014',
            font: '700 28px var(--font-sans)',
            letterSpacing: -1,
          }}>
            CF
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14 }}>
            COLLECTOR'S FORGE STUDIO
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={{ ...cGhost, flex: 1 }}>
            <IconUpload size={12} /> Subir SVG
          </button>
          <button type="button" style={{ ...cGhost, flex: 1 }}>
            <IconDownload size={12} /> Descargar kit
          </button>
        </div>
      </Card>

      <Card title="Colores y PDF" icon="IconEdit" tone={CACC}>
        <FieldRowSwatch label="Primary" value={COMPANY_BRANDING.primary} />
        <FieldRowSwatch label="Accent"  value={COMPANY_BRANDING.accent} />
        <FieldRowSwatch label="Fondo logo" value={COMPANY_BRANDING.logoBg} last />
        <div style={{ marginTop: 12 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 4 }}>
            Footer PDF
          </div>
          <div style={{
            padding: '10px 12px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            font: '400 12px/1.5 var(--font-sans)',
            color: 'var(--steel)',
            fontStyle: 'italic',
          }}>
            "{COMPANY_BRANDING.pdfFooter}"
          </div>
        </div>
      </Card>
    </div>
  );
}

function FieldRowSwatch({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <span className="mono" style={{
        flex: '0 0 120px',
        fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        width: 26, height: 26, borderRadius: 6,
        background: value,
        border: '1px solid var(--border-strong)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }} />
      <span className="mono" style={{
        font: '500 13px var(--font-mono)', color: 'var(--tech-white)',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── RATES tab ────────────────────────────────────────────────────────────
function TabRates() {
  const r = COMPANY_RATES;
  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        <RateTile label="Hora máquina"     value={cFmtCOP(r.hourlyMachine)} sub="por impresora" icon="IconCpu" />
        <RateTile label="Hora trabajo"     value={cFmtCOP(r.hourlyLabor)}   sub="por operario"  icon="IconWrench" />
        <RateTile label="Margen default"   value={`${r.marginDefault}%`}     sub="sobre costo"   icon="IconTrendUp" />
        <RateTile label="Recargo express"  value={`+${r.rushSurcharge}%`}    sub="jobs urgentes" icon="IconAlert" warn />
        <RateTile label="Fee de diseño"    value={cFmtCOP(r.designFee)}      sub="flat por cotización" icon="IconEdit" />
        <RateTile label="Envío Medellín"   value={cFmtCOP(r.shippingMed)}    sub="local en mano"  icon="IconTruck" />
        <RateTile label="IVA"              value={`${r.ivaPct}%`}             sub="aplicar opcional"  icon="IconCalculator" />
      </div>

      <Card title="Notas" icon="IconEdit" tone={CACC} style={{ marginTop: 14 }}>
        <ul style={{
          margin: 0, paddingLeft: 18,
          font: '400 12.5px/1.7 var(--font-sans)',
          color: 'var(--steel)',
        }}>
          <li>Estas tarifas se inyectan como defaults al crear una nueva cotización en la app de Costos.</li>
          <li>La hora máquina cubre amortización + energía estimada. Editable por proyecto.</li>
          <li>Margen, recargos y diseño son aditivos al subtotal.</li>
        </ul>
      </Card>
    </div>
  );
}

function RateTile({ label, value, sub, icon, warn }) {
  const Icon = icon ? window[icon] : null;
  return (
    <div style={{
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 5,
            background: warn ? 'rgba(251, 191, 36, 0.14)' : `color-mix(in oklab, ${CACC} 14%, transparent)`,
            color: warn ? '#FBBF24' : CACC,
          }}>
            <Icon size={11} />
          </span>
        )}
        <span className="mono" style={{
          fontSize: 9, color: warn ? '#FBBF24' : 'var(--gunmetal)',
          letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div className="mono" style={{
        font: '600 19px var(--font-mono)', color: 'var(--tech-white)',
        letterSpacing: -0.3, whiteSpace: 'nowrap',
      }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>{sub}</div>}
    </div>
  );
}

// ─── CLIENTS tab ──────────────────────────────────────────────────────────
function TabClients({ onSelect }) {
  return (
    <div style={{ padding: '16px 22px' }}>
      <ListToolbar
        label={`${CLIENTS.length} clientes activos`}
        button="Nuevo cliente"
      />
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <ListHeaderRow cols={['ID', 'Cliente', 'Contacto', 'Ciudad', 'Cotizaciones', 'Total gastado', 'Tier', '']} />
        {CLIENTS.map((c, i) => (
          <ClientRow key={c.id} client={c} last={i === CLIENTS.length - 1} onClick={onSelect} />
        ))}
      </div>
    </div>
  );
}

function ClientRow({ client, last, onClick }) {
  const tier = COMPANY_TIER[client.tier];
  return (
    <div
      onClick={() => onClick({ kind: 'client', data: client })}
      style={{
        display: 'grid',
        gridTemplateColumns: '80px minmax(0, 1.4fr) minmax(0, 1.2fr) 110px 100px 110px 70px 28px',
        alignItems: 'center', gap: 14,
        padding: '11px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border-soft)',
        cursor: 'default',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surf-card-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>{client.id}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.10)' : 'rgba(167, 139, 250, 0.10)',
          border: `1px solid ${client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.25)' : 'rgba(167, 139, 250, 0.25)'}`,
          color: client.kind === 'B2B' ? 'var(--forge-teal)' : '#A78BFA',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBuilding size={12} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            font: '600 13px var(--font-sans)', color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{client.name}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
            {client.kind} · {client.jobs} jobs
          </div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          font: '500 12px var(--font-sans)', color: 'var(--steel)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{client.contact}</div>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{client.email}</div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{client.city}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>
        {client.quotes} <span style={{ color: 'var(--gunmetal-dim)' }}>· últ. {client.lastOrder}</span>
      </span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--tech-white)' }}>
        {cCopK(client.totalSpent)}
      </span>
      <span className="mono" style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 999,
        background: tier.bg, border: `1px solid ${tier.border}`,
        color: tier.color,
        fontSize: 9, fontWeight: 600, letterSpacing: 0.08,
      }}>
        {tier.label}
      </span>
      <span style={{ color: 'var(--gunmetal)', display: 'inline-flex' }}>
        <IconChevronRight size={13} />
      </span>
    </div>
  );
}

// ─── VENDORS tab ──────────────────────────────────────────────────────────
function TabVendors({ onSelect }) {
  return (
    <div style={{ padding: '16px 22px' }}>
      <ListToolbar
        label={`${VENDORS.length} proveedores · ${VENDORS.reduce((s, v) => s + v.openPOs, 0)} POs abiertas`}
        button="Nuevo proveedor"
      />
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <ListHeaderRow cols={['ID', 'Proveedor', 'Categoría', 'Ciudad', 'Lead', 'POs', 'Gastado', 'Rating', '']} />
        {VENDORS.map((v, i) => (
          <VendorRow key={v.id} vendor={v} last={i === VENDORS.length - 1} onClick={onSelect} />
        ))}
      </div>
    </div>
  );
}

function VendorRow({ vendor, last, onClick }) {
  return (
    <div
      onClick={() => onClick({ kind: 'vendor', data: vendor })}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px minmax(0, 1.3fr) 110px 100px 80px 60px 110px 86px 28px',
        alignItems: 'center', gap: 14,
        padding: '11px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border-soft)',
        cursor: 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surf-card-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>{vendor.id}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'rgba(99, 102, 241, 0.10)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: CACC,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCart size={12} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            font: '600 13px var(--font-sans)', color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{vendor.name}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
            {vendor.contact}
          </div>
        </div>
      </div>
      <span style={{ font: '500 11.5px var(--font-sans)', color: 'var(--steel)' }}>
        {vendor.category}
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{vendor.city}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{vendor.leadDays} días</span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: vendor.openPOs > 0 ? 'var(--app-inventory)' : 'var(--gunmetal-dim)' }}>
        {vendor.openPOs}
      </span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--tech-white)' }}>
        {cCopK(vendor.totalSpent)}
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        font: '500 12px var(--font-sans)', color: '#FBBF24',
      }}>
        ★ <span className="mono">{vendor.rating.toFixed(1)}</span>
      </span>
      <span style={{ color: 'var(--gunmetal)', display: 'inline-flex' }}>
        <IconChevronRight size={13} />
      </span>
    </div>
  );
}

// ─── TEAM tab ────────────────────────────────────────────────────────────
function TabTeam() {
  return (
    <div style={{ padding: '16px 22px' }}>
      <ListToolbar
        label={`${EMPLOYEES.filter((e) => e.active).length} miembros activos`}
        button="Invitar"
      />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10,
      }}>
        {EMPLOYEES.map((e) => <EmployeeCard key={e.id} emp={e} />)}
      </div>
    </div>
  );
}

function EmployeeCard({ emp }) {
  const permTone = emp.permissions === 'admin' ? '#F87171' : emp.permissions === 'edit' ? '#3B82F6' : '#94A0AE';
  return (
    <div style={{
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 999, flexShrink: 0,
          background: `color-mix(in oklab, ${emp.avatarTone} 18%, transparent)`,
          border: `1px solid color-mix(in oklab, ${emp.avatarTone} 32%, transparent)`,
          color: emp.avatarTone,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          font: '600 16px var(--font-sans)',
        }}>
          {emp.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: '600 14px var(--font-sans)', color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{emp.name}</div>
          <div className="mono" style={{
            fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{emp.role}</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 8px', borderRadius: 999,
          background: `color-mix(in oklab, ${permTone} 12%, transparent)`,
          border: `1px solid color-mix(in oklab, ${permTone} 28%, transparent)`,
          color: permTone,
          font: '600 9.5px var(--font-mono)', letterSpacing: 0.08,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {emp.permissions}
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border-soft)',
        borderRadius: 8,
      }}>
        <IconBell size={11} style={{ color: 'var(--gunmetal)' }} />
        <span className="mono" style={{
          fontSize: 10.5, color: 'var(--steel)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1,
        }}>{emp.email}</span>
      </div>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, color: 'var(--gunmetal-dim)',
      }}>
        <IconClock size={10} /> Desde {emp.joined}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: emp.active ? '#34D399' : 'var(--gunmetal-dim)' }} />
          {emp.active ? 'activo' : 'inactivo'}
        </span>
      </div>
    </div>
  );
}

// ─── helpers: Card, ListToolbar, ListHeaderRow ───────────────────────────
function Card({ title, icon, tone = CACC, children, style }) {
  const Icon = icon ? window[icon] : null;
  return (
    <section style={{
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      ...style,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {Icon && (
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: `color-mix(in oklab, ${tone} 14%, transparent)`,
            color: tone,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={12} />
          </span>
        )}
        <h3 style={{
          margin: 0, font: '600 11px/1 var(--font-sans)',
          color: 'var(--steel)', letterSpacing: 0.14, textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>{title}</h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ListToolbar({ label, button }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
    }}>
      <span style={{
        font: '600 12px var(--font-sans)', color: 'var(--tech-white)',
      }}>{label}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7,
          background: 'var(--surf-card)',
          border: '1px solid var(--border-strong)',
          width: 220,
        }}>
          <IconSearch size={12} style={{ color: 'var(--gunmetal)' }} />
          <input placeholder="Buscar…" style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 0, outline: 0,
            color: 'var(--tech-white)', font: '400 12px var(--font-sans)',
          }} />
        </div>
        <button type="button" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 11px', borderRadius: 7,
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.32)',
          color: '#A5B4FC',
          font: '500 11.5px var(--font-sans)',
          cursor: 'default',
        }}>
          <IconPlus size={11} /> {button}
        </button>
      </div>
    </div>
  );
}

function ListHeaderRow({ cols }) {
  return (
    <div style={{
      display: 'grid',
      // matches whatever the row uses; placed manually per table
      gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(228, 232, 237, 0.02)',
    }}>
      {cols.map((c, i) => (
        <span key={i} className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)',
          letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{c}</span>
      ))}
    </div>
  );
}

// ─── detail drawer (client / vendor) ─────────────────────────────────────
function CompanyDrawer({ selection, onClose }) {
  if (!selection) return null;
  const { kind, data } = selection;
  if (kind === 'client') return <ClientDrawer client={data} onClose={onClose} />;
  if (kind === 'vendor') return <VendorDrawer vendor={data} onClose={onClose} />;
  return null;
}

function ClientDrawer({ client, onClose }) {
  const tier = COMPANY_TIER[client.tier];
  // try to find related jobs and quotes
  const jobs = QUEUE_JOBS.filter((j) => j.client === client.name);
  return (
    <DetailDrawer
      open
      onClose={onClose}
      eyebrow={`Cliente · ${client.id}`}
      title={client.name}
      width={500}
      footer={
        <React.Fragment>
          <button type="button" style={cDrawerSecondary}>
            <IconEdit size={13} /> Editar
          </button>
          <button type="button" style={{ ...cDrawerPrimary, flex: 1 }}>
            <IconArrowUpRight size={13} /> Nueva cotización
          </button>
        </React.Fragment>
      }
    >
      {/* hero */}
      <div style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${tier.color} 8%, transparent), transparent), var(--surf-card-2)`,
        border: '1px solid var(--border)',
        borderRadius: 12, padding: 14, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.16)' : 'rgba(167, 139, 250, 0.16)',
          border: `1px solid ${client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.32)' : 'rgba(167, 139, 250, 0.32)'}`,
          color: client.kind === 'B2B' ? 'var(--forge-teal)' : '#A78BFA',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBuilding size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ font: '500 11px var(--font-sans)', color: 'var(--steel)' }}>
              {client.kind} · {client.city}
            </span>
          </div>
          <div className="mono" style={{ font: '600 14px var(--font-mono)', color: 'var(--tech-white)', marginTop: 1 }}>
            {cFmtCOP(client.totalSpent)}
          </div>
        </div>
        <span style={{
          padding: '4px 9px', borderRadius: 999,
          background: tier.bg, border: `1px solid ${tier.border}`,
          color: tier.color,
          font: '600 11px var(--font-mono)', letterSpacing: 0.08,
        }}>
          {tier.label}
        </span>
      </div>

      <h3 style={cDrawerSection}>Contacto</h3>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px', marginBottom: 14,
      }}>
        <FieldRow label="Persona" value={client.contact} />
        <FieldRow label="Email"   value={client.email} mono />
        <FieldRow label="Teléfono" value={client.phone} mono last />
      </div>

      <h3 style={cDrawerSection}>Actividad</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
        <DrawerStat label="Cotizaciones" icon="IconArrowUpRight" value={client.quotes} />
        <DrawerStat label="Jobs"         icon="IconListOrdered"  value={client.jobs} />
        <DrawerStat label="Última orden" icon="IconClock"        value={client.lastOrder} />
      </div>

      {jobs.length > 0 && (
        <React.Fragment>
          <h3 style={cDrawerSection}>Jobs activos</h3>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            {jobs.slice(0, 4).map((j, i) => (
              <div key={j.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                borderBottom: i === Math.min(3, jobs.length - 1) ? 'none' : '1px solid var(--border-soft)',
              }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{j.id}</span>
                <span style={{
                  font: '500 12px var(--font-sans)', color: 'var(--tech-white)',
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{j.name}</span>
                <StatusPill tone={j.status === 'printing' ? 'printing' : j.status === 'done' ? 'done' : j.status === 'paused' ? 'paused' : 'pending'}>
                  {QUEUE_STATUSES.find((s) => s.id === j.status).label}
                </StatusPill>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </DetailDrawer>
  );
}

function VendorDrawer({ vendor, onClose }) {
  const openPOs = COMPRAS.filter((p) => p.vendor === vendor.name && p.status !== 'completado');
  return (
    <DetailDrawer
      open
      onClose={onClose}
      eyebrow={`Proveedor · ${vendor.id}`}
      title={vendor.name}
      width={500}
      footer={
        <React.Fragment>
          <button type="button" style={cDrawerSecondary}>
            <IconEdit size={13} /> Editar
          </button>
          <button type="button" style={{ ...cDrawerPrimary, flex: 1 }}>
            <IconCart size={13} /> Nueva PO
          </button>
        </React.Fragment>
      }
    >
      <div style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${CACC} 10%, transparent), transparent), var(--surf-card-2)`,
        border: '1px solid var(--border)',
        borderRadius: 12, padding: 14, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'rgba(99, 102, 241, 0.14)',
          border: '1px solid rgba(99, 102, 241, 0.32)',
          color: CACC,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCart size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>
            {vendor.category} · {vendor.city}
          </div>
          <div className="mono" style={{ font: '600 14px var(--font-mono)', color: 'var(--tech-white)', marginTop: 1 }}>
            {cFmtCOP(vendor.totalSpent)}
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          font: '600 14px var(--font-sans)', color: '#FBBF24',
        }}>
          ★ <span className="mono">{vendor.rating.toFixed(1)}</span>
        </span>
      </div>

      <h3 style={cDrawerSection}>Contacto y entrega</h3>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px', marginBottom: 14,
      }}>
        <FieldRow label="Contacto"  value={vendor.contact} />
        <FieldRow label="Ciudad"    value={vendor.city} />
        <FieldRow label="Lead time" value={`${vendor.leadDays} días`} mono last />
      </div>

      <h3 style={cDrawerSection}>POs abiertas</h3>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden', marginBottom: 14,
      }}>
        {openPOs.length ? openPOs.map((po, i) => (
          <div key={po.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            borderBottom: i === openPOs.length - 1 ? 'none' : '1px solid var(--border-soft)',
          }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--tech-white)', fontWeight: 600 }}>{po.id}</span>
            <span style={{ font: '500 12px var(--font-sans)', color: 'var(--steel)' }}>
              {po.items} ítems
            </span>
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tech-white)' }}>
              {cCopK(po.total)}
            </span>
            <StatusPill tone={po.status === 'en camino' ? 'printing' : po.status === 'procesando' ? 'warn' : 'neutral'}>
              {po.status}
            </StatusPill>
          </div>
        )) : (
          <div style={{ padding: 14, color: 'var(--gunmetal-dim)', font: '500 12px var(--font-sans)', textAlign: 'center' }}>
            Sin POs abiertas
          </div>
        )}
      </div>

      {vendor.notes && (
        <React.Fragment>
          <h3 style={cDrawerSection}>Notas</h3>
          <div style={{
            padding: '11px 13px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            font: '400 12.5px/1.5 var(--font-sans)',
            color: 'var(--steel)',
          }}>{vendor.notes}</div>
        </React.Fragment>
      )}
    </DetailDrawer>
  );
}

function DrawerStat({ label, value, icon }) {
  const Icon = window[icon];
  return (
    <div style={{
      padding: '9px 11px',
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        <Icon size={10} /> {label}
      </div>
      <div className="mono" style={{ font: '500 13px var(--font-mono)', color: 'var(--tech-white)', marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

const cGhost = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 11px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 12px var(--font-sans)',
  cursor: 'default',
};
const cDrawerPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: CACC_HEX, color: '#0E0F2C',
  border: 0, borderRadius: 8,
  font: '600 12.5px var(--font-sans)',
  cursor: 'default',
};
const cDrawerSecondary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  borderRadius: 8,
  font: '500 12.5px var(--font-sans)',
  cursor: 'default',
};
const cDrawerSection = {
  margin: '0 0 7px',
  font: '600 10.5px/1 var(--font-sans)',
  color: 'var(--steel)',
  letterSpacing: 0.14, textTransform: 'uppercase',
};

// ─── root ────────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab] = React.useState('info');
  const [selected, setSelected] = React.useState(null);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="company" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
        minWidth: 1080,
      }}>
        <CompanyHeader />
        <TabBar value={tab} onChange={setTab} />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'info'     && <TabInfo />}
          {tab === 'branding' && <TabBranding />}
          {tab === 'rates'    && <TabRates />}
          {tab === 'clients'  && <TabClients onSelect={setSelected} />}
          {tab === 'vendors'  && <TabVendors onSelect={setSelected} />}
          {tab === 'team'     && <TabTeam />}
        </div>
      </main>
      <CompanyDrawer selection={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
