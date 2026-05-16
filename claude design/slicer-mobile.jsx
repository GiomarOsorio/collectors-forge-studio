// slicer-mobile.jsx — Slicer in an iOS frame (402×874)
// Vertical stack:
//   header → preview hero → file & profile → settings sections →
//   estimate card → sticky bottom CTA + bottom nav.
// "Recientes" lives in a bottom sheet triggered from the hero card.

const SACC = 'var(--app-slicer)'; // #F59E0B
const SACC_HEX = '#F59E0B';

const cop = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const copShort = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

// ─── header ───────────────────────────────────────────────────────────────
function SMHeader({ onRecientes }) {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={smIconBtn} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(245, 158, 11, 0.14)',
            color: SACC,
          }}>
            <IconCpu size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Slicer</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1 }}>
          Preparar trabajo
        </div>
      </div>
      <button type="button" onClick={onRecientes} style={smIconBtn} aria-label="Recientes">
        <IconHistory size={17} />
      </button>
      <button type="button" style={smIconBtn} aria-label="Más">
        <IconMore size={17} />
      </button>
    </div>
  );
}
const smIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── hero: preview + file ─────────────────────────────────────────────────
function HeroPreview({ job, onChangeFile }) {
  return (
    <div style={{
      margin: '0 16px 14px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* preview area */}
      <div style={{
        height: 200,
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 60%, rgba(245, 158, 11, 0.08), transparent 60%), var(--forge-black)',
        borderBottom: '1px solid var(--border-soft)',
      }}>
        <MobilePreviewSVG />

        {/* top-left badge: current view mode */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: 999,
          background: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(4px)',
          color: 'var(--steel)',
          font: '500 10.5px var(--font-sans)',
        }}>
          <IconBox size={10} style={{ color: SACC }} /> Modelo
        </div>

        {/* bottom-right bbox chip */}
        <div className="mono" style={{
          position: 'absolute', bottom: 10, right: 10,
          padding: '4px 8px', borderRadius: 6,
          background: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(4px)',
          color: 'var(--steel)',
          fontSize: 9.5, letterSpacing: 0.06,
        }}>
          {job.bbox.x}×{job.bbox.y}×{job.bbox.z} mm
        </div>

        {/* bottom-left view switcher */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          display: 'flex', gap: 3,
          padding: 3, borderRadius: 8,
          background: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(4px)',
        }}>
          {['IconBox', 'IconLayers', 'IconCpu'].map((i, idx) => (
            <button key={idx} type="button" style={{
              width: 26, height: 22, borderRadius: 5,
              background: idx === 0 ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
              color: idx === 0 ? SACC : 'var(--gunmetal)',
              border: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
            }}>
              {React.createElement(window[i], { size: 11 })}
            </button>
          ))}
        </div>
      </div>

      {/* file row */}
      <button
        type="button"
        onClick={onChangeFile}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 0,
          color: 'inherit', font: 'inherit',
          cursor: 'default',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #A78BFA33, #A78BFA11)',
          border: '1px solid #A78BFA44',
          color: '#A78BFA',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBox size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: '600 13.5px/1.2 var(--font-sans)',
            color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {job.name}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 2 }}>
            {job.plates} plate · {job.parts} piezas · {job.layerCount} capas
          </div>
        </div>
        <span className="mono" style={{
          padding: '4px 7px', borderRadius: 5,
          background: 'rgba(228, 232, 237, 0.05)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9.5, letterSpacing: 0.08,
          flexShrink: 0,
        }}>
          CAMBIAR
        </span>
      </button>
    </div>
  );
}

