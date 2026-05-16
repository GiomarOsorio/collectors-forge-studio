// vault-mobile.jsx — Vault en iOS frame (402×874)
// Layout: header → KPI mini → category pills + format chips → search →
// grid 2-cols de cards de modelo → bottom sheet de detalle → bottom nav + FAB

const VM_ACC = '#F43F5E';

const vmSize = (mb) => mb < 1 ? `${Math.round(mb * 1000)} KB` : `${mb.toFixed(1)} MB`;
const VM_FMT_COLOR = {
  '.3mf':   { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.28)' },
  '.stl':   { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.28)' },
  '.step':  { color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.10)',  border: 'rgba(34, 211, 238, 0.28)' },
  '.gcode': { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.28)' },
};

// ─── header ───────────────────────────────────────────────────────────────
function VMHeader({ onSearch }) {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={vmIconBtn} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(244, 63, 94, 0.14)',
            color: VM_ACC,
          }}>
            <IconArchive size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Vault</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1 }}>
          Modelos
        </div>
      </div>
      <button type="button" onClick={onSearch} style={vmIconBtn} aria-label="Buscar">
        <IconSearch size={17} />
      </button>
      <button type="button" style={vmIconBtn} aria-label="Importar">
        <IconUpload size={17} />
      </button>
    </div>
  );
}
const vmIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── KPI mini strip ──────────────────────────────────────────────────────
function VMKPI() {
  const totalSize = VAULT_MODELS.reduce((s, m) => s + m.sizeMB, 0);
  const totalPrints = VAULT_MODELS.reduce((s, m) => s + m.prints, 0);
  const tiles = [
    { label: 'Modelos',    value: VAULT_MODELS.length, sub: `${VAULT_CATEGORIES.length - 1} cat.` },
    { label: 'Tamaño',     value: `${totalSize.toFixed(0)}`, unit: 'MB', sub: 'guardado' },
    { label: 'Impresiones',value: totalPrints, sub: 'histórico' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
      {tiles.map((t) => (
        <div key={t.label} style={{
          flex: 1, minWidth: 0,
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '9px 11px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <span className="mono" style={{
            fontSize: 8.5, color: 'var(--gunmetal)',
            letterSpacing: 0.14, textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{t.label}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, whiteSpace: 'nowrap' }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2 }}>
              {t.value}
            </span>
            {t.unit && <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)' }}>{t.unit}</span>}
          </div>
          <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap' }}>{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── filters (horizontal scroll: categories + formats) ───────────────────
function VMFilters({ category, onCategory, format, onFormat }) {
  return (
    <React.Fragment>
      <div className="phone-scroll" style={{
        display: 'flex', gap: 5, padding: '0 16px 8px',
        overflowX: 'auto',
      }}>
        {VAULT_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button key={c.id} type="button" onClick={() => onCategory(c.id)} style={{
              padding: '6px 11px',
              borderRadius: 999,
              background: active ? 'rgba(244, 63, 94, 0.14)' : 'transparent',
              border: `1px solid ${active ? 'rgba(244, 63, 94, 0.4)' : 'var(--border)'}`,
              color: active ? '#FDA4AF' : 'var(--steel)',
              font: '500 12px/1 var(--font-sans)',
              flexShrink: 0, whiteSpace: 'nowrap',
              cursor: 'default',
            }}>
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="phone-scroll" style={{
        display: 'flex', gap: 5, padding: '0 16px 12px',
        overflowX: 'auto',
      }}>
        {['all', ...VAULT_FORMATS].map((f) => {
          const active = format === f;
          const fc = f !== 'all' ? VM_FMT_COLOR[f] : null;
          return (
            <button key={f} type="button" onClick={() => onFormat(f)} style={{
              padding: '5px 9px',
              borderRadius: 6,
              background: active ? (fc ? fc.bg : 'rgba(228, 232, 237, 0.05)') : 'transparent',
              border: `1px solid ${active ? (fc ? fc.border : 'var(--border-strong)') : 'var(--border)'}`,
              color: active ? (fc ? fc.color : 'var(--tech-white)') : 'var(--steel)',
              font: '500 10.5px/1 var(--font-mono)',
              flexShrink: 0, whiteSpace: 'nowrap',
              cursor: 'default',
              letterSpacing: 0.06,
            }}>
              {f === 'all' ? 'todos' : f}
            </button>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// ─── model card (compact for mobile 2-col grid) ──────────────────────────
function VMModelCard({ model, onClick }) {
  const fc = VM_FMT_COLOR[model.fmt] || VM_FMT_COLOR['.3mf'];
  return (
    <button
      type="button"
      onClick={() => onClick(model)}
      style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'default',
        textAlign: 'left',
        color: 'inherit', font: 'inherit',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* thumb */}
      <div style={{
        height: 120,
        background: 'radial-gradient(circle at 50% 60%, rgba(244, 63, 94, 0.04), transparent 60%), var(--forge-black)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'relative',
      }}>
        <VaultThumb shape={model.shape} tone={model.tone} size="grid" />
        {/* fmt chip */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          padding: '2px 6px', borderRadius: 4,
          background: fc.bg, border: `1px solid ${fc.border}`,
          color: fc.color,
          font: '500 9px var(--font-mono)', letterSpacing: 0.06,
        }}>
          {model.fmt}
        </div>
        {/* prints */}
        <div className="mono" style={{
          position: 'absolute', top: 6, right: 6,
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(15, 18, 25, 0.7)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9,
          backdropFilter: 'blur(4px)',
        }}>
          <IconTrendUp size={8} /> {model.prints}
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '9px 11px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          font: '600 12px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{model.name}</div>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)',
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span>{model.version}</span>
          <span style={{ width: 2.5, height: 2.5, borderRadius: 999, background: 'var(--gunmetal-dim)', flexShrink: 0 }} />
          <span>{vmSize(model.sizeMB)}</span>
          <span style={{ width: 2.5, height: 2.5, borderRadius: 999, background: 'var(--gunmetal-dim)', flexShrink: 0 }} />
          <span>{model.lastUsed}</span>
        </div>
      </div>
    </button>
  );
}

// ─── detail bottom sheet ──────────────────────────────────────────────────
function VMModelSheet({ model, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (model) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [model]);
  if (!model) return null;

  const fc = VM_FMT_COLOR[model.fmt] || VM_FMT_COLOR['.3mf'];
  const versions = VAULT_VERSIONS[model.id] || [
    { v: model.version, date: model.created, note: 'Versión actual' },
  ];

  return (
    <React.Fragment>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(6, 9, 18, 0.6)',
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
        padding: '8px 0 28px',
        zIndex: 41,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)',
        maxHeight: '92%',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        {/* large thumb */}
        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <div style={{
            borderRadius: 12,
            background: 'radial-gradient(circle at 50% 60%, rgba(244, 63, 94, 0.06), transparent 60%), var(--surf-card-2)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            position: 'relative',
            height: 200,
          }}>
            <VaultThumb shape={model.shape} tone={model.tone} size="sheet" />
            {/* chips */}
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
              <span style={{
                padding: '3px 7px', borderRadius: 5,
                background: fc.bg, border: `1px solid ${fc.border}`,
                color: fc.color,
                font: '500 10px var(--font-mono)', letterSpacing: 0.06,
              }}>{model.fmt}</span>
              <span className="mono" style={{
                padding: '3px 7px', borderRadius: 5,
                background: 'rgba(15, 18, 25, 0.7)', border: '1px solid var(--border)',
                color: 'var(--steel)', fontSize: 10,
                backdropFilter: 'blur(4px)',
              }}>
                {VAULT_CATEGORIES.find((c) => c.id === model.category)?.label || '—'}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(15, 18, 25, 0.75)',
              border: '1px solid var(--border)',
              color: 'var(--steel)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
            }}>
              <IconX size={12} />
            </button>
          </div>
        </div>

        {/* name */}
        <div style={{ padding: '0 18px 14px' }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase' }}>
            {model.id}
          </div>
          <div style={{ font: '600 17px var(--font-sans)', color: 'var(--tech-white)', letterSpacing: -0.2, marginTop: 2 }}>
            {model.name}
          </div>
        </div>

        {/* meta 3-col */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <VMSheetStat label="Versión"   icon="IconHistory"  value={model.version} />
            <VMSheetStat label="Piezas"    icon="IconBox"      value={model.parts} />
            <VMSheetStat label="Tamaño"    icon="IconArchive"  value={vmSize(model.sizeMB)} />
            <VMSheetStat label="Bbox"      icon="IconLayers"   value={`${model.bbox}`} sub="mm" />
            <VMSheetStat label="Imprs."    icon="IconTrendUp"  value={model.prints} />
            <VMSheetStat label="Creado"    icon="IconClock"    value={model.created} />
          </div>
        </div>

        {/* tags */}
        <div style={{ padding: '0 18px 14px' }}>
          <VMSubsection>Tags</VMSubsection>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {model.tags.map((t) => (
              <span key={t} style={{
                padding: '3px 8px', borderRadius: 999,
                background: 'rgba(228, 232, 237, 0.04)',
                border: '1px solid var(--border)',
                color: 'var(--steel)',
                font: '500 11px var(--font-sans)',
              }}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* origen */}
        <div style={{ padding: '0 18px 14px' }}>
          <VMSubsection>Origen</VMSubsection>
          <div style={{
            padding: '10px 12px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 11,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 999,
              background: model.author === 'Externo' ? 'rgba(167, 139, 250, 0.18)' : 'rgba(45, 212, 191, 0.16)',
              color: model.author === 'Externo' ? '#A78BFA' : 'var(--forge-teal)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              font: '600 11.5px var(--font-sans)',
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
        </div>

        {/* versions */}
        <div style={{ padding: '0 18px 14px' }}>
          <VMSubsection>Versiones</VMSubsection>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {versions.map((v, i) => (
              <div key={v.v} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                borderBottom: i === versions.length - 1 ? 'none' : '1px solid var(--border-soft)',
              }}>
                <span className="mono" style={{
                  flex: '0 0 46px',
                  padding: '2px 6px', borderRadius: 4,
                  background: i === 0 ? 'rgba(244, 63, 94, 0.10)' : 'rgba(228, 232, 237, 0.04)',
                  border: i === 0 ? '1px solid rgba(244, 63, 94, 0.28)' : '1px solid var(--border)',
                  color: i === 0 ? '#FDA4AF' : 'var(--steel)',
                  fontSize: 9.5, fontWeight: 600, textAlign: 'center',
                }}>{v.v}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    font: '500 11.5px var(--font-sans)', color: 'var(--tech-white)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{v.note}</div>
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
                    fontSize: 9, letterSpacing: 0.06,
                  }}>ACTUAL</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
          <button type="button" style={vmSecondaryBtn}>
            <IconDownload size={13} /> Descargar
          </button>
          <button type="button" style={vmPrimaryBtn}>
            <IconCpu size={13} /> Slicer
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

function VMSubsection({ children }) {
  return (
    <h3 style={{
      margin: '0 0 7px',
      font: '600 10px/1 var(--font-sans)',
      color: 'var(--steel)',
      letterSpacing: 0.14, textTransform: 'uppercase',
    }}>{children}</h3>
  );
}

function VMSheetStat({ label, value, sub, icon }) {
  const Icon = window[icon];
  return (
    <div style={{
      padding: '9px 10px',
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 8.5, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        <Icon size={9} /> {label}
      </div>
      <div className="mono" style={{
        font: '500 12px var(--font-mono)', color: 'var(--tech-white)', marginTop: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value} {sub && <span style={{ color: 'var(--gunmetal)', fontSize: 10 }}>{sub}</span>}
      </div>
    </div>
  );
}

const vmPrimaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: VM_ACC, color: '#280711',
  border: 0, borderRadius: 10,
  font: '600 13px var(--font-sans)',
  cursor: 'default',
};
const vmSecondaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: 'var(--surf-card-2)',
  border: '1px solid var(--border-strong)',
  color: 'var(--tech-white)',
  borderRadius: 10,
  font: '500 13px var(--font-sans)',
  cursor: 'default',
};

// ─── FAB ──────────────────────────────────────────────────────────────────
function VMFAB() {
  return (
    <button type="button" aria-label="Importar modelo" style={{
      position: 'absolute',
      right: 16, bottom: 86,
      width: 52, height: 52, borderRadius: 999,
      background: VM_ACC, color: '#280711',
      border: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 20px rgba(244, 63, 94, 0.35), 0 0 0 1px rgba(244, 63, 94, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
      cursor: 'default',
      zIndex: 30,
    }}>
      <IconPlus size={22} />
    </button>
  );
}

// ─── bottom nav ───────────────────────────────────────────────────────────
function VMBottomNav() {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', badge: 4 },
    { id: 'vault',       label: 'Vault',      icon: 'IconArchive', active: true },
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
            color: it.active ? VM_ACC : 'var(--gunmetal)',
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
function MobileVaultApp() {
  const [category, setCategory] = React.useState('all');
  const [format, setFormat] = React.useState('all');
  const [selected, setSelected] = React.useState(null);

  const filtered = React.useMemo(() => {
    let list = VAULT_MODELS;
    if (category !== 'all') list = list.filter((m) => m.category === category);
    if (format !== 'all')   list = list.filter((m) => m.fmt === format);
    return list;
  }, [category, format]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--forge-black)',
      color: 'var(--tech-white)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="phone-scroll" style={{
        position: 'absolute',
        top: 56, bottom: 70,
        left: 0, right: 0,
        overflowY: 'auto',
      }}>
        <VMHeader />
        <VMKPI />
        <VMFilters category={category} onCategory={setCategory} format={format} onFormat={setFormat} />

        {/* section header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          padding: '0 16px', marginBottom: 8, marginTop: 4,
        }}>
          <h3 style={{
            margin: 0,
            font: '600 10px/1 var(--font-sans)',
            color: 'var(--steel)', letterSpacing: 0.16, textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            {filtered.length} {filtered.length === 1 ? 'modelo' : 'modelos'}
          </h3>
          <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap' }}>
            {category === 'all' ? 'todas las categorías' : VAULT_CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()}
          </span>
        </div>

        {/* 2-col grid */}
        {filtered.length === 0 ? (
          <div style={{
            margin: '0 16px 18px',
            padding: '40px 20px', textAlign: 'center',
            background: 'var(--surf-card)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, margin: '0 auto 10px',
              background: 'rgba(244, 63, 94, 0.10)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              color: VM_ACC,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconSearch size={18} />
            </div>
            <div style={{ font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>
              Sin modelos
            </div>
            <div style={{ font: '400 11.5px var(--font-sans)', color: 'var(--gunmetal)', marginTop: 4 }}>
              Ajusta los filtros o importa uno nuevo.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            padding: '0 16px 24px',
          }}>
            {filtered.map((m) => <VMModelCard key={m.id} model={m} onClick={setSelected} />)}
          </div>
        )}
      </div>

      <VMFAB />
      <VMBottomNav />
      <VMModelSheet model={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Vault móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileVaultApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
