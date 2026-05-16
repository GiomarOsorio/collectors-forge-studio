// settings-mobile.jsx — Configuración en iOS frame (402×874)
// Lista de secciones tipo iOS settings. Tap → entra a una vista de sub-section.
// Stack navigation simple en JS (back arrow regresa al index).

const SmTeal = '#2DD4BF';

const ST_SECTIONS = [
  { id: 'ui',           label: 'Apariencia',     icon: 'IconEdit',       hint: 'Tema · densidad · idioma', tone: '#94A0AE' },
  { id: 'notifs',       label: 'Notificaciones', icon: 'IconBell',       hint: 'Alertas, email, push',     tone: '#FBBF24' },
  { id: 'data',         label: 'Datos',          icon: 'IconBox',        hint: 'Backups · export · import',tone: '#34D399' },
  { id: 'account',      label: 'Cuenta',         icon: 'IconBuilding',   hint: 'Perfil · sesión · seguridad', tone: '#2DD4BF' },
  { id: 'integrations', label: 'Integraciones',  icon: 'IconCpu',        hint: 'Bambu Cloud · Mainsail',   tone: '#3B82F6' },
  { id: 'calc',         label: 'Cálculo',        icon: 'IconCalculator', hint: 'Defaults de cotización',   tone: '#A78BFA' },
  { id: 'templates',    label: 'Plantillas',     icon: 'IconArchive',    hint: 'PDF · email · copy',       tone: '#F87171' },
];

// ─── header ───────────────────────────────────────────────────────────────
function StmHeader({ section, onBack }) {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {section ? (
        <button type="button" onClick={onBack} style={stmIconBtn} aria-label="Volver">
          <IconChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
      ) : (
        <button type="button" style={stmIconBtn} aria-label="Menú">
          <IconMenu size={18} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(148, 160, 174, 0.14)',
            color: 'var(--steel)',
          }}>
            <IconSettings size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>
            {section ? 'Configuración · ' + ST_SECTIONS.find((s) => s.id === section).label : 'Configuración'}
          </span>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 600, color: 'var(--tech-white)',
          letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {section ? ST_SECTIONS.find((s) => s.id === section).label : 'Preferencias'}
        </div>
      </div>
      {section && (
        <button type="button" style={{
          padding: '7px 11px', borderRadius: 8,
          background: SmTeal, color: '#0A1014',
          border: 0, font: '600 11.5px var(--font-sans)',
          cursor: 'default', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <IconCheck size={11} /> Guardar
        </button>
      )}
    </div>
  );
}
const stmIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── section index (the root) ─────────────────────────────────────────────
function SectionIndex({ onPick }) {
  return (
    <React.Fragment>
      {/* profile mini card */}
      <div style={{ padding: '0 16px 14px' }}>
        <button type="button" onClick={() => onPick('account')} style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 14px',
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          textAlign: 'left', color: 'inherit', font: 'inherit',
          cursor: 'default',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, flexShrink: 0,
            background: 'rgba(45, 212, 191, 0.18)',
            border: '1px solid rgba(45, 212, 191, 0.32)',
            color: 'var(--forge-teal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '600 17px var(--font-sans)',
          }}>
            G
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 14px var(--font-sans)', color: 'var(--tech-white)' }}>
              Giomar A.
            </div>
            <div className="mono" style={{
              fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              giomar@collectorsforge.studio
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              marginTop: 5,
              padding: '2px 7px', borderRadius: 999,
              background: 'rgba(248, 113, 113, 0.10)',
              border: '1px solid rgba(248, 113, 113, 0.28)',
              color: '#F87171',
              font: '600 9px var(--font-mono)', letterSpacing: 0.08, textTransform: 'uppercase',
            }}>
              admin
            </span>
          </div>
          <IconChevronRight size={14} style={{ color: 'var(--gunmetal-dim)', flexShrink: 0 }} />
        </button>
      </div>

      {/* section list */}
      <SmSection>General</SmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {ST_SECTIONS.filter((s) => s.id !== 'account').map((s, i, arr) => {
            const Icon = window[s.icon];
            return (
              <button key={s.id} type="button" onClick={() => onPick(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%',
                padding: '13px 14px',
                background: 'transparent',
                border: 0,
                borderBottom: i === arr.length - 1 ? 0 : '1px solid var(--border-soft)',
                color: 'inherit', font: 'inherit',
                textAlign: 'left',
                cursor: 'default',
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `color-mix(in oklab, ${s.tone} 14%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${s.tone} 28%, transparent)`,
                  color: s.tone,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '500 13.5px var(--font-sans)', color: 'var(--tech-white)' }}>
                    {s.label}
                  </div>
                  <div className="mono" style={{
                    fontSize: 10, color: 'var(--gunmetal)', marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.hint}</div>
                </div>
                <IconChevronRight size={14} style={{ color: 'var(--gunmetal-dim)' }} />
              </button>
            );
          })}
        </div>
      </div>

      <SmSection>Sesión</SmSection>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <SmStaticRow label="Versión" value="v0.4 · Collector's Forge" />
          <SmStaticRow label="Build"   value="2026.05.15-r3" mono />
          <button type="button" style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '13px 14px',
            background: 'transparent', border: 0,
            borderTop: '1px solid var(--border-soft)',
            color: '#F87171', font: '500 13px var(--font-sans)',
            textAlign: 'left', cursor: 'default',
          }}>
            <IconRefresh size={14} /> Cerrar sesión
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

