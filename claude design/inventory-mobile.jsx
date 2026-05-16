// inventory-mobile.jsx — Mobile inventory inside an iOS frame
// Layout: compact header → hero status → mini KPI strip → category tabs
//         → material chips → grouped row list → bottom sheet detail → bottom nav + FAB

// ─── tiny helpers ─────────────────────────────────────────────────────────
const pct = (f) => Math.max(0, Math.min(100, (f.remaining / f.total) * 100));
const lowLevel = (f) => {
  const p = pct(f);
  if (p <= 10) return 'critical';
  if (p <= 20) return 'low';
  return 'ok';
};

// Compact filament swatch for the row list
function SwatchSmall({ color, size = 36, level = 'ok' }) {
  const isLight = (() => {
    const c = color.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 200;
  })();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: `radial-gradient(circle at 30% 28%, ${color}ee 0%, ${color} 55%, ${color}99 100%)`,
      boxShadow: `0 0 0 1px ${isLight ? 'rgba(228,232,237,0.25)' : 'rgba(15,18,25,0.5)'} inset, 0 1px 2px rgba(0,0,0,0.4)`,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: size * 0.3, height: size * 0.3, borderRadius: 999,
        background: 'var(--surf-card)', border: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)',
      }} />
      {level !== 'ok' && (
        <div className={level === 'critical' ? 'pulse-soft' : ''} style={{
          position: 'absolute', inset: -3, borderRadius: 999,
          border: `1px solid ${level === 'critical' ? '#FBBF24aa' : '#FBBF2455'}`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

// Mini sparkline
function MiniSpark({ data, color, width = 100, height = 28 }) {
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="ms-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ms-grad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={height - (data[data.length - 1] / max) * (height - 4) - 2} r="2" fill={color} />
    </svg>
  );
}

// ─── mobile header ────────────────────────────────────────────────────────
function MobileHeader({ onMenu, onSearch }) {
  return (
    <div style={{
      padding: '4px 16px 10px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <button type="button" onClick={onMenu} style={iconBtnStyle} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(59, 130, 246, 0.14)',
            color: 'var(--app-inventory)',
          }}>
            <IconPackage size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Inventario</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1 }}>
          Filamentos
        </div>
      </div>
      <button type="button" onClick={onSearch} style={iconBtnStyle} aria-label="Buscar">
        <IconSearch size={17} />
      </button>
      <button type="button" style={{ ...iconBtnStyle, position: 'relative' }} aria-label="Notificaciones">
        <IconBell size={17} />
        <span style={{
          position: 'absolute', top: 6, right: 7,
          width: 7, height: 7, borderRadius: 999,
          background: 'var(--forge-amber)',
          boxShadow: '0 0 0 2px var(--forge-black)',
        }} />
      </button>
    </div>
  );
}
const iconBtnStyle = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default',
  flexShrink: 0,
};

