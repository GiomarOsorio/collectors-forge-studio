// vault.jsx — Vault model library (desktop)
// Layout: header + KPI strip → toolbar (filtros + búsqueda + view) → grid de cards
// Detail drawer: full metadata, version history, related quotes/jobs, actions.

const VACC = 'var(--app-vault)'; // #F43F5E rose
const VACC_HEX = '#F43F5E';

const fmtSize = (mb) => mb < 1 ? `${Math.round(mb * 1000)} KB` : `${mb.toFixed(1)} MB`;

// format → color
const FMT_COLOR = {
  '.3mf':   { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.28)' },
  '.stl':   { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.28)' },
  '.step':  { color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.10)',  border: 'rgba(34, 211, 238, 0.28)' },
  '.gcode': { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.28)' },
};

// ─── header ───────────────────────────────────────────────────────────────
function VaultHeader() {
  const totalSize = VAULT_MODELS.reduce((s, m) => s + m.sizeMB, 0);
  const totalPrints = VAULT_MODELS.reduce((s, m) => s + m.prints, 0);
  const formats = new Set(VAULT_MODELS.map((m) => m.fmt));
  return (
    <React.Fragment>
      <header style={{
        padding: '14px 22px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `color-mix(in oklab, ${VACC} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${VACC} 32%, transparent)`,
          color: VACC,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconArchive size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: VACC }} />
            Vault
          </div>
          <h1 style={{
            margin: 0, font: '600 18px/1.2 var(--font-sans)',
            color: 'var(--tech-white)', letterSpacing: -0.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Biblioteca de modelos
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" style={vGhost}>
            <IconUpload size={13} /> Importar
          </button>
          <button type="button" style={vGhost}>
            <IconDownload size={13} /> Exportar
          </button>
          <button type="button" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7,
            background: VACC_HEX, color: '#280711',
            border: 0,
            font: '600 12px var(--font-sans)',
            cursor: 'default',
          }}>
            <IconPlus size={13} /> Nuevo modelo
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '12px 22px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
      }}>
        <VKPI label="Modelos"   icon="IconArchive" value={VAULT_MODELS.length} sub={`${VAULT_CATEGORIES.length - 1} categorías`} />
        <VKPI label="Formato"   icon="IconBox"     value={formats.size} unit="tipos" sub={[...formats].join(' · ')} />
        <VKPI label="Almacenado" icon="IconBox"    value={`${totalSize.toFixed(1)}`} unit="MB" sub="En el servidor" />
        <VKPI label="Impresiones" icon="IconTrendUp" value={totalPrints} sub="Histórico total" />
      </div>
    </React.Fragment>
  );
}

