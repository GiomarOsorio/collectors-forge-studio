// settings.jsx — Configuración (desktop)
// Layout: header + sidebar tabs vertical (UI · Notificaciones · Datos · Cuenta ·
// Integraciones · Cálculo · Plantillas) + content panel.

const SACC_HEX = '#94A0AE'; // settings doesn't have an app accent — neutral
const SACC = 'var(--steel)';
const stCOP = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

// ─── header ───────────────────────────────────────────────────────────────
function SettingsHeader() {
  return (
    <header style={{
      padding: '14px 22px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: 'rgba(148, 160, 174, 0.12)',
        border: '1px solid rgba(148, 160, 174, 0.28)',
        color: 'var(--steel)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconSettings size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--steel)' }} />
          Configuración
        </div>
        <h1 style={{
          margin: 0, font: '600 18px/1.2 var(--font-sans)',
          color: 'var(--tech-white)', letterSpacing: -0.2,
          whiteSpace: 'nowrap',
        }}>
          Preferencias del taller
        </h1>
      </div>
      <button type="button" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 11px', borderRadius: 7,
        background: 'transparent', border: '1px solid var(--border-strong)',
        color: 'var(--steel)', font: '500 12px var(--font-sans)',
        cursor: 'default',
      }}>
        <IconRefresh size={13} /> Restablecer
      </button>
      <button type="button" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 7,
        background: 'var(--forge-teal)', color: '#0A1014',
        border: 0, font: '600 12px var(--font-sans)',
        cursor: 'default',
      }}>
        <IconCheck size={13} /> Guardar cambios
      </button>
    </header>
  );
}

// ─── sidebar tabs ─────────────────────────────────────────────────────────
const ST_TABS = [
  { id: 'ui',           label: 'Apariencia',     icon: 'IconEdit',       hint: 'Tema, densidad, idioma' },
  { id: 'notifs',       label: 'Notificaciones', icon: 'IconBell',       hint: 'Alertas, email, push' },
  { id: 'data',         label: 'Datos',          icon: 'IconBox',        hint: 'Backups · export · import' },
  { id: 'account',      label: 'Cuenta',         icon: 'IconBuilding',   hint: 'Perfil, sesión, seguridad' },
  { id: 'integrations', label: 'Integraciones',  icon: 'IconCpu',        hint: 'Bambu Cloud, Mainsail, Drive' },
  { id: 'calc',         label: 'Cálculo',        icon: 'IconCalculator', hint: 'Defaults de cotización' },
  { id: 'templates',    label: 'Plantillas',     icon: 'IconArchive',    hint: 'PDF, email, copy' },
];

function SettingsSidebar({ value, onChange }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      borderRight: '1px solid var(--border-soft)',
      background: 'var(--surf-sidebar)',
      padding: '14px 12px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div className="mono" style={{
        fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        padding: '6px 10px 8px',
      }}>
        Secciones
      </div>
      {ST_TABS.map((t) => {
        const Icon = window[t.icon];
        const active = value === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px',
            borderRadius: 8,
            background: active ? 'rgba(45, 212, 191, 0.08)' : 'transparent',
            border: `1px solid ${active ? 'rgba(45, 212, 191, 0.22)' : 'transparent'}`,
            color: active ? 'var(--tech-white)' : 'var(--steel)',
            font: '500 13px var(--font-sans)',
            cursor: 'default',
            textAlign: 'left',
            transition: 'background 120ms ease, color 120ms ease',
          }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surf-hover)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: 6,
              background: active ? 'rgba(45, 212, 191, 0.14)' : 'rgba(228, 232, 237, 0.04)',
              color: active ? 'var(--forge-teal)' : 'var(--gunmetal)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={13} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ whiteSpace: 'nowrap' }}>{t.label}</div>
              <div className="mono" style={{
                fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{t.hint}</div>
            </div>
          </button>
        );
      })}
    </aside>
  );
}

// ─── helpers: setting row primitives ─────────────────────────────────────
function SettingsBlock({ title, hint, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{
          margin: 0, font: '600 14px/1.2 var(--font-sans)',
          color: 'var(--tech-white)', letterSpacing: -0.1,
        }}>{title}</h2>
        {hint && (
          <p style={{
            margin: '4px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--gunmetal)',
            maxWidth: 600,
          }}>{hint}</p>
        )}
      </header>
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </section>
  );
}