// ─── hero status card ─────────────────────────────────────────────────────
function HeroStatus({ stats }) {
  return (
    <div style={{
      margin: '0 16px 14px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, rgba(45, 212, 191, 0.04) 100%), var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* corner glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.18), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, position: 'relative' }}>
        <div>
          <div className="mono" style={{
            fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.16, textTransform: 'uppercase', marginBottom: 6,
          }}>
            CAPITAL INVERTIDO
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.5 }}>
              ${(stats.totalValue / 1000000).toFixed(2)}M
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--gunmetal)' }}>COP</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#34D399', marginTop: 4 }}>
            <IconTrendUp size={11} />
            <span className="mono">+4%</span>
            <span style={{ color: 'var(--gunmetal)' }}>vs mes ant.</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <MiniSpark data={CONSUMPTION_14D} color="#3B82F6" width={110} height={36} />
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', textAlign: 'right', marginTop: 2, letterSpacing: 0.08 }}>
            CONSUMO · 14d
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── mini KPI strip ───────────────────────────────────────────────────────
function MiniKPIStrip({ stats }) {
  const activePOs = COMPRAS.filter((p) => p.status !== 'completado');
  const onRoute = activePOs.reduce((s, p) => s + p.total, 0);
  const tiles = [
    { label: 'Material',   value: (stats.totalGrams / 1000).toFixed(2), unit: 'kg',    accent: 'var(--steel)',     sub: `${stats.spoolCount} spools` },
    { label: 'Stock bajo', value: stats.lowCount,                       unit: 'ítems', accent: 'var(--forge-amber)', sub: `${stats.criticalCount} críticos`, warn: true },
    { label: 'Compras',    value: activePOs.length,                     unit: 'POs',   accent: '#A78BFA',           sub: `$${(onRoute/1000000).toFixed(2)}M ruta` },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={{
          flex: 1, minWidth: 0,
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 11px',
          display: 'flex', flexDirection: 'column', gap: 3,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="mono" style={{
              fontSize: 8.5, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{tile.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, whiteSpace: 'nowrap' }}>
            <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: tile.warn ? tile.accent : 'var(--tech-white)' }}>
              {tile.value}
            </span>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)' }}>{tile.unit}</span>
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tile.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── category tabs (horizontal scroll pills) ──────────────────────────────
function MobileTabs({ value, onChange, counts }) {
  const tabs = [
    { id: 'filamentos',    label: 'Filam.',     icon: 'IconDroplet' },
    { id: 'insumos',       label: 'Insumos',    icon: 'IconBox' },
    { id: 'herramientas',  label: 'Herram.',    icon: 'IconScissors' },
    { id: 'consumibles',   label: 'Consum.',    icon: 'IconBeaker' },
    { id: 'compras',       label: 'Compras',    icon: 'IconCart' },
  ];
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <div className="phone-scroll" style={{
        display: 'flex', gap: 5, padding: '0 16px',
        overflowX: 'auto',
      }}>
        {tabs.map((t) => {
          const Icon = window[t.icon];
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 10px',
                borderRadius: 999,
                background: active ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                border: `1px solid ${active ? 'rgba(59, 130, 246, 0.45)' : 'var(--border)'}`,
                color: active ? '#93C5FD' : 'var(--steel)',
                font: '500 12px/1 var(--font-sans)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              {active && <Icon size={12} style={{ color: 'var(--app-inventory)' }} />}
              {t.label}
              {active && (
                <span className="mono" style={{
                  fontSize: 9,
                  padding: '1px 4px',
                  borderRadius: 999,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93C5FD',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}>
                  {counts[t.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* edge fade — hint that strip scrolls horizontally */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 28,
        background: 'linear-gradient(90deg, rgba(15, 18, 25, 0), var(--forge-black))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ─── material filter chips ────────────────────────────────────────────────
function MaterialChips({ selected, onToggle }) {
  return (
    <div className="phone-scroll" style={{
      display: 'flex', gap: 6, padding: '0 16px 10px',
      overflowX: 'auto',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 10px', borderRadius: 999,
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--gunmetal)', font: '500 11.5px/1 var(--font-sans)',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        <IconFilter size={11} />
        Material
      </div>
      {MATERIALS.map((m) => {
        const active = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 10px',
              borderRadius: 999,
              background: active ? 'rgba(59, 130, 246, 0.10)' : 'var(--surf-card)',
              border: `1px solid ${active ? 'rgba(59, 130, 246, 0.4)' : 'var(--border)'}`,
              color: active ? '#93C5FD' : 'var(--steel)',
              font: '500 11.5px/1 var(--font-sans)',
              flexShrink: 0, whiteSpace: 'nowrap',
              cursor: 'default',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: m.tone, opacity: active ? 1 : 0.45,
            }} />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── filament row card (mobile list) ──────────────────────────────────────
function FilamentRow({ f, onClick }) {
  const level = lowLevel(f);
  const p = pct(f);
  return (
    <button
      type="button"
      onClick={() => onClick(f)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%',
        padding: '12px 14px',
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
        cursor: 'default',
      }}
    >
      <SwatchSmall color={f.color} size={40} level={level} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span className="mono" style={{
            fontSize: 8.5,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'rgba(228, 232, 237, 0.05)',
            border: '1px solid var(--border)',
            color: 'var(--steel)',
            letterSpacing: 0.08,
          }}>{f.material}</span>
          {level !== 'ok' && (
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(251, 191, 36, 0.10)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              color: '#FBBF24',
              letterSpacing: 0.06,
            }}>
              <IconAlert size={8} />
              {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--tech-white)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {f.colorName}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {f.vendor} · {f.batch}
        </div>
      </div>

      {/* right: gauge + weight */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, minWidth: 64 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tech-white)', whiteSpace: 'nowrap' }}>
          {Math.round(p)}<span style={{ fontSize: 10, color: 'var(--gunmetal)' }}>%</span>
        </span>
        <div style={{ width: 56, height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${p}%`, height: '100%',
            background: level === 'ok' ? 'var(--app-inventory)' : 'var(--forge-amber)',
            borderRadius: 2,
            boxShadow: level !== 'ok' ? `0 0 4px ${level === 'critical' ? '#FBBF24aa' : '#FBBF2455'}` : 'none',
          }} />
        </div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', whiteSpace: 'nowrap' }}>
          {f.remaining < 1000 ? `${f.remaining}g` : `${(f.remaining/1000).toFixed(2)}kg`}
        </span>
      </div>
    </button>
  );
}

// ─── section header ───────────────────────────────────────────────────────
function SectionHeader({ label, count, warn, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '0 16px',
      marginBottom: 8,
      marginTop: 4,
    }}>
      <h3 style={{
        margin: 0,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.16,
        textTransform: 'uppercase',
        color: warn ? '#FBBF24' : 'var(--steel)',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        {warn && <IconAlert size={10} />}
        {label}
      </h3>
      <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>
        {count}
      </span>
      {warn && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent',
            border: 0,
            color: '#FBBF24',
            font: '500 11px var(--font-sans)',
            cursor: 'default',
          }}
        >
          <IconCart size={11} /> Comprar
        </button>
      )}
    </div>
  );
}

// ─── bottom sheet (detail) ────────────────────────────────────────────────
function BottomSheet({ filament, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (filament) {
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [filament]);
  if (!filament) return null;
  const f = filament;
  const level = lowLevel(f);
  const p = pct(f);
  const remainValue = (f.remaining / 1000) * f.costPerKg;
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
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        background: 'var(--surf-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        padding: '8px 18px 30px',
        zIndex: 41,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)',
        maxHeight: '78%',
        overflowY: 'auto',
      }} className="phone-scroll">
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <SwatchSmall color={f.color} size={60} level={level} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span className="mono" style={{
                fontSize: 9.5, padding: '2px 6px', borderRadius: 3,
                background: 'rgba(228, 232, 237, 0.05)', border: '1px solid var(--border)',
                color: 'var(--steel)',
              }}>{f.material}</span>
              {level !== 'ok' && (
                <span className="mono" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 9.5, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(251, 191, 36, 0.10)', border: '1px solid rgba(251, 191, 36, 0.28)',
                  color: '#FBBF24',
                }}>
                  <IconAlert size={9} />
                  {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.15 }}>
              {f.colorName}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2 }}>
              {f.id} · {f.batch}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            ...iconBtnStyle, width: 32, height: 32, borderRadius: 8,
          }} aria-label="Cerrar">
            <IconX size={14} />
          </button>
        </div>

        {/* gauge */}
        <div style={{
          background: 'var(--surf-card-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.16, textTransform: 'uppercase' }}>Restante</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--tech-white)' }}>
              {Math.round(p)}<span style={{ color: 'var(--gunmetal)', fontSize: 11 }}>%</span>
            </span>
          </div>
          <div style={{ position: 'relative', height: 6, background: 'rgba(228,232,237,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${p}%`,
              background: level === 'ok' ? 'linear-gradient(90deg, #3B82F6, #60A5FA)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)',
            }} />
            {[25, 50, 75].map((t) => (
              <span key={t} style={{ position: 'absolute', top: -1, bottom: -1, left: `${t}%`, width: 1, background: 'var(--surf-card)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{f.remaining} g restantes</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>de {(f.total/1000).toFixed(1)} kg</span>
          </div>
        </div>

        {/* stats 2x2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
          <SheetStat label="Valor restante" value={`$${(remainValue/1000).toFixed(0)}k`} />
          <SheetStat label="Costo/kg"        value={`$${(f.costPerKg/1000).toFixed(0)}k`} />
          <SheetStat label="Ubicación"       value={f.location.split(' · ')[1] || f.location} icon="IconMapPin" />
          <SheetStat label="Último uso"      value={f.lastUsed} icon="IconClock" />
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" style={primaryBtnStyle}>
            <IconCart size={13} /> A compras
          </button>
          <button type="button" style={secondaryBtnStyle}>
            <IconRefresh size={13} /> Reasignar
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}
function SheetStat({ label, value, icon }) {
  const Icon = icon ? window[icon] : null;
  return (
    <div style={{ background: 'var(--surf-card-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px' }}>
      <div className="mono" style={{
        fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {Icon && <Icon size={9} />} {label}
      </div>
      <div className="mono" style={{ fontSize: 13, color: 'var(--tech-white)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}
const primaryBtnStyle = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 14px',
  background: 'var(--forge-teal)', color: '#0A1014',
  border: 0, borderRadius: 10,
  font: '600 13px var(--font-sans)',
  cursor: 'default',
};
const secondaryBtnStyle = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 14px',
  background: 'var(--surf-card-2)', color: 'var(--tech-white)',
  border: '1px solid var(--border-strong)', borderRadius: 10,
  font: '500 13px var(--font-sans)',
  cursor: 'default',
};

// ─── FAB ──────────────────────────────────────────────────────────────────
function FAB() {
  return (
    <button type="button" aria-label="Agregar spool" style={{
      position: 'absolute',
      right: 16, bottom: 86,
      width: 52, height: 52, borderRadius: 999,
      background: 'var(--forge-teal)',
      color: '#0A1014',
      border: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 20px rgba(45, 212, 191, 0.35), 0 0 0 1px rgba(45, 212, 191, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
      cursor: 'default',
      zIndex: 30,
    }}>
      <IconPlus size={22} />
    </button>
  );
}

// ─── bottom nav ───────────────────────────────────────────────────────────
function BottomNav({ active = 'inventory', onChange }) {
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
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange && onChange(it.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'transparent', border: 0,
              color: isActive ? 'var(--app-inventory)' : 'var(--gunmetal)',
              font: '500 9.5px var(--font-sans)',
              cursor: 'default',
              padding: '4px 0',
              position: 'relative',
            }}
          >
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

// ─── search overlay ───────────────────────────────────────────────────────
function SearchOverlay({ open, onClose, query, onQuery }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', top: 60, left: 16, right: 16,
      background: 'var(--surf-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
      zIndex: 25,
      boxShadow: '0 12px 24px rgba(0, 0, 0, 0.4)',
    }}>
      <IconSearch size={15} style={{ color: 'var(--gunmetal)' }} />
      <input
        autoFocus
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Color, batch, ubicación…"
        style={{
          flex: 1, background: 'transparent', border: 0, outline: 0,
          color: 'var(--tech-white)', font: '400 14px var(--font-sans)',
        }}
      />
      <button type="button" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--gunmetal)' }}>
        <IconX size={15} />
      </button>
    </div>
  );
}

// ─── kind icon resolver (insumos / herramientas / consumibles) ───────────
const KIND_ICONS = {
  plate: 'IconLayers', nozzle: 'IconDroplet', hotend: 'IconFlame',
  belt: 'IconRefresh', tube: 'IconBox',
  pliers: 'IconWrench', scissors: 'IconScissors', knife: 'IconEdit',
  hex: 'IconWrench', caliper: 'IconWrench', spatula: 'IconWrench',
  silica: 'IconBox', liquid: 'IconBeaker', glue: 'IconBeaker',
  sandpaper: 'IconBox', gloves: 'IconBox', cloth: 'IconBox',
};
const KIND_TONES = {
  plate: '#3B82F6', nozzle: '#FBBF24', hotend: '#F87171',
  belt: '#94A0AE', tube: '#94A0AE',
  pliers: '#A78BFA', scissors: '#A78BFA', knife: '#A78BFA',
  hex: '#A78BFA', caliper: '#A78BFA', spatula: '#A78BFA',
  silica: '#34D399', liquid: '#22D3EE', glue: '#34D399',
  sandpaper: '#94A0AE', gloves: '#34D399', cloth: '#34D399',
};

// ─── generic supply row (insumos / herramientas / consumibles) ────────────
function SupplyRow({ item }) {
  const Icon = window[KIND_ICONS[item.kind] || 'IconBox'];
  const tone = KIND_TONES[item.kind] || 'var(--steel)';
  const ratio = item.par ? Math.max(0, Math.min(1, item.stock / item.par)) : 1;
  const lvl = item.critical ? 'critical' : item.low ? 'low' : 'ok';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '11px 14px',
      background: 'var(--surf-card)', border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      {/* kind tile */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${tone}1a`,
        border: `1px solid ${tone}40`,
        color: tone,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <Icon size={18} />
        {lvl !== 'ok' && (
          <span className={lvl === 'critical' ? 'pulse-soft' : ''} style={{
            position: 'absolute', top: -3, right: -3,
            width: 8, height: 8, borderRadius: 999,
            background: 'var(--forge-amber)',
            border: '2px solid var(--surf-card)',
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span className="mono" style={{
            fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(228, 232, 237, 0.05)', border: '1px solid var(--border)',
            color: 'var(--steel)', letterSpacing: 0.08,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{item.id}</span>
          {lvl !== 'ok' && (
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(251, 191, 36, 0.10)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              color: '#FBBF24', letterSpacing: 0.06,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <IconAlert size={8} />
              {lvl === 'critical' ? 'CRÍTICO' : 'BAJO'}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--tech-white)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.name}
        </div>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)', marginTop: 2,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
        }}>
          <IconMapPin size={9} /> {item.location}
          {item.lastUsed && <React.Fragment><span style={{ opacity: 0.45 }}>·</span><IconClock size={9} /> {item.lastUsed}</React.Fragment>}
        </div>
      </div>

      {/* right: stock + par */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, minWidth: 60 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: lvl !== 'ok' ? 'var(--forge-amber)' : 'var(--tech-white)' }}>
            {item.stock}
          </span>
          {item.unit && <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)' }}>{item.unit}</span>}
        </div>
        {item.par != null && (
          <div style={{ width: 56, height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, ratio * 100)}%`, height: '100%',
              background: lvl === 'ok' ? tone : 'var(--forge-amber)',
              borderRadius: 2,
            }} />
          </div>
        )}
        {item.par != null && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)' }}>par {item.par}</span>
        )}
      </div>
    </div>
  );
}

// ─── purchase order card (compras tab) ────────────────────────────────────
const PO_STATUS = {
  'en camino':   { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)', icon: 'IconTruck' },
  'procesando':  { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.30)', icon: 'IconClock' },
  'borrador':    { color: '#94A0AE', bg: 'rgba(148, 160, 174, 0.10)', border: 'rgba(148, 160, 174, 0.25)', icon: 'IconEdit' },
  'completado':  { color: '#34D399', bg: 'rgba(52, 211, 153, 0.10)', border: 'rgba(52, 211, 153, 0.28)', icon: 'IconCheck' },
};
function POCard({ po }) {
  const s = PO_STATUS[po.status] || PO_STATUS['procesando'];
  const Icon = window[s.icon];
  return (
    <div style={{
      width: '100%', padding: '13px 14px',
      background: 'var(--surf-card)', border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span className="mono" style={{
          fontSize: 11, fontWeight: 600, color: 'var(--tech-white)', whiteSpace: 'nowrap',
        }}>{po.id}</span>
        <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)', flexShrink: 0 }} />
        <span style={{
          fontSize: 11.5, color: 'var(--steel)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>{po.vendor}</span>
        <span className="mono" style={{
          marginLeft: 'auto', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 600,
          padding: '3px 7px', borderRadius: 999,
          background: s.bg, color: s.color,
          border: `1px solid ${s.border}`,
          letterSpacing: 0.06, textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          <Icon size={9} /> {po.status}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}>
        <span className="mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.3 }}>
          ${(po.total / 1000).toFixed(0)}k
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>COP · {po.items} ítems</span>
        <span className="mono" style={{
          marginLeft: 'auto',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, color: po.status === 'en camino' ? 'var(--app-inventory)' : 'var(--steel)',
        }}>
          <IconClock size={10} /> {po.eta}
        </span>
      </div>

      {/* line items */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        paddingTop: 8, borderTop: '1px dashed var(--border-soft)',
      }}>
        {po.lines.map((l) => (
          <span key={l} className="mono" style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(228, 232, 237, 0.04)',
            border: '1px solid var(--border-soft)',
            color: 'var(--steel)', whiteSpace: 'nowrap',
          }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── main mobile inventory app ────────────────────────────────────────────
function MobileInventoryApp() {
  const [tab, setTab] = React.useState('filamentos');
  const [materialFilters, setMaterialFilters] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [drawerFilament, setDrawerFilament] = React.useState(null);

  const filtered = React.useMemo(() => {
    let list = FILAMENTS;
    if (materialFilters.length) list = list.filter((f) => materialFilters.includes(f.material));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((f) =>
        f.colorName.toLowerCase().includes(q) ||
        f.batch.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q) ||
        f.material.toLowerCase().includes(q)
      );
    }
    return list;
  }, [materialFilters, query]);

  const groups = React.useMemo(() => groupFilaments(filtered), [filtered]);
  const stats = React.useMemo(() => computeStats(FILAMENTS), []);

  const counts = {
    filamentos: FILAMENTS.length,
    insumos: INSUMOS.length,
    herramientas: HERRAMIENTAS.length,
    consumibles: CONSUMIBLES.length,
    compras: COMPRAS.length,
  };

  const toggleMat = (id) =>
    setMaterialFilters((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--forge-black)',
      color: 'var(--tech-white)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* scrollable area (under status bar, above bottom nav) */}
      <div className="phone-scroll" style={{
        position: 'absolute',
        top: 56,   /* status bar height */
        bottom: 70, /* leave room for bottom nav */
        left: 0, right: 0,
        overflowY: 'auto',
      }}>
        <MobileHeader onMenu={() => {}} onSearch={() => setSearchOpen(true)} />
        <HeroStatus stats={stats} />
        <MiniKPIStrip stats={stats} />
        <MobileTabs value={tab} onChange={setTab} counts={counts} />

        {tab === 'filamentos' ? (
          <React.Fragment>
            <MaterialChips selected={materialFilters} onToggle={toggleMat} />

            <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>
                {filtered.length} de {FILAMENTS.length} spools
              </span>
              {(query || materialFilters.length > 0) && (
                <button type="button" onClick={() => { setQuery(''); setMaterialFilters([]); }} style={{
                  background: 'transparent', border: 0, color: 'var(--gunmetal)',
                  font: '500 10.5px var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <IconX size={10} /> limpiar
                </button>
              )}
            </div>

            {groups.map((g) => (
              <section key={g.key} style={{ marginBottom: 18 }}>
                <SectionHeader label={g.label} count={`${g.items.length} ${g.items.length === 1 ? 'spool' : 'spools'}`} warn={g.warn} onAction={() => {}} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px' }}>
                  {g.items.map((f) => (
                    <FilamentRow key={f.id} f={f} onClick={setDrawerFilament} />
                  ))}
                </div>
              </section>
            ))}

            {filtered.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 999, margin: '0 auto 10px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: 'var(--app-inventory)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconSearch size={18} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tech-white)' }}>Sin resultados</div>
                <div style={{ fontSize: 11.5, color: 'var(--gunmetal)', marginTop: 4 }}>
                  Ajusta los filtros para ver más spools.
                </div>
              </div>
            )}
          </React.Fragment>
        ) : tab === 'compras' ? (
          <ComprasTab />
        ) : (
          <SupplyTab tab={tab} />
        )}

        {/* tail padding so FAB doesn't cover content */}
        <div style={{ height: 24 }} />
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} query={query} onQuery={setQuery} />

      <FAB />
      <BottomNav active="inventory" />
      <BottomSheet filament={drawerFilament} onClose={() => setDrawerFilament(null)} />
    </div>
  );
}

// ─── supply tab (insumos / herramientas / consumibles) ───────────────────
function SupplyTab({ tab }) {
  const data = tab === 'insumos' ? INSUMOS
              : tab === 'herramientas' ? HERRAMIENTAS
              : CONSUMIBLES;
  const titles = {
    insumos:      { label: 'Insumos',      sub: 'Plates, nozzles, hotends y refacciones' },
    herramientas: { label: 'Herramientas', sub: 'Inventario fijo del taller' },
    consumibles:  { label: 'Consumibles',  sub: 'Materiales que se gastan por uso' },
  };
  const t = titles[tab];
  const lowItems = data.filter((it) => it.low);
  const okItems  = data.filter((it) => !it.low);

  // category-level mini KPIs
  const totalValue = data.reduce((s, it) => s + (it.costPerUnit ? it.costPerUnit * it.stock : 0), 0);
  const lowCount = lowItems.length;
  const totalCount = data.length;

  return (
    <React.Fragment>
      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <div style={{
          background: 'var(--surf-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{
              fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14,
              textTransform: 'uppercase', marginBottom: 3,
            }}>{t.label}</div>
            <div style={{
              fontSize: 12, color: 'var(--steel)', lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{t.sub}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2 }}>
              {totalCount}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
              ítems
            </div>
          </div>
          {totalValue > 0 && (
            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 14 }}>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--tech-white)' }}>
                ${(totalValue / 1000).toFixed(0)}k
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.1, textTransform: 'uppercase' }}>
                valor
              </div>
            </div>
          )}
        </div>
      </div>

      {lowItems.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader
            label="Reabastecer"
            count={`${lowItems.length} ${lowItems.length === 1 ? 'ítem' : 'ítems'}`}
            warn
            onAction={() => {}}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px' }}>
            {lowItems.map((it) => <SupplyRow key={it.id} item={it} />)}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 18 }}>
        <SectionHeader
          label={lowItems.length ? 'En stock' : 'Inventario'}
          count={`${okItems.length} ${okItems.length === 1 ? 'ítem' : 'ítems'}`}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px' }}>
          {okItems.map((it) => <SupplyRow key={it.id} item={it} />)}
        </div>
      </section>
    </React.Fragment>
  );
}

// ─── compras tab ──────────────────────────────────────────────────────────
function ComprasTab() {
  const active = COMPRAS.filter((p) => p.status !== 'completado');
  const past   = COMPRAS.filter((p) => p.status === 'completado');
  const onRoute = active.reduce((s, p) => s + p.total, 0);

  return (
    <React.Fragment>
      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(59, 130, 246, 0.04)), var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(167, 139, 250, 0.14)',
            border: '1px solid rgba(167, 139, 250, 0.35)',
            color: '#A78BFA',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconTruck size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{
              fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14,
              textTransform: 'uppercase', marginBottom: 2,
            }}>En ruta</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span className="mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.3 }}>
                {onRoute >= 1000000 ? `$${(onRoute / 1000000).toFixed(2)}M` : `$${(onRoute / 1000).toFixed(0)}k`}
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>· {active.length} POs activas</span>
            </div>
          </div>
          <button type="button" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 10px', borderRadius: 8,
            background: 'rgba(167, 139, 250, 0.12)',
            border: '1px solid rgba(167, 139, 250, 0.35)',
            color: '#A78BFA',
            font: '500 11.5px var(--font-sans)',
            cursor: 'default',
          }}>
            <IconPlus size={11} /> Nueva
          </button>
        </div>
      </div>

      {active.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader
            label="Activas"
            count={`${active.length} ${active.length === 1 ? 'orden' : 'órdenes'}`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
            {active.map((po) => <POCard key={po.id} po={po} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <SectionHeader
            label="Recibidas"
            count={`${past.length} este mes`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
            {past.map((po) => <POCard key={po.id} po={po} />)}
          </div>
        </section>
      )}
    </React.Fragment>
  );
}

// ─── mount inside iOS device frame ────────────────────────────────────────
function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Inventario móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileInventoryApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
