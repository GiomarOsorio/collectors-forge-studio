/**
 * @file Página de inventario rediseñada (Claude Design port — Día 2).
 *
 * Reemplaza la antigua `InventoryStockPage` con un layout de pestañas:
 *  Filamentos · Insumos · Herramientas · Consumibles · Compras
 *
 * La pestaña Filamentos tiene el tratamiento completo (KPIs, toolbar con
 * search + chips de material + sort + toggle grid/table, grupos por stock
 * bajo y por material, drawer de detalle). Las otras pestañas muestran un
 * placeholder mientras se portan en días siguientes.
 *
 * Usa primitives de `components/ui/` (Card, Chip, KPI, Sparkline, Swatch,
 * DetailDrawer, Button) y el adapter `utils/inventoryAdapter.js`.
 *
 * @module pages/inventory/InventoryPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Beaker,
  Bell,
  Box,
  ChevronDown,
  ChevronRight,
  Download,
  Droplet,
  Grid3x3,
  List,
  MapPin,
  Pencil,
  Plus,
  Scissors,
  Search,
  ShoppingCart,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Chip, DetailDrawer, KPI, MobileSheet, Sparkline, Swatch } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
  getInventoryFilaments,
  getInventorySupplies,
  getInventoryItems,
  getPurchaseOrders,
} from '../../services/api';
import { MATERIALS, MATERIAL_ORDER } from '../../config/materials';
import {
  computeFilamentStats,
  fillPercent,
  fmtCOP,
  fmtG,
  fmtKg,
  groupFilaments,
  mapToFilament,
  stockLevel,
} from '../../utils/inventoryAdapter';

// Placeholder de consumo diario hasta que tengamos el endpoint real.
// 14 días, gramos por día. Cuando tengamos historial real, viene del backend.
const CONSUMPTION_PLACEHOLDER = [240, 180, 95, 310, 280, 420, 360, 145, 0, 0, 290, 510, 380, 295];

// ─── KPI Strip ───────────────────────────────────────────────────────────────

function KPIStrip({ stats, openPOs, openPOsValue }) {
  return (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Capital"
          value={`$${(stats.totalValue / 1_000_000).toFixed(2)}M`}
          unit="COP"
          sub="valor en inventario"
          accent="#3B82F6"
          icon={ArrowUpRight}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Material"
          value={(stats.totalGrams / 1000).toFixed(2)}
          unit="kg"
          sub={`${stats.spoolCount} spools`}
          accent="#94A0AE"
          icon={Droplet}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Consumo · 14d"
          value={(CONSUMPTION_PLACEHOLDER.reduce((s, n) => s + n, 0) / 1000).toFixed(2)}
          unit="kg"
          sub="placeholder · pronto desde quotes"
          accent="#2DD4BF"
          sparkline={CONSUMPTION_PLACEHOLDER}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Stock bajo"
          value={stats.lowCount}
          unit="ítems"
          sub={`${stats.criticalCount} críticos`}
          accent="#FBBF24"
          icon={AlertTriangle}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Próx. compras"
          value={openPOs}
          unit="POs"
          sub={openPOsValue > 0 ? `${fmtCOP(openPOsValue)} en ruta` : 'sin pedidos abiertos'}
          accent="#8B5CF6"
          icon={ShoppingCart}
        />
      </div>
    </div>
  );
}

// ─── Category tabs ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'filamentos',   label: 'Filamentos',   icon: Droplet },
  { id: 'insumos',      label: 'Insumos',      icon: Box },
  { id: 'herramientas', label: 'Herramientas', icon: Scissors },
  { id: 'consumibles',  label: 'Consumibles',  icon: Beaker },
  { id: 'compras',      label: 'Compras',      icon: ShoppingCart },
];

function CategoryTabs({ value, onChange, counts }) {
  return (
    <div className="flex items-center gap-0.5 px-6 border-b border-[var(--color-border)] overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        const count = counts[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors whitespace-nowrap -mb-px border-b-2 ${
              active
                ? 'text-tech-white border-[var(--color-app-inventory)]'
                : 'text-steel border-transparent hover:text-tech-white'
            }`}
          >
            <Icon size={13} className={active ? '' : 'text-gunmetal'} style={active ? { color: 'var(--color-app-inventory)' } : undefined} />
            {t.label}
            <span
              className={`mono text-[10px] px-1.5 py-px rounded-full border ${
                active
                  ? 'bg-blue-500/14 border-blue-500/30 text-blue-300'
                  : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({ query, onQuery, materialFilters, onToggleMat, view, onView, sort, onSort, onClear }) {
  return (
    <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
        <Search size={13} className="text-gunmetal shrink-0" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar color, batch, ubicación…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="text-gunmetal hover:text-tech-white"
            aria-label="Limpiar búsqueda"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Material chips */}
      <div className="flex gap-1.5 items-center flex-wrap">
        <span className="lbl-eyebrow mr-1">Material</span>
        {MATERIALS.map((m) => (
          <Chip key={m.id} active={materialFilters.includes(m.id)} onClick={() => onToggleMat(m.id)}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: m.tone, opacity: materialFilters.includes(m.id) ? 1 : 0.45 }}
            />
            {m.name}
          </Chip>
        ))}
        {(query || materialFilters.length > 0) && (
          <Button variant="ghost" size="sm" onClick={onClear} icon={X} iconSize={11}>
            Limpiar
          </Button>
        )}
      </div>

      <span className="flex-1" />

      {/* Sort */}
      <div className="relative">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="input mono text-xs pr-8 cursor-pointer w-auto min-w-[180px] appearance-none"
        >
          <option value="lowFirst">Stock bajo primero</option>
          <option value="material">Por material</option>
          <option value="valueDesc">Valor (mayor)</option>
          <option value="weightDesc">Peso restante</option>
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-gunmetal pointer-events-none" />
      </div>

      {/* View toggle */}
      <div className="inline-flex border border-[var(--color-border-strong)] rounded-md overflow-hidden bg-[var(--color-surf-card)]">
        {[
          { id: 'grid', icon: Grid3x3, label: 'Vista grid' },
          { id: 'table', icon: List, label: 'Vista tabla' },
        ].map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onView(v.id)}
              className={`px-2.5 py-1.5 transition-colors ${
                active ? 'bg-[var(--color-surf-hover)] text-tech-white' : 'text-gunmetal hover:text-tech-white'
              }`}
              aria-label={v.label}
              aria-pressed={active}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fuel gauge ──────────────────────────────────────────────────────────────