function SetRow({ label, hint, control, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>
          {label}
        </div>
        {hint && (
          <div className="mono" style={{
            fontSize: 10.5, color: 'var(--gunmetal-dim)', marginTop: 2,
          }}>{hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} aria-pressed={value} style={{
      width: 38, height: 22, borderRadius: 999,
      background: value ? 'var(--forge-teal)' : 'var(--surf-card-2)',
      border: `1px solid ${value ? 'var(--forge-teal)' : 'var(--border-strong)'}`,
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

function SegRadio({ value, onChange, options }) {
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
            padding: '5px 10px', borderRadius: 5,
            background: active ? 'rgba(45, 212, 191, 0.16)' : 'transparent',
            color: active ? 'var(--forge-teal)' : 'var(--steel)',
            border: 0,
            font: '500 11.5px var(--font-sans)',
            cursor: 'default',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({ value, options }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 10px', borderRadius: 7,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
      color: 'var(--tech-white)', font: '500 12px var(--font-sans)',
      cursor: 'default',
      minWidth: 160,
    }}>
      {options.find((o) => o.id === value)?.label || '—'}
      <IconChevronDown size={11} style={{ color: 'var(--gunmetal)', marginLeft: 'auto' }} />
    </div>
  );
}

function TextInput({ value, mono, wide, placeholder }) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      style={{
        padding: '7px 11px', borderRadius: 7,
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border-strong)',
        color: 'var(--tech-white)',
        font: `${mono ? '500 12.5px var(--font-mono)' : '500 12.5px var(--font-sans)'}`,
        outline: 0,
        width: wide ? 300 : 200,
      }}
    />
  );
}

function NumberStepper({ value, suffix, onChange, min = 0, max = 999, step = 1 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 2px 2px 11px', borderRadius: 7,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
    }}>
      <span className="mono" style={{ font: '500 13px var(--font-mono)', color: 'var(--tech-white)' }}>
        {value}{suffix && <span style={{ color: 'var(--gunmetal)', fontSize: 11 }}>{suffix}</span>}
      </span>
      <div style={{ display: 'flex', gap: 1 }}>
        <button type="button" onClick={() => onChange && onChange(Math.max(min, value - step))} style={stStepBtn}>−</button>
        <button type="button" onClick={() => onChange && onChange(Math.min(max, value + step))} style={stStepBtn}>+</button>
      </div>
    </div>
  );
}
const stStepBtn = {
  width: 22, height: 22, borderRadius: 5,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--steel)',
  font: '600 13px var(--font-sans)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', lineHeight: 1,
};

// ─── tab: APPEARANCE ─────────────────────────────────────────────────────
function TabUI({ s, set }) {
  return (
    <React.Fragment>
      <SettingsBlock title="Apariencia" hint="Cómo se ve la app en este dispositivo.">
        <SetRow
          label="Tema"
          hint="Único disponible por ahora (claro vendrá luego)."
          control={
            <SegRadio value={s.theme} onChange={(v) => set('theme', v)} options={[
              { id: 'dark', label: 'Oscuro' },
              { id: 'light', label: 'Claro (próx.)' },
              { id: 'auto', label: 'Auto' },
            ]} />
          }
        />
        <SetRow
          label="Densidad"
          hint="Espaciado y altura de filas en listas."
          control={
            <SegRadio value={s.density} onChange={(v) => set('density', v)} options={[
              { id: 'compact', label: 'Compacto' },
              { id: 'regular', label: 'Regular' },
              { id: 'cozy',    label: 'Cómodo' },
            ]} />
          }
        />
        <SetRow
          label="Acento global"
          hint="Ajusta el color principal de la app (los accents por módulo no cambian)."
          control={
            <SegRadio value={s.accent} onChange={(v) => set('accent', v)} options={[
              { id: 'teal',   label: 'Teal' },
              { id: 'amber',  label: 'Ámbar' },
              { id: 'rose',   label: 'Rose' },
            ]} />
          }
          last
        />
      </SettingsBlock>

      <SettingsBlock title="Idioma y región" hint="Formato de fecha, número y moneda.">
        <SetRow label="Idioma" control={
          <Select value="es-CO" options={[
            { id: 'es-CO', label: 'Español (Colombia)' },
            { id: 'es-MX', label: 'Español (México)' },
            { id: 'en-US', label: 'English (US)' },
          ]} />
        } />
        <SetRow label="Moneda" control={
          <Select value="COP" options={[
            { id: 'COP', label: 'COP · Peso colombiano' },
            { id: 'USD', label: 'USD · US Dollar' },
            { id: 'MXN', label: 'MXN · Peso mexicano' },
          ]} />
        } />
        <SetRow label="Zona horaria" control={
          <Select value="bogota" options={[
            { id: 'bogota', label: 'America/Bogota (UTC-5)' },
          ]} />
        } last />
      </SettingsBlock>

      <SettingsBlock title="Atajos de teclado" hint="Navegación rápida entre apps. Personalizables en versión próxima.">
        <SetRow label="Abrir paleta de comandos" hint="Búsqueda global" control={<KeyCap>⌘ K</KeyCap>} />
        <SetRow label="Ir a Inventario"  control={<KeyCap>G I</KeyCap>} />
        <SetRow label="Ir a Cola"        control={<KeyCap>G C</KeyCap>} />
        <SetRow label="Ir a Slicer"      control={<KeyCap>G S</KeyCap>} />
        <SetRow label="Nueva cotización" control={<KeyCap>N</KeyCap>} last />
      </SettingsBlock>
    </React.Fragment>
  );
}

