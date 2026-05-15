// inventory.jsx — Inventory page (Filamentos focus)
// Layout: header → KPI strip → category tabs → toolbar → grouped content (grid|table) → drawer

// ─── tiny shared helpers ──────────────────────────────────────────────────
const pct = (f) => Math.max(0, Math.min(100, (f.remaining / f.total) * 100));
const lowLevel = (f) => {
  const p = pct(f);
  if (p <= 10) return 'critical';
  if (p <= 20) return 'low';
  return 'ok';
};

// ─── header ───────────────────────────────────────────────────────────────
function InventoryHeader({ onOpenDrawer }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '14px 24px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--surf-sidebar)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#3B82F6',
          border: '1px solid rgba(59, 130, 246, 0.25)',
        }}>
          <IconPackage size={13} />
        </span>
        <span style={{ fontSize: 13, color: 'var(--gunmetal)', whiteSpace: 'nowrap' }}>Inventario</span>
        <span style={{ color: '#3F4654', flexShrink: 0 }}>
          <IconChevronRight size={11} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tech-white)', whiteSpace: 'nowrap' }}>Filamentos</span>
        <span className="mono" style={{
          marginLeft: 6,
          fontSize: 10,
          padding: '2px 6px',
          background: 'rgba(228, 232, 237, 0.06)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--steel)',
          letterSpacing: 0.08,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>22 spools</span>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" type="button">
          <IconUpload size={13} /> Importar
        </button>
        <button className="btn btn-ghost btn-sm" type="button">
          <IconDownload size={13} /> Exportar
        </button>
        <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <button className="btn btn-icon" type="button" aria-label="Notificaciones" style={{ position: 'relative' }}>
          <IconBell size={14} />
          <span style={{
            position: 'absolute',
            top: 5, right: 6,
            width: 6, height: 6,
            borderRadius: 999,
            background: 'var(--forge-amber)',
            boxShadow: '0 0 0 2px var(--surf-sidebar)',
          }} />
        </button>
        <button className="btn btn-primary btn-sm" type="button" onClick={onOpenDrawer}>
          <IconPlus size={13} /> Agregar spool
        </button>
      </div>
    </header>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3B82F6', width = 96, height = 28 }) {
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-grad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={height - (data[data.length - 1] / max) * (height - 4) - 2} r="2" fill={color} />
    </svg>
  );
}

function KPI({ label, value, unit, sub, accent, trend, sparkline, icon }) {
  const Icon = icon ? window[icon] : null;
  const trendColor = trend > 0 ? '#34D399' : trend < 0 ? '#F87171' : 'var(--gunmetal)';
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {Icon && (
          <span style={{ color: accent, display: 'inline-flex', flexShrink: 0 }}>
            <Icon size={12} />
          </span>
        )}
        <span className="lbl-eyebrow" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{label}</span>
        <span style={{ flex: 1 }} />
        {sparkline && <span style={{ flexShrink: 0 }}><Sparkline data={sparkline} color={accent} width={60} height={20} /></span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.5 }}>
          {value}
        </span>
        {unit && <span className="mono" style={{ fontSize: 12, color: 'var(--gunmetal)' }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
        {trend != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: trendColor, fontSize: 11, flexShrink: 0 }}>
            {trend > 0 ? <IconTrendUp size={11} /> : <IconTrendDown size={11} />}
            <span className="mono">{Math.abs(trend)}%</span>
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: 'var(--gunmetal)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
      </div>
    </div>
  );
}

function KPIStrip({ stats }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '16px 24px 8px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex' }}>
        <KPI
          label="Capital"
          value={`$${(stats.totalValue / 1000000).toFixed(2)}M`}
          unit="COP"
          sub="vs mes ant."
          accent="#3B82F6"
          trend={4}
          icon="IconArrowUpRight"
        />
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex' }}>
        <KPI
          label="Material"
          value={(stats.totalGrams / 1000).toFixed(2)}
          unit="kg"
          sub={`${stats.spoolCount} spools`}
          accent="#94A0AE"
          icon="IconDroplet"
        />
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex' }}>
        <KPI
          label="Consumo · 14d"
          value={`${(CONSUMPTION_14D.reduce((s, n) => s + n, 0) / 1000).toFixed(2)}`}
          unit="kg"
          sub="≈ 254 g/día"
          accent="#2DD4BF"
          sparkline={CONSUMPTION_14D}
        />
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex' }}>
        <KPI
          label="Stock bajo"
          value={stats.lowCount}
          unit="ítems"
          sub={`${stats.criticalCount} críticos`}
          accent="#FBBF24"
          icon="IconAlert"
        />
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex' }}>
        <KPI
          label="Próx. compra"
          value="3"
          unit="POs"
          sub="$1.4M en ruta"
          accent="#8B5CF6"
          icon="IconCart"
        />
      </div>
    </div>
  );
}