function VKPI({ label, value, unit, sub, icon }) {
  const Icon = window[icon];
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '11px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5,
          background: `color-mix(in oklab, ${VACC} 14%, transparent)`,
          color: VACC,
        }}>
          <Icon size={11} />
        </span>
        <span className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.3 }}>
          {value}
        </span>
        {unit && <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{unit}</span>}
      </div>
      {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

// ─── toolbar (filters + search + view) ───────────────────────────────────
function VaultToolbar({ category, onCategory, format, onFormat, query, onQuery, sort, onSort }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 22px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--forge-black)',
      flexWrap: 'wrap',
    }}>
      {/* category pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {VAULT_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button key={c.id} type="button" onClick={() => onCategory(c.id)} style={{
              padding: '5px 10px', borderRadius: 999,
              background: active ? 'rgba(244, 63, 94, 0.12)' : 'transparent',
              border: `1px solid ${active ? 'rgba(244, 63, 94, 0.38)' : 'var(--border)'}`,
              color: active ? '#FDA4AF' : 'var(--steel)',
              font: '500 11.5px/1 var(--font-sans)',
              cursor: 'default',
              whiteSpace: 'nowrap',
            }}>
              {c.label}
            </button>
          );
        })}
      </div>

      <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />

      {/* format chips */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['all', ...VAULT_FORMATS].map((f) => {
          const active = format === f;
          const fc = f !== 'all' ? FMT_COLOR[f] : null;
          return (
            <button key={f} type="button" onClick={() => onFormat(f)} style={{
              padding: '5px 8px', borderRadius: 6,
              background: active ? (fc ? fc.bg : 'rgba(228, 232, 237, 0.06)') : 'transparent',
              border: `1px solid ${active ? (fc ? fc.border : 'var(--border-strong)') : 'var(--border)'}`,
              color: active ? (fc ? fc.color : 'var(--tech-white)') : 'var(--steel)',
              font: '500 11px/1 var(--font-mono)',
              cursor: 'default',
              whiteSpace: 'nowrap',
              letterSpacing: 0.04,
            }}>
              {f === 'all' ? 'todos' : f}
            </button>
          );
        })}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* search */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7,
          background: 'var(--surf-card)',
          border: '1px solid var(--border-strong)',
          width: 220,
        }}>
          <IconSearch size={12} style={{ color: 'var(--gunmetal)' }} />
          <input
            value={query} onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar modelos, tags…"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 0, outline: 0,
              color: 'var(--tech-white)', font: '400 12px var(--font-sans)',
            }}
          />
        </div>
        {/* sort */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7,
          background: 'var(--surf-card)',
          border: '1px solid var(--border-strong)',
          color: 'var(--steel)',
          font: '500 11.5px var(--font-sans)',
          cursor: 'default',
        }}>
          <IconFilter size={11} />
          {sort === 'recent' ? 'Recientes' : sort === 'prints' ? 'Más usados' : 'Más recientes'}
          <IconChevronDown size={11} />
        </div>
      </div>
    </div>
  );
}

// ─── model card ──────────────────────────────────────────────────────────
function ModelCard({ model, onClick }) {
  const fc = FMT_COLOR[model.fmt] || FMT_COLOR['.3mf'];
  return (
    <div
      onClick={() => onClick(model)}
      style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'default',
        transition: 'border-color 140ms ease, transform 140ms ease',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* thumbnail */}
      <div style={{
        height: 160,
        background:
          'radial-gradient(circle at 50% 60%, rgba(244, 63, 94, 0.04), transparent 60%), var(--forge-black)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'relative',
      }}>
        <VaultThumb shape={model.shape} tone={model.tone} size="card" />

        {/* top-left: format chip */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 7px', borderRadius: 5,
          background: fc.bg, border: `1px solid ${fc.border}`,
          color: fc.color,
          font: '500 9.5px var(--font-mono)',
          letterSpacing: 0.06,
        }}>
          {model.fmt}
        </div>

        {/* top-right: prints */}
        <div className="mono" style={{
          position: 'absolute', top: 8, right: 8,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 5,
          background: 'rgba(15, 18, 25, 0.7)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9.5,
          backdropFilter: 'blur(4px)',
        }}>
          <IconTrendUp size={9} /> {model.prints}
        </div>

        {/* bottom-left: bbox */}
        <div className="mono" style={{
          position: 'absolute', bottom: 8, left: 8,
          padding: '3px 7px', borderRadius: 5,
          background: 'rgba(15, 18, 25, 0.7)',
          border: '1px solid var(--border)',
          color: 'var(--gunmetal)',
          fontSize: 9, letterSpacing: 0.06,
          backdropFilter: 'blur(4px)',
        }}>
          {model.bbox} mm
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '11px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              font: '600 13.5px/1.2 var(--font-sans)', color: 'var(--tech-white)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {model.name}
            </div>
            <div className="mono" style={{
              fontSize: 10, color: 'var(--gunmetal)', marginTop: 2,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{model.id}</span>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
              <span>{model.version}</span>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
              <span>{fmtSize(model.sizeMB)}</span>
            </div>
          </div>
          <button type="button" style={{
            width: 24, height: 24, borderRadius: 5,
            background: 'transparent', border: 0,
            color: 'var(--gunmetal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'default', flexShrink: 0,
          }}>
            <IconMore size={13} />
          </button>
        </div>

        {/* tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {model.tags.map((t) => (
            <span key={t} className="mono" style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 4,
              background: 'rgba(228, 232, 237, 0.04)',
              border: '1px solid var(--border-soft)',
              color: 'var(--steel)',
              letterSpacing: 0.04,
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* footer meta */}
        <div className="mono" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: 'var(--gunmetal)',
          paddingTop: 6,
          borderTop: '1px dashed var(--border-soft)',
        }}>
          <IconClock size={10} /> {model.lastUsed}
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
          <IconBox size={10} /> {model.parts} {model.parts === 1 ? 'pieza' : 'piezas'}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3,
            color: VACC, font: '500 10px var(--font-sans)',
          }}>
            Abrir <IconArrowUpRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── detail drawer ───────────────────────────────────────────────────────