function FuelGauge({ value, level }) {
  const color = level === 'ok' ? '#3B82F6' : '#FBBF24';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="mono text-[10px] text-gunmetal tracking-wider">RESTANTE</span>
        <span className="mono text-[11px] text-tech-white">
          {Math.round(value)}
          <span className="text-gunmetal">%</span>
        </span>
      </div>
      <div className="relative h-1 bg-white/5 rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded transition-all duration-200"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: level !== 'ok' ? `0 0 6px ${color}55` : 'none',
          }}
        />
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            className="absolute -top-px -bottom-px w-px bg-forge-black/90"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Filament card (grid) ────────────────────────────────────────────────────

function FilamentCard({ f, onClick }) {
  const level = stockLevel(f);
  const p = fillPercent(f);
  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(f)}
      className="relative flex flex-col gap-3 p-3.5 text-left w-full"
    >
      {/* Top: swatch + meta */}
      <div className="flex gap-3 items-start">
        <Swatch color={f.color} size={48} level={level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {f.material}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-0.5 text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                <AlertTriangle size={9} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white leading-snug truncate" title={f.colorName}>
            {f.colorName}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">
            {f.vendor}
            {f.batch ? ` · ${f.batch}` : ''}
          </p>
        </div>
      </div>

      <FuelGauge value={p} level={level} />

      <div className="flex justify-between items-end gap-2.5 border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <div className="flex flex-col min-w-0">
          <span className="lbl-eyebrow text-[9px]">Peso</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">
            {fmtG(f.remaining)}
            <span className="text-gunmetal">/{fmtKg(f.total)}</span>
          </span>
        </div>
        <div className="flex flex-col items-end min-w-0">
          <span className="lbl-eyebrow text-[9px]">Costo/kg</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">{fmtCOP(f.costPerKg)}</span>
        </div>
      </div>

      {f.location && (
        <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] text-gunmetal">
          <MapPin size={10} />
          <span className="mono">{f.location.split(' · ').slice(-1)[0]}</span>
        </div>
      )}
    </Card>
  );
}

