// company-mobile.jsx — Compañía en iOS frame (402×874)
// Tabs horizontales pills: Info · Branding · Tarifas · Clientes · Prov. · Equipo
// Listas compactas en cada tab. Sheet de detalle para cliente/proveedor.

const CMA = '#6366F1';
const cmCOP = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`;
const cmCopK = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

// ─── header ───────────────────────────────────────────────────────────────
function CmHeader() {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={cmIconBtn} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(99, 102, 241, 0.14)',
            color: CMA,
          }}>
            <IconBuilding size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Compañía</span>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 600, color: 'var(--tech-white)',
          letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {COMPANY_PROFILE.name}
        </div>
      </div>
      <button type="button" style={cmIconBtn} aria-label="Buscar">
        <IconSearch size={17} />
      </button>
      <button type="button" style={cmIconBtn} aria-label="Editar">
        <IconEdit size={17} />
      </button>
    </div>
  );
}
const cmIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── tabs (horizontal scroll pills) ──────────────────────────────────────
const CM_TABS = [
  { id: 'info',     label: 'Info' },
  { id: 'branding', label: 'Branding' },
  { id: 'rates',    label: 'Tarifas' },
  { id: 'clients',  label: 'Clientes' },
  { id: 'vendors',  label: 'Prov.' },
  { id: 'team',     label: 'Equipo' },
];
function CmTabs({ value, onChange }) {
  return (
    <div className="phone-scroll" style={{
      display: 'flex', gap: 5, padding: '0 16px 12px',
      overflowX: 'auto',
    }}>
      {CM_TABS.map((t) => {
        const active = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            padding: '7px 12px',
            borderRadius: 999,
            background: active ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
            border: `1px solid ${active ? 'rgba(99, 102, 241, 0.40)' : 'var(--border)'}`,
            color: active ? '#A5B4FC' : 'var(--steel)',
            font: '500 12px/1 var(--font-sans)',
            flexShrink: 0, whiteSpace: 'nowrap',
            cursor: 'default',
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── section label helper ────────────────────────────────────────────────
function CmSection({ children, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '0 16px', marginBottom: 8, marginTop: 4,
    }}>
      <h3 style={{
        margin: 0,
        font: '600 10px/1 var(--font-sans)',
        color: 'var(--steel)', letterSpacing: 0.16, textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>{children}</h3>
      {extra && <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', whiteSpace: 'nowrap' }}>{extra}</span>}
    </div>
  );
}

// ─── INFO tab ─────────────────────────────────────────────────────────────
function CmTabInfo() {
  const p = COMPANY_PROFILE;
  return (
    <React.Fragment>
      <CmSection>Datos fiscales</CmSection>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '4px 14px',
        }}>
          <CmField label="Razón social" value={p.legalName} />
          <CmField label="NIT" value={p.nit} mono />
          <CmField label="Comercial" value={p.name} />
          <CmField label="Fundada" value={p.founded} />
          <CmField label="Ciudad" value={p.city} />
          <CmField label="Dirección" value={p.address} last />
        </div>
      </div>

      <CmSection>Contacto</CmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '4px 14px',
        }}>
          <CmField label="Email"    value={p.email} mono />
          <CmField label="Teléfono" value={p.phone} mono />
          <CmField label="Web"      value={p.web}   mono last />
        </div>
      </div>

      <CmSection>Integraciones</CmSection>
      <div style={{ padding: '0 16px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['Bambu Cloud', 'Mainsail', 'Wompi'].map((c) => (
          <span key={c} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(52, 211, 153, 0.10)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            color: '#34D399',
            font: '500 11.5px var(--font-sans)',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
            {c}
          </span>
        ))}
      </div>
    </React.Fragment>
  );
}

function CmField({ label, value, mono, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '9px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <span className="mono" style={{
        flex: '0 0 88px',
        fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase',
      }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{
        flex: 1,
        font: `${mono ? '500 12.5px var(--font-mono)' : '500 12.5px var(--font-sans)'}`,
        color: 'var(--tech-white)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}</span>
    </div>
  );
}

// ─── BRANDING tab ─────────────────────────────────────────────────────────
function CmTabBranding() {
  const b = COMPANY_BRANDING;
  return (
    <React.Fragment>
      <CmSection>Logo</CmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: b.logoBg,
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14, margin: '0 auto 10px',
            background: `linear-gradient(135deg, ${b.primary}, ${b.accent})`,
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
      </div>

      <CmSection>Colores</CmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '4px 14px',
        }}>
          <CmFieldSwatch label="Primary"   color={b.primary} />
          <CmFieldSwatch label="Accent"    color={b.accent} />
          <CmFieldSwatch label="Fondo"     color={b.logoBg} last />
        </div>
      </div>

      <CmSection>Footer PDF</CmSection>
      <div style={{ padding: '0 16px 18px' }}>
        <div style={{
          padding: '12px 14px',
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          font: '400 12px/1.5 var(--font-sans)',
          color: 'var(--steel)', fontStyle: 'italic',
        }}>
          "{b.pdfFooter}"
        </div>
      </div>
    </React.Fragment>
  );
}

function CmFieldSwatch({ label, color, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <span className="mono" style={{
        flex: '0 0 70px',
        fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        width: 22, height: 22, borderRadius: 5,
        background: color,
        border: '1px solid var(--border-strong)',
        flexShrink: 0,
      }} />
      <span className="mono" style={{
        font: '500 12.5px var(--font-mono)', color: 'var(--tech-white)',
      }}>{color}</span>
    </div>
  );
}

// ─── RATES tab ────────────────────────────────────────────────────────────
function CmTabRates() {
  const r = COMPANY_RATES;
  const tiles = [
    { label: 'Hora máquina',    value: cmCOP(r.hourlyMachine), sub: 'por impresora', icon: 'IconCpu' },
    { label: 'Hora trabajo',    value: cmCOP(r.hourlyLabor),   sub: 'por operario',  icon: 'IconWrench' },
    { label: 'Margen default',  value: `${r.marginDefault}%`,  sub: 'sobre costo',   icon: 'IconTrendUp' },
    { label: 'Express',         value: `+${r.rushSurcharge}%`, sub: 'urgentes',      icon: 'IconAlert', warn: true },
    { label: 'Diseño',          value: cmCOP(r.designFee),     sub: 'flat por cot.', icon: 'IconEdit' },
    { label: 'Envío local',     value: cmCOP(r.shippingMed),   sub: 'Medellín',      icon: 'IconTruck' },
    { label: 'IVA',             value: `${r.ivaPct}%`,         sub: 'opcional',      icon: 'IconCalculator' },
  ];
  return (
    <React.Fragment>
      <CmSection extra={`${tiles.length} parámetros`}>Tarifas default</CmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {tiles.map((t) => {
            const Icon = window[t.icon];
            return (
              <div key={t.label} style={{
                background: 'var(--surf-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: t.warn ? 'rgba(251, 191, 36, 0.14)' : 'rgba(99, 102, 241, 0.14)',
                    color: t.warn ? '#FBBF24' : CMA,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={10} />
                  </span>
                  <span className="mono" style={{
                    fontSize: 8.5, color: t.warn ? '#FBBF24' : 'var(--gunmetal)',
                    letterSpacing: 0.14, textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{t.label}</span>
                </div>
                <div className="mono" style={{
                  font: '600 16px var(--font-mono)', color: 'var(--tech-white)',
                  letterSpacing: -0.2, whiteSpace: 'nowrap',
                }}>{t.value}</div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)' }}>{t.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
      <CmSection>Notas</CmSection>
      <div style={{ padding: '0 16px 18px' }}>
        <div style={{
          padding: '11px 13px',
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          font: '400 12px/1.5 var(--font-sans)',
          color: 'var(--steel)',
        }}>
          Estas tarifas se inyectan como defaults al crear una nueva cotización en Costos. La hora máquina cubre amortización + energía. Editable por proyecto.
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── CLIENTS tab ──────────────────────────────────────────────────────────
function CmTabClients({ onSelect }) {
  return (
    <React.Fragment>
      <CmSection extra={`${CLIENTS.length} activos`}>Clientes</CmSection>
      <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CLIENTS.map((c) => <CmClientRow key={c.id} client={c} onClick={onSelect} />)}
      </div>
    </React.Fragment>
  );
}
function CmClientRow({ client, onClick }) {
  const tier = COMPANY_TIER[client.tier];
  return (
    <button type="button" onClick={() => onClick({ kind: 'client', data: client })} style={{
      display: 'flex', alignItems: 'center', gap: 11,
      width: '100%',
      padding: '11px 13px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      textAlign: 'left', font: 'inherit', color: 'inherit',
      cursor: 'default',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.10)' : 'rgba(167, 139, 250, 0.10)',
        border: `1px solid ${client.kind === 'B2B' ? 'rgba(45, 212, 191, 0.25)' : 'rgba(167, 139, 250, 0.25)'}`,
        color: client.kind === 'B2B' ? 'var(--forge-teal)' : '#A78BFA',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBuilding size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span className="mono" style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(228, 232, 237, 0.05)', border: '1px solid var(--border)',
            color: 'var(--steel)', letterSpacing: 0.06,
            whiteSpace: 'nowrap',
          }}>{client.id}</span>
          <span className="mono" style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: tier.bg, border: `1px solid ${tier.border}`,
            color: tier.color, letterSpacing: 0.08, fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {tier.label}
          </span>
        </div>
        <div style={{
          font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{client.name}</div>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span>{client.city}</span>
          <span>·</span>
          <span>{client.jobs} jobs</span>
          <span>·</span>
          <span>últ. {client.lastOrder}</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div className="mono" style={{ font: '600 13px var(--font-mono)', color: 'var(--tech-white)' }}>
          {cmCopK(client.totalSpent)}
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1 }}>
          {client.quotes} cot.
        </div>
      </div>
    </button>
  );
}

// ─── VENDORS tab ──────────────────────────────────────────────────────────
function CmTabVendors({ onSelect }) {
  return (
    <React.Fragment>
      <CmSection extra={`${VENDORS.length} proveedores`}>Proveedores</CmSection>
      <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VENDORS.map((v) => <CmVendorRow key={v.id} vendor={v} onClick={onSelect} />)}
      </div>
    </React.Fragment>
  );
}
function CmVendorRow({ vendor, onClick }) {
  return (
    <button type="button" onClick={() => onClick({ kind: 'vendor', data: vendor })} style={{
      display: 'flex', alignItems: 'center', gap: 11,
      width: '100%',
      padding: '11px 13px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      textAlign: 'left', font: 'inherit', color: 'inherit',
      cursor: 'default',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.28)',
        color: CMA,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconCart size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span className="mono" style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(228, 232, 237, 0.05)', border: '1px solid var(--border)',
            color: 'var(--steel)', letterSpacing: 0.06,
            whiteSpace: 'nowrap',
          }}>{vendor.id}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: '#FBBF24', fontWeight: 600,
          }}>★ <span className="mono">{vendor.rating.toFixed(1)}</span></span>
        </div>
        <div style={{
          font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{vendor.name}</div>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <span>{vendor.category}</span>
          <span>·</span>
          <span>{vendor.city}</span>
          <span>·</span>
          <span>{vendor.leadDays}d lead</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div className="mono" style={{ font: '600 13px var(--font-mono)', color: 'var(--tech-white)' }}>
          {cmCopK(vendor.totalSpent)}
        </div>
        <div className="mono" style={{
          fontSize: 9.5,
          color: vendor.openPOs > 0 ? 'var(--app-inventory)' : 'var(--gunmetal-dim)',
          marginTop: 1,
        }}>
          {vendor.openPOs} POs
        </div>
      </div>
    </button>
  );
}

// ─── TEAM tab ────────────────────────────────────────────────────────────
function CmTabTeam() {
  return (
    <React.Fragment>
      <CmSection extra={`${EMPLOYEES.filter((e) => e.active).length} activos`}>Equipo</CmSection>
      <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {EMPLOYEES.map((e) => <CmEmpRow key={e.id} emp={e} />)}
      </div>
    </React.Fragment>
  );
}
function CmEmpRow({ emp }) {
  const permTone = emp.permissions === 'admin' ? '#F87171' : emp.permissions === 'edit' ? '#3B82F6' : '#94A0AE';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '11px 13px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 999, flexShrink: 0,
        background: `color-mix(in oklab, ${emp.avatarTone} 18%, transparent)`,
        border: `1px solid color-mix(in oklab, ${emp.avatarTone} 32%, transparent)`,
        color: emp.avatarTone,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '600 15px var(--font-sans)',
      }}>
        {emp.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>
            {emp.name}
          </span>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: emp.active ? '#34D399' : 'var(--gunmetal-dim)' }} />
        </div>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{emp.role}</div>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{emp.email}</div>
      </div>
      <span style={{
        padding: '3px 7px', borderRadius: 999,
        background: `color-mix(in oklab, ${permTone} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${permTone} 28%, transparent)`,
        color: permTone,
        font: '600 9px var(--font-mono)', letterSpacing: 0.08, textTransform: 'uppercase',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {emp.permissions}
      </span>
    </div>
  );
}

// ─── detail bottom sheet ──────────────────────────────────────────────────
function CmSheet({ selection, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (selection) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [selection]);
  if (!selection) return null;
  const { kind, data } = selection;
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(6, 9, 18, 0.6)',
        backdropFilter: 'blur(4px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 220ms ease',
        zIndex: 40,
      }} />
      <div className="phone-scroll" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--surf-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        padding: '8px 0 28px',
        zIndex: 41,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)',
        maxHeight: '90%',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>
        {kind === 'client' && <CmClientSheet client={data} onClose={onClose} />}
        {kind === 'vendor' && <CmVendorSheet vendor={data} onClose={onClose} />}
      </div>
    </React.Fragment>
  );
}

function CmClientSheet({ client, onClose }) {
  const tier = COMPANY_TIER[client.tier];
  const jobs = QUEUE_JOBS.filter((j) => j.client === client.name);
  return (
    <React.Fragment>
      {/* hero */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${tier.color} 10%, transparent), transparent), var(--surf-card-2)`,
          border: '1px solid var(--border)',
          borderRadius: 12, padding: 14,
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
            <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{client.id} · {client.city}</div>
            <div style={{
              font: '600 16px var(--font-sans)', color: 'var(--tech-white)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{client.name}</div>
          </div>
          <span style={{
            padding: '4px 9px', borderRadius: 999,
            background: tier.bg, border: `1px solid ${tier.border}`,
            color: tier.color,
            font: '600 11px var(--font-mono)', letterSpacing: 0.08,
            flexShrink: 0,
          }}>{tier.label}</span>
        </div>
      </div>

      {/* stats */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <CmStat label="Total" value={cmCopK(client.totalSpent)} />
          <CmStat label="Cot." value={client.quotes} />
          <CmStat label="Jobs" value={client.jobs} />
        </div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <CmSheetTitle>Contacto</CmSheetTitle>
        <div style={{
          background: 'var(--surf-card-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '4px 14px',
        }}>
          <CmField label="Persona"   value={client.contact} />
          <CmField label="Email"     value={client.email} mono />
          <CmField label="Teléfono"  value={client.phone} mono last />
        </div>
      </div>

      {jobs.length > 0 && (
        <div style={{ padding: '0 18px 14px' }}>
          <CmSheetTitle>Jobs activos</CmSheetTitle>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {jobs.slice(0, 4).map((j, i) => (
              <div key={j.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                borderBottom: i === Math.min(3, jobs.length - 1) ? 'none' : '1px solid var(--border-soft)',
              }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', flexShrink: 0 }}>{j.id}</span>
                <span style={{
                  flex: 1, font: '500 12px var(--font-sans)', color: 'var(--tech-white)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{j.name}</span>
                <StatusPill tone={j.status === 'printing' ? 'printing' : j.status === 'done' ? 'done' : j.status === 'paused' ? 'paused' : 'pending'}>
                  {QUEUE_STATUSES.find((s) => s.id === j.status).label}
                </StatusPill>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
        <button type="button" style={cmSecondaryBtn}>
          <IconEdit size={13} /> Editar
        </button>
        <button type="button" style={cmPrimaryBtn}>
          <IconArrowUpRight size={13} /> Nueva cot.
        </button>
      </div>
    </React.Fragment>
  );
}

function CmVendorSheet({ vendor, onClose }) {
  const openPOs = COMPRAS.filter((p) => p.vendor === vendor.name && p.status !== 'completado');
  return (
    <React.Fragment>
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: `linear-gradient(135deg, rgba(99, 102, 241, 0.10), transparent), var(--surf-card-2)`,
          border: '1px solid var(--border)',
          borderRadius: 12, padding: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: 'rgba(99, 102, 241, 0.16)',
            border: '1px solid rgba(99, 102, 241, 0.32)',
            color: CMA,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCart size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{vendor.id} · {vendor.category}</div>
            <div style={{
              font: '600 16px var(--font-sans)', color: 'var(--tech-white)', marginTop: 2,
            }}>{vendor.name}</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            font: '600 14px var(--font-sans)', color: '#FBBF24',
            flexShrink: 0,
          }}>★ <span className="mono">{vendor.rating.toFixed(1)}</span></span>
        </div>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <CmStat label="Total" value={cmCopK(vendor.totalSpent)} />
          <CmStat label="POs"   value={vendor.openPOs} />
          <CmStat label="Lead"  value={`${vendor.leadDays}d`} />
        </div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <CmSheetTitle>POs abiertas</CmSheetTitle>
        <div style={{
          background: 'var(--surf-card-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {openPOs.length ? openPOs.map((po, i) => (
            <div key={po.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderBottom: i === openPOs.length - 1 ? 'none' : '1px solid var(--border-soft)',
            }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--tech-white)', fontWeight: 600 }}>{po.id}</span>
              <span style={{ flex: 1, font: '500 12px var(--font-sans)', color: 'var(--steel)' }}>
                {po.items} ítems
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--tech-white)' }}>{cmCopK(po.total)}</span>
            </div>
          )) : (
            <div style={{ padding: 14, color: 'var(--gunmetal-dim)', font: '500 12px var(--font-sans)', textAlign: 'center' }}>
              Sin POs abiertas
            </div>
          )}
        </div>
      </div>

      {vendor.notes && (
        <div style={{ padding: '0 18px 14px' }}>
          <CmSheetTitle>Notas</CmSheetTitle>
          <div style={{
            padding: '11px 13px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            font: '400 12px/1.5 var(--font-sans)', color: 'var(--steel)',
          }}>{vendor.notes}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
        <button type="button" style={cmSecondaryBtn}>
          <IconEdit size={13} /> Editar
        </button>
        <button type="button" style={cmPrimaryBtn}>
          <IconCart size={13} /> Nueva PO
        </button>
      </div>
    </React.Fragment>
  );
}

function CmSheetTitle({ children }) {
  return (
    <h3 style={{
      margin: '0 0 7px',
      font: '600 10px/1 var(--font-sans)',
      color: 'var(--steel)', letterSpacing: 0.14, textTransform: 'uppercase',
    }}>{children}</h3>
  );
}
function CmStat({ label, value }) {
  return (
    <div style={{
      padding: '9px 11px',
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div className="mono" style={{
        fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
        marginBottom: 3,
      }}>{label}</div>
      <div className="mono" style={{ font: '600 13px var(--font-mono)', color: 'var(--tech-white)' }}>
        {value}
      </div>
    </div>
  );
}

const cmPrimaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: CMA, color: '#0E0F2C',
  border: 0, borderRadius: 10,
  font: '600 13px var(--font-sans)', cursor: 'default',
};
const cmSecondaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: 'var(--surf-card-2)',
  border: '1px solid var(--border-strong)',
  color: 'var(--tech-white)',
  borderRadius: 10,
  font: '500 13px var(--font-sans)', cursor: 'default',
};

// ─── bottom nav ───────────────────────────────────────────────────────────
function CmBottomNav() {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', badge: 4 },
    { id: 'company',     label: 'Compañía',   icon: 'IconBuilding', active: true },
    { id: 'maintenance', label: 'Mantto',     icon: 'IconWrench', badge: 2, badgeWarn: true },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 14, 22, 0.92)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--border)',
      padding: '8px 12px 24px',
      display: 'flex', justifyContent: 'space-around',
      zIndex: 20,
    }}>
      {items.map((it) => {
        const Icon = window[it.icon];
        return (
          <button key={it.id} type="button" style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'transparent', border: 0,
            color: it.active ? CMA : 'var(--gunmetal)',
            font: '500 9.5px var(--font-sans)',
            cursor: 'default', padding: '4px 0',
            position: 'relative',
          }}>
            <span style={{ position: 'relative' }}>
              <Icon size={19} />
              {it.badge && (
                <span className="mono" style={{
                  position: 'absolute', top: -5, right: -8,
                  fontSize: 8.5, fontWeight: 600,
                  padding: '1px 4px', borderRadius: 999,
                  background: it.badgeWarn ? 'var(--forge-amber)' : 'var(--app-inventory)',
                  color: '#0A1014',
                  border: '1.5px solid var(--surf-sidebar)',
                  minWidth: 14, textAlign: 'center', lineHeight: 1,
                }}>
                  {it.badge}
                </span>
              )}
            </span>
            <span style={{ letterSpacing: 0.04 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── main app ─────────────────────────────────────────────────────────────
function MobileCompanyApp() {
  const [tab, setTab] = React.useState('info');
  const [selected, setSelected] = React.useState(null);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--forge-black)', color: 'var(--tech-white)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="phone-scroll" style={{
        position: 'absolute', top: 56, bottom: 70,
        left: 0, right: 0, overflowY: 'auto',
      }}>
        <CmHeader />
        <CmTabs value={tab} onChange={setTab} />
        {tab === 'info'     && <CmTabInfo />}
        {tab === 'branding' && <CmTabBranding />}
        {tab === 'rates'    && <CmTabRates />}
        {tab === 'clients'  && <CmTabClients onSelect={setSelected} />}
        {tab === 'vendors'  && <CmTabVendors onSelect={setSelected} />}
        {tab === 'team'     && <CmTabTeam />}
      </div>
      <CmBottomNav />
      <CmSheet selection={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Compañía móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileCompanyApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