function KeyCap({ children }) {
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 6,
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border-strong)',
      color: 'var(--tech-white)',
      font: '500 11px var(--font-mono)',
      letterSpacing: 0.08,
    }}>
      {children}
    </span>
  );
}

// ─── tab: NOTIFICATIONS ─────────────────────────────────────────────────
function TabNotifs({ s, set }) {
  return (
    <React.Fragment>
      <SettingsBlock title="Canales" hint="Por dónde recibes alertas.">
        <SetRow label="Notificaciones in-app" hint="Campanita en el header" control={<Toggle value={s.nInApp}  onChange={(v) => set('nInApp', v)} />} />
        <SetRow label="Email"                 hint="hola@collectorsforge.studio" control={<Toggle value={s.nEmail} onChange={(v) => set('nEmail', v)} />} />
        <SetRow label="Push (móvil)"          hint="Requiere instalar PWA"     control={<Toggle value={s.nPush}  onChange={(v) => set('nPush', v)} />} last />
      </SettingsBlock>

      <SettingsBlock title="Eventos" hint="Cuándo te avisamos.">
        <SetRow label="Impresión completada"     control={<Toggle value={s.eDone}      onChange={(v) => set('eDone', v)} />} />
        <SetRow label="Impresión pausada / falla" control={<Toggle value={s.ePause}    onChange={(v) => set('ePause', v)} />} />
        <SetRow label="Stock bajo o crítico"      control={<Toggle value={s.eStock}    onChange={(v) => set('eStock', v)} />} />
        <SetRow label="Mantenimiento vencido"     control={<Toggle value={s.eMaint}    onChange={(v) => set('eMaint', v)} />} />
        <SetRow label="PO recibida"               control={<Toggle value={s.ePO}       onChange={(v) => set('ePO', v)} />} />
        <SetRow label="Nueva cotización aprobada" control={<Toggle value={s.eQuote}    onChange={(v) => set('eQuote', v)} />} last />
      </SettingsBlock>

      <SettingsBlock title="Resúmenes" hint="Reportes recurrentes por email.">
        <SetRow label="Resumen diario"   hint="9:00 AM zona horaria" control={<Toggle value={s.rDaily}  onChange={(v) => set('rDaily', v)} />} />
        <SetRow label="Resumen semanal"  hint="Lunes 8:00 AM" control={<Toggle value={s.rWeekly} onChange={(v) => set('rWeekly', v)} />} last />
      </SettingsBlock>
    </React.Fragment>
  );
}

