// slicer.jsx — Slicer app
// Three-column desktop layout:
//   ┌─────────┬────────────────────────────┬───────────────┐
//   │ recent  │ preview (model viewer)     │ settings      │
//   │ + drop  │ + status bar               │ + estimate    │
//   └─────────┴────────────────────────────┴───────────────┘

const SLICER_ACCENT = 'var(--app-slicer)'; // #F59E0B

const fmtCOPInline = (n) => `$${Math.round(n / 1000)}k`;
const fmtCOPFull   = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

// ─── left rail: recientes + dropzone ─────────────────────────────────────
function SlicerLeftRail({ selected, onSelect }) {
  return (
    <aside style={{
      width: 268, flexShrink: 0,
      borderRight: '1px solid var(--border-soft)',
      background: 'var(--surf-sidebar)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14,
          textTransform: 'uppercase', marginBottom: 10,
        }}>Importar</div>
        <CompactDropZone />
      </div>

      <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14,
          textTransform: 'uppercase',
        }}>Recientes</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>
          {SLICER_RECENT.length}
        </span>
        <button type="button" style={{
          marginLeft: 'auto',
          background: 'transparent', border: 0, color: 'var(--gunmetal)',
          font: '500 11px var(--font-sans)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          cursor: 'default',
        }}>
          <IconHistory size={11} /> historial
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
        {SLICER_RECENT.map((f) => (
          <RecentFile key={f.id} file={f} active={selected === f.id} onClick={() => onSelect(f.id)} />
        ))}
      </div>
    </aside>
  );
}

function CompactDropZone() {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); }}
      style={{
        padding: '18px 12px 16px',
        border: `1.5px dashed ${hover ? SLICER_ACCENT : 'var(--border-strong)'}`,
        borderRadius: 10,
        background: hover
          ? `color-mix(in oklab, ${SLICER_ACCENT} 6%, var(--surf-card))`
          : 'var(--surf-card)',
        textAlign: 'center',
        transition: 'border-color 160ms ease, background 160ms ease',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, margin: '0 auto 8px',
        background: `color-mix(in oklab, ${SLICER_ACCENT} 16%, transparent)`,
        border: `1px solid color-mix(in oklab, ${SLICER_ACCENT} 32%, transparent)`,
        color: SLICER_ACCENT,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconUpload size={16} />
      </div>
      <div style={{ font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--tech-white)', marginBottom: 3 }}>
        Suelta tu modelo
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>
        .3mf · .gcode · .stl
      </div>
    </div>
  );
}

function RecentFile({ file, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%',
        padding: '7px 8px',
        background: active ? 'rgba(245, 158, 11, 0.10)' : 'transparent',
        border: `1px solid ${active ? 'rgba(245, 158, 11, 0.32)' : 'transparent'}`,
        borderRadius: 8,
        textAlign: 'left',
        color: 'inherit', font: 'inherit',
        cursor: 'default',
        marginBottom: 2,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
        background: `linear-gradient(135deg, ${file.thumb}33, ${file.thumb}11)`,
        border: `1px solid ${file.thumb}44`,
        color: file.thumb,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBox size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: '500 12px/1.2 var(--font-sans)',
          color: active ? 'var(--tech-white)' : 'var(--steel)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {file.name}
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
          {file.size} · {file.when}
        </div>
      </div>
    </button>
  );
}

// ─── center: preview canvas ──────────────────────────────────────────────
function SlicerCenter({ job, viewMode, onViewMode }) {
  const tabs = [
    { id: 'model',  label: 'Modelo',  icon: 'IconBox' },
    { id: 'layers', label: 'Capas',   icon: 'IconLayers' },
    { id: 'gcode',  label: 'G-code',  icon: 'IconCpu' },
  ];

  return (
    <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* tabs above the preview */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '10px 18px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onViewMode(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px',
              borderRadius: 7,
              background: viewMode === t.id ? 'rgba(245, 158, 11, 0.10)' : 'transparent',
              border: `1px solid ${viewMode === t.id ? 'rgba(245, 158, 11, 0.32)' : 'transparent'}`,
              color: viewMode === t.id ? '#FCD34D' : 'var(--steel)',
              font: '500 12px/1 var(--font-sans)',
              cursor: 'default',
            }}
          >
            <span style={{ color: viewMode === t.id ? SLICER_ACCENT : 'var(--gunmetal)' }}>
              {React.createElement(window[t.icon], { size: 12 })}
            </span>
            {t.label}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>
            {job.name}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>
            {job.bbox.x} × {job.bbox.y} × {job.bbox.z} mm
          </span>
        </div>
      </div>

      {/* preview canvas */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.04), transparent 60%), var(--forge-black)',
      }}>
        <PreviewCanvas mode={viewMode} job={job} />

        {/* hover toolbar (top-left) */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 4,
          backdropFilter: 'blur(6px)',
        }}>
          {[{i:'IconRefresh', l:'Reset cámara'}, {i:'IconGrid', l:'Vista superior'}, {i:'IconLayers', l:'Vista capa'}].map((b, idx) => (
            <button key={idx} type="button" title={b.l} style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'transparent', border: 0,
              color: 'var(--steel)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
            }}>
              {React.createElement(window[b.i], { size: 13 })}
            </button>
          ))}
        </div>

        {/* layer scrubber when in 'layers' mode */}
        {viewMode === 'layers' && (
          <div style={{
            position: 'absolute', right: 14, top: 14, bottom: 60,
            width: 36,
            background: 'rgba(15, 18, 25, 0.85)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '10px 6px',
            backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', writingMode: 'vertical-rl' }}>
              CAPA
            </span>
            <div style={{ flex: 1, width: 4, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, position: 'relative' }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '62%',
                background: `linear-gradient(0deg, ${SLICER_ACCENT}, #FCD34D)`,
                borderRadius: 2,
              }} />
              <div style={{
                position: 'absolute', bottom: '62%', left: '50%',
                transform: 'translate(-50%, 50%)',
                width: 14, height: 14, borderRadius: 999,
                background: SLICER_ACCENT,
                border: '2px solid var(--forge-black)',
                boxShadow: `0 0 12px ${SLICER_ACCENT}aa`,
              }} />
            </div>
            <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tech-white)' }}>
              {Math.round(job.layerCount * 0.62)}
            </span>
            <span className="mono" style={{ fontSize: 8.5, color: 'var(--gunmetal-dim)' }}>
              /{job.layerCount}
            </span>
          </div>
        )}

        {/* bottom status strip */}
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 14,
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 14px',
          background: 'rgba(15, 18, 25, 0.85)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          backdropFilter: 'blur(6px)',
        }}>
          <StatusChip label="Plates" value={job.plates} />
          <StatusChip label="Piezas" value={job.parts} />
          <StatusChip label="Capa" value={`${job.layerHeight}mm`} />
          <StatusChip label="Walls" value={job.walls} />
          <StatusChip label="Infill" value={`${job.infill}%`} />
          <StatusChip label="Supports" value={job.supports ? 'sí' : 'no'} valueColor={job.supports ? '#FCD34D' : 'var(--steel)'} />

          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#34D399', boxShadow: '0 0 6px #34D39988' }} />
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--steel)' }}>Estimación lista</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusChip({ label, value, valueColor = 'var(--tech-white)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span className="mono" style={{
        fontSize: 9, color: 'var(--gunmetal-dim)', letterSpacing: 0.14, textTransform: 'uppercase',
      }}>{label}</span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