// ─── Grid grouped by stock level + material ─────────────────────────────────

function FilamentGrid({ groups, onCardClick }) {
  return (
    <div className="flex flex-col gap-6 px-6 pt-2 pb-8">
      {groups.map((g) => (
        <section key={g.key}>
          <div
            className={`flex items-baseline gap-2.5 mb-2.5 pb-1.5 border-b ${
              g.warn ? 'border-amber-400/25' : 'border-[var(--color-border-soft)]'
            }`}
          >
            <h3
              className={`text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                g.warn ? 'text-amber-400' : 'text-steel'
              }`}
            >
              {g.warn && <AlertTriangle size={11} />}
              {g.label}
            </h3>
            <span className="mono text-[10.5px] text-gunmetal">
              {g.items.length} {g.items.length === 1 ? 'spool' : 'spools'}
            </span>
          </div>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
          >
            {g.items.map((f) => (
              <FilamentCard key={f.id} f={f} onClick={onCardClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Table view ──────────────────────────────────────────────────────────────

function FilamentTable({ items, onRowClick }) {
  return (
    <div className="px-6 pb-8">
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surf-card)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['', 'Color · Batch', 'Material', 'Vendor', 'Restante', 'Costo/kg', 'Ubicación'].map((h, idx) => (
                <th
                  key={idx}
                  className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gunmetal px-3 py-2.5 border-b border-[var(--color-border)] bg-forge-black sticky top-0 z-[1]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((f) => {
              const level = stockLevel(f);
              const p = fillPercent(f);
              return (
                <tr
                  key={f.id}
                  onClick={() => onRowClick(f)}
                  className="cursor-pointer hover:bg-[var(--color-surf-hover)]/60 transition-colors border-b border-[var(--color-border-soft)] last:border-b-0"
                >
                  <td className="px-3 py-3 w-[44px]">
                    <Swatch color={f.color} size={26} level={level} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-tech-white truncate">{f.colorName}</div>
                    <div className="mono text-[11px] text-gunmetal">{f.batch || '—'}</div>
                  </td>
                  <td className="px-3 py-3 w-[80px]">
                    <span className="mono text-[10.5px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
                      {f.material}
                    </span>
                  </td>
                  <td className="px-3 py-3 w-[110px] mono text-xs text-steel">{f.vendor}</td>
                  <td className="px-3 py-3 w-[180px]">
                    <div className="flex flex-col gap-1">
                      <span className="mono text-xs text-tech-white">
                        {fmtG(f.remaining)} <span className="text-gunmetal">/ {fmtKg(f.total)}</span>
                      </span>
                      <div className="h-0.5 bg-white/5 rounded">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${p}%`,
                            background: level === 'ok' ? '#3B82F6' : '#FBBF24',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 w-[110px] mono text-xs text-tech-white">{fmtCOP(f.costPerKg)}</td>
                  <td className="px-3 py-3 mono text-[11px] text-steel">{f.location || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Drawer body ─────────────────────────────────────────────────────────────

function FilamentDrawerBody({ f }) {
  if (!f) return null;
  const level = stockLevel(f);
  const p = fillPercent(f);
  const remainValueCop = (f.remaining / 1000) * f.costPerKg;

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Hero */}
      <div className="flex items-center gap-4">
        <Swatch color={f.color} size={72} level={level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel">
              {f.material}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <AlertTriangle size={10} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-tech-white tracking-tight">{f.colorName}</h2>
          <p className="mono text-[11.5px] text-gunmetal mt-1 truncate">
            {f.vendor}
            {f.batch ? ` · ${f.batch}` : ''}
            {f.color ? ` · ${f.color}` : ''}
          </p>
        </div>
      </div>

      <FuelGauge value={p} level={level} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 flex flex-col gap-1">
          <span className="lbl-eyebrow text-[9px]">Restante</span>
          <span className="mono text-base text-tech-white">{fmtG(f.remaining)}</span>
          <span className="mono text-[11px] text-gunmetal">de {fmtKg(f.total)}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1">
          <span className="lbl-eyebrow text-[9px]">Valor restante</span>
          <span className="mono text-base text-tech-white">{fmtCOP(remainValueCop)}</span>
          <span className="mono text-[11px] text-gunmetal">{fmtCOP(f.costPerKg)} / kg</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1">
          <span className="lbl-eyebrow text-[9px]">Ubicación</span>
          <span className="mono text-sm text-tech-white">{f.location || '—'}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1">
          <span className="lbl-eyebrow text-[9px]">Mínimo</span>
          <span className="mono text-sm text-tech-white">
            {f.minQuantity ? `${fmtG(f.minQuantity)} ${f.unit}` : '—'}
          </span>
        </Card>
      </div>

      {f.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{f.notes}</p>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="primary" icon={Pencil} className="flex-1">
          Editar
        </Button>
        <Button variant="ghost" icon={ShoppingCart} className="flex-1">
          Agregar a compras
        </Button>
      </div>

      <p className="text-[11px] text-gunmetal">
        Editor inline disponible pronto. Por ahora edita desde la página antigua de inventario.
      </p>
    </div>
  );
}

// ─── Mobile shell ────────────────────────────────────────────────────────────
// Nota: el header (logo + hamburger) lo provee AppLayout vía Studio Sidebar.
// Esta vista sólo renderiza el contenido específico del inventario.

function MobileHeroStatus({ stats }) {
  const lowPct = stats.spoolCount > 0 ? (stats.lowCount / stats.spoolCount) * 100 : 0;
  return (
    <div className="mx-4 mt-3">
      <Card className="p-4 flex flex-col gap-3 industrial-grid">
        <div className="flex items-baseline justify-between">
          <span className="lbl-eyebrow">Estado del taller</span>
          <span className="mono text-[10px] text-gunmetal">{stats.spoolCount} spools</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mono text-3xl font-semibold text-tech-white tracking-tight">
            {(stats.totalGrams / 1000).toFixed(2)}
          </span>
          <span className="mono text-sm text-gunmetal">kg de material</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="lbl-eyebrow text-[9px]">Capital</span>
            <span className="mono text-sm text-tech-white">
              ${(stats.totalValue / 1_000_000).toFixed(2)}M
            </span>
          </div>
          <div className="flex flex-col">
            <span className="lbl-eyebrow text-[9px]">Stock bajo</span>
            <span
              className={`mono text-sm ${stats.criticalCount > 0 ? 'text-amber-400' : 'text-tech-white'}`}
            >
              {stats.lowCount}{' '}
              <span className="text-gunmetal text-[10px]">({stats.criticalCount} crít.)</span>
            </span>
          </div>
        </div>
        {/* Mini barra global stock-bajo */}
        <div className="relative h-1 bg-white/5 rounded">
          <div
            className="absolute inset-y-0 left-0 rounded transition-all"
            style={{
              width: `${lowPct}%`,
              background: lowPct > 0 ? '#FBBF24' : '#3B82F6',
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function MobileMiniKPIs({ stats, openPOs }) {
  const items = [
    { label: 'Spools', value: stats.spoolCount, accent: '#3B82F6' },
    { label: 'Críticos', value: stats.criticalCount, accent: '#FBBF24' },
    { label: 'Bajos', value: stats.lowCount - stats.criticalCount, accent: '#FBBF24' },
    { label: 'POs abiertas', value: openPOs, accent: '#8B5CF6' },
  ];
  return (
    <div className="px-4 mt-3 flex gap-2 overflow-x-auto pb-1 -mb-1 snap-x">
      {items.map((it) => (
        <div
          key={it.label}
          className="card flex flex-col gap-0.5 px-3 py-2 min-w-[110px] snap-start shrink-0"
        >
          <span className="lbl-eyebrow text-[9px]">{it.label}</span>
          <span className="mono text-base font-semibold text-tech-white">{it.value}</span>
          <span
            className="block w-6 h-0.5 rounded mt-0.5"
            style={{ background: it.accent }}
          />
        </div>
      ))}
    </div>
  );
}

function MobileTabs({ value, onChange, counts }) {
  return (
    <div className="mt-3 px-4 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
              active
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-transparent border-[var(--color-border)] text-steel'
            }`}
          >
            <Icon size={12} />
            {t.label}
            <span className="mono text-[10px] text-gunmetal">{counts[t.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileSearchBar({ query, onQuery }) {
  return (
    <div className="px-4 mt-3">
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
        <Search size={14} className="text-gunmetal" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Color, batch, ubicación…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="text-gunmetal hover:text-tech-white"
            aria-label="Limpiar"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function MobileChips({ materialFilters, onToggleMat }) {
  return (
    <div className="px-4 mt-2 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
      {MATERIALS.map((m) => {
        const active = materialFilters.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggleMat(m.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
              active
                ? 'bg-blue-500/12 border-blue-500/45 text-blue-300'
                : 'bg-transparent border-[var(--color-border)] text-steel'
            }`}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: m.tone, opacity: active ? 1 : 0.45 }}
            />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function FilamentRow({ f, onClick }) {
  const level = stockLevel(f);
  const p = fillPercent(f);
  return (
    <button
      type="button"
      onClick={() => onClick(f)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <Swatch color={f.color} size={36} level={level} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="mono text-[9.5px] px-1 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
            {f.material}
          </span>
          {level !== 'ok' && (
            <span className="mono text-[9.5px] px-1 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400">
              {level === 'critical' ? 'CRÍT' : 'BAJO'}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-tech-white truncate leading-tight">
          {f.colorName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="relative h-0.5 bg-white/5 rounded flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded"
              style={{ width: `${p}%`, background: level === 'ok' ? '#3B82F6' : '#FBBF24' }}
            />
          </div>
          <span className="mono text-[10px] text-gunmetal shrink-0">{Math.round(p)}%</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="mono text-xs text-tech-white">{fmtG(f.remaining)}</span>
        <span className="mono text-[10px] text-gunmetal">{fmtCOP(f.costPerKg)}/kg</span>
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

function MobileFAB({ onClick, label = 'Agregar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-forge-teal text-[#0A1014] font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
      style={{ boxShadow: '0 8px 24px rgba(45, 212, 191, 0.35)' }}
      aria-label={label}
    >
      <Plus size={16} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Página principal de inventario.
 *
 * @returns {JSX.Element}
 */
export default function InventoryPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('filamentos');
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [materialFilters, setMaterialFilters] = useState([]);
  const [sort, setSort] = useState('lowFirst');
  const [selected, setSelected] = useState(null);

  const [filaments, setFilaments] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [tools, setTools] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial: todos los conteos en paralelo (la pestaña activa los necesita
  // para los badges; las inactivas se mantienen sincronizadas para no esperar
  // al cambiar de tab).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        getInventoryFilaments(),
        getInventorySupplies(),
        getInventoryItems({ params: { category: 'Herramienta' } }),
        getInventoryItems({ params: { category: 'Consumible' } }),
        getPurchaseOrders(),
      ]);
      if (cancelled) return;
      const [filRes, supRes, toolRes, consRes, poRes] = results;
      if (filRes.status === 'fulfilled') {
        setFilaments((filRes.value.data || []).map(mapToFilament));
      }
      if (supRes.status === 'fulfilled') {
        // Supplies retorna inventory items sin filtro de categoría;
        // descartamos los filamentos para no duplicar.
        const items = (supRes.value.data || []).filter((i) => i.category !== 'Filamento');
        setSupplies(items.filter((i) => i.category === 'Insumo'));
      }
      if (toolRes.status === 'fulfilled') {
        setTools(toolRes.value.data || []);
      }
      if (consRes.status === 'fulfilled') {
        setConsumables(consRes.value.data || []);
      }
      if (poRes.status === 'fulfilled') {
        setPurchases(poRes.value.data || []);
      }
      setLoading(false);
    };
    load().catch((err) => {
      if (cancelled) return;
      console.error(err);
      toast.error('No se pudo cargar el inventario');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtrado + sorting de filamentos
  const filteredFilaments = useMemo(() => {
    let list = filaments;
    if (materialFilters.length) {
      list = list.filter((f) => materialFilters.includes(f.material));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.colorName.toLowerCase().includes(q) ||
          f.batch.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          f.material.toLowerCase().includes(q) ||
          f.vendor.toLowerCase().includes(q),
      );
    }
    const arr = [...list];
    switch (sort) {
      case 'lowFirst':
        arr.sort((a, b) => fillPercent(a) - fillPercent(b));
        break;
      case 'valueDesc':
        arr.sort(
          (a, b) => (b.remaining / 1000) * b.costPerKg - (a.remaining / 1000) * a.costPerKg,
        );
        break;
      case 'weightDesc':
        arr.sort((a, b) => b.remaining - a.remaining);
        break;
      case 'material':
      default:
        arr.sort(
          (a, b) => MATERIAL_ORDER.indexOf(a.material) - MATERIAL_ORDER.indexOf(b.material),
        );
    }
    return arr;
  }, [filaments, materialFilters, query, sort]);

  const groups = useMemo(() => {
    if (sort === 'lowFirst') return groupFilaments(filteredFilaments, MATERIAL_ORDER);
    return [{ key: 'all', label: 'Resultados', items: filteredFilaments, warn: false }];
  }, [filteredFilaments, sort]);

  const stats = useMemo(() => computeFilamentStats(filaments), [filaments]);

  const openPOs = useMemo(
    () => purchases.filter((p) => (p.status || '').toLowerCase() !== 'completado').length,
    [purchases],
  );
  const openPOsValue = useMemo(
    () =>
      purchases
        .filter((p) => (p.status || '').toLowerCase() !== 'completado')
        .reduce((s, p) => s + Number(p.total || 0), 0),
    [purchases],
  );

  const counts = {
    filamentos: filaments.length,
    insumos: supplies.length,
    herramientas: tools.length,
    consumibles: consumables.length,
    compras: purchases.length,
  };

  const toggleMat = (id) =>
    setMaterialFilters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const clearFilters = () => {
    setQuery('');
    setMaterialFilters([]);
  };

  // ── Shell mobile ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col -mx-4 -mt-4">
        {tab === 'filamentos' && (
          <>
            <MobileHeroStatus stats={stats} />
            <MobileMiniKPIs stats={stats} openPOs={openPOs} />
          </>
        )}
        <MobileTabs value={tab} onChange={setTab} counts={counts} />

        {tab === 'filamentos' ? (
          <>
            <MobileSearchBar query={query} onQuery={setQuery} />
            <MobileChips materialFilters={materialFilters} onToggleMat={toggleMat} />
            <div className="flex items-center justify-between px-4 mt-3 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {filteredFilaments.length} de {filaments.length} spools
              </span>
              {(query || materialFilters.length > 0) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-blue-400 hover:text-blue-300"
                >
                  Limpiar
                </button>
              )}
            </div>
            {loading ? (
              <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando inventario…</p>
            ) : filteredFilaments.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
                <Search size={22} className="text-gunmetal-dim" />
                <p className="text-sm font-semibold text-tech-white">
                  {filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
                </p>
                <p className="text-xs text-gunmetal max-w-xs">
                  {filaments.length === 0
                    ? 'Toca el botón + para agregar el primer filamento.'
                    : 'Ajusta los filtros o limpia la búsqueda.'}
                </p>
              </div>
            ) : (
              <ul className="mt-2 pb-28">
                {filteredFilaments.map((f) => (
                  <li key={f.id}>
                    <FilamentRow f={f} onClick={setSelected} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <TabPlaceholder tab={tab} />
        )}

        <MobileFAB onClick={() => navigate('/inventory/stock?new=1')} />

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.colorName}
          height="full"
        >
          <FilamentDrawerBody f={selected} />
        </MobileSheet>
      </div>
    );
  }

  // ── Shell desktop ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3B82F6',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <Box size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Inventario</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">
            {tab}
          </span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/6 border border-[var(--color-border)] text-steel tracking-wider whitespace-nowrap shrink-0 ml-1">
            {counts[tab] ?? 0} ítems
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/inventory/io" className="btn btn-ghost btn-sm">
            <Upload size={13} /> Importar
          </Link>
          <Link to="/inventory/io" className="btn btn-ghost btn-sm">
            <Download size={13} /> Exportar
          </Link>
          <span className="w-px h-4 bg-[var(--color-border)]" />
          <Button variant="ghost" iconOnly icon={Bell} iconSize={14} aria-label="Notificaciones" />
          <Link to="/inventory/stock?new=1" className="btn btn-primary btn-sm">
            <Plus size={13} /> Agregar
          </Link>
        </div>
      </header>

      <KPIStrip stats={stats} openPOs={openPOs} openPOsValue={openPOsValue} />

      <CategoryTabs value={tab} onChange={setTab} counts={counts} />

      {tab === 'filamentos' ? (
        <>
          <Toolbar
            query={query}
            onQuery={setQuery}
            materialFilters={materialFilters}
            onToggleMat={toggleMat}
            view={view}
            onView={setView}
            sort={sort}
            onSort={setSort}
            onClear={clearFilters}
          />

          <div className="flex items-center gap-2.5 px-6 mb-1">
            <span className="mono text-[11px] text-gunmetal">
              {filteredFilaments.length} de {filaments.length} spools
            </span>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-gunmetal text-sm">Cargando inventario…</div>
          ) : filteredFilaments.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.22)',
                  color: '#3B82F6',
                }}
              >
                <Search size={22} />
              </div>
              <p className="text-sm font-semibold text-tech-white">
                {filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
              </p>
              <p className="text-xs text-gunmetal max-w-sm">
                {filaments.length === 0
                  ? 'Agrega un filamento para empezar a usarlo en la calculadora y la cola.'
                  : 'Ajusta los filtros o limpia la búsqueda para ver todos los spools.'}
              </p>
              {filaments.length === 0 && (
                <Link to="/inventory/stock?new=1" className="btn btn-primary btn-sm">
                  <Plus size={13} /> Agregar primer filamento
                </Link>
              )}
            </div>
          ) : view === 'grid' ? (
            <FilamentGrid groups={groups} onCardClick={setSelected} />
          ) : (
            <FilamentTable items={filteredFilaments} onRowClick={setSelected} />
          )}
        </>
      ) : (
        <TabPlaceholder tab={tab} />
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.rawId : ''}
        width={460}
      >
        <FilamentDrawerBody f={selected} />
      </DetailDrawer>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{filaments.length} spools</span>
        <span className="mono">{(stats.totalGrams / 1000).toFixed(2)} kg</span>
        <span className="mono">{fmtCOP(stats.totalValue)}</span>
        <span className="flex-1" />
        <span className="mono">es-CO · COP</span>
      </footer>
    </div>
  );
}

function TabPlaceholder({ tab }) {
  const map = {
    insumos: { to: '/inventory/supplies', label: 'Insumos' },
    herramientas: { to: '/inventory/tools', label: 'Herramientas' },
    consumibles: { to: '/inventory/consumables', label: 'Consumibles' },
    compras: { to: '/inventory/purchases', label: 'Pedidos de compra' },
  };
  const target = map[tab];
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <p className="text-sm font-semibold text-tech-white">Vista en construcción</p>
      <p className="text-xs text-gunmetal max-w-sm">
        Esta pestaña se portará al nuevo diseño en los próximos días. Mientras tanto se mantiene
        funcional la página antigua.
      </p>
      {target && (
        <Link to={target.to} className="btn btn-ghost btn-sm">
          Ir a {target.label} (vista antigua)
        </Link>
      )}
    </div>
  );
}