function ModelDrawer({ model, onClose }) {
  if (!model) return null;
  const fc = FMT_COLOR[model.fmt] || FMT_COLOR['.3mf'];
  const versions = VAULT_VERSIONS[model.id] || [
    { v: model.version, date: model.created, note: 'Versión actual' },
  ];

  return (
    <DetailDrawer
      open={!!model}
      onClose={onClose}
      eyebrow={`Modelo · ${model.id}`}
      title={model.name}
      width={500}
      footer={
        <React.Fragment>
          <button type="button" style={drawerSecondary}>
            <IconDownload size={13} /> Descargar
          </button>
          <button type="button" style={{ ...drawerPrimary, flex: 1 }}>
            <IconCpu size={13} /> Cargar en slicer
          </button>
        </React.Fragment>
      }
    >
      {/* big thumbnail */}
      <div style={{
        borderRadius: 12,
        background: 'radial-gradient(circle at 50% 60%, rgba(244, 63, 94, 0.06), transparent 60%), var(--surf-card-2)',
        border: '1px solid var(--border)',
        marginBottom: 14,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ height: 220 }}>
          <VaultThumb shape={model.shape} tone={model.tone} size="sheet" />
        </div>
        {/* top-left chips */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 6,
            background: fc.bg, border: `1px solid ${fc.border}`,
            color: fc.color,
            font: '500 10.5px var(--font-mono)', letterSpacing: 0.06,
          }}>
            {model.fmt}
          </span>
          <span className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(15, 18, 25, 0.7)', border: '1px solid var(--border)',
            color: 'var(--steel)',
            fontSize: 10, letterSpacing: 0.06,
            backdropFilter: 'blur(4px)',
          }}>
            {VAULT_CATEGORIES.find((c) => c.id === model.category)?.label || '—'}
          </span>
        </div>
      </div>

      {/* meta stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 14 }}>
        <DSheetStat label="Versión"   icon="IconHistory"   value={model.version} />
        <DSheetStat label="Piezas"    icon="IconBox"       value={model.parts} />
        <DSheetStat label="Tamaño"    icon="IconArchive"   value={fmtSize(model.sizeMB)} />
        <DSheetStat label="Bbox"      icon="IconLayers"    value={`${model.bbox} mm`} />
        <DSheetStat label="Impresiones" icon="IconTrendUp" value={model.prints} />
        <DSheetStat label="Creado"    icon="IconClock"     value={model.created} />
      </div>

      {/* tags */}
      <h3 style={vSection}>Tags</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {model.tags.map((t) => (
          <span key={t} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '4px 9px', borderRadius: 999,
            background: 'rgba(228, 232, 237, 0.04)',
            border: '1px solid var(--border)',
            color: 'var(--steel)',
            font: '500 11px var(--font-sans)',
          }}>
            #{t}
          </span>
        ))}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 999,
          background: 'transparent',
          border: '1px dashed var(--border-strong)',
          color: 'var(--gunmetal)',
          font: '500 11px var(--font-sans)',
        }}>
          <IconPlus size={10} /> añadir
        </span>
      </div>

      {/* author + ownership */}
      <h3 style={vSection}>Origen</h3>
      <div style={{
        padding: '10px 12px',
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999,
          background: model.author === 'Externo' ? 'rgba(167, 139, 250, 0.18)' : 'rgba(45, 212, 191, 0.16)',
          color: model.author === 'Externo' ? '#A78BFA' : 'var(--forge-teal)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          font: '600 12px var(--font-sans)',
        }}>
          {model.author[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)' }}>
            {model.author}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
            {model.author === 'Externo' ? 'Importado de fuente externa' : 'Diseñado internamente'}
          </div>
        </div>
      </div>

      {/* version history */}
      <h3 style={vSection}>Historial de versiones</h3>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        {versions.map((v, i) => (
          <div key={v.v} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            borderBottom: i === versions.length - 1 ? 'none' : '1px solid var(--border-soft)',
          }}>
            <span className="mono" style={{
              flex: '0 0 50px',
              padding: '2px 7px', borderRadius: 4,
              background: i === 0 ? 'rgba(244, 63, 94, 0.10)' : 'rgba(228, 232, 237, 0.04)',
              border: i === 0 ? '1px solid rgba(244, 63, 94, 0.28)' : '1px solid var(--border)',
              color: i === 0 ? '#FDA4AF' : 'var(--steel)',
              fontSize: 10, fontWeight: 600,
              textAlign: 'center',
            }}>
              {v.v}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                font: '500 12px var(--font-sans)', color: 'var(--tech-white)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {v.note}
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
                {v.date}
              </div>
            </div>
            {i === 0 && (
              <span className="mono" style={{
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(52, 211, 153, 0.10)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: '#34D399',
                fontSize: 9.5, letterSpacing: 0.06,
              }}>
                ACTUAL
              </span>
            )}
          </div>
        ))}
      </div>
    </DetailDrawer>
  );
}