// ─── tab: DATA ──────────────────────────────────────────────────────────
function TabData() {
  return (
    <React.Fragment>
      <SettingsBlock title="Respaldo automático" hint="Snapshot completo de la base local. Se guarda cifrado.">
        <SetRow
          label="Frecuencia"
          control={
            <Select value="daily" options={[
              { id: 'daily',   label: 'Diario · 03:00' },
              { id: 'weekly',  label: 'Semanal · domingo' },
              { id: 'manual',  label: 'Solo manual' },
            ]} />
          }
        />
        <SetRow
          label="Retención"
          hint="Cuántos snapshots conservar antes de rotar."
          control={<NumberStepper value={30} suffix=" snaps" />}
        />
        <SetRow label="Cifrar con clave" hint="AES-256 sobre el zip resultante" control={<Toggle value={true} />} last />
      </SettingsBlock>

      <SettingsBlock title="Backup manual" hint="Genera o restaura un snapshot ahora.">
        <SetRow
          label="Último backup"
          hint="Hace 6 horas · 142 MB"
          control={
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(52, 211, 153, 0.10)',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              color: '#34D399',
              fontSize: 10.5, fontWeight: 600,
            }}>
              <IconCheck size={11} /> OK
            </span>
          }
        />
        <div style={{
          padding: '14px 16px', display: 'flex', gap: 8,
          borderTop: '1px solid var(--border-soft)',
        }}>
          <button type="button" style={stGhost}>
            <IconDownload size={13} /> Descargar último
          </button>
          <button type="button" style={stPrimary}>
            <IconUpload size={13} /> Crear backup ahora
          </button>
          <button type="button" style={{ ...stGhost, marginLeft: 'auto', color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.32)' }}>
            <IconRefresh size={13} /> Restaurar desde archivo
          </button>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Exportar / Importar datos">
        <SetRow
          label="Exportar inventario · CSV"
          hint="Filamentos + Insumos + Herramientas + Consumibles"
          control={<button type="button" style={stGhost}><IconDownload size={12} /> Exportar</button>}
        />
        <SetRow
          label="Exportar cotizaciones · JSON"
          control={<button type="button" style={stGhost}><IconDownload size={12} /> Exportar</button>}
        />
        <SetRow
          label="Importar modelos al Vault"
          hint=".3mf · .stl · .step en bulk"
          control={<button type="button" style={stGhost}><IconUpload size={12} /> Subir</button>} last
        />
      </SettingsBlock>

      <SettingsBlock title="Zona de peligro" hint="Acciones irreversibles.">
        <SetRow
          label="Resetear datos demo"
          hint="Borra los placeholders de muestra y prepara para datos reales."
          control={<button type="button" style={{ ...stGhost, color: '#FBBF24', borderColor: 'rgba(251, 191, 36, 0.32)' }}>
            <IconRefresh size={12} /> Reset demo
          </button>}
        />
        <SetRow
          label="Eliminar todos los datos"
          hint="Esto no se puede deshacer. Pedirá confirmación por email."
          control={<button type="button" style={{ ...stGhost, color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.32)' }}>
            <IconAlert size={12} /> Eliminar todo
          </button>}
          last
        />
      </SettingsBlock>
    </React.Fragment>
  );
}

// ─── tab: ACCOUNT ───────────────────────────────────────────────────────
function TabAccount() {
  return (
    <React.Fragment>
      <SettingsBlock title="Perfil" hint="Tus datos como usuario admin.">
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 999,
            background: 'rgba(45, 212, 191, 0.18)',
            border: '1px solid rgba(45, 212, 191, 0.32)',
            color: 'var(--forge-teal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '600 22px var(--font-sans)', flexShrink: 0,
          }}>G</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 16px var(--font-sans)', color: 'var(--tech-white)' }}>Giomar A.</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)', marginTop: 1 }}>
              Owner · Operación · giomar@collectorsforge.studio
            </div>
          </div>
          <button type="button" style={stGhost}><IconUpload size={12} /> Cambiar foto</button>
        </div>
        <SetRow label="Nombre"      control={<TextInput value="Giomar A." wide />} />
        <SetRow label="Email"       control={<TextInput value="giomar@collectorsforge.studio" mono wide />} />
        <SetRow label="Teléfono"    control={<TextInput value="+57 304 123 4567" mono />} last />
      </SettingsBlock>

      <SettingsBlock title="Seguridad">
        <SetRow
          label="Contraseña"
          hint="Última actualización hace 32 días"
          control={<button type="button" style={stGhost}><IconEdit size={12} /> Cambiar</button>}
        />
        <SetRow
          label="Autenticación de 2 factores"
          hint="Apps Authenticator (TOTP)"
          control={<Toggle value={true} />}
        />
        <SetRow
          label="Sesiones activas"
          hint="2 dispositivos · MacBook Pro (este), iPhone 14"
          control={<button type="button" style={{ ...stGhost, color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.32)' }}>
            Cerrar todas
          </button>}
          last
        />
      </SettingsBlock>
    </React.Fragment>
  );
}