// ─── category tabs ────────────────────────────────────────────────────────
function CategoryTabs({ value, onChange, counts }) {
  const tabs = [
    { id: 'filamentos',    label: 'Filamentos',    icon: 'IconDroplet'   },
    { id: 'insumos',       label: 'Insumos',       icon: 'IconBox'       },
    { id: 'herramientas',  label: 'Herramientas',  icon: 'IconScissors'  },
    { id: 'consumibles',   label: 'Consumibles',   icon: 'IconBeaker'    },
    { id: 'compras',       label: 'Compras',       icon: 'IconCart'      },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '0 24px',
      borderBottom: '1px solid var(--border)',
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
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '11px 14px',
              background: 'transparent',
              border: 0,
              borderBottom: `2px solid ${active ? '#3B82F6' : 'transparent'}`,
              color: active ? 'var(--tech-white)' : 'var(--steel)',
              font: '500 13px/1 var(--font-sans)',
              cursor: 'default',
              transition: 'color 120ms ease, border-color 120ms ease',
              whiteSpace: 'nowrap',
              marginBottom: -1,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--tech-white)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--steel)'; }}
          >
            <Icon size={13} style={{ color: active ? '#3B82F6' : 'var(--gunmetal)' }} />
            {t.label}
            <span className="mono" style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 999,
              background: active ? 'rgba(59, 130, 246, 0.14)' : 'rgba(228, 232, 237, 0.05)',
              border: `1px solid ${active ? 'rgba(59, 130, 246, 0.3)' : 'var(--border)'}`,
              color: active ? '#93C5FD' : 'var(--gunmetal)',
            }}>
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── toolbar ──────────────────────────────────────────────────────────────
function Toolbar({ query, onQuery, materialFilters, onToggleMat, view, onView, sort, onSort }) {
  return (
    <div className="toolbar-sticky" style={{
      padding: '14px 24px 12px',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      {/* search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surf-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 7,
        padding: '7px 11px',
        minWidth: 260,
        flexBasis: 280,
        flexGrow: 1,
        maxWidth: 420,
      }}>
        <span style={{ color: 'var(--gunmetal)' }}><IconSearch size={13} /></span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar color, batch, ubicación…"
          style={{
            flex: 1, background: 'transparent', border: 0, outline: 0,
            color: 'var(--tech-white)', font: '400 13px var(--font-sans)',
          }}
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} className="btn btn-ghost" style={{ padding: 2 }}>
            <IconX size={12} />
          </button>
        )}
      </div>

      {/* material chips */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="lbl-eyebrow" style={{ fontSize: 10, marginRight: 4 }}>Material</span>
        {MATERIALS.map((m) => {
          const active = materialFilters.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggleMat(m.id)}
              className={`chip ${active ? 'chip-active' : ''}`}
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

      <span style={{ flex: 1 }} />

      {/* sort */}
      <div style={{ position: 'relative' }}>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="input mono"
          style={{
            paddingRight: 28,
            fontSize: 12,
            appearance: 'none',
            cursor: 'default',
            width: 'auto',
            minWidth: 180,
          }}
        >
          <option value="lowFirst">Stock bajo primero</option>
          <option value="material">Por material</option>
          <option value="recent">Uso reciente</option>
          <option value="valueDesc">Valor (mayor)</option>
          <option value="weightDesc">Peso restante</option>
        </select>
        <span style={{ position: 'absolute', right: 9, top: 10, color: 'var(--gunmetal)', pointerEvents: 'none' }}>
          <IconChevronDown size={12} />
        </span>
      </div>

      {/* view toggle */}
      <div style={{
        display: 'inline-flex',
        border: '1px solid var(--border-strong)',
        borderRadius: 7,
        overflow: 'hidden',
        background: 'var(--surf-card)',
      }}>
        {['grid', 'table'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            className="btn"
            style={{
              padding: '7px 10px',
              border: 0,
              borderRadius: 0,
              background: view === v ? 'var(--surf-hover)' : 'transparent',
              color: view === v ? 'var(--tech-white)' : 'var(--gunmetal)',
            }}
            aria-label={v === 'grid' ? 'Vista grid' : 'Vista tabla'}
          >
            {v === 'grid' ? <IconGrid size={13} /> : <IconList size={13} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── filament card (grid view) ────────────────────────────────────────────
function FuelGauge({ value, level }) {
  const color = level === 'critical' ? '#FBBF24' : level === 'low' ? '#FBBF24' : '#3B82F6';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>RESTANTE</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--tech-white)' }}>
          {Math.round(value)}<span style={{ color: 'var(--gunmetal)' }}>%</span>
        </span>
      </div>
      <div style={{
        position: 'relative',
        height: 4,
        background: 'rgba(228, 232, 237, 0.06)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${value}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 220ms ease',
          boxShadow: level !== 'ok' ? `0 0 6px ${color}55` : 'none',
        }} />
        {/* tick marks at 25/50/75% */}
        {[25, 50, 75].map((t) => (
          <span key={t} style={{
            position: 'absolute', top: -1, bottom: -1, width: 1,
            left: `${t}%`,
            background: 'rgba(15, 18, 25, 0.9)',
          }} />
        ))}
      </div>
    </div>
  );
}

function FilamentCard({ f, density, neon, onClick }) {
  const level = lowLevel(f);
  const p = pct(f);
  const compact = density === 'compact';
  return (
    <button
      type="button"
      onClick={() => onClick(f)}
      className="card card-interactive"
      style={{
        textAlign: 'left',
        padding: compact ? 12 : 14,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 10 : 12,
        position: 'relative',
        overflow: 'hidden',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {/* top: swatch + meta */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <FilamentSwatch color={f.color} size={compact ? 40 : 48} level={level} neon={neon} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span className="mono" style={{
              fontSize: 9.5,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'rgba(228, 232, 237, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--steel)',
              letterSpacing: 0.08,
            }}>{f.material}</span>
            {level !== 'ok' && (
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9.5,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'rgba(251, 191, 36, 0.10)',
                border: '1px solid rgba(251, 191, 36, 0.28)',
                color: '#FBBF24',
                letterSpacing: 0.06,
              }}>
                <IconAlert size={9} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <div style={{
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
            color: 'var(--tech-white)',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {f.colorName}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2 }}>
            {f.vendor} · {f.batch}
          </div>
        </div>
      </div>

      {/* gauge */}
      <FuelGauge value={p} level={level} />

      {/* bottom row: weight + cost */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 10,
        borderTop: '1px dashed var(--border-soft)',
        marginTop: 2,
        paddingTop: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="lbl-eyebrow" style={{ fontSize: 9 }}>Peso</span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--tech-white)', whiteSpace: 'nowrap' }}>
            {fmtG(f.remaining)}
            <span style={{ color: 'var(--gunmetal)' }}>/{fmtKg(f.total)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
          <span className="lbl-eyebrow" style={{ fontSize: 9 }}>Costo/kg</span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--tech-white)', whiteSpace: 'nowrap' }}>
            {fmtCOP(f.costPerKg)}
          </span>
        </div>
      </div>

      {/* location pill — corner */}
      <div style={{
        position: 'absolute',
        top: 10, right: 10,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10,
        color: 'var(--gunmetal)',
      }}>
        <IconMapPin size={10} />
        <span className="mono">{f.location.split(' · ')[1] || f.location}</span>
      </div>
    </button>
  );
}

// ─── swatch component ─────────────────────────────────────────────────────
function FilamentSwatch({ color, size = 48, level = 'ok', neon = false }) {
  // detect very light color → add inner stroke
  const isLight = (() => {
    const c = color.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b);
    return lum > 200;
  })();
  return (
    <div style={{
      flexShrink: 0,
      width: size, height: size,
      borderRadius: 999,
      background: neon
        ? color
        : `radial-gradient(circle at 30% 28%, ${color}ee 0%, ${color} 55%, ${color}99 100%)`,
      boxShadow: neon
        ? `0 0 0 1px ${isLight ? 'rgba(228,232,237,0.18)' : 'rgba(15,18,25,0.6)'} inset, 0 0 18px ${color}66`
        : `0 0 0 1px ${isLight ? 'rgba(228,232,237,0.25)' : 'rgba(15,18,25,0.45)'} inset, 0 1px 2px rgba(0,0,0,0.4)`,
      position: 'relative',
    }}>
      {/* spool hole */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: size * 0.28, height: size * 0.28,
        borderRadius: 999,
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)',
      }} />
      {/* alert ring */}
      {level !== 'ok' && (
        <div style={{
          position: 'absolute',
          top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: 999,
          border: `1px solid ${level === 'critical' ? '#FBBF24aa' : '#FBBF2455'}`,
          pointerEvents: 'none',
        }} className={level === 'critical' ? 'pulse-soft' : ''} />
      )}
    </div>
  );
}

// ─── grouped grid ─────────────────────────────────────────────────────────
function FilamentGrid({ groups, density, neon, onCardClick }) {
  return (
    <div style={{ padding: '8px 24px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      {groups.map((g) => (
        <section key={g.key}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10,
            paddingBottom: 6,
            borderBottom: g.warn
              ? '1px solid rgba(251, 191, 36, 0.22)'
              : '1px solid var(--border-soft)',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.16,
              textTransform: 'uppercase',
              color: g.warn ? '#FBBF24' : 'var(--steel)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {g.warn && <IconAlert size={11} />}
              {g.label}
            </h3>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>
              {g.items.length} {g.items.length === 1 ? 'spool' : 'spools'}
            </span>
            {g.warn && (
              <span style={{ flex: 1, textAlign: 'right' }}>
                <button className="btn btn-sm" type="button" style={{
                  borderColor: 'rgba(251, 191, 36, 0.35)',
                  color: '#FBBF24',
                  background: 'rgba(251, 191, 36, 0.06)',
                }}>
                  <IconCart size={12} /> Agregar todos a compras
                </button>
              </span>
            )}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: density === 'compact'
              ? 'repeat(auto-fill, minmax(220px, 1fr))'
              : 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {g.items.map((f) => (
              <FilamentCard key={f.id} f={f} density={density} neon={neon} onClick={onCardClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── table view ───────────────────────────────────────────────────────────
function FilamentTable({ items, onRowClick }) {
  return (
    <div style={{ padding: '0 24px 32px' }}>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--surf-card)',
      }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 44 }}></th>
              <th>Color · Batch</th>
              <th style={{ width: 80 }}>Material</th>
              <th style={{ width: 90 }}>Vendor</th>
              <th style={{ width: 160 }}>Restante</th>
              <th style={{ width: 100 }}>Costo/kg</th>
              <th style={{ width: 110 }}>Ubicación</th>
              <th style={{ width: 80 }}>Último uso</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => {
              const level = lowLevel(f);
              const p = pct(f);
              return (
                <tr key={f.id} onClick={() => onRowClick(f)} style={{ cursor: 'default' }}>
                  <td>
                    <FilamentSwatch color={f.color} size={26} level={level} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--tech-white)' }}>{f.colorName}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{f.batch}</div>
                  </td>
                  <td>
                    <span className="mono" style={{
                      fontSize: 10.5,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(228, 232, 237, 0.05)',
                      border: '1px solid var(--border)',
                      color: 'var(--steel)',
                      letterSpacing: 0.08,
                    }}>{f.material}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--steel)' }}>{f.vendor}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--tech-white)' }}>
                        {fmtG(f.remaining)} <span style={{ color: 'var(--gunmetal)' }}>/ {fmtKg(f.total)}</span>
                      </span>
                      <div style={{ height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          width: `${p}%`, height: '100%',
                          background: level === 'ok' ? '#3B82F6' : '#FBBF24',
                          borderRadius: 2,
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--tech-white)' }}>{fmtCOP(f.costPerKg)}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{f.location}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{f.lastUsed}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Más">
                      <IconMore size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── detail drawer ────────────────────────────────────────────────────────
function DetailDrawer({ filament, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (filament) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [filament]);

  if (!filament) return null;
  const f = filament;
  const level = lowLevel(f);
  const p = pct(f);
  const used = f.total - f.remaining;
  const remainValue = (f.remaining / 1000) * f.costPerKg;

  return (
    <React.Fragment>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`drawer-backdrop ${mounted ? 'drawer-backdrop-active' : ''}`}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 14, 22, 0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
        }}
      />
      {/* drawer */}
      <aside
        className={`${mounted ? 'drawer-active' : 'drawer-enter'}`}
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(460px, calc(100vw - 40px))',
          background: 'var(--surf-card)',
          borderLeft: '1px solid var(--border)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.1, whiteSpace: 'nowrap' }}>
            {f.id}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar">
            <IconEdit size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onClose}>
            <IconX size={14} />
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 24px' }}>
          {/* hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <FilamentSwatch color={f.color} size={72} level={level} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="mono" style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'rgba(228, 232, 237, 0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--steel)',
                }}>{f.material}</span>
                {level !== 'ok' && (
                  <span className="mono" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: 'rgba(251, 191, 36, 0.10)',
                    border: '1px solid rgba(251, 191, 36, 0.28)',
                    color: '#FBBF24',
                  }}>
                    <IconAlert size={10} />
                    {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
                  </span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2 }}>
                {f.colorName}
              </h2>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--gunmetal)', marginTop: 4 }}>
                {f.vendor} · {f.batch} · {f.color.toUpperCase()}
              </div>
            </div>
          </div>

          {/* big gauge */}
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span className="lbl-eyebrow">Restante</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)' }}>
                {Math.round(p)}<span style={{ color: 'var(--gunmetal)', fontSize: 13 }}>%</span>
              </span>
            </div>
            <div style={{
              position: 'relative',
              height: 8,
              background: 'rgba(228, 232, 237, 0.06)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 12,
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${p}%`,
                background: level === 'ok' ? 'linear-gradient(90deg, #3B82F6, #60A5FA)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                borderRadius: 4,
              }} />
              {[25, 50, 75].map((t) => (
                <span key={t} style={{ position: 'absolute', top: -1, bottom: -1, left: `${t}%`, width: 1, background: 'var(--surf-card)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--steel)' }}>
                {fmtG(f.remaining)} restantes
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--gunmetal)' }}>
                {fmtG(used)} usados
              </span>
            </div>
          </div>

          {/* stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            <StatTile label="Valor restante" value={fmtCOP(remainValue)} mono />
            <StatTile label="Costo/kg" value={fmtCOP(f.costPerKg)} mono />
            <StatTile label="Spool original" value={fmtKg(f.total)} mono />
            <StatTile label="Impresiones" value={`${f.prints}`} mono />
            <StatTile label="Ubicación" value={f.location} icon="IconMapPin" />
            <StatTile label="Último uso" value={f.lastUsed} icon="IconClock" />
          </div>

          {/* actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <IconCart size={13} /> Agregar a compras
            </button>
            <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }}>
              <IconRefresh size={13} /> Reasignar batch
            </button>
          </div>

          {/* history */}
          <div>
            <div className="lbl-eyebrow" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconHistory size={11} /> Historial reciente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { date: 'Hace 2 d.', what: 'Print · plate-23.gcode',  weight: 38 },
                { date: 'Hace 4 d.', what: 'Print · plate-22.gcode',  weight: 112 },
                { date: 'Hace 6 d.', what: 'Print · plate-21.gcode',  weight: 26 },
                { date: '12 nov',    what: 'Cotización Q-0184',       weight: 64, est: true },
                { date: '08 nov',    what: 'Spool registrado',         weight: f.total, kind: 'add' },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px dashed var(--border-soft)',
                }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)', minWidth: 60, flexShrink: 0, whiteSpace: 'nowrap' }}>{row.date}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--tech-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.what}
                    {row.est && <span className="mono" style={{ marginLeft: 6, fontSize: 10, color: 'var(--gunmetal)' }}>(estim)</span>}
                  </span>
                  <span className="mono" style={{
                    fontSize: 12,
                    color: row.kind === 'add' ? '#34D399' : 'var(--steel)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {row.kind === 'add' ? '+' : '−'}{fmtG(row.weight)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

function StatTile({ label, value, mono, icon }) {
  const Icon = icon ? window[icon] : null;
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div className="lbl-eyebrow" style={{ fontSize: 9.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {Icon && <Icon size={10} />} {label}
      </div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 13, color: 'var(--tech-white)', fontWeight: mono ? 500 : 400 }}>
        {value}
      </div>
    </div>
  );
}

// ─── empty placeholders for non-filament tabs ─────────────────────────────
function CategoryPlaceholder({ kind }) {
  const labels = {
    insumos: { title: 'Insumos', desc: 'Build plates, nozzles, hotends, etc.', count: INSUMOS.length },
    herramientas: { title: 'Herramientas', desc: 'Pinzas, tijeras, bisturíes, llaves.', count: HERRAMIENTAS.length },
    consumibles: { title: 'Consumibles', desc: 'Desecante, IPA, pegamento, lijas.', count: CONSUMIBLES.length },
    compras: { title: 'Órdenes de compra', desc: 'POs en tránsito y completadas.', count: COMPRAS.length },
  };
  const l = labels[kind] || labels.insumos;
  const items =
    kind === 'insumos' ? INSUMOS :
    kind === 'herramientas' ? HERRAMIENTAS :
    kind === 'consumibles' ? CONSUMIBLES :
    kind === 'compras' ? COMPRAS : [];
  return (
    <div style={{ padding: '20px 24px 32px' }}>
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'rgba(59, 130, 246, 0.10)',
          border: '1px solid rgba(59, 130, 246, 0.22)',
          color: '#3B82F6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBox size={14} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tech-white)' }}>{l.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--gunmetal)' }}>{l.desc}</div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{l.count} ítems</span>
      </div>

      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 100 }}>ID</th>
              <th>Nombre</th>
              <th style={{ width: 100 }}>Stock</th>
              {kind === 'compras' && <th style={{ width: 120 }}>Vendor</th>}
              {kind !== 'compras' && <th style={{ width: 120 }}>Costo/u</th>}
              <th style={{ width: 110 }}>Estado</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td><span className="mono" style={{ fontSize: 11.5, color: 'var(--gunmetal)' }}>{it.id}</span></td>
                <td><span style={{ color: 'var(--tech-white)' }}>{it.name || `Orden ${it.id}`}</span></td>
                <td>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {it.stock != null ? `${it.stock} ${it.unit || 'u'}` : it.items + ' ítems'}
                  </span>
                </td>
                {kind === 'compras' && <td><span className="mono" style={{ fontSize: 11.5, color: 'var(--steel)' }}>{it.vendor}</span></td>}
                {kind !== 'compras' && (
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--tech-white)' }}>{it.costPerUnit ? fmtCOP(it.costPerUnit) : '—'}</span></td>
                )}
                <td>
                  {it.low ? (
                    <span className="mono" style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(251, 191, 36, 0.10)',
                      border: '1px solid rgba(251, 191, 36, 0.28)',
                      color: '#FBBF24',
                    }}>BAJO</span>
                  ) : it.status === 'en camino' ? (
                    <span className="mono" style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3,
                      background: 'rgba(45, 212, 191, 0.10)',
                      border: '1px solid rgba(45, 212, 191, 0.28)',
                      color: '#2DD4BF',
                    }}>EN CAMINO</span>
                  ) : it.status === 'procesando' ? (
                    <span className="mono" style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3,
                      background: 'rgba(59, 130, 246, 0.10)',
                      border: '1px solid rgba(59, 130, 246, 0.28)',
                      color: '#60A5FA',
                    }}>PROCESANDO</span>
                  ) : it.status === 'completado' ? (
                    <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>COMPLETADO</span>
                  ) : (
                    <span className="mono" style={{ fontSize: 10, color: 'var(--steel)' }}>OK</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-icon" type="button"><IconMore size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, {
  InventoryHeader, KPIStrip, CategoryTabs, Toolbar,
  FilamentGrid, FilamentTable, DetailDrawer, FilamentSwatch,
  CategoryPlaceholder, pct, lowLevel,
});
