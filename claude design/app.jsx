// app.jsx — root: sidebar + inventory page + state + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfy",
  "defaultView": "grid",
  "showLowFirst": true,
  "swatchStyle": "glossy"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ─── inventory state ────────────────────────────────────────────────
  const [tab, setTab] = React.useState('filamentos');
  const [view, setView] = React.useState(t.defaultView || 'grid');
  const [query, setQuery] = React.useState('');
  const [materialFilters, setMaterialFilters] = React.useState([]);
  const [sort, setSort] = React.useState(t.showLowFirst ? 'lowFirst' : 'material');
  const [drawerFilament, setDrawerFilament] = React.useState(null);

  // sync view with tweaks
  React.useEffect(() => { setView(t.defaultView); }, [t.defaultView]);
  React.useEffect(() => {
    if (t.showLowFirst && sort !== 'lowFirst') setSort('lowFirst');
    if (!t.showLowFirst && sort === 'lowFirst') setSort('material');
  }, [t.showLowFirst]);

  // ─── filtering / sorting ────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = FILAMENTS;
    if (materialFilters.length) {
      list = list.filter((f) => materialFilters.includes(f.material));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((f) =>
        f.colorName.toLowerCase().includes(q) ||
        f.batch.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q) ||
        f.material.toLowerCase().includes(q) ||
        f.vendor.toLowerCase().includes(q)
      );
    }
    return list;
  }, [materialFilters, query]);

  const sortedFlat = React.useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'lowFirst':
        return arr.sort((a, b) => pct(a) - pct(b));
      case 'recent':
        return arr.sort((a, b) => a.prints - b.prints).reverse();
      case 'valueDesc':
        return arr.sort((a, b) => (b.remaining / 1000) * b.costPerKg - (a.remaining / 1000) * a.costPerKg);
      case 'weightDesc':
        return arr.sort((a, b) => b.remaining - a.remaining);
      case 'material':
      default:
        return arr.sort((a, b) => {
          const order = MATERIALS.map((m) => m.id);
          return order.indexOf(a.material) - order.indexOf(b.material);
        });
    }
  }, [filtered, sort]);

  const groups = React.useMemo(() => {
    if (sort === 'lowFirst') return groupFilaments(filtered);
    // For other sorts, single ungrouped section
    return [{ key: 'all', label: 'Resultados', items: sortedFlat, warn: false }];
  }, [filtered, sortedFlat, sort]);

  const stats = React.useMemo(() => computeStats(FILAMENTS), []);

  const counts = {
    filamentos: FILAMENTS.length,
    insumos: INSUMOS.length,
    herramientas: HERRAMIENTAS.length,
    consumibles: CONSUMIBLES.length,
    compras: COMPRAS.length,
  };

  const toggleMat = (id) => {
    setMaterialFilters((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // ─── render ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="inventory" />

      <main style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <InventoryHeader onOpenDrawer={() => {}} />
        <KPIStrip stats={stats} />

        <CategoryTabs value={tab} onChange={setTab} counts={counts} />

        {tab === 'filamentos' ? (
          <React.Fragment>
            <Toolbar
              query={query} onQuery={setQuery}
              materialFilters={materialFilters} onToggleMat={toggleMat}
              view={view} onView={(v) => { setView(v); setTweak('defaultView', v); }}
              sort={sort} onSort={setSort}
            />

            {/* result count */}
            <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)', whiteSpace: 'nowrap' }}>
                {filtered.length} de {FILAMENTS.length} spools
              </span>
              {(query || materialFilters.length > 0) && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setMaterialFilters([]); }}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  <IconX size={11} /> Limpiar filtros
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <EmptyState />
            ) : view === 'grid' ? (
              <FilamentGrid
                groups={groups}
                density={t.density}
                neon={t.swatchStyle === 'neon'}
                onCardClick={setDrawerFilament}
              />
            ) : (
              <FilamentTable items={sortedFlat} onRowClick={setDrawerFilament} />
            )}
          </React.Fragment>
        ) : (
          <CategoryPlaceholder kind={tab} />
        )}

        <FooterBar stats={stats} />
      </main>

      <DetailDrawer filament={drawerFilament} onClose={() => setDrawerFilament(null)} />

      {/* tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Vista" />
        <TweakRadio
          label="Densidad"
          value={t.density}
          options={['compact', 'comfy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakRadio
          label="Vista por defecto"
          value={t.defaultView}
          options={['grid', 'table']}
          onChange={(v) => setTweak('defaultView', v)}
        />
        <TweakToggle
          label="Stock bajo primero"
          value={t.showLowFirst}
          onChange={(v) => setTweak('showLowFirst', v)}
        />
        <TweakSection label="Swatch" />
        <TweakRadio
          label="Acabado"
          value={t.swatchStyle}
          options={['glossy', 'neon']}
          onChange={(v) => setTweak('swatchStyle', v)}
        />
      </TweaksPanel>
    </div>
  );
}

// ─── empty state ────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      padding: '60px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.22)',
        color: '#3B82F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconSearch size={22} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tech-white)' }}>Sin resultados</div>
      <div style={{ fontSize: 12.5, color: 'var(--gunmetal)', textAlign: 'center', maxWidth: 360 }}>
        Ajusta los filtros o limpia la búsqueda para ver todos los spools.
      </div>
    </div>
  );
}

// ─── footer status bar ──────────────────────────────────────────────────
function FooterBar({ stats }) {
  return (
    <footer style={{
      marginTop: 'auto',
      padding: '10px 24px',
      borderTop: '1px solid var(--border-soft)',
      background: 'var(--surf-sidebar)',
      display: 'flex', alignItems: 'center', gap: 16,
      fontSize: 11,
      color: 'var(--gunmetal)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: '#34D399', boxShadow: '0 0 6px #34D39966' }} />
        <span className="mono">SYNCED · hace 12s</span>
      </span>
      <span style={{ width: 1, height: 12, background: 'var(--border)' }} />
      <span className="mono">{FILAMENTS.length} spools</span>
      <span className="mono">{(stats.totalGrams / 1000).toFixed(2)} kg</span>
      <span className="mono">{fmtCOP(stats.totalValue)}</span>
      <span style={{ flex: 1 }} />
      <span className="mono">es-CO · COP</span>
      <span style={{ width: 1, height: 12, background: 'var(--border)' }} />
      <span className="mono">CFS v0.4.2</span>
    </footer>
  );
}

// ─── mount ──────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