// ─── preview canvas — abstract iso model placeholder ─────────────────────
function PreviewCanvas({ mode, job }) {
  // simple SVG showing a stylized 3D shape on a build plate.
  // 'layers' mode draws horizontal layer lines; 'gcode' uses gradient stripes.
  const W = 720, H = 460;
  const cx = W / 2, cy = H / 2 + 30;
  const filamentColor = '#A78BFA'; // SP-0008 Violet Pearl

  // build plate (iso)
  const plate = [
    [cx - 180, cy + 80],
    [cx, cy + 130],
    [cx + 180, cy + 80],
    [cx, cy + 30],
  ];
  const platePath = `M ${plate.map(p => p.join(',')).join(' L ')} Z`;

  // simple "dragon" silhouette — abstracted as stacked diamond / pyramid
  const layers = 14;
  const layerPolys = [];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const w = 110 - t * 60;        // width tapers up
    const d = 60 - t * 35;          // depth tapers up
    const y = cy + 30 - i * 18;
    layerPolys.push({
      pts: [
        [cx - w, y],
        [cx, y - d * 0.5],
        [cx + w, y],
        [cx, y + d * 0.5],
      ],
      i,
      t,
    });
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="plate-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2030" />
          <stop offset="100%" stopColor="#0F1219" />
        </linearGradient>
        <linearGradient id="model-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={filamentColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={filamentColor} stopOpacity="0.55" />
        </linearGradient>
        <pattern id="plate-grid" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="matrix(1.2, 0.55, -1.2, 0.55, 0, 0)">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a3142" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* plate */}
      <path d={platePath} fill="url(#plate-grad)" stroke="#2a3142" strokeWidth="1" />
      <path d={platePath} fill="url(#plate-grid)" opacity="0.7" />

      {/* origin marker */}
      <circle cx={plate[0][0] + 10} cy={plate[0][1] - 2} r="2" fill={SLICER_ACCENT === 'var(--app-slicer)' ? '#F59E0B' : SLICER_ACCENT} />
      <text x={plate[0][0] + 18} y={plate[0][1] + 1} fill="#7A8494" fontFamily="JetBrains Mono" fontSize="9">0,0</text>

      {/* model */}
      {mode === 'layers' ? (
        // each layer drawn discretely with color gradient bottom→top
        layerPolys.map((L) => {
          const c = `hsl(${260 - L.t * 60}, 55%, ${42 + L.t * 28}%)`;
          return (
            <polygon
              key={L.i}
              points={L.pts.map(p => p.join(',')).join(' ')}
              fill={c}
              stroke="#0F1219"
              strokeWidth="0.4"
              opacity={L.i / layers > 0.62 ? 0.18 : 1}
            />
          );
        })
      ) : mode === 'gcode' ? (
        layerPolys.map((L) => (
          <polygon
            key={L.i}
            points={L.pts.map(p => p.join(',')).join(' ')}
            fill="none"
            stroke={`hsl(${30 + L.t * 30}, 90%, ${55 + L.t * 10}%)`}
            strokeWidth="0.6"
            opacity={0.9}
          />
        ))
      ) : (
        // 'model' — solid silhouette w/ outline
        <React.Fragment>
          <polygon
            points={[
              [cx - 110, cy + 30],
              [cx, cy - 8],
              [cx + 110, cy + 30],
              [cx + 50, cy - 224],
              [cx, cy - 250],
              [cx - 50, cy - 224],
            ].map(p => p.join(',')).join(' ')}
            fill="url(#model-grad)"
            stroke={filamentColor}
            strokeWidth="1.2"
            opacity="0.95"
          />
          {/* horizontal subtle layer lines to hint at slicing */}
          {[...Array(11)].map((_, i) => {
            const y = cy - 8 - (i + 1) * 22;
            const taper = (i + 1) / 12;
            const w = 100 - taper * 50;
            return (
              <line key={i} x1={cx - w} y1={y} x2={cx + w} y2={y}
                    stroke="#0F1219" strokeOpacity="0.45" strokeWidth="0.6" />
            );
          })}
        </React.Fragment>
      )}

      {/* axis legend bottom-right */}
      <g transform={`translate(${W - 70}, ${H - 50})`} fontFamily="JetBrains Mono" fontSize="9" fill="#7A8494">
        <line x1="0" y1="0" x2="22" y2="11" stroke="#F87171" strokeWidth="1.2" />
        <text x="26" y="13" fill="#F87171">X</text>
        <line x1="0" y1="0" x2="-22" y2="11" stroke="#34D399" strokeWidth="1.2" />
        <text x="-32" y="13" fill="#34D399">Y</text>
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#3B82F6" strokeWidth="1.2" />
        <text x="-4" y="-26" fill="#3B82F6">Z</text>
      </g>
    </svg>
  );
}