// abstracted iso-ish model for the hero
function MobilePreviewSVG() {
  const W = 360, H = 200;
  const cx = W / 2, cy = H / 2 + 30;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="mp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2030" />
          <stop offset="100%" stopColor="#0F1219" />
        </linearGradient>
        <linearGradient id="mp-model" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.55" />
        </linearGradient>
        <pattern id="mp-grid" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="matrix(1.2, 0.55, -1.2, 0.55, 0, 0)">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#2a3142" strokeWidth="0.4" />
        </pattern>
      </defs>
      <path
        d={`M ${cx - 130} ${cy + 50} L ${cx} ${cy + 86} L ${cx + 130} ${cy + 50} L ${cx} ${cy + 14} Z`}
        fill="url(#mp-plate)" stroke="#2a3142" strokeWidth="0.8"
      />
      <path
        d={`M ${cx - 130} ${cy + 50} L ${cx} ${cy + 86} L ${cx + 130} ${cy + 50} L ${cx} ${cy + 14} Z`}
        fill="url(#mp-grid)" opacity="0.6"
      />
      <polygon
        points={[
          [cx - 80, cy + 14],
          [cx, cy - 10],
          [cx + 80, cy + 14],
          [cx + 36, cy - 130],
          [cx, cy - 148],
          [cx - 36, cy - 130],
        ].map(p => p.join(',')).join(' ')}
        fill="url(#mp-model)"
        stroke="#A78BFA"
        strokeWidth="1"
      />
      {/* subtle layer lines */}
      {[...Array(7)].map((_, i) => {
        const y = cy - 10 - (i + 1) * 18;
        const taper = (i + 1) / 8;
        const w = 75 - taper * 36;
        return <line key={i} x1={cx - w} y1={y} x2={cx + w} y2={y} stroke="#0F1219" strokeOpacity="0.45" strokeWidth="0.6" />;
      })}
    </svg>
  );
}