function SmSection({ children, extra }) {
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
      {extra && <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{extra}</span>}
    </div>
  );
}

function SmStaticRow({ label, value, mono, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 0 : '1px solid var(--border-soft)',
    }}>
      <span style={{ flex: 1, font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{
        font: mono ? '500 12px var(--font-mono)' : '500 12px var(--font-sans)',
        color: 'var(--gunmetal)',
      }}>{value}</span>
    </div>
  );
}

// ─── settings row primitives ─────────────────────────────────────────────
function SmRow({ label, hint, control, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 0 : '1px solid var(--border-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>{label}</div>
        {hint && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

function SmToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange && onChange(!value)} aria-pressed={value} style={{
      width: 38, height: 22, borderRadius: 999,
      background: value ? SmTeal : 'var(--surf-card-2)',
      border: `1px solid ${value ? SmTeal : 'var(--border-strong)'}`,
      position: 'relative',
      cursor: 'default',
      transition: 'background 160ms ease, border-color 160ms ease',
    }}>
      <span style={{
        position: 'absolute', top: 1, left: value ? 17 : 1,
        width: 18, height: 18, borderRadius: 999,
        background: value ? '#0A1014' : 'var(--tech-white)',
        transition: 'left 160ms ease',
      }} />
    </button>
  );
}

function SmSeg({ value, onChange, options }) {
  return (
    <div style={{
      display: 'inline-flex', gap: 2, padding: 2,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
      borderRadius: 7,
    }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{
            padding: '5px 9px', borderRadius: 5,
            background: active ? 'rgba(45, 212, 191, 0.16)' : 'transparent',
            color: active ? SmTeal : 'var(--steel)',
            border: 0,
            font: '500 11px var(--font-sans)',
            cursor: 'default',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SmSelect({ value, options }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 7,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
      color: 'var(--tech-white)', font: '500 11.5px var(--font-sans)',
      cursor: 'default',
      maxWidth: 180,
    }}>
      <span style={{
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{options.find((o) => o.id === value)?.label || '—'}</span>
      <IconChevronDown size={10} style={{ color: 'var(--gunmetal)' }} />
    </div>
  );
}

function SmStepper({ value, suffix, onChange, min = 0, max = 999, step = 1 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 2px 2px 9px', borderRadius: 7,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
    }}>
      <span className="mono" style={{ font: '500 12.5px var(--font-mono)', color: 'var(--tech-white)' }}>
        {value}{suffix && <span style={{ color: 'var(--gunmetal)', fontSize: 10 }}>{suffix}</span>}
      </span>
      <button type="button" onClick={() => onChange && onChange(Math.max(min, value - step))} style={smStepBtn}>−</button>
      <button type="button" onClick={() => onChange && onChange(Math.min(max, value + step))} style={smStepBtn}>+</button>
    </div>
  );
}
const smStepBtn = {
  width: 22, height: 22, borderRadius: 5,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--steel)',
  font: '600 12.5px var(--font-sans)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', lineHeight: 1,
};