const vSection = {
  margin: '0 0 7px',
  font: '600 10.5px/1 var(--font-sans)',
  color: 'var(--steel)',
  letterSpacing: 0.14, textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

function DSheetStat({ label, value, icon }) {
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
      <div className="mono" style={{
        font: '500 12.5px var(--font-mono)', color: 'var(--tech-white)', marginTop: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

const vGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 11px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 12px var(--font-sans)',
  cursor: 'default',
};
const drawerPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: VACC_HEX, color: '#280711',
  border: 0, borderRadius: 8,
  font: '600 12.5px var(--font-sans)',
  cursor: 'default',
};
const drawerSecondary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  borderRadius: 8,
  font: '500 12.5px var(--font-sans)',
  cursor: 'default',
};

// ─── root ────────────────────────────────────────────────────────────────
function App() {
  const [category, setCategory] = React.useState('all');
  const [format, setFormat] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState('recent');
  const [selected, setSelected] = React.useState(null);

  const filtered = React.useMemo(() => {
    let list = VAULT_MODELS;
    if (category !== 'all') list = list.filter((m) => m.category === category);
    if (format !== 'all')   list = list.filter((m) => m.fmt === format);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [category, format, query, sort]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="vault" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
        minWidth: 1080,
      }}>
        <VaultHeader />
        <VaultToolbar
          category={category} onCategory={setCategory}
          format={format} onFormat={setFormat}
          query={query} onQuery={setQuery}
          sort={sort} onSort={setSort}
        />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12,
          }}>
            <h3 style={vSection}>
              {filtered.length} {filtered.length === 1 ? 'modelo' : 'modelos'}
            </h3>
            <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>
              {category === 'all' ? 'Todas las categorías' : VAULT_CATEGORIES.find((c) => c.id === category)?.label}
              {format !== 'all' && ` · ${format}`}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="IconSearch"
              accent={VACC}
              title="Sin modelos"
              hint="Ajusta los filtros o importa un archivo nuevo."
              action={
                <button type="button" style={{ ...drawerPrimary, padding: '8px 14px' }}>
                  <IconUpload size={12} /> Importar modelo
                </button>
              }
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}>
              {filtered.map((m) => <ModelCard key={m.id} model={m} onClick={setSelected} />)}
            </div>
          )}
        </div>
      </main>
      <ModelDrawer model={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