// ─── right rail: settings + estimate ─────────────────────────────────────
function SlicerRightRail({ job, settings, onSettings }) {
  return (
    <aside style={{
      width: 340, flexShrink: 0,
      borderLeft: '1px solid var(--border-soft)',
      background: 'var(--surf-sidebar)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 12px' }}>
        {/* perfil / printer */}
        <SettingsBlock title="Perfil">
          <SettingsRow label="Impresora" value={(() => {
            const p = PRINTERS.find((x) => x.id === settings.printer);
            return p ? `${p.name} · ${p.model}` : '—';
          })()} icon="IconCpu" tone={SLICER_ACCENT} />
          <SettingsRow label="Boquilla" value={`${settings.nozzle} mm`} icon="IconDroplet" />
          <SettingsRow label="Material" value={settings.material} icon="IconBeaker" />
          <SettingsRow label="Spool" value="SP-0008 · Violet Pearl" icon="IconBox" sub="660g restantes" />
        </SettingsBlock>

        {/* settings */}
        <SettingsBlock title="Settings">
          <StepperRow
            label="Altura de capa"
            unit="mm"
            value={settings.layerHeight.toFixed(2)}
            onMinus={() => onSettings('layerHeight', Math.max(0.08, settings.layerHeight - 0.04))}
            onPlus={() => onSettings('layerHeight', Math.min(0.32, settings.layerHeight + 0.04))}
          />
          <SliderRow
            label="Infill"
            unit="%"
            value={settings.infill}
            min={0} max={100}
            onChange={(v) => onSettings('infill', v)}
          />
          <StepperRow
            label="Walls"
            value={settings.walls}
            onMinus={() => onSettings('walls', Math.max(1, settings.walls - 1))}
            onPlus={() => onSettings('walls', Math.min(8, settings.walls + 1))}
          />
          <ToggleRow
            label="Supports"
            sub="Genera estructuras de soporte"
            value={settings.supports}
            onChange={(v) => onSettings('supports', v)}
          />
          <ToggleRow
            label="Adaptive layers"
            sub="Capas variables según geometría"
            value={settings.adaptive}
            onChange={(v) => onSettings('adaptive', v)}
          />
        </SettingsBlock>

        {/* estimate */}
        <SettingsBlock title="Estimación" titleIcon="IconZap">
          <div style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${SLICER_ACCENT} 10%, transparent), transparent), var(--surf-card)`,
            border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px',
            marginBottom: 8,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Stat label="Tiempo" value={job.estimate.time} icon="IconClock" mono />
              <Stat label="Filamento" value={`${job.estimate.gramsPLA + job.estimate.gramsSupport} g`} icon="IconDroplet" mono />
            </div>
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-soft)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            }}>
              <CostLine label="Material"  value={job.estimate.cost.material} />
              <CostLine label="Máquina"   value={job.estimate.cost.machine} />
              <CostLine label="Energía"   value={job.estimate.cost.energy} />
              <CostLine label="Margen"    value={job.estimate.cost.margin} />
            </div>
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <span className="mono" style={{
                fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
              }}>Total estimado</span>
              <span className="mono" style={{
                fontSize: 21, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.3,
              }}>
                {fmtCOPFull(job.estimate.cost.total)}
              </span>
            </div>
          </div>

          <div className="mono" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, color: 'var(--steel)',
            padding: '6px 10px', borderRadius: 6,
            background: 'rgba(52, 211, 153, 0.06)',
            border: '1px solid rgba(52, 211, 153, 0.18)',
          }}>
            <IconCheck size={11} style={{ color: '#34D399' }} />
            Stock suficiente · SP-0008 cubre 4.5×
          </div>
        </SettingsBlock>
      </div>

      {/* footer: enviar a cola */}
      <div style={{
        padding: '12px 16px 14px',
        borderTop: '1px solid var(--border-soft)',
        background: 'var(--surf-card-2)',
        display: 'flex', gap: 8,
      }}>
        <button type="button" style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'transparent',
          border: '1px solid var(--border-strong)',
          color: 'var(--steel)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'default', flexShrink: 0,
        }} title="Re-estimar">
          <IconRefresh size={15} />
        </button>
        <button type="button" style={{
          flex: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '10px 14px',
          background: SLICER_ACCENT,
          color: '#1A1004',
          border: 0, borderRadius: 8,
          font: '600 13px var(--font-sans)',
          cursor: 'default',
        }}>
          <IconListOrdered size={14} />
          Enviar a cola
        </button>
      </div>
    </aside>
  );
}

function SettingsBlock({ title, titleIcon, children }) {
  const Icon = titleIcon ? window[titleIcon] : null;
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 8, paddingLeft: 2,
      }}>
        {Icon && <Icon size={12} style={{ color: SLICER_ACCENT }} />}
        <h3 style={{
          margin: 0, font: '600 10.5px/1.2 var(--font-sans)',
          color: 'var(--steel)', letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </section>
  );
}

function SettingsRow({ label, value, sub, icon, tone = 'var(--steel)' }) {
  const Icon = window[icon];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 11px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <span style={{
        width: 24, height: 24, borderRadius: 6,
        background: `color-mix(in oklab, ${tone} 12%, transparent)`,
        color: tone,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={12} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{
          font: '500 12.5px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
        {sub && <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      <button type="button" style={{
        width: 24, height: 24, borderRadius: 5,
        background: 'transparent', border: 0,
        color: 'var(--gunmetal)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'default', flexShrink: 0,
      }}>
        <IconChevronRight size={12} />
      </button>
    </div>
  );
}

function StepperRow({ label, value, unit, onMinus, onPlus }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 11px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 1 }}>
          <span className="mono" style={{ font: '600 14px var(--font-sans)', color: 'var(--tech-white)' }}>{value}</span>
          {unit && <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{unit}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={onMinus} style={stepBtn}>−</button>
        <button type="button" onClick={onPlus}  style={stepBtn}>+</button>
      </div>
    </div>
  );
}
const stepBtn = {
  width: 26, height: 26, borderRadius: 6,
  background: 'var(--surf-card-2)',
  border: '1px solid var(--border-strong)',
  color: 'var(--tech-white)',
  font: '600 14px var(--font-sans)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', lineHeight: 1,
};

function SliderRow({ label, value, min = 0, max = 100, unit, onChange }) {
  const pctVal = ((value - min) / (max - min)) * 100;
  return (
    <div style={{
      padding: '9px 11px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 7 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span className="mono" style={{ marginLeft: 'auto', font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>
          {value}{unit && <span style={{ fontSize: 10, color: 'var(--gunmetal)' }}>{unit}</span>}
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
          background: `linear-gradient(90deg, ${SLICER_ACCENT}, #FCD34D)`,
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', left: `${pctVal}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 12, height: 12, borderRadius: 999,
          background: '#FCD34D',
          border: '2px solid var(--forge-black)',
          boxShadow: `0 0 8px ${SLICER_ACCENT}88`,
        }} />
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: -6, width: '100%', opacity: 0, cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 11px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)' }}>{label}</div>
        {sub && <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 34, height: 20, borderRadius: 999,
          background: value ? SLICER_ACCENT : 'var(--surf-card-2)',
          border: `1px solid ${value ? SLICER_ACCENT : 'var(--border-strong)'}`,
          position: 'relative',
          cursor: 'default', flexShrink: 0,
          transition: 'background 160ms ease, border-color 160ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 1, left: value ? 15 : 1,
          width: 16, height: 16, borderRadius: 999,
          background: value ? '#1A1004' : 'var(--tech-white)',
          transition: 'left 160ms ease',
        }} />
      </button>
    </div>
  );
}