function SmCard({ children }) {
  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );
}

// ─── per-section content (mobile) ────────────────────────────────────────
function SecUI({ s, set }) {
  return (
    <React.Fragment>
      <SmSection>Apariencia</SmSection>
      <SmCard>
        <SmRow label="Tema" hint="Único disponible por ahora" control={
          <SmSeg value={s.theme} onChange={(v) => set('theme', v)} options={[
            { id: 'dark', label: 'Oscuro' }, { id: 'light', label: 'Claro' },
          ]} />
        } />
        <SmRow label="Densidad" control={
          <SmSeg value={s.density} onChange={(v) => set('density', v)} options={[
            { id: 'compact', label: 'Compacto' }, { id: 'regular', label: 'Regular' }, { id: 'cozy', label: 'Cómodo' },
          ]} />
        } last />
      </SmCard>

      <SmSection>Idioma y región</SmSection>
      <SmCard>
        <SmRow label="Idioma" control={
          <SmSelect value="es-CO" options={[
            { id: 'es-CO', label: 'Español (CO)' },
            { id: 'es-MX', label: 'Español (MX)' },
            { id: 'en-US', label: 'English (US)' },
          ]} />
        } />
        <SmRow label="Moneda" control={
          <SmSelect value="COP" options={[
            { id: 'COP', label: 'COP · Peso' },
            { id: 'USD', label: 'USD · Dollar' },
          ]} />
        } />
        <SmRow label="Zona horaria" control={
          <SmSelect value="bogota" options={[{ id: 'bogota', label: 'Bogota UTC-5' }]} />
        } last />
      </SmCard>
    </React.Fragment>
  );
}

function SecNotifs({ s, set }) {
  return (
    <React.Fragment>
      <SmSection>Canales</SmSection>
      <SmCard>
        <SmRow label="In-app"        hint="Campanita en el header" control={<SmToggle value={s.nInApp}  onChange={(v) => set('nInApp', v)} />} />
        <SmRow label="Email"         hint="giomar@collectorsforge.studio" control={<SmToggle value={s.nEmail}  onChange={(v) => set('nEmail', v)} />} />
        <SmRow label="Push (móvil)"  hint="Requiere instalar PWA"   control={<SmToggle value={s.nPush}   onChange={(v) => set('nPush', v)} />} last />
      </SmCard>

      <SmSection>Eventos</SmSection>
      <SmCard>
        <SmRow label="Impresión completada"    control={<SmToggle value={s.eDone}  onChange={(v) => set('eDone', v)} />} />
        <SmRow label="Pausada / falla"          control={<SmToggle value={s.ePause} onChange={(v) => set('ePause', v)} />} />
        <SmRow label="Stock bajo / crítico"     control={<SmToggle value={s.eStock} onChange={(v) => set('eStock', v)} />} />
        <SmRow label="Mantenimiento vencido"    control={<SmToggle value={s.eMaint} onChange={(v) => set('eMaint', v)} />} />
        <SmRow label="PO recibida"              control={<SmToggle value={s.ePO}    onChange={(v) => set('ePO', v)} />} />
        <SmRow label="Cotización aprobada"      control={<SmToggle value={s.eQuote} onChange={(v) => set('eQuote', v)} />} last />
      </SmCard>

      <SmSection>Resúmenes</SmSection>
      <SmCard>
        <SmRow label="Diario"   hint="9:00 AM"            control={<SmToggle value={s.rDaily}  onChange={(v) => set('rDaily', v)} />} />
        <SmRow label="Semanal"  hint="Lunes 8:00 AM"      control={<SmToggle value={s.rWeekly} onChange={(v) => set('rWeekly', v)} />} last />
      </SmCard>
    </React.Fragment>
  );
}