// ─── perfil row ───────────────────────────────────────────────────────────
function ProfileCard({ settings }) {
  const printer = PRINTERS.find((p) => p.id === settings.printer);
  return (
    <div style={{
      margin: '0 16px 14px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <SMRow
        icon="IconCpu" iconTone={SACC}
        label="Impresora"
        value={printer ? `${printer.name} · ${printer.model}` : '—'}
        sub={`Boquilla ${settings.nozzle}mm · ${printer?.bed || ''}`}
        chevron
      />
      <SMRow
        icon="IconBox" iconTone="#A78BFA"
        label="Spool"
        value="SP-0008 · Violet Pearl"
        sub={`${settings.material} · 660g restantes`}
        chevron
        last
      />
    </div>
  );
}

function SMRow({ icon, iconTone = 'var(--steel)', label, value, sub, chevron, last }) {
  const Icon = window[icon];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `color-mix(in oklab, ${iconTone} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${iconTone} 32%, transparent)`,
        color: iconTone,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
        }}>{label}</div>
        <div style={{
          font: '500 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
        {sub && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
      {chevron && (
        <IconChevronRight size={14} style={{ color: 'var(--gunmetal-dim)', flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── settings (compact) ───────────────────────────────────────────────────
function SettingsCard({ settings, setSettings }) {
  const onSet = (k, v) => setSettings((cur) => ({ ...cur, [k]: v }));
  return (
    <div style={{ margin: '0 16px 14px' }}>
      <SectionLabel>Settings</SectionLabel>
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <MStepperRow
          label="Altura de capa" unit="mm"
          value={settings.layerHeight.toFixed(2)}
          onMinus={() => onSet('layerHeight', Math.max(0.08, settings.layerHeight - 0.04))}
          onPlus={() => onSet('layerHeight', Math.min(0.32, settings.layerHeight + 0.04))}
        />
        <MSliderRow
          label="Infill" unit="%"
          value={settings.infill} min={0} max={100}
          onChange={(v) => onSet('infill', v)}
        />
        <MStepperRow
          label="Walls"
          value={settings.walls}
          onMinus={() => onSet('walls', Math.max(1, settings.walls - 1))}
          onPlus={() => onSet('walls', Math.min(8, settings.walls + 1))}
        />
        <MToggleRow
          label="Supports"
          sub="Estructuras automáticas"
          value={settings.supports}
          onChange={(v) => onSet('supports', v)}
        />
        <MToggleRow
          label="Adaptive layers"
          sub="Capas variables según geometría"
          value={settings.adaptive}
          onChange={(v) => onSet('adaptive', v)}
          last
        />
      </div>
    </div>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '0 2px',
      marginBottom: 8, marginTop: 4,
    }}>
      <h3 style={{
        margin: 0,
        font: '600 10px/1 var(--font-sans)',
        color: 'var(--steel)', letterSpacing: 0.16, textTransform: 'uppercase',
      }}>
        {children}
      </h3>
      {action}
    </div>
  );
}

function MStepperRow({ label, value, unit, onMinus, onPlus, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 1 }}>
          <span className="mono" style={{ font: '600 15px var(--font-sans)', color: 'var(--tech-white)' }}>{value}</span>
          {unit && <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>{unit}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button type="button" onClick={onMinus} style={mStepBtn} aria-label="Reducir">−</button>
        <button type="button" onClick={onPlus} style={mStepBtn} aria-label="Aumentar">+</button>
      </div>
    </div>
  );
}
const mStepBtn = {
  width: 30, height: 30, borderRadius: 8,
  background: 'var(--surf-card-2)',
  border: '1px solid var(--border-strong)',
  color: 'var(--tech-white)',
  font: '600 16px var(--font-sans)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', lineHeight: 1,
};

function MSliderRow({ label, value, min = 0, max = 100, unit, onChange, last }) {
  const pctVal = ((value - min) / (max - min)) * 100;
  return (
    <div style={{
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 7 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span className="mono" style={{ marginLeft: 'auto', font: '600 14px var(--font-sans)', color: 'var(--tech-white)' }}>
          {value}{unit && <span style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>{unit}</span>}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(228, 232, 237, 0.08)', borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pctVal}%`,
          background: `linear-gradient(90deg, ${SACC_HEX}, #FCD34D)`,
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', left: `${pctVal}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 14, height: 14, borderRadius: 999,
          background: '#FCD34D',
          border: '2px solid var(--forge-black)',
          boxShadow: `0 0 8px ${SACC_HEX}88`,
        }} />
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: -8, width: '100%', opacity: 0, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

function MToggleRow({ label, sub, value, onChange, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>{label}</div>
        {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 38, height: 22, borderRadius: 999,
          background: value ? SACC_HEX : 'var(--surf-card-2)',
          border: `1px solid ${value ? SACC_HEX : 'var(--border-strong)'}`,
          position: 'relative',
          cursor: 'default', flexShrink: 0,
          transition: 'background 160ms ease, border-color 160ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 1, left: value ? 17 : 1,
          width: 18, height: 18, borderRadius: 999,
          background: value ? '#1A1004' : 'var(--tech-white)',
          transition: 'left 160ms ease',
        }} />
      </button>
    </div>
  );
}

// ─── estimate card ────────────────────────────────────────────────────────
function EstimateCard({ job }) {
  return (
    <div style={{ margin: '0 16px 14px' }}>
      <SectionLabel>Estimación</SectionLabel>
      <div style={{
        background: `linear-gradient(135deg, rgba(245, 158, 11, 0.10), transparent), var(--surf-card)`,
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MStat label="Tiempo" icon="IconClock" value={job.estimate.time} />
          <MStat label="Filamento" icon="IconDroplet" value={`${job.estimate.gramsPLA + job.estimate.gramsSupport} g`} />
        </div>
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-soft)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        }}>
          <MCostLine label="Material" value={job.estimate.cost.material} />
          <MCostLine label="Máquina" value={job.estimate.cost.machine} />
          <MCostLine label="Energía" value={job.estimate.cost.energy} />
          <MCostLine label="Margen"  value={job.estimate.cost.margin} />
        </div>
      </div>

      {/* stock-ok line */}
      <div className="mono" style={{
        marginTop: 8,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10.5, color: 'var(--steel)',
        padding: '7px 11px', borderRadius: 8,
        background: 'rgba(52, 211, 153, 0.06)',
        border: '1px solid rgba(52, 211, 153, 0.18)',
      }}>
        <IconCheck size={11} style={{ color: '#34D399' }} />
        Stock suficiente · SP-0008 cubre 4.5×
      </div>
    </div>
  );
}

function MStat({ label, value, icon }) {
  const Icon = window[icon];
  return (
    <div>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        <Icon size={10} /> {label}
      </div>
      <div className="mono" style={{
        font: '600 17px var(--font-mono)', color: 'var(--tech-white)',
        marginTop: 3, letterSpacing: -0.2,
      }}>
        {value}
      </div>
    </div>
  );
}

function MCostLine({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{copShort(value)}</span>
    </div>
  );
}

// ─── action bar (sticky bottom above nav) ────────────────────────────────
function ActionBar({ total, onSend }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 70,
      padding: '10px 16px 12px',
      background: 'rgba(10, 14, 22, 0.95)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      display: 'flex', alignItems: 'center', gap: 10,
      zIndex: 15,
    }}>
      <div style={{ flex: '0 0 auto' }}>
        <div className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        }}>Total</div>
        <div className="mono" style={{ font: '600 16px var(--font-mono)', color: 'var(--tech-white)', letterSpacing: -0.3 }}>
          {cop(total)}
        </div>
      </div>
      <button
        type="button"
        onClick={onSend}
        style={{
          flex: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '13px 14px',
          background: SACC_HEX,
          color: '#1A1004',
          border: 0, borderRadius: 12,
          font: '600 14px var(--font-sans)',
          cursor: 'default',
        }}
      >
        <IconListOrdered size={14} /> Enviar a cola
      </button>
    </div>
  );
}