function Stat({ label, value, icon, mono }) {
  const Icon = icon ? window[icon] : null;
  return (
    <div>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        {Icon && <Icon size={10} />} {label}
      </div>
      <div className={mono ? 'mono' : ''} style={{
        font: `600 17px var(--font-${mono ? 'mono' : 'sans'})`,
        color: 'var(--tech-white)', marginTop: 3, letterSpacing: -0.2,
      }}>
        {value}
      </div>
    </div>
  );
}

function CostLine({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)', fontWeight: 500 }}>{fmtCOPInline(value)}</span>
    </div>
  );
}

// ─── header (top of page) ────────────────────────────────────────────────
function SlicerHeader() {
  return (
    <header style={{
      padding: '14px 20px 14px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `color-mix(in oklab, ${SLICER_ACCENT} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${SLICER_ACCENT} 32%, transparent)`,
        color: SLICER_ACCENT,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconCpu size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
          textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: SLICER_ACCENT }} />
          Slicer
        </div>
        <h1 style={{
          margin: 0, font: '600 18px/1.2 var(--font-sans)',
          color: 'var(--tech-white)', letterSpacing: -0.2,
        }}>
          Preparar para impresión
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={ghostBtn}>
          <IconHistory size={13} /> Historial
        </button>
        <button type="button" style={ghostBtn}>
          <IconDownload size={13} /> Exportar G-code
        </button>
        <button type="button" style={primaryBtn}>
          <IconPlus size={13} /> Nuevo proyecto
        </button>
      </div>
    </header>
  );
}
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 11px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 12px var(--font-sans)',
  cursor: 'default',
};
const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 7,
  background: SLICER_ACCENT,
  border: `1px solid ${SLICER_ACCENT}`,
  color: '#1A1004',
  font: '600 12px var(--font-sans)',
  cursor: 'default',
};

// ─── root ────────────────────────────────────────────────────────────────
function App() {
  const [viewMode, setViewMode] = React.useState('model');
  const [selected, setSelected] = React.useState(SLICER_JOBS.current.id);
  const [settings, setSettings] = React.useState({
    printer: SLICER_JOBS.current.printer,
    material: SLICER_JOBS.current.material,
    nozzle: SLICER_JOBS.current.nozzle,
    layerHeight: SLICER_JOBS.current.layerHeight,
    infill: SLICER_JOBS.current.infill,
    walls: SLICER_JOBS.current.walls,
    supports: SLICER_JOBS.current.supports,
    adaptive: false,
  });
  const onSettings = (k, v) => setSettings((cur) => ({ ...cur, [k]: v }));

  const job = SLICER_JOBS.current;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="slicer" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
      }}>
        <SlicerHeader />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', minWidth: 1080 }}>
          <SlicerLeftRail selected={selected} onSelect={setSelected} />
          <SlicerCenter job={job} viewMode={viewMode} onViewMode={setViewMode} />
          <SlicerRightRail job={job} settings={settings} onSettings={onSettings} />
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