function SecData() {
  return (
    <React.Fragment>
      <SmSection>Respaldo automático</SmSection>
      <SmCard>
        <SmRow label="Frecuencia" control={
          <SmSelect value="daily" options={[
            { id: 'daily', label: 'Diario 03:00' },
            { id: 'weekly', label: 'Semanal' },
            { id: 'manual', label: 'Solo manual' },
          ]} />
        } />
        <SmRow label="Retención" control={<SmStepper value={30} suffix="" />} />
        <SmRow label="Cifrar con AES-256" control={<SmToggle value={true} />} last />
      </SmCard>

      <SmSection>Último backup</SmSection>
      <SmCard>
        <div style={{
          padding: '14px',
          display: 'flex', alignItems: 'center', gap: 11,
          borderBottom: '1px solid var(--border-soft)',
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'rgba(52, 211, 153, 0.10)',
            border: '1px solid rgba(52, 211, 153, 0.28)',
            color: '#34D399',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconCheck size={16} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>Hace 6 horas</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
              142 MB · cfs-backup-2026-05-15.zip
            </div>
          </div>
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <button type="button" style={smGhostBtn}><IconDownload size={12} /> Descargar</button>
          <button type="button" style={smPrimaryBtn}><IconUpload size={12} /> Crear ahora</button>
        </div>
      </SmCard>

      <SmSection>Exportar</SmSection>
      <SmCard>
        <SmRow label="Inventario · CSV"   control={<button type="button" style={smGhostBtn}><IconDownload size={11} /></button>} />
        <SmRow label="Cotizaciones · JSON" control={<button type="button" style={smGhostBtn}><IconDownload size={11} /></button>} last />
      </SmCard>
    </React.Fragment>
  );
}

function SecAccount() {
  return (
    <React.Fragment>
      <SmSection>Perfil</SmSection>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 999, flexShrink: 0,
            background: 'rgba(45, 212, 191, 0.18)',
            border: '1px solid rgba(45, 212, 191, 0.32)',
            color: SmTeal,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '600 22px var(--font-sans)',
          }}>G</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 16px var(--font-sans)', color: 'var(--tech-white)' }}>Giomar A.</div>
            <div className="mono" style={{
              fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>Owner · Operación</div>
            <button type="button" style={{
              ...smGhostBtn, marginTop: 8, padding: '4px 9px',
            }}><IconUpload size={11} /> Cambiar foto</button>
          </div>
        </div>
      </div>

      <SmSection>Información</SmSection>
      <SmCard>
        <SmStaticRow label="Nombre"    value="Giomar A." />
        <SmStaticRow label="Email"     value="giomar@cfs" mono />
        <SmStaticRow label="Teléfono"  value="+57 304 123 4567" mono last />
      </SmCard>

      <SmSection>Seguridad</SmSection>
      <SmCard>
        <SmRow label="Contraseña"  hint="Hace 32 días" control={<button type="button" style={smGhostBtn}><IconEdit size={11} /></button>} />
        <SmRow label="2FA · TOTP"  control={<SmToggle value={true} />} />
        <SmRow label="Sesiones activas" hint="2 dispositivos"
          control={<button type="button" style={{ ...smGhostBtn, color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.32)' }}>Cerrar</button>} last />
      </SmCard>
    </React.Fragment>
  );
}

function SecIntegrations() {
  const integrations = [
    { id: 'bambu',    name: 'Bambu Cloud',     desc: 'Sincroniza nube oficial', status: 'connected',    icon: 'IconCpu',    tone: '#2DD4BF', account: 'giomar@cfs' },
    { id: 'mainsail', name: 'Mainsail',        desc: 'Klipper local 192.168.1.42', status: 'connected', icon: 'IconWrench', tone: '#3B82F6', account: null },
    { id: 'wompi',    name: 'Wompi · Banco',   desc: 'Cobros y pagos',         status: 'connected',    icon: 'IconCart',   tone: '#FBBF24', account: 'Comercio CFS' },
    { id: 'drive',    name: 'Google Drive',    desc: 'Backup del Vault',        status: 'disconnected', icon: 'IconArchive', tone: '#F87171', account: null },
    { id: 'siigo',    name: 'Siigo / Alegra',  desc: 'Facturación DIAN',        status: 'disconnected', icon: 'IconBuilding', tone: '#A78BFA', account: null },
  ];
  return (
    <React.Fragment>
      <SmSection extra={`${integrations.filter((i) => i.status === 'connected').length}/${integrations.length} activas`}>Servicios</SmSection>
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {integrations.map((i) => {
          const Icon = window[i.icon];
          const connected = i.status === 'connected';
          return (
            <div key={i.id} style={{
              padding: '11px 13px',
              background: 'var(--surf-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `color-mix(in oklab, ${i.tone} 14%, transparent)`,
                border: `1px solid color-mix(in oklab, ${i.tone} 28%, transparent)`,
                color: i.tone,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>{i.name}</span>
                  <span className="pulse-soft" style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: connected ? '#34D399' : 'var(--gunmetal-dim)',
                  }} />
                </div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--gunmetal)', marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{i.desc}</div>
              </div>
              <button type="button" style={connected ? smGhostBtn : {
                ...smPrimaryBtn, padding: '6px 10px',
              }}>
                {connected ? <IconSettings size={11} /> : <IconPlus size={11} />}
                {connected ? '' : 'Conectar'}
              </button>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

function SecCalc({ s, set }) {
  return (
    <React.Fragment>
      <SmSection>Defaults de cotización</SmSection>
      <SmCard>
        <SmRow label="Margen"     control={<SmStepper value={s.marginDefault} suffix="%" onChange={(v) => set('marginDefault', v)} />} />
        <SmRow label="Express"    control={<SmStepper value={s.rushSurcharge} suffix="%" onChange={(v) => set('rushSurcharge', v)} />} />
        <SmRow label="IVA"        control={<SmStepper value={s.ivaPct}        suffix="%" onChange={(v) => set('ivaPct', v)} max={50} />} />
        <SmRow label="Fee diseño" control={<SmStepper value={s.designFee}     suffix=" COP" step={5000}  max={500000} onChange={(v) => set('designFee', v)} />} />
        <SmRow label="Hora máq."  control={<SmStepper value={s.hourlyMachine} suffix=" COP" step={500}   max={500000} onChange={(v) => set('hourlyMachine', v)} />} />
        <SmRow label="Hora lab."  control={<SmStepper value={s.hourlyLabor}   suffix=" COP" step={1000}  max={500000} onChange={(v) => set('hourlyLabor', v)} />} />
        <SmRow label="Envío"      control={<SmStepper value={s.shippingMed}   suffix=" COP" step={500}   max={200000} onChange={(v) => set('shippingMed', v)} />} last />
      </SmCard>

      <SmSection>Comportamiento</SmSection>
      <SmCard>
        <SmRow label="IVA automático"          control={<SmToggle value={s.ivaAuto}       onChange={(v) => set('ivaAuto', v)} />} />
        <SmRow label="Redondear a 1k"          control={<SmToggle value={s.roundTotal}    onChange={(v) => set('roundTotal', v)} />} />
        <SmRow label="Mostrar desglose en PDF" control={<SmToggle value={s.showBreakdown} onChange={(v) => set('showBreakdown', v)} />} last />
      </SmCard>
    </React.Fragment>
  );
}

function SecTemplates() {
  const tpls = [
    { id: 'pdf-quote',    name: 'PDF cotización',  fmt: 'Liquid + WeasyPrint', updated: '12 may', active: true },
    { id: 'pdf-invoice',  name: 'PDF factura',     fmt: 'Liquid + WeasyPrint', updated: '10 may', active: true },
    { id: 'email-quote',  name: 'Email cotización', fmt: 'MJML',               updated: '08 may', active: true },
    { id: 'email-done',   name: 'Email impresión lista', fmt: 'MJML',          updated: '02 may', active: true },
    { id: 'email-late',   name: 'Email demora',    fmt: 'MJML',                updated: '28 abr', active: false },
  ];
  return (
    <React.Fragment>
      <SmSection extra={`${tpls.length} plantillas`}>Plantillas</SmSection>
      <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tpls.map((t) => {
          const isLiquid = t.fmt.includes('Liquid');
          return (
            <div key={t.id} style={{
              padding: '11px 13px',
              background: 'var(--surf-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: isLiquid ? 'rgba(167, 139, 250, 0.12)' : 'rgba(45, 212, 191, 0.12)',
                border: `1px solid ${isLiquid ? 'rgba(167, 139, 250, 0.28)' : 'rgba(45, 212, 191, 0.28)'}`,
                color: isLiquid ? '#A78BFA' : SmTeal,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconArchive size={13} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  font: '600 13px var(--font-sans)', color: 'var(--tech-white)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{t.name}</div>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--gunmetal)', marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{t.fmt} · {t.updated}</div>
              </div>
              <span className="mono" style={{
                padding: '2px 7px', borderRadius: 999,
                background: t.active ? 'rgba(52, 211, 153, 0.10)' : 'rgba(228, 232, 237, 0.04)',
                border: `1px solid ${t.active ? 'rgba(52, 211, 153, 0.25)' : 'var(--border)'}`,
                color: t.active ? '#34D399' : 'var(--gunmetal)',
                fontSize: 9, fontWeight: 600, letterSpacing: 0.06,
                whiteSpace: 'nowrap',
              }}>{t.active ? 'ACTIVA' : 'OFF'}</span>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// ─── buttons ─────────────────────────────────────────────────────────────
const smGhostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 11.5px var(--font-sans)',
  cursor: 'default',
  whiteSpace: 'nowrap',
};
const smPrimaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 7,
  background: SmTeal, color: '#0A1014',
  border: 0,
  font: '600 11.5px var(--font-sans)',
  cursor: 'default',
  whiteSpace: 'nowrap',
};

// ─── bottom nav ───────────────────────────────────────────────────────────
function StmBottomNav() {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', badge: 4 },
    { id: 'vault',       label: 'Vault',      icon: 'IconArchive' },
    { id: 'settings',    label: 'Ajustes',    icon: 'IconSettings', active: true },
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
            color: it.active ? SmTeal : 'var(--gunmetal)',
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
                  background: 'var(--app-inventory)', color: '#0A1014',
                  border: '1.5px solid var(--surf-sidebar)',
                  minWidth: 14, textAlign: 'center', lineHeight: 1,
                }}>{it.badge}</span>
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
function MobileSettingsApp() {
  const [section, setSection] = React.useState(null);
  const [s, setState] = React.useState({
    theme: 'dark', density: 'regular',
    nInApp: true, nEmail: true, nPush: false,
    eDone: true, ePause: true, eStock: true, eMaint: true, ePO: true, eQuote: true,
    rDaily: false, rWeekly: true,
    marginDefault: 35, rushSurcharge: 25, designFee: 45000,
    hourlyMachine: 8500, hourlyLabor: 28000, shippingMed: 8500, ivaPct: 19,
    ivaAuto: false, roundTotal: true, showBreakdown: false,
  });
  const set = (k, v) => setState((cur) => ({ ...cur, [k]: v }));

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
        <StmHeader section={section} onBack={() => setSection(null)} />

        {section === null         && <SectionIndex onPick={setSection} />}
        {section === 'ui'           && <SecUI s={s} set={set} />}
        {section === 'notifs'       && <SecNotifs s={s} set={set} />}
        {section === 'data'         && <SecData />}
        {section === 'account'      && <SecAccount />}
        {section === 'integrations' && <SecIntegrations />}
        {section === 'calc'         && <SecCalc s={s} set={set} />}
        {section === 'templates'    && <SecTemplates />}
      </div>
      <StmBottomNav />
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Configuración móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileSettingsApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