// ─── tab: INTEGRATIONS ──────────────────────────────────────────────────
function TabIntegrations() {
  const integrations = [
    { id: 'bambu',   name: 'Bambu Cloud',   desc: 'Sincroniza impresoras y G-code en la nube oficial.', status: 'connected', icon: 'IconCpu',    accent: '#2DD4BF', account: 'giomar@cfs' },
    { id: 'mainsail', name: 'Mainsail',     desc: 'Control directo de impresoras Klipper en la red local.', status: 'connected', icon: 'IconWrench', accent: '#3B82F6', account: '192.168.1.42' },
    { id: 'wompi',   name: 'Wompi · Bancolombia', desc: 'Cobros y links de pago para cotizaciones.', status: 'connected', icon: 'IconCart',   accent: '#FBBF24', account: 'Comercio CFS' },
    { id: 'drive',   name: 'Google Drive',  desc: 'Backup automático del Vault y reportes.', status: 'disconnected', icon: 'IconArchive', accent: '#F87171', account: null },
    { id: 'siigo',   name: 'Siigo / Alegra', desc: 'Facturación electrónica DIAN.', status: 'disconnected', icon: 'IconBuilding', accent: '#A78BFA', account: null },
  ];
  return (
    <React.Fragment>
      <SettingsBlock title="Integraciones activas" hint="Servicios externos conectados a tu taller.">
        {integrations.map((i, idx) => (
          <IntegrationRow key={i.id} integration={i} last={idx === integrations.length - 1} />
        ))}
      </SettingsBlock>

      <SettingsBlock title="API y webhooks" hint="Para automatizaciones propias.">
        <SetRow
          label="Token de API"
          hint="cfs_pk_••••••••••••••f8a2"
          control={
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={stGhost}><IconRefresh size={12} /> Rotar</button>
              <button type="button" style={stGhost}><IconDownload size={12} /> Copiar</button>
            </div>
          }
        />
        <SetRow
          label="URL del webhook"
          control={<TextInput placeholder="https://…" wide />}
          last
        />
      </SettingsBlock>
    </React.Fragment>
  );
}

function IntegrationRow({ integration, last }) {
  const i = integration;
  const Icon = window[i.icon];
  const connected = i.status === 'connected';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13,
      padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `color-mix(in oklab, ${i.accent} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${i.accent} 30%, transparent)`,
        color: i.accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>{i.name}</span>
          <StatusPill tone={connected ? 'done' : 'neutral'}>
            {connected ? 'Conectado' : 'Sin conectar'}
          </StatusPill>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2 }}>
          {i.desc}
        </div>
        {i.account && (
          <div className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: i.accent, marginTop: 4,
            padding: '2px 6px', borderRadius: 4,
            background: `color-mix(in oklab, ${i.accent} 8%, transparent)`,
            border: `1px solid color-mix(in oklab, ${i.accent} 20%, transparent)`,
          }}>
            <IconCheck size={9} /> {i.account}
          </div>
        )}
      </div>
      <button type="button" style={{
        ...stGhost,
        ...(connected ? {} : { background: 'var(--forge-teal)', color: '#0A1014', border: 0 }),
      }}>
        {connected ? <React.Fragment><IconSettings size={12} /> Configurar</React.Fragment>
                   : <React.Fragment><IconPlus size={12} /> Conectar</React.Fragment>}
      </button>
    </div>
  );
}

// ─── tab: CALC defaults ──────────────────────────────────────────────────
function TabCalc({ s, set }) {
  return (
    <React.Fragment>
      <SettingsBlock title="Defaults de cotización" hint="Estos valores aparecen como punto de partida al crear una cotización nueva.">
        <SetRow label="Margen default"     control={<NumberStepper value={s.marginDefault} suffix="%" onChange={(v) => set('marginDefault', v)} max={100} />} />
        <SetRow label="Recargo express"    control={<NumberStepper value={s.rushSurcharge} suffix="%" onChange={(v) => set('rushSurcharge', v)} max={100} />} />
        <SetRow label="Fee diseño (flat)"  control={<NumberStepper value={s.designFee} suffix=" COP" step={5000} max={500000} onChange={(v) => set('designFee', v)} />} />
        <SetRow label="Hora máquina"       control={<NumberStepper value={s.hourlyMachine} suffix=" COP" step={500}  max={500000} onChange={(v) => set('hourlyMachine', v)} />} />
        <SetRow label="Hora trabajo"       control={<NumberStepper value={s.hourlyLabor}   suffix=" COP" step={1000} max={500000} onChange={(v) => set('hourlyLabor', v)} />} />
        <SetRow label="Envío local"        control={<NumberStepper value={s.shippingMed}   suffix=" COP" step={500}  max={200000} onChange={(v) => set('shippingMed', v)} />} />
        <SetRow label="IVA"                control={<NumberStepper value={s.ivaPct}        suffix="%" onChange={(v) => set('ivaPct', v)} max={50} />} last />
      </SettingsBlock>

      <SettingsBlock title="Comportamiento" hint="Cómo se aplican los defaults.">
        <SetRow label="Aplicar IVA automáticamente"        hint="Si está apagado, se decide por cotización" control={<Toggle value={s.ivaAuto}    onChange={(v) => set('ivaAuto', v)} />} />
        <SetRow label="Redondear total a múltiplo de 1k"   control={<Toggle value={s.roundTotal} onChange={(v) => set('roundTotal', v)} />} />
        <SetRow label="Mostrar costos internos al cliente" hint="Material, máquina, energía, margen desglosados en el PDF" control={<Toggle value={s.showBreakdown} onChange={(v) => set('showBreakdown', v)} />} last />
      </SettingsBlock>
    </React.Fragment>
  );
}