// ─── recientes bottom sheet ───────────────────────────────────────────────
function RecientesSheet({ open, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (open) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [open]);
  if (!open) return null;

  return (
    <React.Fragment>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(6, 9, 18, 0.55)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 220ms ease',
          zIndex: 40,
        }}
      />
      <div className="phone-scroll" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--surf-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        padding: '8px 0 30px',
        zIndex: 41,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)',
        maxHeight: '78%',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        <div style={{ padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.32)',
            color: SACC,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconHistory size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 14px var(--font-sans)', color: 'var(--tech-white)' }}>Archivos recientes</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
              {SLICER_RECENT.length} en los últimos 7 días
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            ...smIconBtn, width: 30, height: 30, borderRadius: 8,
          }}>
            <IconX size={13} />
          </button>
        </div>

        <div style={{ padding: '0 14px' }}>
          {/* compact dropzone at top */}
          <div style={{
            padding: '14px 12px',
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 12,
            background: 'var(--surf-card-2)',
            textAlign: 'center',
            marginBottom: 14,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, margin: '0 auto 6px',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.32)',
              color: SACC,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconUpload size={15} />
            </div>
            <div style={{ font: '600 12.5px var(--font-sans)', color: 'var(--tech-white)' }}>
              Importar nuevo
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 2 }}>
              .3mf · .gcode · .stl
            </div>
          </div>

          {SLICER_RECENT.map((f) => (
            <button key={f.id} type="button" style={{
              display: 'flex', alignItems: 'center', gap: 11,
              width: '100%',
              padding: '10px 11px',
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              borderRadius: 10,
              marginBottom: 5,
              color: 'inherit', font: 'inherit',
              textAlign: 'left',
              cursor: 'default',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                background: `linear-gradient(135deg, ${f.thumb}33, ${f.thumb}11)`,
                border: `1px solid ${f.thumb}44`,
                color: f.thumb,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconBox size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  font: '500 12.5px/1.2 var(--font-sans)',
                  color: 'var(--tech-white)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
                  {f.size} · {f.when}
                </div>
              </div>
              <IconChevronRight size={13} style={{ color: 'var(--gunmetal-dim)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── bottom nav (shared shape with inventory mobile) ─────────────────────
function SlicerBottomNav({ active = 'slicer' }) {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', badge: 4 },
    { id: 'slicer',      label: 'Slicer',     icon: 'IconCpu' },
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
        const isActive = it.id === active;
        const tone = isActive ? SACC : 'var(--gunmetal)';
        return (
          <button key={it.id} type="button" style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'transparent', border: 0,
            color: tone,
            font: '500 9.5px var(--font-sans)',
            cursor: 'default',
            padding: '4px 0',
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
function MobileSlicerApp() {
  const job = SLICER_JOBS.current;
  const [settings, setSettings] = React.useState({
    printer: job.printer,
    material: job.material,
    nozzle: job.nozzle,
    layerHeight: job.layerHeight,
    infill: job.infill,
    walls: job.walls,
    supports: job.supports,
    adaptive: false,
  });
  const [recientesOpen, setRecientesOpen] = React.useState(false);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--forge-black)',
      color: 'var(--tech-white)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* scroll area: under status bar, above action bar + nav */}
      <div className="phone-scroll" style={{
        position: 'absolute',
        top: 56, bottom: 144, /* nav 70 + action bar ~74 */
        left: 0, right: 0,
        overflowY: 'auto',
      }}>
        <SMHeader onRecientes={() => setRecientesOpen(true)} />
        <HeroPreview job={job} onChangeFile={() => setRecientesOpen(true)} />
        <ProfileCard settings={settings} />
        <SettingsCard settings={settings} setSettings={setSettings} />
        <EstimateCard job={job} />
        <div style={{ height: 12 }} />
      </div>

      <ActionBar total={job.estimate.cost.total} onSend={() => {}} />
      <SlicerBottomNav active="slicer" />
      <RecientesSheet open={recientesOpen} onClose={() => setRecientesOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Slicer móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileSlicerApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