// ─── tab: TEMPLATES ─────────────────────────────────────────────────────
function TabTemplates() {
  const tpls = [
    { id: 'pdf-quote',    name: 'PDF de cotización',  format: 'Liquid + WeasyPrint', updated: '12 may', active: true },
    { id: 'pdf-invoice',  name: 'PDF de factura',     format: 'Liquid + WeasyPrint', updated: '10 may', active: true },
    { id: 'email-quote',  name: 'Email · cotización envío', format: 'MJML',           updated: '08 may', active: true },
    { id: 'email-done',   name: 'Email · impresión lista', format: 'MJML',            updated: '02 may', active: true },
    { id: 'email-late',   name: 'Email · entrega demorada', format: 'MJML',           updated: '28 abr', active: false },
  ];
  return (
    <SettingsBlock title="Plantillas" hint="Documentos generados por la app. Editables como código (Liquid / MJML).">
      {tpls.map((t, i) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px',
          borderBottom: i === tpls.length - 1 ? 'none' : '1px solid var(--border-soft)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: t.format.includes('Liquid') ? 'rgba(167, 139, 250, 0.10)' : 'rgba(45, 212, 191, 0.10)',
            border: `1px solid ${t.format.includes('Liquid') ? 'rgba(167, 139, 250, 0.28)' : 'rgba(45, 212, 191, 0.28)'}`,
            color: t.format.includes('Liquid') ? '#A78BFA' : 'var(--forge-teal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconArchive size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>{t.name}</span>
              <StatusPill tone={t.active ? 'done' : 'neutral'}>{t.active ? 'Activa' : 'Inactiva'}</StatusPill>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2 }}>
              {t.format} · actualizada {t.updated}
            </div>
          </div>
          <button type="button" style={stGhost}><IconEdit size={12} /> Editar</button>
          <button type="button" style={{
            width: 30, height: 30, borderRadius: 6,
            background: 'transparent', border: '1px solid var(--border-strong)',
            color: 'var(--gunmetal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'default',
          }}>
            <IconMore size={13} />
          </button>
        </div>
      ))}
    </SettingsBlock>
  );
}

// ─── shared button styles ────────────────────────────────────────────────
const stGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 11.5px var(--font-sans)',
  cursor: 'default',
  whiteSpace: 'nowrap',
};
const stPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 7,
  background: 'var(--forge-teal)', color: '#0A1014',
  border: 0,
  font: '600 11.5px var(--font-sans)',
  cursor: 'default',
  whiteSpace: 'nowrap',
};

// ─── root ────────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab] = React.useState('ui');
  const [s, setState] = React.useState({
    theme: 'dark', density: 'regular', accent: 'teal',
    nInApp: true, nEmail: true, nPush: false,
    eDone: true, ePause: true, eStock: true, eMaint: true, ePO: true, eQuote: true,
    rDaily: false, rWeekly: true,
    marginDefault: 35, rushSurcharge: 25, designFee: 45000,
    hourlyMachine: 8500, hourlyLabor: 28000, shippingMed: 8500, ivaPct: 19,
    ivaAuto: false, roundTotal: true, showBreakdown: false,
  });
  const set = (k, v) => setState((cur) => ({ ...cur, [k]: v }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
        minWidth: 1080,
      }}>
        <SettingsHeader />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <SettingsSidebar value={tab} onChange={setTab} />
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px 28px' }}>
            {tab === 'ui'           && <TabUI s={s} set={set} />}
            {tab === 'notifs'       && <TabNotifs s={s} set={set} />}
            {tab === 'data'         && <TabData />}
            {tab === 'account'      && <TabAccount />}
            {tab === 'integrations' && <TabIntegrations />}
            {tab === 'calc'         && <TabCalc s={s} set={set} />}
            {tab === 'templates'    && <TabTemplates />}
          </div>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
